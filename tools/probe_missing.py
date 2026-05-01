"""
直接用 firstLine 片段在全部 corpus (含 御定全唐詩/曹操/五代/元曲) 搜.
"""
import json, os
from pathlib import Path
from opencc import OpenCC

ROOT = Path(__file__).parent.parent
CORPUS_ROOT = ROOT / 'chinese-poetry-master'
cc = OpenCC('t2s')

SEARCH = [
    ('清明|杜牧', '清明时节雨纷纷'),
    ('钱塘湖春行|白居易', '孤山寺北贾亭西'),
    ('临洞庭湖赠张丞相|孟浩然', '八月湖水平'),
    ('井底引银瓶|白居易', '井底引银瓶'),
    ('行香子|秦观', '树绕村庄'),
    ('杨柳枝|柳宗元', '杨柳'),
    ('天仙子|贺铸', '韶华'),
    ('晋祠|李白', '晋祠'),
    ('饮酒|陶渊明', '结庐在人境'),
    ('观沧海|曹操', '东临碣石'),
    ('龟虽寿|曹操', '神龟虽寿'),
    ('短歌行|曹操', '对酒当歌'),
    ('己亥杂诗|龚自珍', '九州生气'),
    ('春宵|苏轼', '春宵一刻'),
    ('丁都护歌|李白', '云阳上征去'),
    ('黄鹤楼闻笛|李白', '一为迁客去长沙'),
    ('玄都观桃花|刘禹锡', '紫陌红尘'),
    ('山坡羊·潼关怀古|张养浩', '峰峦如聚'),
    ('菩萨蛮·黄鹤楼|毛泽东', '茫茫九派'),
    ('沁园春·长沙|毛泽东', '独立寒秋'),
    ('潼关|谭嗣同', '终古高云'),
    ('泰山吟|谢道韫', '峨峨东岳高'),
    ('活水亭观书有感|朱熹', '半亩方塘'),
    ('京口北固亭怀古|辛弃疾', '千古江山'),
    ('三吏|杜甫', '暮投石壕村'),
    ('送元二使安西|王维', '渭城朝雨'),
    ('蝶恋花|晏殊', '六曲阑干偎碧树'),
    ('蝶恋花|欧阳修', '庭院深深深几许'),
    ('秋日登清源山|陈允平', '林外'),
    ('题岳麓寺|张栻', '万山'),
    ('乌山|赵汝愚', '好景'),
]

results = {mk: [] for mk, _ in SEARCH}
total_scanned = 0

def scan_data(data, src):
    global total_scanned
    for p in data:
        paras = [cc.convert(x) for x in p.get('paragraphs', [])]
        if not paras: continue
        total_scanned += 1
        p0 = paras[0]
        title = cc.convert(p.get('title') or p.get('rhythmic') or '')
        author = cc.convert(p.get('author', '') or '')
        for (mk, frag) in SEARCH:
            if p0.startswith(frag) or (frag in title):
                results[mk].append((author, title, p0[:35], src))

def scan_file(path, src):
    if not path.exists(): return
    with open(path, 'r', encoding='utf-8') as f:
        try: data = json.load(f)
        except: return
    scan_data(data, src)

def scan_dir(d, prefix, src):
    if not d.exists(): return
    for fname in sorted(os.listdir(d)):
        if prefix and not fname.startswith(prefix): continue
        if not fname.endswith('.json'): continue
        if fname.startswith('author') or 'intro' in fname or 'preface' in fname: continue
        scan_file(d / fname, f'{src}/{fname}')

scan_dir(CORPUS_ROOT / '全唐诗', 'poet.', '全唐诗')
scan_dir(CORPUS_ROOT / '宋词', 'ci.song.', '宋词')
scan_dir(CORPUS_ROOT / '御定全唐詩' / 'json', '', '御定')
scan_file(CORPUS_ROOT / '曹操诗集' / 'caocao.json', '曹操')
scan_file(CORPUS_ROOT / '五代诗词' / 'nantang' / 'poetrys.json', '南唐')
scan_dir(CORPUS_ROOT / '五代诗词' / 'huajianji', 'huajianji-', '花间')
scan_file(CORPUS_ROOT / '元曲' / 'yuanqu.json', '元曲')

print(f'Scanned {total_scanned} poems')
print()
for (mk, frag) in SEARCH:
    cs = results[mk]
    print(f'[{mk}] frag="{frag}" → {len(cs)} hits')
    for c in cs[:5]: print(f'   {c[3]:8} | {c[0]} 《{c[1]}》: {c[2]}')
    print()
