"""
把用户手工编辑后的 manual_lines.json 规范化:
  - 用户用裸文本写在 [...] 里, 解析出每行作为数组元素
  - 空数组 [] 的条目直接删除
  - 以 _ 开头的注释 key 也删掉
"""
import json, re
from pathlib import Path

SRC = Path(__file__).parent.parent / 'src' / 'data' / 'manual_lines.json'

with open(SRC, 'r', encoding='utf-8') as f:
    raw = f.read()

# 匹配 "key": [...] 的块 (中间可以跨行, 最短匹配)
PAT = re.compile(r'"([^"]+)"\s*:\s*\[(.*?)\](?=\s*[,}])', re.DOTALL)

result = {}
for m in PAT.finditer(raw):
    k = m.group(1)
    body = m.group(2).strip()
    if k.startswith('_'):
        continue
    if not body:
        continue  # 空数组 → 跳过
    # 若已是合法 JSON 字符串列表
    if body.lstrip().startswith('"'):
        try:
            arr = json.loads('[' + body + ']')
            if arr:
                result[k] = arr
            continue
        except Exception:
            pass
    # 按换行拆行, 每行作为独立字符串
    lines = []
    for ln in body.split('\n'):
        s = ln.strip().rstrip(',').strip()
        # 去除残留的外层引号
        if s.startswith('"') and s.endswith('"') and len(s) >= 2:
            s = s[1:-1]
        if s:
            lines.append(s)
    if lines:
        result[k] = lines

with open(SRC, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f'Wrote {len(result)} entries')
for k in result:
    print(f'  {k}: {len(result[k])} 行')
