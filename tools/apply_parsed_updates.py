"""
读取 parsed_updates.json (由 parse_template.py 生成),
直接对 诗词山河.html 应用正则替换

用法:
  python assets/audio/apply_parsed_updates.py            # 预览
  python assets/audio/apply_parsed_updates.py --apply    # 真正写入

跳过列表 SKIP 里的条目会被忽略 (比如有争议的作者/版本)
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
HTML_PATH = ROOT / '诗词山河.html'
PARSED_JSON = HERE / 'parsed_updates.json'

# 有争议, 保持现状不更新
SKIP = {
    ('华山', '登华山'),    # 用户填的正文和现作者 金章宗 对不上, 不更新
    ('庐山', '庐山谣'),    # 用户填的是中段 4 句, 保留现有开头段落
}


def format_lines(lines):
    return '[' + ','.join(f"'{l}'" for l in lines) + ']'


def apply():
    with open(PARSED_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    content = HTML_PATH.read_text(encoding='utf-8')
    applied = 0
    skipped = 0
    missing = []

    for u in data['to_update']:
        loc = u['location']
        title = u['title']
        new_lines = u['new_lines']

        if (loc, title) in SKIP:
            skipped += 1
            print(f'  - {loc}/{title}  [SKIP: 有争议, 保持现状]')
            continue

        # 用正则找到 ['title','author','dyn',[lines]] 并替换 [lines] 部分
        # 注: 对于同标题重复 (如登鹳雀楼 畅当/王之涣), 匹配第一个
        pattern = re.compile(
            r"(\['" + re.escape(loc) + r"'[^\n]*?\[\s*'" +
            re.escape(title) + r"'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*)\[[^\[\]]*?\]",
            re.DOTALL
        )
        m = pattern.search(content)
        if not m:
            missing.append((loc, title))
            print(f'  ✗ {loc}/{title}  [REGEX 未匹配]')
            continue

        new_js = format_lines(new_lines)
        content = content[:m.start()] + m.group(1) + new_js + content[m.end():]
        applied += 1
        old_author = m.group(2)
        print(f'  ✓ {loc}/{title} ({old_author}) {u["old_line_count"]}→{u["new_line_count"]}')

    print()
    print(f'应用: {applied}, 跳过: {skipped}, 未匹配: {len(missing)}')

    return content, applied


def main():
    apply_flag = '--apply' in sys.argv
    content, n = apply()
    if not apply_flag:
        print('\n(预览模式, 未写入, 加 --apply 真正应用)')
        return
    if n == 0:
        print('没有改动')
        return
    HTML_PATH.write_text(content, encoding='utf-8')
    print(f'\n已写入 {HTML_PATH}')


if __name__ == '__main__':
    main()
