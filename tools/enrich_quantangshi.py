"""
给 chinese-poetry-master/全唐诗 下的所有 poet.tang.*.json / poet.song.*.json
每首诗追加 4 个字段:
    dynasty  — '唐' / '宋' (按 filename)
    year     — 创作年份 (匹配 poem_meta.js 的才有, 其余 null)
    location — 地点名 (匹配 locations.json 的才有, 其余 null)
    lonlat   — [lon, lat] (同上)

error/ 目录跳过.
原文件写回 (保持缩进 4, ensure_ascii=False).

跨简繁: 源文件是繁体, poem_meta/locations.json 是简体. 用 opencc t2s 把繁体标题
转成简体后再匹配.
"""
import json
import re
import os
from pathlib import Path
from opencc import OpenCC

ROOT = Path(__file__).parent.parent
POETRY_DIR = ROOT / 'chinese-poetry-master' / '全唐诗'
SONG_CI_DIR = ROOT / 'chinese-poetry-master' / '宋词'
LOC_JSON = ROOT / 'public' / 'assets' / 'locations' / 'locations.json'
META_JS = ROOT / 'src' / 'data' / 'poem_meta.js'

cc = OpenCC('t2s')  # traditional → simplified

# ── 1. 读 locations.json 建 loc → {lon, lat} 表 + poem(title,author) → loc ──
with open(LOC_JSON, 'r', encoding='utf-8') as f:
    locations_data = json.load(f)

loc_coords = {}                 # name → (lon, lat)
poem_to_loc = {}                # (simplified_title, author) → location_name
for loc in locations_data:
    loc_coords[loc['name']] = (loc['lon'], loc['lat'])
    for p in loc['poems']:
        poem_to_loc[(p['title'], p['author'])] = loc['name']

# ── 2. 解析 poem_meta.js 拿 year ──
# 支持两种 value 形式:
#   对象:  '...|作者': { year: XXX, ... }                 → 一对一
#   数组:  '...|作者': [{firstLine:'首句', year:XXX,...}, ...] → 同词牌多首消歧义
with open(META_JS, 'r', encoding='utf-8') as f:
    meta_src = f.read()

year_map = {}       # (simplified_title, author) → (year, location_hint|None)
year_map_multi = {} # (simplified_title, author) → [(firstLine, year, location_hint|None), ...]

def _find_loc_in_entry(body):
    # 找 location: '长安' 或 location:'长安'
    lm = re.search(r"location:\s*'([^']+)'", body)
    return lm.group(1) if lm else None

# 先找 singleton 对象形式
for m in re.finditer(r"'([^']+)\|([^']+)':\s*\{([^}]*)\}", meta_src):
    title, author, body = m.group(1), m.group(2), m.group(3)
    ym = re.search(r"\byear:\s*(-?\d+)", body)
    if not ym: continue
    year_map[(title, author)] = (int(ym.group(1)), _find_loc_in_entry(body))

# 再找数组形式
for arr_m in re.finditer(r"'([^']+)\|([^']+)':\s*\[([^\]]+)\]", meta_src):
    title, author = arr_m.group(1), arr_m.group(2)
    body = arr_m.group(3)
    entries = []
    # 每个 {...} 是一个子对象
    for obj_m in re.finditer(r"\{([^}]*)\}", body):
        sub = obj_m.group(1)
        fl_m = re.search(r"firstLine:\s*'([^']+)'", sub)
        yr_m = re.search(r"\byear:\s*(-?\d+)", sub)
        if fl_m and yr_m:
            entries.append((fl_m.group(1), int(yr_m.group(1)), _find_loc_in_entry(sub)))
    if entries:
        year_map_multi[(title, author)] = entries
        year_map.pop((title, author), None)

print(f'locations: {len(loc_coords)}')
print(f'poem→loc entries: {len(poem_to_loc)}')
print(f'year entries: {len(year_map)}')


YUEFU_PREFIXES = (
    '杂曲歌辞', '相和歌辞', '横吹曲辞', '鼓吹曲辞', '琴曲歌辞',
    '郊庙歌辞', '清商曲辞', '舞曲歌辞', '新乐府辞', '乐府',
    '鼓吹辞', '横吹辞',
)

NUM_SUFFIX_RE = re.compile(r'\s*[一二三四五六七八九十零]+$')
GROUP_SUFFIX_RE = re.compile(r'[一二三四五六七八九十零]+首\s*$')

def _strip_yuefu(t):
    parts = t.split(' ', 1)
    if len(parts) == 2 and parts[0] in YUEFU_PREFIXES:
        return parts[1].strip()
    return t

def canonical_title(t):
    """返回多个候选规范化 title (由宽到严)."""
    if not t: return []
    out = set()
    t = t.strip().replace('"', '')
    out.add(t)
    # 剥 乐府 prefix
    t1 = _strip_yuefu(t)
    out.add(t1)
    # 去尾部"一/二/三" (单字数字编号)
    t2 = NUM_SUFFIX_RE.sub('', t1).strip()
    out.add(t2)
    # 去"X首 X"结构 (如 "出塞二首 一" → "出塞")
    t3 = re.sub(r'[二三四五六七八九十]+首\s*[一二三四五六七八九十]+$', '', t1).strip()
    out.add(t3)
    return [x for x in out if x]

# 作者别名: corpus 里可能用尊号/庙号/别号, 我们 meta 用本名
AUTHOR_ALIASES = {
    '后主煜': '李煜',        # 南唐后主
    '后主': '李煜',
    '李重光': '李煜',
    '文忠': '欧阳修',
    '文正': '范仲淹',
    '乐天': '白居易',
    '香山居士': '白居易',
    '东坡': '苏轼',
    '稼轩': '辛弃疾',
    '易安': '李清照',
    '易安居士': '李清照',
    '少游': '秦观',
    '山谷': '黄庭坚',
    '太白': '李白',
    '子美': '杜甫',
    '少陵': '杜甫',
    '工部': '杜甫',
    '放翁': '陆游',
    '剑南': '陆游',
    '韩昌黎': '韩愈',
    '柳柳州': '柳宗元',
    '义山': '李商隐',
    '玉谿生': '李商隐',
    '飞卿': '温庭筠',
    '宣公': '韦应物',
    '荆公': '王安石',
    '半山': '王安石',
    '临川': '王安石',
    '石湖': '范成大',
    '诚斋': '杨万里',
    '白石': '姜夔',
    '白石道人': '姜夔',
}

def resolve_author(a):
    return AUTHOR_ALIASES.get(a, a)

def enrich_poem(p, dynasty):
    # 宋词的 title 存在 rhythmic 字段里 (词牌), 不是 title
    raw_title = p.get('title') or p.get('rhythmic') or ''
    title_s = cc.convert(raw_title)
    author_s = resolve_author(cc.convert(p.get('author', '')))
    # 取首句 (paragraphs 第一条的第一句, 到逗号为止, 用于同词牌多首消歧义)
    paragraphs = p.get('paragraphs', [])
    first_line = ''
    if paragraphs:
        fp = cc.convert(paragraphs[0])
        # 裁到第一个标点前 (逗号/句号)
        for punct in ('，', '。', ',', '.'):
            idx = fp.find(punct)
            if idx > 0:
                fp = fp[:idx]; break
        first_line = fp.strip()
    loc_name = None
    year = None
    meta_loc_hint = None  # meta.js 里 entry 自带的 location hint
    for cand in canonical_title(title_s):
        k = (cand, author_s)
        if loc_name is None:
            loc_name = poem_to_loc.get(k)
        if year is None:
            multi = year_map_multi.get(k)
            if multi:
                for fl, yr, lh in multi:
                    if first_line.startswith(fl):
                        year = yr
                        meta_loc_hint = lh
                        break
            else:
                single = year_map.get(k)
                if single:
                    year, meta_loc_hint = single
        if loc_name is not None and year is not None:
            break
    # 如果 locations.json 没匹配到地点, 用 meta.js entry 里的 location hint
    if loc_name is None and meta_loc_hint and meta_loc_hint in loc_coords:
        loc_name = meta_loc_hint
    lonlat = loc_coords.get(loc_name) if loc_name else None
    # 顺序: 在 title/author 之后插入
    new_p = {}
    for k, v in p.items():
        new_p[k] = v
    new_p['dynasty'] = dynasty
    new_p['year'] = year          # None 会序列化为 null
    new_p['location'] = loc_name
    new_p['lonlat'] = list(lonlat) if lonlat else None
    return new_p


def process(files, dynasty, base_dir=None):
    base = base_dir or POETRY_DIR
    filled_year = 0
    filled_loc = 0
    total = 0
    for f in files:
        path = base / f
        with open(path, 'r', encoding='utf-8') as fp:
            data = json.load(fp)
        out = []
        for p in data:
            np_ = enrich_poem(p, dynasty)
            if np_['year'] is not None: filled_year += 1
            if np_['location'] is not None: filled_loc += 1
            total += 1
            out.append(np_)
        with open(path, 'w', encoding='utf-8') as fp:
            json.dump(out, fp, ensure_ascii=False, indent=4)
    return total, filled_year, filled_loc


all_files = sorted(os.listdir(POETRY_DIR))
tang_files = [f for f in all_files if f.startswith('poet.tang.') and f.endswith('.json')]
song_shi_files = [f for f in all_files if f.startswith('poet.song.') and f.endswith('.json')]
song_ci_files = []
if SONG_CI_DIR.exists():
    song_ci_files = sorted([f for f in os.listdir(SONG_CI_DIR) if f.startswith('ci.song.') and f.endswith('.json')])
print(f'tang 诗 files: {len(tang_files)}')
print(f'song 诗 files: {len(song_shi_files)}')
print(f'song 词 files: {len(song_ci_files)}')
print('─' * 60)

print('\n▸ 处理 tang 诗...')
t_total, t_year, t_loc = process(tang_files, '唐')
print(f'  总 {t_total} 首, 填年份 {t_year}, 填地点 {t_loc}')

print('\n▸ 处理 song 诗...')
s_total, s_year, s_loc = process(song_shi_files, '宋')
print(f'  总 {s_total} 首, 填年份 {s_year}, 填地点 {s_loc}')

print('\n▸ 处理 song 词...')
c_total, c_year, c_loc = process(song_ci_files, '宋', base_dir=SONG_CI_DIR)
print(f'  总 {c_total} 首, 填年份 {c_year}, 填地点 {c_loc}')

print('─' * 60)
tot = t_total + s_total + c_total
tot_year = t_year + s_year + c_year
tot_loc = t_loc + s_loc + c_loc
print(f'✓ 总 {tot} 首, 已加 dynasty/year/location/lonlat 字段')
print(f'✓ 匹配 poem_meta.js 的才填 year (共 {tot_year})')
print(f'✓ 匹配 locations.json 的才填 location (共 {tot_loc})')
