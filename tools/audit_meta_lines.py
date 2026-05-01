"""
核对 meta_lines.json 的缺漏: 列出 poem_meta.js 里有 key 但 meta_lines.json 没命中的诗.
对每个缺漏做 corpus 模糊搜索, 给候选.
输出 tools/miss_report.json 供人工核对.
"""
import json, re, os
from pathlib import Path
from opencc import OpenCC

ROOT = Path(__file__).parent.parent
POETRY_DIR = ROOT / 'chinese-poetry-master' / '全唐诗'
SONG_CI_DIR = ROOT / 'chinese-poetry-master' / '宋词'
META_JS = ROOT / 'src' / 'data' / 'poem_meta.js'
LINES_JSON = ROOT / 'src' / 'data' / 'meta_lines.json'
OUT = ROOT / 'tools' / 'miss_report.json'

cc = OpenCC('t2s')

# ── 1. parse poem_meta.js ──
with open(META_JS, 'r', encoding='utf-8') as f:
    meta_src = f.read()

singleton_keys = []       # [(title, author)]
multi_keys = []           # [(title, author, firstLine)]
for m in re.finditer(r"'([^']+)\|([^']+)':\s*\{", meta_src):
    singleton_keys.append((m.group(1), m.group(2)))
for arr_m in re.finditer(r"'([^']+)\|([^']+)':\s*\[([^\]]+)\]", meta_src):
    title, author, body = arr_m.group(1), arr_m.group(2), arr_m.group(3)
    for obj_m in re.finditer(r"\{([^}]*)\}", body):
        fl_m = re.search(r"firstLine:\s*'([^']+)'", obj_m.group(1))
        if fl_m:
            # 移除 singleton 里可能的重复 (title|author)
            multi_keys.append((title, author, fl_m.group(1)))
singleton_keys = [k for k in singleton_keys if (k[0], k[1]) not in {(a,b) for (a,b,_) in multi_keys}]

# ── 2. load meta_lines.json ──
with open(LINES_JSON, 'r', encoding='utf-8') as f:
    lines_map = json.load(f)

# ── 3. compute miss ──
miss_singletons = []
for (t, a) in singleton_keys:
    if f"{t}|{a}" not in lines_map:
        miss_singletons.append((t, a))

miss_multi = []
for (t, a, fl) in multi_keys:
    if f"{t}|{a}|{fl}" not in lines_map:
        miss_multi.append((t, a, fl))

print(f'Total meta: {len(singleton_keys)} singletons + {len(multi_keys)} multi = {len(singleton_keys)+len(multi_keys)}')
print(f'Miss:       {len(miss_singletons)} singletons + {len(miss_multi)} multi = {len(miss_singletons)+len(miss_multi)}')

# ── 4. load corpus into (author → [poem]) index ──
AUTHOR_ALIASES_REV = {    # 正向: corpus_name → canonical
    '后主煜':'李煜','后主':'李煜','李重光':'李煜','文忠':'欧阳修','文正':'范仲淹',
    '乐天':'白居易','香山居士':'白居易','东坡':'苏轼','稼轩':'辛弃疾','易安':'李清照',
    '易安居士':'李清照','少游':'秦观','山谷':'黄庭坚','太白':'李白','子美':'杜甫',
    '少陵':'杜甫','工部':'杜甫','放翁':'陆游','剑南':'陆游','韩昌黎':'韩愈',
    '柳柳州':'柳宗元','义山':'李商隐','玉谿生':'李商隐','飞卿':'温庭筠','宣公':'韦应物',
    '荆公':'王安石','半山':'王安石','临川':'王安石','石湖':'范成大','诚斋':'杨万里',
    '白石':'姜夔','白石道人':'姜夔',
}
def resolve_author(a): return AUTHOR_ALIASES_REV.get(a, a)

author_idx = {}  # author → [(title, paragraphs)]

def load_dir(d, prefix):
    if not d.exists(): return
    for fname in sorted(os.listdir(d)):
        if not (fname.startswith(prefix) and fname.endswith('.json')): continue
        if fname.startswith('author'): continue
        with open(d / fname, 'r', encoding='utf-8') as f:
            try: data = json.load(f)
            except: continue
        for p in data:
            t = cc.convert(p.get('title') or p.get('rhythmic') or '')
            a = resolve_author(cc.convert(p.get('author', '')))
            paras = [cc.convert(x) for x in p.get('paragraphs', [])]
            if not t or not a or not paras: continue
            author_idx.setdefault(a, []).append((t, paras))

load_dir(POETRY_DIR, 'poet.')
load_dir(SONG_CI_DIR, 'ci.song.')
print(f'Corpus authors: {len(author_idx)}; total poems: {sum(len(v) for v in author_idx.values())}')

# ── 5. fuzzy search for each miss ──
report = []
for (t, a) in miss_singletons:
    candidates = []
    pool = author_idx.get(a, [])
    # 1. 标题包含 / 被包含
    for (ct, paras) in pool:
        if t == ct or t in ct or ct in t:
            candidates.append({'cTitle': ct, 'firstLine': paras[0][:30] if paras else '', 'paragraphs': paras})
    # 2. 若无, 首 2 字匹配
    if not candidates and len(t) >= 2:
        for (ct, paras) in pool:
            if ct.startswith(t[:2]) or t.startswith(ct[:2]):
                candidates.append({'cTitle': ct, 'firstLine': paras[0][:30] if paras else '', 'paragraphs': paras})
    report.append({'type':'singleton', 'title': t, 'author': a, 'cand': candidates[:5]})

for (t, a, fl) in miss_multi:
    candidates = []
    pool = author_idx.get(a, [])
    for (ct, paras) in pool:
        # 标题匹配 (词牌可能相同) 且首句包含 fl
        if (t == ct or t in ct or ct in t):
            if paras and fl in paras[0]:
                candidates.append({'cTitle': ct, 'firstLine': paras[0][:30], 'paragraphs': paras})
    # 若无精确首句, 放宽: 同词牌所有 (让人肉眼挑)
    if not candidates:
        for (ct, paras) in pool:
            if t == ct or t in ct or ct in t:
                candidates.append({'cTitle': ct, 'firstLine': paras[0][:30] if paras else '', 'paragraphs': paras})
    report.append({'type':'multi', 'title': t, 'author': a, 'firstLine': fl, 'cand': candidates[:5]})

# 分类统计: 0/1/多候选
c0 = sum(1 for r in report if len(r['cand']) == 0)
c1 = sum(1 for r in report if len(r['cand']) == 1)
cn = sum(1 for r in report if len(r['cand']) > 1)
print(f'Candidates: 0={c0}, 1={c1}, multi={cn}')

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print(f'Wrote {OUT}')
