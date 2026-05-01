// 诗人行程数据 — 每位诗人在诗史上有代表性的城市按时间顺序排列.
// city 字段必须对应 public/assets/locations/locations.json 里的 name.
// note 是简短的时期/心境标签 (2-6 字), 播放时可显示给用户.
// year 尽量用真实年代, 不确切的用 "约xxx" 或省略.
//
// 这些行程是诗歌史上常被引用的"经典路线", 不是完整年表.

export const POET_JOURNEYS = [
  {
    name: '李白',
    dyn:  '唐',
    life: '701-762',
    desc: '一生漂泊, 从蜀地出夔门, 游历南北, 晚年隐于宣城',
    stops: [
      { city: '成都',     year: '约720',  note: '出蜀前' },
      { city: '峨眉山',   year: '约724',  note: '少年游' },
      { city: '剑门',     year: '725',    note: '出蜀' },
      { city: '白帝城',   year: '725',    note: '朝辞白帝' },
      { city: '荆门',     year: '725',    note: '渡荆门' },
      { city: '扬州',     year: '726',    note: '散金结客' },
      { city: '金陵',     year: '727',    note: '金陵酒肆' },
      { city: '长安',     year: '742',    note: '供奉翰林' },
      { city: '洛阳',     year: '744',    note: '逢杜甫' },
      { city: '庐山',     year: '756',    note: '望庐山' },
      { city: '浔阳',     year: '757',    note: '系浔阳狱' },
      { city: '宣城',     year: '761',    note: '晚岁之地' },
    ],
  },
  {
    name: '杜甫',
    dyn:  '唐',
    life: '712-770',
    desc: '半生漂泊, 安史之乱后流寓蜀地夔州, 终殁于湘江舟上',
    stops: [
      { city: '洛阳',     year: '约730',  note: '初游齐赵' },
      { city: '泰山',     year: '736',    note: '望岳' },
      { city: '长安',     year: '746',    note: '困顿十年' },
      { city: '秦州',     year: '759',    note: '弃官西行' },
      { city: '成都',     year: '760',    note: '草堂春色' },
      { city: '梓州',     year: '762',    note: '避乱' },
      { city: '阆中',     year: '764',    note: '阆州春望' },
      { city: '白帝城',   year: '766',    note: '夔州孤城' },
      { city: '岳阳',     year: '768',    note: '登岳阳楼' },
      { city: '潭州',     year: '770',    note: '长沙晚岁' },
    ],
  },
  {
    name: '苏轼',
    dyn:  '宋',
    life: '1037-1101',
    desc: '仕途跌宕, 从汴京贬黄州, 再南至岭南, 豁达自得',
    stops: [
      { city: '汴京',     year: '1061',   note: '初登朝班' },
      { city: '杭州',     year: '1071',   note: '通判杭州' },
      { city: '密州',     year: '1075',   note: '知密州' },
      { city: '彭城',     year: '1077',   note: '知徐州' },
      { city: '黄州',     year: '1080',   note: '贬黄州' },
      { city: '杭州',     year: '1089',   note: '再守杭州' },
      { city: '扬州',     year: '1092',   note: '知扬州' },
    ],
  },
  {
    name: '王维',
    dyn:  '唐',
    life: '701-761',
    desc: '半官半隐, 长安 · 终南之间, 山水田园的代表',
    stops: [
      { city: '长安',     year: '约721',  note: '中进士' },
      { city: '凉州',     year: '737',    note: '出使河西' },
      { city: '阳关',     year: '737',    note: '送元二使安西' },
      { city: '终南山',   year: '约740',  note: '辋川别业' },
      { city: '洛阳',     year: '755',    note: '安史乱中' },
    ],
  },
  {
    name: '白居易',
    dyn:  '唐',
    life: '772-846',
    desc: '长安入仕, 贬江州司马后豁然, 晚年洛阳闲居',
    stops: [
      { city: '长安',     year: '806',    note: '任左拾遗' },
      { city: '浔阳',     year: '815',    note: '江州司马' },
      { city: '庐山',     year: '817',    note: '草堂记' },
      { city: '杭州',     year: '822',    note: '刺史' },
      { city: '苏州',     year: '825',    note: '刺史' },
      { city: '洛阳',     year: '829',    note: '晚岁闲居' },
    ],
  },
];

export default POET_JOURNEYS;
