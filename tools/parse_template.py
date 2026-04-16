"""
解析 assets/locations/poems_template.md 里用户填写的诗词正文,
与现有 locations.json 对比, 生成需要 patch 的列表

输出:
  assets/audio/parsed_updates.json  — 可以直接用于 patch_poems.py
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
TEMPLATE = ROOT / 'assets' / 'locations' / 'poems_template.md'
LOC_JSON = ROOT / 'assets' / 'locations' / 'locations.json'
OUT = HERE / 'parsed_updates.json'


def split_lines(text):
    """把一整段诗词正文按 逗号/句号/问号/感叹号/分号 切成 phrase list"""
    # 去掉首尾空白
    text = text.strip()
    # 统一标点
    text = re.sub(r'[\u3000 \t]+', '', text)  # 去掉全角/半角空格、tab
    text = text.replace('\n', '')  # 拼接换行
    # 切分: 以各种中文标点为分界
    parts = re.split(r'[，。；！？、,;!?]', text)
    parts = [p.strip() for p in parts if p.strip()]
    return parts


def parse_template():
    content = TEMPLATE.read_text(encoding='utf-8')
    lines = content.split('\n')

    # 正则: 地点/标题 (作者·朝代) [现 N 行 / 长诗跳过]
    header_re = re.compile(
        r'^(.+?)/(.+?)\s*\((.+?)[·\u00b7](.+?)\)\s*\[(.+?)\]\s*$'
    )

    entries = {}  # (location, title) -> {"author","dynasty","note","body_raw","body_lines"}
    current_key = None
    current_body = []

    for line in lines:
        line = line.rstrip()
        m = header_re.match(line.strip())
        if m:
            # 保存上一条
            if current_key:
                body_raw = '\n'.join(current_body).strip()
                entries[current_key]['body_raw'] = body_raw
                entries[current_key]['body_lines'] = split_lines(body_raw)
                current_body = []

            loc, title, author, dyn, note = m.groups()
            current_key = (loc.strip(), title.strip())
            entries[current_key] = {
                'location': loc.strip(),
                'title': title.strip(),
                'author': author.strip(),
                'dynasty': dyn.strip(),
                'note': note.strip(),
                'body_raw': '',
                'body_lines': [],
            }
        elif line.startswith('#') or line.startswith('==='):
            # 标题或分隔符, 不算正文
            continue
        elif current_key:
            current_body.append(line)

    # 保存最后一条
    if current_key:
        body_raw = '\n'.join(current_body).strip()
        entries[current_key]['body_raw'] = body_raw
        entries[current_key]['body_lines'] = split_lines(body_raw)

    return entries


def main():
    entries = parse_template()
    with open(LOC_JSON, 'r', encoding='utf-8') as f:
        locs = json.load(f)

    # 建立现有诗词索引
    current = {}
    for loc in locs:
        for p in loc['poems']:
            current[(loc['name'], p['title'])] = {
                'lines': p['lines'],
                'author': p['author'],
                'dynasty': p['dynasty'],
                'excerpt': p.get('excerpt', False),
            }

    # 分类对比
    to_update = []       # 新内容, 需要 patch
    unchanged = []       # 内容相同, 跳过
    empty = []           # 用户没填, 跳过
    skip_tag = []        # 标记跳过 (长诗)
    missing = []         # 模板里有, locations.json 没有
    mismatch = []        # 作者/朝代不一致

    for key, e in entries.items():
        # 检查是否跳过
        if '跳过' in e['note']:
            skip_tag.append(key)
            continue
        if key not in current:
            missing.append(key)
            continue
        # 检查作者/朝代一致
        cur = current[key]
        if e['author'] != cur['author'] or e['dynasty'] != cur['dynasty']:
            mismatch.append((key, e['author'], e['dynasty'], cur['author'], cur['dynasty']))
        # 空白 = 用户没填
        if not e['body_lines']:
            empty.append(key)
            continue
        # 内容相同?
        if e['body_lines'] == cur['lines']:
            unchanged.append(key)
            continue
        # 需要更新
        to_update.append({
            'location': e['location'],
            'title': e['title'],
            'author': e['author'],
            'dynasty': e['dynasty'],
            'old_line_count': len(cur['lines']),
            'new_line_count': len(e['body_lines']),
            'old_first_line': cur['lines'][0] if cur['lines'] else '',
            'new_first_line': e['body_lines'][0] if e['body_lines'] else '',
            'new_lines': e['body_lines'],
        })

    # 输出
    print('=' * 60)
    print(f'模板总条目: {len(entries)}')
    print(f'  需要 patch (内容变化): {len(to_update)}')
    print(f'  内容相同 (已完整): {len(unchanged)}')
    print(f'  用户未填写 (空): {len(empty)}')
    print(f'  标记跳过 (长诗): {len(skip_tag)}')
    print(f'  模板有但数据里没有: {len(missing)}')
    print(f'  作者/朝代不一致警告: {len(mismatch)}')
    print('=' * 60)

    if mismatch:
        print()
        print('⚠️ 作者/朝代不一致:')
        for key, na, nd, ca, cd in mismatch:
            print(f'  {key[0]}/{key[1]}: 模板 "{na}·{nd}" vs 现 "{ca}·{cd}"')

    if missing:
        print()
        print('⚠️ 模板里有但数据里没有 (可能多写或拼写错):')
        for key in missing:
            print(f'  {key[0]}/{key[1]}')

    if to_update:
        print()
        print('将要 patch 的诗词 (按地点排序):')
        to_update.sort(key=lambda x: (x['location'], x['title']))
        for u in to_update:
            old_n = u['old_line_count']
            new_n = u['new_line_count']
            change = '+' + str(new_n - old_n) if new_n > old_n else (
                '=' if new_n == old_n else str(new_n - old_n))
            print(f'  {u["location"]}/{u["title"]} ({u["author"]}·{u["dynasty"]}) '
                  f'{old_n}→{new_n} [{change}]')

    # 写入 JSON 供 patch_poems.py 后续读取
    save = {
        'to_update': to_update,
        'unchanged_count': len(unchanged),
        'empty_count': len(empty),
        'skip_count': len(skip_tag),
        'missing': [list(k) for k in missing],
        'mismatch': [
            {'key': list(k), 'template_author': na, 'template_dynasty': nd,
             'current_author': ca, 'current_dynasty': cd}
            for k, na, nd, ca, cd in mismatch
        ],
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(save, f, ensure_ascii=False, indent=2)
    print()
    print(f'[写入] {OUT}')


if __name__ == '__main__':
    main()
