"""
对剩 27 首 miss, 在整个 chinese-poetry-master/ 下所有 JSON 里搜首句关键字片段.
无论在哪个子目录 (诗经/楚辞/论语/蒙学也扫一遍) 都找.
"""
import json, os
from pathlib import Path
from opencc import OpenCC

ROOT = Path(__file__).parent.parent / 'chinese-poetry-master'
cc = OpenCC('t2s')

# meta_key → (firstLine_fragment, author_check)
# author_check=None 表示不限作者
TARGETS = [
    ('乌山|赵汝愚', '好景', '赵汝愚'),
    ('剑阁赋|李白', '咸阳', '李白'),
    ('天仙子|贺铸',  '韶华', '贺铸'),
    ('小石潭记|柳宗元', '从小丘西行', None),
    ('岳阳楼记|欧阳修', '庆历四年', None),
    ('岳阳楼记|范仲淹', '庆历四年', None),
    ('己亥杂诗|龚自珍', '九州生气', None),
    ('晋祠|李白', '晋祠流水', '李白'),
    ('杨柳枝|柳宗元', '杨柳', '柳宗元'),
    ('沁园春·长沙|毛泽东', '独立寒秋', None),
    ('泰山吟|谢道韫', '峨峨东岳', None),
    ('潼关|谭嗣同', '终古高云', None),
    ('独秀峰|袁枚', '来龙', None),
    ('登华山|金章宗', '华山', '金章宗'),
    ('登泰山|张岱', '岱', None),
    ('秋声赋|欧阳修', '欧阳子方夜读', None),
    ('秋日登清源山|陈允平', '林外', '陈允平'),
    ('苏堤春晓|杨周', '树色', None),
    ('菩萨蛮·黄鹤楼|毛泽东', '茫茫九派', None),
    ('行香子|秦观', '树绕村庄', '秦观'),
    ('记承天寺夜游|苏轼', '元丰六年', None),
    ('醉翁亭记|欧阳修', '环滁皆山', None),
    ('陋室铭|刘禹锡', '山不在高', None),
    ('题岳麓寺|张栻', None, '张栻'),        # 无 firstLine 确信, 按作者+标题扫
    ('饮酒|陶渊明', '结庐', None),
    ('蝶恋花|晏殊 · 六曲阑干偎碧树', '六曲阑干', None),
    ('蝶恋花|欧阳修 · 庭院深深深几许', '庭院深深', None),
]

hits = {k: [] for k, _, _ in TARGETS}
scanned = 0

def scan(data, src):
    global scanned
    for p in data:
        if not isinstance(p, dict): continue
        paras = p.get('paragraphs') or p.get('content') or []
        if isinstance(paras, str): paras = [paras]
        if not paras: continue
        paras = [cc.convert(x) if isinstance(x, str) else '' for x in paras]
        scanned += 1
        p0 = paras[0]
        title = cc.convert(p.get('title') or p.get('rhythmic') or '')
        author = cc.convert(p.get('author', '') or '')
        joined = ''.join(paras)[:60]
        for (mk, frag, auth_c) in TARGETS:
            if auth_c and author and auth_c not in author and author not in auth_c: continue
            match = False
            if frag:
                if frag in joined: match = True
            else:
                # 无 frag → 用 title 含 meta title 的片段 (取 '|' 前)
                mt = mk.split('|')[0]
                if mt in title: match = True
            if match:
                hits[mk].append((src, author, title, p0[:40]))

def walk_and_scan(root):
    for p in root.rglob('*.json'):
        # 跳过巨型 corpus 已经扫过的子集 (避免刷屏)
        if 'ci.song' in p.name or 'poet.tang' in p.name or 'poet.song' in p.name: continue
        if p.name.startswith('author'): continue
        rel = p.relative_to(root)
        try:
            with open(p, 'r', encoding='utf-8') as f: data = json.load(f)
        except: continue
        if isinstance(data, list): scan(data, str(rel))

walk_and_scan(ROOT)
print(f'Scanned {scanned} poems\n')

for (mk, frag, auth_c) in TARGETS:
    cs = hits[mk]
    print(f'[{mk}] frag={frag} → {len(cs)} hits')
    for c in cs[:3]:
        print(f'  {c[0]} | {c[1]}《{c[2]}》: {c[3]}')
    print()
