"""
从 诗词山河.html 里提取所有地点和诗词数据,
生成 assets/locations/locations.json 和 locations.csv
供后续查图 / 生成 3D 模型使用
"""
import re
import json
import os
import csv

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HTML_PATH = os.path.join(ROOT, '诗词山河.html')
OUT_DIR = os.path.join(HERE, 'locations')
os.makedirs(OUT_DIR, exist_ok=True)

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# ────────────────────────────────────────
# 把 JS 的 R 数组转成 Python 可读的 JSON
# ────────────────────────────────────────
m = re.search(r'const R=(\[)', content)
if not m:
    raise SystemExit('找不到 const R=[')
start = m.end() - 1  # 指向 [
depth = 0
i = start
while i < len(content):
    ch = content[i]
    if ch == '[':
        depth += 1
    elif ch == ']':
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
raw = content[start:end]

# 简单 JS → JSON 转换:
# 1. 对象字面量里有 {k:v} 形式的 opts (hl, excerpt) — 需要加引号
# 2. 单引号 → 双引号
# 保留单引号在字符串内部时要小心, 但此数据没有撇号
js_raw = raw

# 把对象字面量的 key 加引号: {hl:true} → {"hl":true}
js_raw = re.sub(r'\{(\w+):', r'{"\1":', js_raw)
# 多个 key 的情况 {hl:true,excerpt:true}
prev = None
while prev != js_raw:
    prev = js_raw
    js_raw = re.sub(r',(\w+):', r',"\1":', js_raw)

# 单引号 → 双引号
js_raw = js_raw.replace("'", '"')

try:
    R = json.loads(js_raw)
except json.JSONDecodeError as e:
    print('JSON parse error at char', e.pos)
    print(js_raw[max(0, e.pos-80):e.pos+80])
    raise

print(f'解析成功, 共 {len(R)} 个地点')

# ────────────────────────────────────────
# 地点 → 代表建筑/风景 的注释字典
# (手工整理的古典意象 + 著名建筑)
# ────────────────────────────────────────
LANDMARKS = {
    '长安':       ['大明宫含元殿', '未央宫遗址', '大雁塔', '小雁塔', '曲江池', '乐游原', '灞桥', '城墙角楼'],
    '渭城':       ['渭水古桥', '阳关道驿站', '古柳丛', '汉代驿亭'],
    '终南山':     ['终南主峰', '太乙池', '翠华山', '楼观台', '唐代道观'],
    '华山':       ['西峰斧劈石', '长空栈道', '苍龙岭', '北斗九星阁', '玉泉院'],
    '蓝关':       ['蓝关古道', '秦岭蓝关关楼', '山间驿站', '秦岭雪峰'],
    '秦州':       ['秦州古城', '麦积山石窟', '伏羲庙', '渭水源头'],
    '汉中':       ['古汉台', '拜将坛', '定军山', '褒斜栈道', '石门水库'],
    '潼关':       ['潼关古城楼', '风陵渡', '黄河拐角', '华山北麓'],
    '洛阳':       ['龙门石窟', '白马寺', '天堂明堂', '洛水洛浦', '应天门', '牡丹园'],
    '鹳雀楼':     ['鹳雀楼', '黄河三门峡', '蒲州古城墙', '中条山'],
    '汴京':       ['汴河虹桥', '樊楼酒楼', '州桥', '大相国寺', '开封铁塔', '清明上河图长街'],
    '许昌':       ['许昌古城', '魏王故宫遗址', '曹魏武库', '灞陵桥'],
    '太原':       ['晋祠', '难老泉', '圣母殿', '鱼沼飞梁', '崇善寺'],
    '延州':       ['延州古城楼', '清凉山', '塞外烽火台', '长城残垣'],
    '幽州':       ['蓟门烟树', '幽州台', '卢沟晓月', '古燕长城', '潞河渡口'],
    '凉州':       ['凉州古城', '雷台汉墓', '大云寺', '玉门关遥望', '祁连雪山'],
    '阳关':       ['阳关故址', '阳关烽燧', '古董滩', '寿昌城遗址'],
    '泰山':       ['岱庙', '南天门', '日观峰', '经石峪', '碧霞祠', '十八盘'],
    '密州':       ['超然台', '密州州衙', '诸城黑龙潭', '齐鲁古城墙'],
    '彭城':       ['黄楼', '云龙山', '戏马台', '项羽故地', '燕子楼'],
    '金陵':       ['乌衣巷', '朱雀桥', '秦淮河夫子庙', '凤凰台', '石头城', '古鸡鸣寺'],
    '扬州':       ['二十四桥', '瘦西湖五亭桥', '大明寺', '平山堂', '个园', '古运河'],
    '镇江':       ['北固山', '金山寺', '焦山', '西津渡', '甘露寺'],
    '苏州':       ['寒山寺', '枫桥', '拙政园', '虎丘塔', '古运河', '盘门'],
    '杭州':       ['断桥残雪', '雷峰夕照', '三潭印月', '灵隐寺', '六和塔', '保俶塔'],
    '越州':       ['沈园', '大禹陵', '兰亭', '鉴湖', '会稽山'],
    '白帝城':     ['白帝庙', '夔门', '瞿塘峡', '巫山十二峰入口', '古三峡栈道'],
    '峨眉山':     ['金顶舍身崖', '报国寺', '伏虎寺', '清音阁', '万年寺'],
    '梓州':       ['牛头山', '梓州古城', '梓潼文昌宫'],
    '巴山':       ['巴山峰峦', '明月峡', '夜雨竹林', '古柏栈道'],
    '天姥山':     ['天姥峰', '会墅岭', '天台古道', '东海云雾'],
    '荆州':       ['荆州古城楼', '关羽祠', '三国古战场', '江陵古渡'],
    '玉门关':     ['玉门关小方盘城', '汉长城烽燧', '戈壁雅丹', '祁连雪山'],
    '大散关':     ['大散关古关楼', '秦岭关隘', '渭水源头', '古驿道'],
    '邯郸':       ['学步桥', '丛台', '赵王城遗址', '吕仙祠'],
    # 其余地点补充
    '岳阳':       ['岳阳楼', '洞庭湖', '君山岛', '三醉亭', '怀甫亭'],
    '黄鹤楼':     ['黄鹤楼', '长江古渡', '晴川阁', '蛇山'],
    '浔阳':       ['浔阳江琵琶亭', '庐山东林寺', '白鹿洞书院', '烟水亭'],
    '滕王阁':     ['滕王阁', '赣江落霞', '南昌古城墙'],
    '赤壁':       ['赤壁矶', '赤壁古战场', '江夏古城'],
    '襄阳':       ['岘山', '襄阳古城', '古隆中', '汉江'],
    '黄州':       ['东坡赤壁', '安国寺', '黄冈古城墙', '定惠院'],
    '建康':       ['台城遗址', '乌衣古巷', '燕子矶', '栖霞古寺'],
    '崖山':       ['崖山古战场', '崖门炮台', '南宋末代行宫遗址'],
    '桂林':       ['象鼻山', '独秀峰', '漓江', '七星岩'],
    '柳州':       ['柳侯祠', '鱼峰山', '柳江'],
    '成都':       ['杜甫草堂', '武侯祠', '锦江', '青城山', '望江楼'],
    '青城山':     ['青城主峰', '天师洞', '上清宫', '建福宫'],
    '岷江':       ['岷江峡口', '都江堰', '青城群峰'],
    '滁州':       ['醉翁亭', '琅琊山', '丰乐亭'],
    '九江':       ['庐山', '东林寺', '石钟山', '浔阳楼'],
    '九华山':     ['九华主峰', '化城寺', '百岁宫'],
    '武夷山':     ['天游峰', '九曲溪', '大红袍母树', '武夷宫'],
    '莫愁湖':     ['莫愁女像', '胜棋楼', '湖心亭'],
    '寒山寺':     ['寒山寺钟楼', '枫桥', '古运河'],
    '玄武湖':     ['玄武门', '梁洲', '樱洲'],
    # 补充
    '宣城':       ['敬亭山', '谢朓楼', '宛溪河', '广教寺双塔'],
    '池州':       ['齐山', '九华山', '秋浦河', '杏花村古井'],
    '合肥':       ['包公祠', '逍遥津', '蜀山森林公园', '淮浦春融'],
    '庐山':       ['五老峰', '三叠泉', '含鄱口', '花径', '仙人洞', '东林寺'],
    '荆门':       ['象山', '龙泉公园', '明显陵', '荆门州城楼'],
    '潭州':       ['岳麓书院', '橘子洲', '天心阁', '爱晚亭', '麓山寺'],
    '永州':       ['柳子庙', '浯溪碑林', '朝阳岩', '愚溪', '永州八景'],
    '郴州':       ['苏仙岭', '三绝碑亭', '郴江古渡'],
    '南昌':       ['滕王阁', '八一广场', '绳金塔', '百花洲'],
    '赣州':       ['八境台', '郁孤台', '通天岩', '赣州古城墙'],
    '吉州':       ['白鹭洲书院', '螺子山', '文天祥纪念馆'],
    '泉州':       ['开元寺东西塔', '清净寺', '洛阳桥', '九日山', '天后宫'],
    '福州':       ['三坊七巷', '乌塔', '白塔', '鼓山涌泉寺', '镇海楼'],
    '建州':       ['建州古城楼', '黄华山', '通仙桥', '建溪'],
    '剑门':       ['剑门关楼', '剑山七十二峰', '翠云廊', '姜维墓'],
    '阆中':       ['阆中古城', '华光楼', '张飞庙', '嘉陵江古渡', '滕王阁 (阆中版)'],
}

# ────────────────────────────────────────
# 整理输出
# ────────────────────────────────────────
locations_out = []
poems_flat = []

for entry in R:
    name = entry[0]
    lon = entry[1]
    lat = entry[2]
    icon = entry[3]
    poems = entry[4]

    landmarks = LANDMARKS.get(name, ['(待补充)'])

    poem_list = []
    for p in poems:
        if len(p) >= 4:
            title = p[0]
            author = p[1]
            dynasty = p[2]
            lines = p[3]
            opts = p[4] if len(p) > 4 else {}
            poem_list.append({
                'title': title,
                'author': author,
                'dynasty': dynasty,
                'lines': lines,
                'hl': bool(opts.get('hl', False)),
                'excerpt': bool(opts.get('excerpt', False)),
            })
            poems_flat.append({
                'location': name,
                'lon': lon,
                'lat': lat,
                'title': title,
                'author': author,
                'dynasty': dynasty,
                'full_text': '，'.join(lines) + '。',
                'representative_landmarks': ' | '.join(landmarks),
            })

    locations_out.append({
        'name': name,
        'lon': lon,
        'lat': lat,
        'icon': icon,
        'representative_landmarks': landmarks,
        'poem_count': len(poem_list),
        'poems': poem_list,
    })

# JSON
json_path = os.path.join(OUT_DIR, 'locations.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(locations_out, f, ensure_ascii=False, indent=2)
print(f'[写入] {json_path} ({len(locations_out)} 地点)')

# CSV - 诗词展开 (一首诗一行)
csv_path = os.path.join(OUT_DIR, 'poems.csv')
with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=[
        'location', 'lon', 'lat',
        'title', 'author', 'dynasty',
        'full_text', 'representative_landmarks',
    ])
    w.writeheader()
    for row in poems_flat:
        w.writerow(row)
print(f'[写入] {csv_path} ({len(poems_flat)} 首诗)')

# CSV - 地点一行 (用于 3D 模型规划)
loc_csv = os.path.join(OUT_DIR, 'locations_summary.csv')
with open(loc_csv, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=[
        'name', 'lon', 'lat', 'icon',
        'poem_count', 'representative_landmarks',
    ])
    w.writeheader()
    for loc in locations_out:
        w.writerow({
            'name': loc['name'],
            'lon': loc['lon'],
            'lat': loc['lat'],
            'icon': loc['icon'],
            'poem_count': loc['poem_count'],
            'representative_landmarks': ' | '.join(loc['representative_landmarks']),
        })
print(f'[写入] {loc_csv}')

# 统计
total_poems = sum(len(loc['poems']) for loc in locations_out)
covered = sum(1 for loc in locations_out if loc['representative_landmarks'] != ['(待补充)'])
print(f'')
print(f'统计:')
print(f'  地点总数: {len(locations_out)}')
print(f'  诗词总数: {total_poems}')
print(f'  已标注代表建筑/风景的地点: {covered}/{len(locations_out)}')
missing = [loc['name'] for loc in locations_out if loc['representative_landmarks'] == ['(待补充)']]
if missing:
    print(f'  待补充: {", ".join(missing)}')
