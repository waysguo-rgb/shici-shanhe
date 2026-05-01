// 名句立牌数据 — 每句国民级诗词名句, 挂在对应地点附近上空的 sprite 立牌上.
// city 必须对应 locations.json 里的 name (否则该句不显示).
// dyn: 该句所属朝代 (用于朝代滤镜联动).
// author: 作者 (点击立牌时可帮助高亮面板里的对应诗).
// yOff: 立牌相对 location Y 的高度偏移.
// boardSize: 0.8 ~ 1.4, 字多的句子给 1.2+ 避免挤.

export const FAMOUS_LINES = [
  { line: '会当凌绝顶 · 一览众山小',        city: '泰山',    dyn: '唐', author: '杜甫', yOff: 5.5, boardSize: 1.0 },
  { line: '落霞与孤鹜齐飞 · 秋水共长天一色', city: '南昌',    dyn: '唐', author: '王勃', yOff: 4.8, boardSize: 1.3 },
  { line: '大江东去 · 浪淘尽千古风流人物',   city: '黄州',    dyn: '宋', author: '苏轼', yOff: 4.5, boardSize: 1.2 },
  { line: '大漠孤烟直 · 长河落日圆',        city: '凉州',    dyn: '唐', author: '王维', yOff: 4.5, boardSize: 1.0 },
  { line: '劝君更尽一杯酒 · 西出阳关无故人', city: '阳关',    dyn: '唐', author: '王维', yOff: 4.5, boardSize: 1.2 },
  { line: '朝辞白帝彩云间 · 千里江陵一日还', city: '白帝城',  dyn: '唐', author: '李白', yOff: 4.8, boardSize: 1.2 },
  { line: '姑苏城外寒山寺 · 夜半钟声到客船', city: '苏州',    dyn: '唐', author: '张继', yOff: 4.5, boardSize: 1.2 },
  { line: '烟花三月下扬州',                city: '扬州',    dyn: '唐', author: '李白', yOff: 4.5, boardSize: 0.9 },
  { line: '孤帆远影碧空尽 · 唯见长江天际流', city: '黄鹤楼',  dyn: '唐', author: '李白', yOff: 5.0, boardSize: 1.2 },
  { line: '欲穷千里目 · 更上一层楼',        city: '鹳雀楼',  dyn: '唐', author: '王之涣', yOff: 5.0, boardSize: 1.0 },
  { line: '春风又绿江南岸 · 明月何时照我还', city: '镇江',    dyn: '宋', author: '王安石', yOff: 4.5, boardSize: 1.2 },
  { line: '清明时节雨纷纷 · 路上行人欲断魂', city: '池州',    dyn: '唐', author: '杜牧', yOff: 4.5, boardSize: 1.2 },
  { line: '露从今夜白 · 月是故乡明',        city: '秦州',    dyn: '唐', author: '杜甫', yOff: 4.5, boardSize: 1.0 },
  { line: '飞流直下三千尺 · 疑是银河落九天', city: '庐山',    dyn: '唐', author: '李白', yOff: 5.5, boardSize: 1.2 },
  { line: '但愿人长久 · 千里共婵娟',        city: '密州',    dyn: '宋', author: '苏轼', yOff: 4.5, boardSize: 1.0 },
  { line: '感时花溅泪 · 恨别鸟惊心',        city: '长安',    dyn: '唐', author: '杜甫', yOff: 4.5, boardSize: 1.0 },
  { line: '独在异乡为异客 · 每逢佳节倍思亲', city: '华山',    dyn: '唐', author: '王维', yOff: 5.2, boardSize: 1.2 },
  { line: '少小离家老大回 · 乡音无改鬓毛衰', city: '越州',    dyn: '唐', author: '贺知章', yOff: 4.5, boardSize: 1.2 },
  { line: '东风夜放花千树',                city: '杭州',    dyn: '宋', author: '辛弃疾', yOff: 4.5, boardSize: 0.95 },
  { line: '孤舟蓑笠翁 · 独钓寒江雪',        city: '永州',    dyn: '唐', author: '柳宗元', yOff: 4.5, boardSize: 1.0 },
];

export default FAMOUS_LINES;
