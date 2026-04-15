"""
补全诗词山河.html 里明显不完整的律诗 (4 行 → 8 行)
只补最明确的几首, 长诗和散文保持现状

运行:
  python assets/audio/patch_poems.py           # 预览改动
  python assets/audio/patch_poems.py --apply   # 真正写入

补全数据由用户提供, 脚本只负责定位 + 替换
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
HTML_PATH = ROOT / '诗词山河.html'

# ────────────────────────────────────────
# 补全数据: (location, title, author) → complete lines
# 只包含明显 4 → 8 律诗 和 2 → 4 绝句 的修复
# 其余长诗/散文维持现有状态 (用户后续可自行 Edit)
# ────────────────────────────────────────
# 注: 这些都是公开的中小学语文课本标准文本, 不做任何改动,
# 保持和教材一致的行分隔方式 (逗号/句号为一行的界限)
UPDATES = {
    # 每个 key 是 (location, title), 值是新的行列表
    # 律诗 4 → 8: 补全下半首 (颈联 + 尾联)
    # 这些都是用户现有数据里已有前 4 行的诗, 我只填后 4 行

    # 杜甫 登高 (白帝城) — 4 行已有前 4 句 (首联+颔联), 补颈联+尾联
    ('白帝城', '登高'): [
        '风急天高猿啸哀', '渚清沙白鸟飞回',
        '无边落木萧萧下', '不尽长江滚滚来',
        '万里悲秋常作客', '百年多病独登台',
        '艰难苦恨繁霜鬓', '潦倒新停浊酒杯',
    ],

    # 杜甫 春夜喜雨 (成都)
    ('成都', '春夜喜雨'): [
        '好雨知时节', '当春乃发生',
        '随风潜入夜', '润物细无声',
        '野径云俱黑', '江船火独明',
        '晓看红湿处', '花重锦官城',
    ],

    # 杜甫 蜀相 (成都)
    ('成都', '蜀相'): [
        '丞相祠堂何处寻', '锦官城外柏森森',
        '映阶碧草自春色', '隔叶黄鹂空好音',
        '三顾频烦天下计', '两朝开济老臣心',
        '出师未捷身先死', '长使英雄泪满襟',
    ],

    # 李商隐 锦瑟 (巴山)
    ('巴山', '锦瑟'): [
        '锦瑟无端五十弦', '一弦一柱思华年',
        '庄生晓梦迷蝴蝶', '望帝春心托杜鹃',
        '沧海月明珠有泪', '蓝田日暖玉生烟',
        '此情可待成追忆', '只是当时已惘然',
    ],

    # 杜甫 春日忆李白 (梓州)
    ('梓州', '春日忆李白'): [
        '白也诗无敌', '飘然思不群',
        '清新庾开府', '俊逸鲍参军',
        '渭北春天树', '江东日暮云',
        '何时一樽酒', '重与细论文',
    ],

    # 杜甫 登岳阳楼 (岳阳)
    ('岳阳', '登岳阳楼'): [
        '昔闻洞庭水', '今上岳阳楼',
        '吴楚东南坼', '乾坤日夜浮',
        '亲朋无一字', '老病有孤舟',
        '戎马关山北', '凭轩涕泗流',
    ],

    # 王维 终南山 (终南山) — 现有 7 行, 补到 8 行标准律诗
    ('终南山', '终南山'): [
        '太乙近天都', '连山接海隅',
        '白云回望合', '青霭入看无',
        '分野中峰变', '阴晴众壑殊',
        '欲投人处宿', '隔水问樵夫',
    ],

    # 王维 使至塞上 (延州) — 现只有颈联 2 句, 补全律诗 8 句
    ('延州', '使至塞上'): [
        '单车欲问边', '属国过居延',
        '征蓬出汉塞', '归雁入胡天',
        '大漠孤烟直', '长河落日圆',
        '萧关逢候骑', '都护在燕然',
    ],

    # 杜甫 江南逢李龟年 (潭州) — 绝句 2 → 4 行
    ('潭州', '江南逢李龟年'): [
        '岐王宅里寻常见', '崔九堂前几度闻',
        '正是江南好风景', '落花时节又逢君',
    ],
}


def format_lines(lines):
    """把 lines 列表格式化成 JS 数组形式 ['xxx','xxx',...]"""
    return '[' + ','.join(f"'{l}'" for l in lines) + ']'


def patch():
    content = HTML_PATH.read_text(encoding='utf-8')
    original = content
    applied = 0
    missing = []

    for (loc, title), new_lines in UPDATES.items():
        # 构造正则: 找到 location 行内包含 ['title','author','dyn',[...]]
        # 位置行格式: ['长安',108.94,34.26,'🏯',[...poems...]]
        # 每首诗: ['title','author','dynasty',[lines],opts?]
        # 我们要替换其中 [lines] 部分

        # 先找到 location 所在的那一行
        loc_pattern = re.compile(
            r"(\['" + re.escape(loc) + r"'[^\n]*?\[\s*'" +
            re.escape(title) + r"'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*)\[[^\[\]]*?\]",
            re.DOTALL
        )
        m = loc_pattern.search(content)
        if not m:
            missing.append((loc, title))
            continue

        new_lines_js = format_lines(new_lines)
        content = content[:m.start()] + m.group(1) + new_lines_js + content[m.end():]
        applied += 1
        print(f'  ✓ {loc}/{title}  ({m.group(2)} · {m.group(3)}) — {len(new_lines)} 行')

    print(f'\n应用: {applied}/{len(UPDATES)}')
    if missing:
        print('未找到:')
        for loc, title in missing:
            print(f'  ✗ {loc}/{title}')

    return content, applied


def main():
    apply = '--apply' in sys.argv
    content, n = patch()
    if not apply:
        print('\n(预览模式, 未写入, 加 --apply 真正应用)')
        return
    if n == 0:
        print('没有改动')
        return
    HTML_PATH.write_text(content, encoding='utf-8')
    print(f'\n已写入 {HTML_PATH}')


if __name__ == '__main__':
    main()
