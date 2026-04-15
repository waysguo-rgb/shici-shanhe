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
# 音色分派规则
# Azure 神经网络音色列表: https://learn.microsoft.com/azure/cognitive-services/speech-service/language-support
# ────────────────────────────────────────
# 豪放派男声: 李白、苏轼、辛弃疾、陆游、岳飞、王昌龄、王之涣、范仲淹、王翰、高适、卢纶、李益、寇准、曹操、张养浩、谭嗣同
HEROIC_AUTHORS = {
    '李白', '苏轼', '辛弃疾', '陆游', '岳飞',
    '王昌龄', '王之涣', '范仲淹', '王翰', '高适',
    '卢纶', '李益', '寇准', '王安石', '毛泽东',
    '王勃', '金章宗', '韩愈', '张籍',
    '张养浩', '谭嗣同',
}
# 沉郁苍凉派: 杜甫、陈子昂、曹操、李煜 (亡国)、张养浩 (忧民)
SOMBER_AUTHORS = {
    '杜甫', '陈子昂', '曹操', '李煜', '崔颢',
    '马致远', '文天祥',
}
# 婉约派女声: 李清照、柳永、温庭筠、秦观、晏殊、欧阳修、杜牧、王维、孟浩然、白居易、李商隐、姜夔
GRACEFUL_AUTHORS = {
    '李清照', '柳永', '温庭筠', '秦观', '晏殊', '欧阳修',
    '杜牧', '王维', '孟浩然', '白居易', '李商隐', '姜夔',
    '贺知章', '张继', '韦应物', '贾岛', '常建', '刘禹锡',
    '杨万里', '林升', '朱熹', '范成大', '叶绍翁', '张若虚',
    '寇准', '张仆射', '谢道韫', '林逋', '杨周', '孟郊',
    '贺铸', '晁补之', '吴文英', '张孝祥',
}

def pick_voice(poem, override=None):
    """根据作者和内容选择音色 + 情感风格 + 语速"""
    if override:
        return (f'zh-CN-{override}', 'poetry-reading', 0.88)

    a = poem.get('author', '')

    # 沉郁苍凉 -> 成熟男声, serious 风格
    if a in SOMBER_AUTHORS:
        return ('zh-CN-YunyeNeural', 'serious', 0.82)

    # 豪放 -> 阳光男声 + 诗词风格
    if a in HEROIC_AUTHORS:
        return ('zh-CN-YunxiNeural', 'poetry-reading', 0.88)

    # 婉约 -> 温柔女声 + 诗词风格
    if a in GRACEFUL_AUTHORS:
        return ('zh-CN-XiaoxiaoNeural', 'poetry-reading', 0.86)

    # 默认: 女声诗词风格
    return ('zh-CN-XiaoxiaoNeural', 'poetry-reading', 0.88)

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
    - express-as 情感风格 (styledegree 1.3 加强)
    - prosody rate 控制整体语速
    """
    title = escape_xml(poem['title'])
    author = escape_xml(poem['author'])
    dynasty = escape_xml(poem['dynasty'])
    lines = [escape_xml(l) for l in poem['lines']]

    # 开场白
    intro = f'{title}。{dynasty}代，{author}。'

    # 诗句: 每句之间 500ms 停顿, 句末 400ms, 形成吟诵节奏
    body_parts = []
    for i, line in enumerate(lines):
        body_parts.append(f'{line}。')
        # 最后一句用更长停顿
        if i < len(lines) - 1:
            body_parts.append('<break time="500ms"/>')
        else:
            body_parts.append('<break time="800ms"/>')
    body = ''.join(body_parts)

    rate_pct = f'{int((rate - 1) * 100):+d}%'  # 0.88 -> "-12%"

    if style:
        content = (
            f'<mstts:express-as style="{style}" styledegree="1.3">'
            f'<prosody rate="{rate_pct}">'
            f'{intro}<break time="700ms"/>'
            f'{body}'
            f'</prosody>'
            f'</mstts:express-as>'
        )
    else:
        content = (
            f'<prosody rate="{rate_pct}">'
            f'{intro}<break time="700ms"/>'
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
def synthesize(ssml, out_path, retries=3):
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
                # 429 (rate limit) 等一下再试
                if r.status_code == 429:
                    time.sleep(2.0 * (attempt + 1))
                    continue
                # 400 / 401 等是 SSML 错误, 不重试
                if r.status_code in (400, 401, 403):
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

        voice, style, rate = pick_voice(poem, override=args.voice)
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

        # 避免触发 QPS 限制, 每请求后睡一会儿 (F0 免费层约 20 req/s)
        time.sleep(0.35)

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
