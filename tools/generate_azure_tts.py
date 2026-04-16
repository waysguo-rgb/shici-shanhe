"""
用 Microsoft Azure TTS 批量生成诗词朗诵 MP3

前置条件:
  1. Azure 订阅 (免费账户可用): https://portal.azure.com/
  2. 创建 "语音服务 Speech" 资源
  3. 在资源页面找到 Key 和 Region (如 eastasia, eastus)
  4. pip install requests

设置环境变量 (Windows PowerShell):
  $env:AZURE_SPEECH_KEY="你的Key"
  $env:AZURE_SPEECH_REGION="eastasia"

设置环境变量 (Linux/Mac):
  export AZURE_SPEECH_KEY="你的Key"
  export AZURE_SPEECH_REGION="eastasia"

运行:
  python assets/audio/generate_azure_tts.py               # 生成全部 165 首
  python assets/audio/generate_azure_tts.py --sample      # 只生成前 3 首测试
  python assets/audio/generate_azure_tts.py --only 长安    # 只生成指定地点
  python assets/audio/generate_azure_tts.py --only 长安,洛阳
  python assets/audio/generate_azure_tts.py --force       # 强制覆盖已生成的
  python assets/audio/generate_azure_tts.py --voice YunxiNeural   # 全部用指定音色

特点:
  - 按作者自动分派合适的音色 (豪放男声 / 婉约女声 / 沉郁苍凉)
  - 使用 Azure 神经网络音色的 <mstts:express-as style="poetry-reading"> 情感风格
  - SSML 句间停顿 + 节奏控制
  - 断点续传: 已生成的文件自动跳过
  - 免费额度: 每月 50 万字符 (标准神经网络) / 20 万 (情感风格)
    165 首诗总字符数约 20000, 远低于额度上限
"""
import os
import sys
import json
import time
import argparse
from pathlib import Path

try:
    import requests
except ImportError:
    print('错误: 缺少 requests 库')
    print('请运行: pip install requests')
    sys.exit(1)

# ────────────────────────────────────────
# 路径配置
# ────────────────────────────────────────
HERE = Path(__file__).parent
ROOT = HERE.parent.parent
LOCATIONS_JSON = ROOT / 'assets' / 'locations' / 'locations.json'
AUDIO_DIR = ROOT / 'assets' / 'audio'

# ────────────────────────────────────────
# Azure 配置
# ────────────────────────────────────────
SPEECH_KEY = os.getenv('AZURE_SPEECH_KEY', '').strip()
SPEECH_REGION = os.getenv('AZURE_SPEECH_REGION', 'eastasia').strip()

if not SPEECH_KEY:
    print('错误: 未设置环境变量 AZURE_SPEECH_KEY')
    print()
    print('Windows (PowerShell):')
    print('  $env:AZURE_SPEECH_KEY="你的Key"')
    print('  $env:AZURE_SPEECH_REGION="eastasia"')
    print()
    print('Linux/Mac:')
    print('  export AZURE_SPEECH_KEY="你的Key"')
    print('  export AZURE_SPEECH_REGION="eastasia"')
    print()
    print('Key 和 Region 在 Azure Portal 的 "语音服务 Speech" 资源页面找')
    sys.exit(1)

ENDPOINT = f'https://{SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1'
OUTPUT_FORMAT = 'audio-24khz-96kbitrate-mono-mp3'

# ────────────────────────────────────────
# 风格分派规则: 全部用 XiaoxiaoNeural 女声, 按诗意选情感风格
# 可用风格: poetry-reading / gentle / lyrical / affectionate / sad / calm / narration-relaxed
# ────────────────────────────────────────
VOICE = 'zh-CN-XiaoxiaoNeural'

# sad 风格: 悼亡、亡国、怀古、哀伤
SAD_POEMS = {
    # (location, title) 精确匹配
    ('金陵', '虞美人'),           # 李煜 亡国之恨
    ('金陵', '乌衣巷'),           # 刘禹锡 怀古
    ('金陵', '泊秦淮'),           # 杜牧 亡国之叹
    ('金陵', '桂枝香·金陵怀古'),   # 王安石
    ('金陵', '登金陵凤凰台'),      # 李白 怀古
    ('潼关', '山坡羊·潼关怀古'),   # 张养浩
    ('汴京', '雨霖铃'),           # 柳永 离别
    ('汴京', '如梦令'),           # 李清照
    ('长安', '长恨歌'),           # 白居易 悲剧
    ('长安', '春望'),             # 杜甫 国破
    ('越州', '钗头凤·红酥手'),    # 陆游 悲剧爱情
    ('越州', '示儿'),             # 陆游 临终
    ('岳阳', '岳阳楼记'),         # 先天下之忧而忧
    ('白帝城', '登高'),           # 杜甫 凄凉
    ('密州', '江城子·乙卯正月二十日夜记梦'),  # 苏轼 悼亡妻
    ('潭州', '江南逢李龟年'),      # 杜甫 衰老飘零
    ('巴山', '锦瑟'),             # 李商隐 追忆
    ('赣州', '过零丁洋'),         # 文天祥 赴死
    ('赣州', '正气歌'),
    ('郴州', '踏莎行·郴州旅舍'),   # 秦观 贬谪
    ('永州', '小石潭记'),         # 柳宗元 贬谪凄清
    ('永州', '江雪'),             # 柳宗元 孤独
    ('浔阳', '琵琶行'),           # 白居易 同是天涯沦落人
    ('黄鹤楼', '黄鹤楼'),         # 崔颢 日暮乡关
    ('黄州', '念奴娇·赤壁怀古'),   # 苏轼 人生如梦
}

# gentle 风格: 婉约词、相思、柔情、女性视角
GENTLE_POEMS = {
    ('长安', '清平调'),           # 李白 美人
    ('长安', '九月九日忆山东兄弟'),  # 王维 思乡
    ('长安', '乐游原'),           # 李商隐 夕阳
    ('苏州', '枫桥夜泊'),         # 张继 愁思
    ('苏州', '忆江南'),           # 白居易
    ('苏州', '横塘'),             # 范成大
    ('秦州', '月夜忆舍弟'),       # 杜甫 思念
    ('秦州', '月夜'),             # 杜甫 思妻
    ('洛阳', '春夜洛城闻笛'),     # 李白 思乡
    ('洛阳', '秋思'),             # 张籍
    ('洛阳', '洛阳女儿行'),       # 王维 女性
    ('渭城', '送元二使安西'),     # 王维 送别
    ('巴山', '夜雨寄北'),         # 李商隐 思人
    ('蓝关', '蓝桥驿见元九诗'),   # 白居易 怀友
    ('杭州', '饮湖上初晴后雨'),   # 苏轼 美景
    ('杭州', '苏堤春晓'),         # 杨周
    ('扬州', '寄扬州韩绰判官'),   # 杜牧
    ('合肥', '淡黄柳'),           # 姜夔
    ('郴州', '鹊桥仙'),           # 秦观 柔情
    ('邯郸', '逢入京使'),         # 岑参 思乡
    ('邯郸', '邯郸冬至夜思家'),   # 白居易 思家
    ('浔阳', '暮江吟'),           # 白居易
    ('福州', '乌山'),
    ('福州', '福州'),
    ('金陵', '泊秦淮'),           # 已在 sad
    ('池州', '清明'),             # 杜牧 悲凉
    ('滁州', '丰乐亭游春'),
    ('天姥山', '天台晓望'),       # 李白
    ('岳阳', '望洞庭'),           # 刘禹锡
    ('镇江', '泊船瓜洲'),         # 王安石 思乡
    ('宣城', '独坐敬亭山'),       # 李白
    ('宣城', '秋登宣城谢朓北楼'),
    ('蓝关', '左迁至蓝关示侄孙湘'),  # 韩愈
}

# calm 风格: 山水田园、闲适
CALM_POEMS = {
    ('终南山', '终南山'),         # 王维
    ('终南山', '终南别业'),       # 王维
    ('终南山', '鹿柴'),           # 王维
    ('襄阳', '春晓'),             # 孟浩然
    ('襄阳', '过故人庄'),         # 孟浩然 田园
    ('襄阳', '临洞庭湖赠张丞相'),  # 孟浩然
    ('越州', '游山西村'),         # 陆游
    ('杭州', '钱塘湖春行'),       # 白居易
    ('杭州', '晓出净慈寺送林子方'),  # 杨万里
    ('苏州', '题破山寺后禅院'),   # 常建
    ('永州', '渔翁'),             # 柳宗元
    ('永州', '溪居'),             # 柳宗元
    ('滁州', '醉翁亭记'),         # 欧阳修 闲适
    ('峨眉山', '峨眉山月歌'),     # 李白
    ('峨眉山', '登峨眉山'),       # 李白
    ('庐山', '饮酒'),             # 陶渊明
    ('庐山', '题西林壁'),         # 苏轼 哲理
    ('池州', '九日齐山登高'),     # 杜牧
    ('成都', '春夜喜雨'),         # 杜甫 喜悦
    ('成都', '江畔独步寻花'),     # 杜甫
    ('黄州', '定风波'),           # 苏轼 豁达
}

# narration-relaxed 风格: 长叙事诗、歌行、散文
NARRATION_POEMS = {
    ('汉中', '蜀道难'),
    ('长安', '长恨歌'),           # 可以 sad 也可以 narration, 用 narration 更有故事感
    ('许昌', '短歌行'),           # 曹操
    ('许昌', '观沧海'),
    ('许昌', '龟虽寿'),
    ('天姥山', '梦游天姥吟留别'), # 李白 长篇
    ('南昌', '滕王阁序'),         # 骈文
    ('金陵', '登金陵凤凰台'),
    ('成都', '茅屋为秋风所破歌'), # 杜甫 叙事
    ('浔阳', '琵琶行'),
    ('潼关', '潼关吏'),           # 杜甫 叙事
    ('汴京', '清明上河'),
}

# affectionate 风格: 爱情、深情
AFFECTIONATE_POEMS = {
    ('巴山', '锦瑟'),
    ('巴山', '夜雨寄北'),
    ('金陵', '虞美人'),
}

def pick_voice(poem, override=None, location=None):
    """全部 XiaoxiaoNeural 女声, 按诗意选情感风格"""
    if override:
        return (f'zh-CN-{override}', 'poetry-reading', 0.86)

    key = (location, poem.get('title', ''))

    # sad 优先
    if key in SAD_POEMS:
        return (VOICE, 'sad', 0.82)
    # 长叙事用 narration-relaxed (更轻松不犯困)
    if key in NARRATION_POEMS:
        return (VOICE, 'narration-relaxed', 0.90)
    # 柔情抒情
    if key in GENTLE_POEMS:
        return (VOICE, 'gentle', 0.86)
    # 田园山水
    if key in CALM_POEMS:
        return (VOICE, 'calm', 0.88)
    # 默认诗词风格 (端庄大气)
    return (VOICE, 'poetry-reading', 0.86)

# ────────────────────────────────────────
# SSML 构建
# ────────────────────────────────────────
def escape_xml(s):
    return (s.replace('&', '&amp;')
             .replace('<', '&lt;')
             .replace('>', '&gt;')
             .replace('"', '&quot;')
             .replace("'", '&apos;'))

def build_ssml(poem, voice, style, rate):
    """
    构造 SSML, 包含:
    - 标题+朝代+作者开场
    - 每句诗之间 500ms 停顿
    - express-as 情感风格 (styledegree 1.0 不过度强调, 避免回音感)
    - prosody rate 控制整体语速
    """
    title = escape_xml(poem['title'])
    author = escape_xml(poem['author'])
    dynasty = escape_xml(poem['dynasty'])
    lines = [escape_xml(l) for l in poem['lines']]

    # 开场白: 修掉 "现代代" bug — 朝代已经带"代"字时不再加"代"
    if dynasty.endswith('代'):
        dyn_text = dynasty
    else:
        dyn_text = dynasty + '代'
    intro = f'{title}。{dyn_text}，{author}。'

    # 诗句: 每句之间 400ms 停顿, 句末 700ms
    body_parts = []
    for i, line in enumerate(lines):
        body_parts.append(f'{line}。')
        if i < len(lines) - 1:
            body_parts.append('<break time="400ms"/>')
        else:
            body_parts.append('<break time="700ms"/>')
    body = ''.join(body_parts)

    rate_pct = f'{int((rate - 1) * 100):+d}%'  # 0.86 -> "-14%"

    if style:
        # styledegree 1.0 (正常强度), 避免 1.3 造成的过度情感和回音感
        content = (
            f'<mstts:express-as style="{style}" styledegree="1.0">'
            f'<prosody rate="{rate_pct}">'
            f'{intro}<break time="600ms"/>'
            f'{body}'
            f'</prosody>'
            f'</mstts:express-as>'
        )
    else:
        content = (
            f'<prosody rate="{rate_pct}">'
            f'{intro}<break time="600ms"/>'
            f'{body}'
            f'</prosody>'
        )

    ssml = (
        f'<speak version="1.0" '
        f'xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xmlns:mstts="https://www.w3.org/2001/mstts" '
        f'xml:lang="zh-CN">'
        f'<voice name="{voice}">'
        f'{content}'
        f'</voice>'
        f'</speak>'
    )
    return ssml

# ────────────────────────────────────────
# Azure TTS API 调用
# ────────────────────────────────────────
def synthesize(ssml, out_path, retries=5):
    headers = {
        'Ocp-Apim-Subscription-Key': SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
        'User-Agent': 'poetry-map-tts-gen/1.0',
    }
    last_err = None
    for attempt in range(retries):
        try:
            r = requests.post(
                ENDPOINT,
                headers=headers,
                data=ssml.encode('utf-8'),
                timeout=45,
            )
            if r.status_code == 200:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(r.content)
                return len(r.content)
            else:
                last_err = f'HTTP {r.status_code}: {r.text[:200]}'
                # 429 / 401 (Azure F0 层级限流有时假扮 401) / 503 → 指数退避后重试
                if r.status_code in (401, 429, 503):
                    wait = 3.0 * (attempt + 1)
                    time.sleep(wait)
                    continue
                # 400 (SSML 语法错误) / 403 (权限错误) → 不重试
                if r.status_code in (400, 403):
                    break
        except requests.RequestException as e:
            last_err = str(e)
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(last_err)

# ────────────────────────────────────────
# 主函数
# ────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Azure TTS 批量生成诗词朗诵')
    parser.add_argument('--force', action='store_true', help='强制重新生成已存在的文件')
    parser.add_argument('--only', help='只生成指定地点, 用逗号分隔')
    parser.add_argument('--sample', action='store_true', help='只生成前 3 首测试')
    parser.add_argument('--voice', help='强制使用指定音色 (不带 zh-CN- 前缀), 如 XiaoxiaoNeural')
    parser.add_argument('--dry-run', action='store_true', help='只打印将要做什么, 不实际调用 API')
    args = parser.parse_args()

    if not LOCATIONS_JSON.exists():
        print(f'错误: 找不到 {LOCATIONS_JSON}')
        print('请先运行 python assets/extract_poems.py 生成 locations.json')
        sys.exit(1)

    with open(LOCATIONS_JSON, 'r', encoding='utf-8') as f:
        locations = json.load(f)

    only_set = set(args.only.split(',')) if args.only else None

    # 展开所有 (地点, 诗) 对
    tasks = []
    for loc in locations:
        if only_set and loc['name'] not in only_set:
            continue
        for p in loc['poems']:
            tasks.append((loc['name'], p))

    if args.sample:
        tasks = tasks[:3]

    if not tasks:
        print('没有匹配的任务')
        return

    total = len(tasks)
    ok = 0
    skip = 0
    fail = 0
    bytes_total = 0
    chars_total = 0
    failures = []

    print(f'待生成: {total} 首')
    print(f'Region: {SPEECH_REGION}')
    print(f'输出目录: {AUDIO_DIR}')
    print(f'Endpoint: {ENDPOINT}')
    if args.dry_run:
        print('(DRY RUN - 不实际调用 API)')
    print('=' * 70)

    start_time = time.time()

    for i, (loc_name, poem) in enumerate(tasks):
        title = poem['title']
        out_path = AUDIO_DIR / loc_name / f'{title}.mp3'

        if out_path.exists() and not args.force:
            skip += 1
            print(f'[{i+1:3}/{total}] · 已存在: {loc_name}/{title}.mp3')
            continue

        voice, style, rate = pick_voice(poem, override=args.voice, location=loc_name)
        ssml = build_ssml(poem, voice, style, rate)

        # 估算字符数 (SSML 标签不计费, 仅文本)
        plain_chars = len(poem['title'] + poem['dynasty'] + poem['author'] + ''.join(poem['lines']))
        chars_total += plain_chars

        if args.dry_run:
            print(f'[{i+1:3}/{total}] · {loc_name}/{title} | {voice} [{style or "plain"}] rate {rate}')
            continue

        voice_short = voice.replace('zh-CN-', '')
        style_tag = f'[{style}]' if style else ''
        try:
            size = synthesize(ssml, out_path)
            ok += 1
            bytes_total += size
            print(f'[{i+1:3}/{total}] ✓ {loc_name}/{title} | {voice_short} {style_tag} | {size//1024}KB')
        except Exception as e:
            fail += 1
            failures.append((loc_name, title, str(e)))
            print(f'[{i+1:3}/{total}] ✗ {loc_name}/{title} | {e}')

        # 避免触发 QPS 限制, 每请求后睡一会儿 (F0 免费层限流较严, 2.0s 稳妥)
        time.sleep(2.0)

    elapsed = time.time() - start_time
    print('=' * 70)
    print(f'完成: 成功 {ok}, 跳过 {skip}, 失败 {fail}')
    if bytes_total:
        print(f'生成音频总大小: {bytes_total / 1024 / 1024:.1f} MB')
    print(f'耗时: {elapsed:.1f} 秒')
    if chars_total and not args.dry_run:
        print(f'本次消耗字符数: 约 {chars_total} (每月免费额度 200000 字符)')
    if failures:
        print('\n失败明细:')
        for loc, title, err in failures[:15]:
            print(f'  {loc}/{title}: {err[:120]}')
        if len(failures) > 15:
            print(f'  ... 还有 {len(failures)-15} 个')

if __name__ == '__main__':
    main()
