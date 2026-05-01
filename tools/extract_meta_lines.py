"""
从 chinese-poetry-master/ 抽出 poem_meta.js 里所有 entry 的正文,
输出 src/data/meta_lines.json: { "title|author" 或 "title|author|firstLine" → [line1, ...] }

匹配规则 (v2):
  1. corpus → meta 的双向规范化 canonical title 集合:
     - 原标题
     - 去乐府前缀 ("杂曲歌辞" 等)
     - 去组诗前缀 ("辋川集 鹿柴" → "鹿柴")
     - 去尾部数字编号 ("出塞二首 一" → "出塞")
     - 规范化点号 (·/・/∙ 统一成 ·), 去前后 " "
     - "词牌·副标题"/"词牌·首句" 形式: 生成两种 key (带/不带副标题)
  2. 作者别名 (corpus 用尊号/别号的 → 本名)
  3. 多候选消歧义:
     - meta 的 array 形式直接用 firstLine 去 startswith 匹配 corpus paragraphs[0]
     - meta 的 singleton 但 title 有 "·副标题" 的 (如 "声声慢·寻寻觅觅"), 副标题作 firstLine 提示
     - 组诗 (corpus 标题里有 "N首 N") 无消歧信息时取第一首 (经典引用约定)
"""
import json, re, os
from pathlib import Path
from opencc import OpenCC

ROOT = Path(__file__).parent.parent
POETRY_DIR = ROOT / 'chinese-poetry-master' / '全唐诗'
SONG_CI_DIR = ROOT / 'chinese-poetry-master' / '宋词'
CORPUS_ROOT = ROOT / 'chinese-poetry-master'
META_JS = ROOT / 'src' / 'data' / 'poem_meta.js'
OUT = ROOT / 'src' / 'data' / 'meta_lines.json'

cc = OpenCC('t2s')

# ── 1. parse poem_meta.js ──
with open(META_JS, 'r', encoding='utf-8') as f:
    meta_src = f.read()

singletons = set()
multi = {}
for m in re.finditer(r"'([^']+)\|([^']+)':\s*\{", meta_src):
    singletons.add((m.group(1), m.group(2)))
for arr_m in re.finditer(r"'([^']+)\|([^']+)':\s*\[([^\]]+)\]", meta_src):
    title, author, body = arr_m.group(1), arr_m.group(2), arr_m.group(3)
    fls = []
    for obj_m in re.finditer(r"\{([^}]*)\}", body):
        fl_m = re.search(r"firstLine:\s*'([^']+)'", obj_m.group(1))
        if fl_m: fls.append(fl_m.group(1))
    if fls:
        multi[(title, author)] = fls
        singletons.discard((title, author))

# ── 2. author alias (corpus → canonical) ──
AUTHOR_ALIASES = {
    '后主煜':'李煜','后主':'李煜','李重光':'李煜','文忠':'欧阳修','文正':'范仲淹',
    '乐天':'白居易','香山居士':'白居易','东坡':'苏轼','稼轩':'辛弃疾','易安':'李清照',
    '易安居士':'李清照','少游':'秦观','山谷':'黄庭坚','太白':'李白','子美':'杜甫',
    '少陵':'杜甫','工部':'杜甫','放翁':'陆游','剑南':'陆游','韩昌黎':'韩愈',
    '柳柳州':'柳宗元','义山':'李商隐','玉谿生':'李商隐','飞卿':'温庭筠','宣公':'韦应物',
    '荆公':'王安石','半山':'王安石','临川':'王安石','石湖':'范成大','诚斋':'杨万里',
    '白石':'姜夔','白石道人':'姜夔',
    # 南唐李璟常被 corpus 收录为"南唐嗣主李璟" / "南唐中主李璟"
    '南唐嗣主李璟':'李璟','南唐中主李璟':'李璟','李中主':'李璟','嗣主李璟':'李璟',
}
def resolve_author(a): return AUTHOR_ALIASES.get(a, a)

# ── 3. title normalization ──
YUEFU_PREFIXES = ('杂曲歌辞','相和歌辞','横吹曲辞','鼓吹曲辞','琴曲歌辞',
                  '郊庙歌辞','清商曲辞','舞曲歌辞','新乐府辞','乐府','鼓吹辞','横吹辞')
# 常见组诗前缀 (corpus 里用这些前缀包裹单首诗)
GROUP_PREFIXES = ('辋川集','金陵五题','秋浦歌','戏为六绝句')
NUM_SUFFIX_RE = re.compile(r'\s*[一二三四五六七八九十零]+$')
GROUP_SUFFIX_RE = re.compile(r'[二三四五六七八九十]+首\s*[一二三四五六七八九十]+$')

# 繁简漏项手工补 (t2s 没覆盖或多词义)
EXTRA_T2S = {'姪':'侄','異':'异','劒':'剑','翦':'剪','沈':'沉','荅':'答','《':'','》':''}

# 手工映射: meta_key → (corpus_title_hint, firstLine_prefix)
# 用于"副标题 singleton"名篇无 firstLine 可推断 / corpus 版本字异过大的情况.
# 匹配规则: 作者 + corpus_title 被 title_hint 子串包含 + corpus.paragraphs[0] 以 firstLine_prefix 开头.
HAND_OVERRIDES = {
    '念奴娇·赤壁怀古|苏轼': ('念奴娇', '大江东去'),
    '江城子·乙卯正月二十日夜记梦|苏轼': ('江城子', '十年生死两茫茫'),
    '江城子·密州出猎|苏轼': ('江城子', '老夫聊发少年狂'),
    '蝶恋花·春景|苏轼': ('蝶恋花', '花褪残红青杏小'),
    '卜算子·黄州定慧院寓居作|苏轼': ('卜算子', '缺月挂疏桐'),
    '破阵子·为陈同甫赋壮词以寄之|辛弃疾': ('破阵子', '醉里挑灯看剑'),
    '永遇乐·京口北固亭怀古|辛弃疾': ('永遇乐', '千古江山'),
    '京口北固亭怀古|辛弃疾': ('永遇乐', '千古江山'),
    '丑奴儿·书博山道中壁|辛弃疾': ('丑奴儿', '少年不识愁滋味'),
    '西江月·夜行黄沙道中|辛弃疾': ('西江月', '明月别枝惊鹊'),
    '菩萨蛮·书江西造口壁|辛弃疾': ('菩萨蛮', '郁孤台下清江水'),
    '南乡子·登京口北固亭有怀|辛弃疾': ('南乡子', '何处望神州'),
    '桂枝香·金陵怀古|王安石': ('桂枝香', '登临送目'),
    '晓出净慈寺送林子方|杨万里': ('晓出', '毕竟西湖'),
    '山中问答|李白': ('山中问', '问余何意'),
    '四时田园杂兴 春日 一|范成大': ('春日田园杂兴', '柳花深巷'),
    '四时田园杂兴 夏日|范成大': ('夏日田园杂兴', '昼出耘田'),
    '观书有感 一|朱熹': ('观书有感', '半亩方塘'),
    '观书有感 二|朱熹': ('观书有感', '昨夜江边'),
    '客中作|李白': ('客中', '兰陵美酒'),
    '嫦娥|李商隐': ('常娥', '云母屏风'),           # 古写 "常娥"
    '三别|杜甫': ('新婚别', '兔丝附蓬麻'),         # 组名 → 代表作
    '三吏|杜甫': ('石壕吏', '暮投石壕村'),         # 组名 → 代表作
    # corpus 异名映射
    '钱塘湖春行|白居易': ('钱唐湖春行', '孤山寺北'),
    '临洞庭湖赠张丞相|孟浩然': ('望洞庭湖赠张丞相', '八月湖水平'),
    '井底引银瓶|白居易': ('井底引银瓶', '井底引银瓶'),
    '春宵|苏轼': ('春夜', '春宵一刻'),
    '丁都护歌|李白': ('丁督护歌', '云阳上征去'),
    '黄鹤楼闻笛|李白': ('听黄鹤楼上吹笛', '一为迁客'),
    '玄都观桃花|刘禹锡': ('元和十一年', '紫陌红尘'),
    '活水亭观书有感|朱熹': ('观书有感', '半亩方塘'),
    '送元二使安西|王维': ('渭城曲', '渭城朝雨'),
    # 曹操诗集 (default_author='曹操' 注入)
    '观沧海|曹操': ('观沧海', '东临碣石'),
    '龟虽寿|曹操': ('龟虽寿', '神龟虽寿'),
    '短歌行|曹操': ('短歌行', '对酒当歌'),
    # 晏殊的《蝶恋花·六曲阑干偎碧树》实际作者是冯延巳, 作为同词内容仍可 fallback
    # (不加入 HAND_OVERRIDES, 避免错误归属)
    # array-form keys
    '蝶恋花|李清照|暖雨晴风初破冻': ('蝶恋花', '暖日晴风'),
    '鹧鸪天|辛弃疾|唱彻阳关泪未干': ('鹧鸪天', '唱彻'),
}

def norm_punct(t):
    """统一 · ・ ∙ 为 ·, 去 引号 全角空格"""
    t = t.replace('・', '·').replace('∙', '·').replace('．', '·')
    t = t.replace('"','').replace('"','').replace('"','').replace('“','').replace('”','')
    t = t.replace('\u3000', ' ')  # 全角空格
    for k, v in EXTRA_T2S.items(): t = t.replace(k, v)
    return t.strip()

def _strip_yuefu(t):
    parts = t.split(' ', 1)
    if len(parts) == 2 and parts[0] in YUEFU_PREFIXES: return parts[1].strip()
    return t

def _strip_group_prefix(t):
    parts = t.split(' ', 1)
    if len(parts) == 2 and parts[0] in GROUP_PREFIXES: return parts[1].strip()
    return t

def canonical_titles(t):
    """生成多个候选规范化 title (由宽到严)."""
    if not t: return []
    out = set()
    t = norm_punct(t)
    out.add(t)
    t1 = _strip_yuefu(t); out.add(t1)
    t2 = _strip_group_prefix(t1); out.add(t2)
    t3 = NUM_SUFFIX_RE.sub('', t2).strip(); out.add(t3)
    t4 = GROUP_SUFFIX_RE.sub('', t2).strip(); out.add(t4)
    # 按空白切 (处理组诗前缀 "新乐府 卖炭翁" / "皇甫岳云溪杂题五首 鸟鸣涧" 等)
    for base in (t, t1, t2):
        for seg in re.split(r'[\s\t]+', base):
            seg = seg.strip()
            if seg and len(seg) >= 2: out.add(seg)
    # "·" 两侧都加 (词牌·副标题 和 异名·词牌 两种形式)
    for base in (t, t1):
        if '·' in base:
            for seg in base.split('·'):
                seg = seg.strip()
                if seg and len(seg) >= 2: out.add(seg)
    return [x for x in out if x]

def title_subtitle(t):
    """从 '词牌·副标题/首句' 拆副标题, 返回 (词牌, 副标题|None)"""
    t = norm_punct(t)
    if '·' in t:
        parts = t.split('·', 1)
        return parts[0].strip(), parts[1].strip()
    return t, None

# ── 4. build corpus index: (canonical_title, author) → [poem] ──
corpus_idx = {}  # (ct, author) → [(raw_title, paragraphs)]

def _add_poem(raw_title, author, paragraphs):
    if not raw_title or not author or not paragraphs: return
    for ct in canonical_titles(raw_title):
        corpus_idx.setdefault((ct, author), []).append((raw_title, paragraphs))

def _add_from_json_data(data, default_author=None):
    for p in data:
        raw_title = cc.convert(p.get('title') or p.get('rhythmic') or '')
        author = p.get('author') or default_author or ''
        author = resolve_author(cc.convert(author))
        paragraphs = [cc.convert(x) for x in p.get('paragraphs', [])]
        _add_poem(raw_title, author, paragraphs)

def load_dir(d, prefix, default_author=None):
    if not d.exists(): return
    for fname in sorted(os.listdir(d)):
        if prefix and not fname.startswith(prefix): continue
        if not fname.endswith('.json'): continue
        if fname.startswith('author'): continue
        if 'intro' in fname or 'preface' in fname: continue
        with open(d / fname, 'r', encoding='utf-8') as f:
            try: data = json.load(f)
            except: continue
        _add_from_json_data(data, default_author)

def load_file(path, default_author=None):
    if not path.exists(): return
    with open(path, 'r', encoding='utf-8') as f:
        try: data = json.load(f)
        except: return
    _add_from_json_data(data, default_author)

load_dir(POETRY_DIR, 'poet.')
# 全唐诗 里还有两个经典集 (文件名不是 poet.* 前缀, 必须单独加载)
load_file(POETRY_DIR / '唐诗三百首.json')
load_file(POETRY_DIR / '唐诗补录.json')
load_dir(SONG_CI_DIR, 'ci.song.')
# 宋词三百首 (精选宋词)
load_file(SONG_CI_DIR / '宋词三百首.json')
# 御定全唐詩 (更严谨的繁体唐诗全本, 900 卷)
load_dir(CORPUS_ROOT / '御定全唐詩' / 'json', '')
# 水墨唐诗 (176 首精选唐诗, 带 prologue 赏析)
load_file(CORPUS_ROOT / '水墨唐诗' / 'shuimotangshi.json')
# 曹操诗集 (无 author 字段, 手工注入)
load_file(CORPUS_ROOT / '曹操诗集' / 'caocao.json', default_author='曹操')
# 五代诗词 南唐 (李煜/李璟)
load_file(CORPUS_ROOT / '五代诗词' / 'nantang' / 'poetrys.json')
# 五代诗词 花间集
load_dir(CORPUS_ROOT / '五代诗词' / 'huajianji', 'huajianji-')
# 元曲 (张养浩/关汉卿等)
load_file(CORPUS_ROOT / '元曲' / 'yuanqu.json')

# ── 5. match ──
collected = {}

# 按作者聚合原始 corpus 条目 (用于 fallback 的 substring 匹配)
author_corpus = {}   # author → [(raw_title, paragraphs), ...]
for (ct, a), poems in corpus_idx.items():
    for (rt, paras) in poems:
        key = (rt, a)
        author_corpus.setdefault(a, []).append((rt, paras))
# 去重
for a in author_corpus:
    seen_rt = set()
    unique = []
    for (rt, paras) in author_corpus[a]:
        pid = (rt, tuple(paras[:2]))
        if pid in seen_rt: continue
        seen_rt.add(pid); unique.append((rt, paras))
    author_corpus[a] = unique

def find_candidates(title, author):
    """给 meta (title, author), 返回所有 corpus 候选 [(raw_title, paragraphs), ...]"""
    seen_ids = set()
    out = []
    # 1. canonical 匹配
    for ct in canonical_titles(title):
        for (rt, paras) in corpus_idx.get((ct, author), []):
            pid = (rt, tuple(paras[:2]))
            if pid in seen_ids: continue
            seen_ids.add(pid)
            out.append((rt, paras))
    if out: return out
    # 2. fallback: 同作者里做子串包含 match (meta title 是 corpus title 子串, 或反之)
    meta_t = norm_punct(title)
    if len(meta_t) < 3: return out
    for (rt, paras) in author_corpus.get(author, []):
        ct = norm_punct(rt)
        if meta_t in ct or ct in meta_t:
            pid = (rt, tuple(paras[:2]))
            if pid in seen_ids: continue
            seen_ids.add(pid)
            out.append((rt, paras))
    return out

def pick_first_or_match(candidates, first_line_hint=None):
    """消歧义: 有 firstLine hint 则按 startswith 匹配; 否则优先挑非组诗的, 再退取第一个."""
    if not candidates: return None
    if first_line_hint:
        hint = norm_punct(first_line_hint)
        # (a) 精确 startswith (已规范化字异)
        for (rt, paras) in candidates:
            if paras and norm_punct(paras[0]).startswith(hint):
                return paras
        # (b) 放宽 - hint 的前 3 字 == paras[0] 前 3 字 (容忍一字之差: 如 "雨/日", "淮/怀")
        if len(hint) >= 3:
            for (rt, paras) in candidates:
                if paras and norm_punct(paras[0])[:3] == hint[:3]:
                    return paras
        # (c) candidates 唯一 → 认为副标题非 firstLine, 取这唯一首
        if len(candidates) == 1: return candidates[0][1]
        return None   # 多候选 hint 没命中 → 宁缺勿错
    if len(candidates) == 1: return candidates[0][1]
    # 多候选无 hint: 优先挑 "X 一" 结尾的 (组诗第一首)
    for (rt, paras) in candidates:
        if re.search(r'[二三四五六七八九十]+首\s*一$', rt): return paras
    # 还不行: 挑最短 title (通常是精确匹配)
    candidates.sort(key=lambda x: len(x[0]))
    return candidates[0][1]

def try_hand_override(meta_key, author):
    """按 HAND_OVERRIDES 里的 (title_hint, firstLine_prefix) 精确筛选 corpus."""
    if meta_key not in HAND_OVERRIDES: return None
    th, flp = HAND_OVERRIDES[meta_key]
    th_n = norm_punct(th); flp_n = norm_punct(flp)
    for (rt, paras) in author_corpus.get(author, []):
        ct = norm_punct(rt)
        if th_n in ct and paras and norm_punct(paras[0]).startswith(flp_n):
            return paras
    return None

# singletons
for (title, author) in singletons:
    meta_key = f"{title}|{author}"
    paras = try_hand_override(meta_key, author)
    if paras is None:
        cands = find_candidates(title, author)
        _, sub = title_subtitle(title)
        paras = pick_first_or_match(cands, sub)
    if paras:
        collected[meta_key] = paras

# multi (array 形式)
for (title, author), fls in multi.items():
    cands = find_candidates(title, author)
    for fl in fls:
        meta_key = f"{title}|{author}|{fl}"
        paras = try_hand_override(meta_key, author)
        if paras is None:
            paras = pick_first_or_match(cands, fl)
        if paras:
            collected[meta_key] = paras

# ── 6. dump ──
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(collected, f, ensure_ascii=False, indent=1)

total_targets = len(singletons) + sum(len(v) for v in multi.values())
print(f'Targets: {len(singletons)} singletons + {sum(len(v) for v in multi.values())} multi = {total_targets}')
print(f'Collected: {len(collected)}  ({len(collected)*100//total_targets}%)')
print(f'Wrote {OUT} ({OUT.stat().st_size//1024}KB)')
