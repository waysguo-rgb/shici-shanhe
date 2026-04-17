"""
豆包 TTS 2.0 (火山引擎 Seed TTS 2.0) 批量生成诗词朗读

使用新版控制台简化鉴权 (X-Api-Key 单一凭证)
端点: HTTP Chunked Streaming V3
音色: Seed TTS 2.0 (uranus_bigtts 系列, 支持 context_texts 情绪控制)

环境变量:
  DOUBAO_API_KEY   — API Key (必填, 从新版控制台获取)
  DOUBAO_VOICE     — 音色 (默认 zh_female_vv_uranus_bigtts)

用法:
  python assets/audio/generate_doubao_tts.py --sample        # 前 3 首测试
  python assets/audio/generate_doubao_tts.py --only 长安      # 指定地点
  python assets/audio/generate_doubao_tts.py --force         # 覆盖已有
  python assets/audio/generate_doubao_tts.py                 # 全部 163 首
  python assets/audio/generate_doubao_tts.py --dry-run       # 不调 API
"""
import os
import sys
import json
import time
import uuid
import base64
import argparse
from pathlib import Path

try:
    import requests
except ImportError:
    print('错误: 缺少 requests. pip install requests')
    sys.exit(1)

# ────────────────────────────────────────
HERE = Path(__file__).parent
# Vue/Vite 迁移后, locations 和 audio 都在 public/ 下
ROOT = HERE.parent
LOCATIONS_JSON = ROOT / 'public' / 'assets' / 'locations' / 'locations.json'
AUDIO_DIR = ROOT / 'public' / 'assets' / 'audio'

API_KEY = os.getenv('DOUBAO_API_KEY', '').strip()
DEFAULT_VOICE = os.getenv('DOUBAO_VOICE', 'zh_female_vv_uranus_bigtts').strip()
RESOURCE_ID = 'seed-tts-2.0'
API_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional'

if not API_KEY:
    print('错误: 未设置环境变量 DOUBAO_API_KEY')
    print('  Windows: $env:DOUBAO_API_KEY="你的key"')
    print('  Linux/Mac: export DOUBAO_API_KEY="你的key"')
    sys.exit(1)

# ────────────────────────────────────────
# 按 (地点, 诗题) 精细映射的情绪指令
# 这些是发给 context_texts 的自然语言指令, 让豆包 2.0 理解诗意
# ────────────────────────────────────────
MOOD_INSTRUCTIONS = {
    # ── 长安 ──
    ('长安', '春望'):           '请用特别沉痛、缓慢的语气朗读，表达杜甫国破家亡之痛，字字含泪。',
    ('长安', '长恨歌'):         '请用悲叹婉转的语气朗读，讲述杨贵妃与唐玄宗的悲剧爱情，如诉如泣。',
    ('长安', '清平调'):         '请用赞美华美的语气朗读，咏唱贵妃之美，声调明亮。',
    ('长安', '九月九日忆山东兄弟'): '请用思乡孤寂的语气朗读，表达游子重阳节思念亲人的情感。',
    ('长安', '乐游原'):         '请用怅然若失的语气朗读，表达夕阳无限好只是近黄昏的叹惋。',
    ('长安', '和张仆射塞下曲'): '请用肃穆雄浑的语气朗读，展现边塞将士的豪迈。',
    # ── 杜甫沉郁 ──
    ('秦州', '月夜忆舍弟'):     '请用幽咽哀伤的语气朗读，表达战乱中思念兄弟的悲情。',
    ('秦州', '月夜'):           '请用柔情思念的语气朗读，诉说月下思妻的深情。',
    ('白帝城', '登高'):         '请用沉郁苍凉的语气朗读，展现杜甫晚年漂泊凄苦之情。',
    ('成都', '春夜喜雨'):       '请用欣喜温柔的语气朗读，表达春雨滋润万物的喜悦。',
    ('成都', '蜀相'):           '请用敬慕感慨的语气朗读，追怀诸葛亮的功业与遗憾。',
    ('成都', '茅屋为秋风所破歌'): '请用慷慨悲壮的语气朗读，抒发忧国忧民的胸怀。',
    ('梓州', '闻官军收河南河北'): '请用狂喜激动的语气朗读，表达听闻捷报的惊喜之情。',
    ('梓州', '春日忆李白'):     '请用追忆怀念的语气朗读，表达对友人的思念与敬佩。',
    ('岳阳', '登岳阳楼'):       '请用苍凉壮阔的语气朗读，表达登楼远眺的苍茫之情。',
    ('潭州', '江南逢李龟年'):   '请用感伤沧桑的语气朗读，表达老来重逢的身世之悲。',
    # ── 李白豪放 ──
    ('汉中', '蜀道难'):         '请用惊叹磅礴的语气朗读，展现蜀道之险与李白的豪情。',
    ('白帝城', '早发白帝城'):   '请用欢快轻盈的语气朗读，表达遇赦归途的欣喜。',
    ('峨眉山', '峨眉山月歌'):   '请用悠远清朗的语气朗读，展现峨眉月色的清幽。',
    ('天姥山', '梦游天姥吟留别'): '请用梦幻飘逸的语气朗读，展现李白奇幻的想象世界。',
    ('金陵', '登金陵凤凰台'):   '请用怀古苍茫的语气朗读，抒发登高怀古之情。',
    ('阳关', '关山月'):         '请用苍茫悲壮的语气朗读，展现边塞月色与征人之苦。',
    # ── 边塞 ──
    ('延州', '出塞'):           '请用豪迈刚健的语气朗读，展现大漠孤城的壮阔。',
    ('延州', '使至塞上'):       '请用壮阔雄浑的语气朗读，展现大漠孤烟长河落日的壮美。',
    ('延州', '渔家傲·秋思'):    '请用悲壮苍凉的语气朗读，表达戍边将士思乡与守土的情怀。',
    ('凉州', '凉州词'):         '请用苍凉悲壮的语气朗读，展现黄河远上白云间的壮阔。',
    ('凉州', '从军行'):         '请用坚毅激昂的语气朗读，表达不破楼兰终不还的决心。',
    ('玉门关', '出塞'):         '请用激昂豪迈的语气朗读，展现边塞将士的英雄气概。',
    ('玉门关', '古从军行'):     '请用沉痛悲愤的语气朗读，控诉战争之残酷。',
    ('幽州', '登幽州台歌'):     '请用悲怆孤独的语气朗读，表达天地悠悠独怆然而涕下的绝望。',
    # ── 婉约词 ──
    ('金陵', '虞美人'):         '请用哀婉悲切的语气朗读，表达李煜亡国之痛、故国之思。',
    ('汴京', '雨霖铃'):         '请用缠绵悱恻的语气朗读，诉说柳永执手相看泪眼的离别之痛。',
    ('汴京', '如梦令'):         '请用俏皮活泼的语气朗读，再现李清照少女时代的欢快游玩。',
    ('汴京', '汴河曲'):         '请用怀古感伤的语气朗读，诉说汴水东流、隋家宫阙成尘的沧桑悲叹。',
    ('密州', '水调歌头'):       '请用旷达深情的语气朗读，诵出苏轼但愿人长久千里共婵娟的深情。',
    ('密州', '江城子·乙卯正月二十日夜记梦'): '请用泪眼凄婉的语气朗读，表达苏轼对亡妻的深切思念。',
    ('密州', '江城子·密州出猎'): '请用豪情壮志的语气朗读，展现苏轼老夫聊发少年狂的豪迈。',
    ('越州', '钗头凤·红酥手'):  '请用痛惜悲愤的语气朗读，表达陆游与唐婉的爱情悲剧。',
    ('越州', '示儿'):           '请用临终嘱托的语气朗读，表达陆游至死不忘恢复中原的遗愿。',
    ('郴州', '踏莎行·郴州旅舍'): '请用凄清孤寂的语气朗读，表达秦观贬谪旅途的苦闷。',
    ('郴州', '鹊桥仙'):         '请用温柔含情的语气朗读，诉说牛郎织女相会的深情。',
    # ── 苏轼黄州 ──
    ('黄州', '念奴娇·赤壁怀古'): '请用壮怀激烈的语气朗读，展现大江东去浪淘尽千古风流人物的气魄。',
    ('黄州', '定风波'):         '请用豁达超然的语气朗读，表达一蓑烟雨任平生的旷达胸襟。',
    ('黄州', '卜算子·黄州定慧院寓居作'): '请用孤高清冷的语气朗读，表达苏轼贬谪时孤鸿般的清高。',
    # ── 辛弃疾 ──
    ('镇江', '京口北固亭怀古'): '请用慷慨悲凉的语气朗读，表达辛弃疾凭吊古迹的壮志难酬。',
    ('镇江', '南乡子·登京口北固亭有怀'): '请用豪迈悲壮的语气朗读，抒发英雄无觅的感慨。',
    ('吉州', '青玉案·元夕'):    '请用由惊喜到静美的语气朗读，从元夜繁华到蓦然回首的转折。',
    ('吉州', '菩萨蛮·书江西造口壁'): '请用沉痛悲愤的语气朗读，表达郁孤台下清江水中间多少行人泪的悲情。',
    ('吉州', '破阵子'):         '请用壮烈激昂的语气朗读，梦回吹角连营的豪情与可怜白发生的悲凉。',
    # ── 江南 ──
    ('苏州', '枫桥夜泊'):       '请用孤寂清冷的语气朗读，诉说月落乌啼霜满天的夜泊愁思。',
    ('苏州', '忆江南'):         '请用温暖回忆的语气朗读，表达白居易对江南美景的深情怀念。',
    ('杭州', '饮湖上初晴后雨'): '请用赞叹喜悦的语气朗读，展现西湖水光山色的美丽。',
    ('杭州', '望海潮'):         '请用繁华富丽的语气朗读，展现杭州的十万人家三秋桂子。',
    ('扬州', '寄扬州韩绰判官'): '请用清雅怀念的语气朗读，表达对扬州二十四桥明月夜的思念。',
    ('扬州', '扬州慢'):         '请用衰飒悲凉的语气朗读，抒发姜夔昔盛今衰的黍离之悲。',
    # ── 田园 ──
    ('终南山', '终南山'):       '请用悠然开阔的语气朗读，展现终南山云雾缭绕的仙境。',
    ('终南山', '终南别业'):     '请用闲适恬淡的语气朗读，表达王维行到水穷处坐看云起时的禅意。',
    ('终南山', '鹿柴'):         '请用幽静空灵的语气朗读，展现空山不见人的禅意境界。',
    ('襄阳', '春晓'):           '请用慵懒清新的语气朗读，再现春天清晨的闲适。',
    ('襄阳', '过故人庄'):       '请用淳朴温暖的语气朗读，展现田园访友的闲趣。',
    ('越州', '游山西村'):       '请用畅快开朗的语气朗读，展现山重水复疑无路柳暗花明又一村的豁然。',
    # ── 怀古 ──
    ('金陵', '乌衣巷'):         '请用怀古感伤的语气朗读，表达朱雀桥边野草花的沧桑。',
    ('金陵', '泊秦淮'):         '请用冷峻讽喻的语气朗读，表达商女不知亡国恨的悲愤。',
    ('金陵', '桂枝香·金陵怀古'): '请用苍茫凭吊的语气朗读，抒发王安石的金陵怀古之情。',
    ('潼关', '山坡羊·潼关怀古'): '请用沉痛悲悯的语气朗读，表达兴百姓苦亡百姓苦的深沉同情。',
    ('赣州', '过零丁洋'):       '请用视死如归的语气朗读，表达文天祥人生自古谁无死留取丹心照汗青的气节。',
    ('赣州', '正气歌'):         '请用浩然正气的语气朗读，展现文天祥天地有正气的凛然。',
    # ── 现代 ──
    ('黄鹤楼', '菩萨蛮·黄鹤楼'): '请用沉郁坚定的语气朗读，表达作者忧国忧民的情怀。',
    ('潭州', '沁园春·长沙'):    '请用豪迈激昂的语气朗读，展现粪土当年万户侯的青春气概。',
    # ── 洛阳 ──
    ('洛阳', '春夜洛城闻笛'):   '请用思乡柔情的语气朗读，表达春夜闻笛的乡愁。',
    ('洛阳', '秋思'):           '请用深沉思念的语气朗读，表达张籍洛阳城里见秋风的乡思。',
    ('洛阳', '赠汪伦'):         '请用温暖深情的语气朗读，表达李白与汪伦的真挚友情。',
    # ── 黄鹤楼 ──
    ('黄鹤楼', '黄鹤楼'):       '请用怅惘苍茫的语气朗读，表达崔颢日暮乡关何处是的乡愁。',
    ('黄鹤楼', '黄鹤楼送孟浩然之广陵'): '请用惜别依依的语气朗读，展现李白送别故人的深情。',
    # ── 许昌曹操 ──
    ('许昌', '短歌行'):         '请用慨叹豪雄的语气朗读，表达曹操对酒当歌人生几何的感慨。',
    ('许昌', '观沧海'):         '请用壮阔雄浑的语气朗读，展现东临碣石以观沧海的气魄。',
    ('许昌', '龟虽寿'):         '请用老当益壮的语气朗读，表达烈士暮年壮心不已的豪情。',
    # ── 泰山 ──
    ('泰山', '望岳'):           '请用雄浑豪迈的语气朗读，展现会当凌绝顶一览众山小的气魄。',
    # ── 鹳雀楼 ──
    ('鹳雀楼', '登鹳雀楼'):     '请用豁达开阔的语气朗读，表达欲穷千里目更上一层楼的境界。',
    # ── 汉中陆游 ──
    ('汉中', '书愤'):           '请用悲愤慷慨的语气朗读，表达陆游塞上长城空自许的悲壮。',
    # ── 渭城 ──
    ('渭城', '送元二使安西'):   '请用珍重惜别的语气朗读，展现劝君更尽一杯酒的深情。',
    # ── 巴山 李商隐 ──
    ('巴山', '夜雨寄北'):       '请用思念温柔的语气朗读，表达何当共剪西窗烛的深情期盼。',
    ('巴山', '锦瑟'):           '请用迷离追忆的语气朗读，表达锦瑟无端五十弦的人生怅惘。',
    # ── 蓝关 ──
    ('蓝关', '左迁至蓝关示侄孙湘'): '请用悲愤苍凉的语气朗读，表达韩愈一封朝奏九重天夕贬潮州路八千的悲壮。',
    # ── 浔阳 ──
    ('浔阳', '琵琶行'):         '请用同情感伤的语气朗读，诉说同是天涯沦落人的悲情。',
    ('浔阳', '暮江吟'):         '请用静谧优美的语气朗读，展现一道残阳铺水中的美景。',
    # ── 永州 ──
    ('永州', '江雪'):           '请用孤绝清冷的语气朗读，展现独钓寒江雪的孤高境界。',
    ('永州', '渔翁'):           '请用悠然淡远的语气朗读，表达渔翁的闲适隐逸。',
    # ── 滁州 ──
    ('滁州', '醉翁亭记'):       '请用闲雅自得的语气朗读，表达欧阳修醉翁之意不在酒的洒脱。',
    # ── 庐山 ──
    ('庐山', '望庐山瀑布'):     '请用惊叹赞美的语气朗读，展现飞流直下三千尺疑是银河落九天的气魄。',
    ('庐山', '题西林壁'):       '请用哲思深远的语气朗读，表达不识庐山真面目只缘身在此山中的哲理。',
}

# 按作者兜底的简单指令 (没有显式映射的诗走这里)
AUTHOR_INSTRUCTION = {
    '李白': '请用豪放飘逸的语气朗读这首诗。',
    '杜甫': '请用沉郁顿挫的语气朗读这首诗。',
    '王维': '请用静谧清远的语气朗读这首诗。',
    '苏轼': '请用旷达从容的语气朗读这首诗。',
    '辛弃疾': '请用慷慨豪迈的语气朗读这首词。',
    '李清照': '请用婉约细腻的语气朗读这首词。',
    '柳永': '请用缠绵柔情的语气朗读这首词。',
    '白居易': '请用平和深情的语气朗读这首诗。',
    '李商隐': '请用含蓄朦胧的语气朗读这首诗。',
    '杜牧': '请用清丽婉转的语气朗读这首诗。',
    '孟浩然': '请用闲雅自然的语气朗读这首诗。',
    '曹操': '请用豪雄苍劲的语气朗读这首诗。',
    '陶渊明': '请用淡远恬静的语气朗读这首诗。',
    '陆游': '请用沉郁悲愤的语气朗读这首诗。',
    '王昌龄': '请用雄健悲壮的语气朗读这首诗。',
    '韩愈': '请用刚劲凝重的语气朗读这首诗。',
    '柳宗元': '请用清峻孤寂的语气朗读这首诗。',
}

def get_instruction(loc, title, author):
    key = (loc, title)
    if key in MOOD_INSTRUCTIONS:
        return MOOD_INSTRUCTIONS[key]
    if author in AUTHOR_INSTRUCTION:
        return AUTHOR_INSTRUCTION[author]
    return '请用从容优雅的语气朗读这首诗。'

# ────────────────────────────────────────
# 组装朗读文本
# ────────────────────────────────────────
def build_text(poem):
    """组装纯文本, 情绪由 context_texts 控制"""
    title = poem['title']
    author = poem['author']
    dynasty = poem['dynasty']
    lines = poem['lines']
    dyn_text = dynasty if dynasty.endswith('代') else dynasty + '代'
    parts = [title, '。', dyn_text, '，', author, '。']
    for line in lines:
        parts.append(line)
        parts.append('。')
    return ''.join(parts)

# ────────────────────────────────────────
# Doubao TTS 2.0 HTTP Chunked API 调用
# ────────────────────────────────────────
def synthesize(text, voice, instruction, out_path, retries=6):
    headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
        'X-Api-Resource-Id': RESOURCE_ID,
        'X-Api-Request-Id': str(uuid.uuid4()),
    }
    additions = {'context_texts': [instruction]}
    body = {
        'user': {'uid': 'poetry-map'},
        'req_params': {
            'text': text,
            'speaker': voice,
            'audio_params': {
                'format': 'mp3',
                'sample_rate': 24000,
                'speech_rate': -10,  # 稍慢
            },
            'additions': json.dumps(additions, ensure_ascii=False),
        },
    }

    # 成功码: 文档明确 "CodeOK Code = 20000000"
    # 部分数据 chunk 里 code=0 也算成功 (没有显式设置时默认 0)
    SUCCESS_CODES = {0, 20000000}

    last_err = None
    for attempt in range(retries):
        try:
            r = requests.post(
                API_URL,
                headers={**headers, 'X-Api-Request-Id': str(uuid.uuid4())},
                data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
                timeout=120,
            )
            if r.status_code != 200:
                last_err = f'HTTP {r.status_code}: {r.text[:200]}'
                time.sleep(2.0 * (attempt + 1))
                continue
            # 响应是多个 JSON 对象拼接的 chunked stream
            text_body = r.text
            dec = json.JSONDecoder()
            pos = 0
            audio_parts = []
            fatal = False
            while pos < len(text_body):
                remainder = text_body[pos:].lstrip()
                if not remainder:
                    break
                skip = len(text_body[pos:]) - len(remainder)
                try:
                    obj, end = dec.raw_decode(remainder)
                except json.JSONDecodeError:
                    break
                pos += skip + end
                code = obj.get('code', 0)
                if code not in SUCCESS_CODES:
                    msg = obj.get('message', '')
                    last_err = f'chunk code={code}: {msg[:120]}'
                    # 只有明确的错误码才终止
                    if code >= 45000000:  # 45xxxxxx = client err, 55xxxxxx = server err
                        fatal = True
                        audio_parts = []
                        break
                data_b64 = obj.get('data', '')
                if data_b64:
                    audio_parts.append(base64.b64decode(data_b64))
            if audio_parts:
                merged = b''.join(audio_parts)
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_bytes(merged)
                return len(merged)
            if fatal:
                # 错误参数类不重试
                if 'mismatch' in (last_err or '').lower() or 'invalid' in (last_err or '').lower():
                    break
            time.sleep(2.0 * (attempt + 1))
        except requests.RequestException as e:
            last_err = f'network: {type(e).__name__}'
            time.sleep(2.5 * (attempt + 1))
    raise RuntimeError(last_err or 'unknown error')

# ────────────────────────────────────────
# 主函数
# ────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Doubao Seed TTS 2.0 批量生成')
    parser.add_argument('--force', action='store_true', help='覆盖已有')
    parser.add_argument('--only', help='只生成指定地点 (逗号分隔)')
    parser.add_argument('--sample', action='store_true', help='只生成前 3 首')
    parser.add_argument('--dry-run', action='store_true', help='不调 API')
    parser.add_argument('--voice', help='覆盖默认音色')
    args = parser.parse_args()

    voice = args.voice or DEFAULT_VOICE

    with open(LOCATIONS_JSON, 'r', encoding='utf-8') as f:
        locations = json.load(f)

    only_set = set(args.only.split(',')) if args.only else None

    seen = set()
    tasks = []
    for loc in locations:
        if only_set and loc['name'] not in only_set:
            continue
        for p in loc['poems']:
            key = (loc['name'], p['title'])
            if key in seen:
                continue
            seen.add(key)
            tasks.append((loc['name'], p))

    if args.sample:
        tasks = tasks[:3]

    total = len(tasks)
    ok = 0
    skip = 0
    fail = 0
    bytes_total = 0
    failures = []

    print(f'待生成: {total} 首')
    print(f'Voice: {voice}')
    print(f'Resource: {RESOURCE_ID}')
    print(f'Endpoint: {API_URL}')
    if args.dry_run:
        print('(DRY RUN)')
    print('=' * 70)

    start = time.time()

    for i, (loc_name, poem) in enumerate(tasks):
        title = poem['title']
        out_path = AUDIO_DIR / loc_name / f'{title}.mp3'

        if out_path.exists() and not args.force:
            skip += 1
            print(f'[{i+1:3}/{total}] · 已存在: {loc_name}/{title}.mp3')
            continue

        text = build_text(poem)
        instruction = get_instruction(loc_name, title, poem['author'])

        if args.dry_run:
            print(f'[{i+1:3}/{total}] · {loc_name}/{title}')
            print(f'          instruction: {instruction[:60]}')
            continue

        try:
            size = synthesize(text, voice, instruction, out_path)
            ok += 1
            bytes_total += size
            print(f'[{i+1:3}/{total}] ✓ {loc_name}/{title} | {size//1024}KB')
        except Exception as e:
            fail += 1
            failures.append((loc_name, title, str(e)))
            print(f'[{i+1:3}/{total}] ✗ {loc_name}/{title} | {e}')

        time.sleep(0.5)

    elapsed = time.time() - start
    print('=' * 70)
    print(f'完成: 成功 {ok}, 跳过 {skip}, 失败 {fail}')
    if bytes_total:
        print(f'总大小: {bytes_total / 1024 / 1024:.1f} MB')
    print(f'耗时: {elapsed:.1f} 秒')
    if failures:
        print('\n失败明细:')
        for loc, title, err in failures[:15]:
            print(f'  {loc}/{title}: {err[:120]}')

if __name__ == '__main__':
    main()
