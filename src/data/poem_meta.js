// 诗词元数据库 — 给每首诗补 {year, mood, related}.
// key 是 `title|author` 字符串. 加载时在 loadLocations 里合并进 poem 对象.
//
// year: 创作年份 (公元). 不确定的给朝代中期估值.
// mood: {tod: 'dawn'|'noon'|'dusk'|'night', weather: 'rain'|'snow'|'none', note?}
//       — 用于"滑到哪首自动切天气/昼夜". 不设则沿用用户当前场景.
// related: 关联到其它诗的 `title|author` key 列表. 可按"感情/对象/作者/意境"几类
//          标签化, 用 {type:'author'|'theme'|'object'|'mood', target:'xx|yy'} 也行,
//          这里先简单数组保持轻量.
//
// 未在此表内的诗按 dynasty 中点估年 (见 _dynastyMid 函数).

export const POEM_META = {
  // 唐诗
  '静夜思|李白':               { year: 726, location: '扬州', mood: { tod: 'night',  weather: 'none' }, related: ['月下独酌|李白', '关山月|李白'] },
  '月下独酌|李白':             { year: 744, location: '长安', mood: { tod: 'night',  weather: 'none' }, related: ['静夜思|李白', '将进酒|李白'] },
  '将进酒|李白':               { year: 752, location: '长安', mood: { tod: 'night',  weather: 'none' }, related: ['月下独酌|李白', '行路难|李白'] },
  '行路难|李白':               { year: 744, mood: { tod: 'noon',   weather: 'none' }, related: ['将进酒|李白'] },
  '早发白帝城|李白':           { year: 759, location: '白帝城', mood: { tod: 'dawn',   weather: 'none' }, related: ['秋浦歌|李白', '望庐山瀑布|李白'] },
  '望庐山瀑布|李白':           { year: 725, location: '庐山', mood: { tod: 'noon',   weather: 'none' }, related: ['早发白帝城|李白'] },
  '黄鹤楼送孟浩然之广陵|李白':  { year: 730, location: '黄鹤楼', mood: { tod: 'noon',   weather: 'none' }, related: ['送友人|李白', '渡荆门送别|李白'] },
  '送友人|李白':               { year: 753, location: '宣城', mood: { tod: 'dusk',   weather: 'none' }, related: ['黄鹤楼送孟浩然之广陵|李白'] },
  '渡荆门送别|李白':           { year: 725, location: '荆门', mood: { tod: 'dusk',   weather: 'none' }, related: ['黄鹤楼送孟浩然之广陵|李白'] },
  '关山月|李白':               { year: 744, mood: { tod: 'night',  weather: 'none' } },
  '梦游天姥吟留别|李白':       { year: 745, location: '天姥山', mood: { tod: 'night',  weather: 'none' } },
  '独坐敬亭山|李白':           { year: 753, location: '宣城', mood: { tod: 'noon',   weather: 'none' } },
  '秋浦歌|李白':               { year: 754, location: '池州', mood: { tod: 'dusk',   weather: 'none' } },

  '春望|杜甫':                 { year: 757, location: '长安', mood: { tod: 'noon',   weather: 'none' }, related: ['月夜|杜甫', '闻官军收河南河北|杜甫'] },
  '月夜|杜甫':                 { year: 756, location: '长安', mood: { tod: 'night',  weather: 'none' }, related: ['春望|杜甫'] },
  '望岳|杜甫':                 { year: 736, location: '泰山', mood: { tod: 'noon',   weather: 'none' } },
  '登高|杜甫':                 { year: 767, location: '白帝城', mood: { tod: 'dusk',   weather: 'none' }, related: ['登岳阳楼|杜甫', '秋兴八首|杜甫'] },
  '登岳阳楼|杜甫':             { year: 768, location: '岳阳', mood: { tod: 'dusk',   weather: 'none' }, related: ['登高|杜甫'] },
  '秋兴八首|杜甫':             { year: 766, mood: { tod: 'dusk',   weather: 'none' }, related: ['登高|杜甫'] },
  '春夜喜雨|杜甫':             { year: 761, location: '成都', mood: { tod: 'night',  weather: 'rain' } },
  '闻官军收河南河北|杜甫':     { year: 763, location: '梓州', mood: { tod: 'noon',   weather: 'none' } },
  '江南逢李龟年|杜甫':         { year: 770, location: '潭州', mood: { tod: 'dusk',   weather: 'none' } },
  '旅夜书怀|杜甫':             { year: 765, location: '白帝城', mood: { tod: 'night',  weather: 'none' } },
  '茅屋为秋风所破歌|杜甫':     { year: 761, location: '成都', mood: { tod: 'night',  weather: 'rain' } },
  '春日忆李白|杜甫':           { year: 746, location: '长安', mood: { tod: 'noon',   weather: 'none' } },

  '登鹳雀楼|王之涣':           { year: 704, location: '鹳雀楼', mood: { tod: 'dusk',   weather: 'none' } },
  '凉州词|王之涣':             { year: 726, location: '凉州', mood: { tod: 'dusk',   weather: 'none' } },

  '送元二使安西|王维':         { year: 737, location: '渭城', mood: { tod: 'dawn',   weather: 'rain' }, related: ['九月九日忆山东兄弟|王维', '使至塞上|王维'] },
  '使至塞上|王维':             { year: 737, location: '凉州', mood: { tod: 'dusk',   weather: 'none' }, related: ['送元二使安西|王维'] },
  '九月九日忆山东兄弟|王维':   { year: 717, location: '长安', mood: { tod: 'noon',   weather: 'none' }, related: ['送元二使安西|王维'] },
  '鹿柴|王维':                 { year: 758, location: '终南山', mood: { tod: 'dusk',   weather: 'none' } },
  '山居秋暝|王维':             { year: 757, location: '终南山', mood: { tod: 'dusk',   weather: 'none' } },
  '终南别业|王维':             { year: 758, location: '终南山', mood: { tod: 'noon',   weather: 'none' } },

  '滕王阁序|王勃':             { year: 675, location: '南昌', mood: { tod: 'dusk',   weather: 'none' } },
  '滕王阁诗|王勃':             { year: 675, location: '南昌', mood: { tod: 'dusk',   weather: 'none' } },
  '送杜少府之任蜀州|王勃':     { year: 676, mood: { tod: 'noon',   weather: 'none' } },

  '枫桥夜泊|张继':             { year: 756, location: '苏州', mood: { tod: 'night',  weather: 'none' } },
  '清明|杜牧':                 { year: 845, location: '池州', mood: { tod: 'dusk',   weather: 'rain' }, related: ['江南春|杜牧', '赤壁|杜牧'] },
  '江南春|杜牧':               { year: 834, location: '扬州', mood: { tod: 'dawn',   weather: 'rain' }, related: ['清明|杜牧'] },
  '赤壁|杜牧':                 { year: 842, location: '黄州', mood: { tod: 'dusk',   weather: 'none' }, related: ['清明|杜牧', '念奴娇·赤壁怀古|苏轼'] },
  '泊秦淮|杜牧':               { year: 841, location: '金陵', mood: { tod: 'night',  weather: 'none' } },
  '山行|杜牧':                 { year: 835, location: '池州', mood: { tod: 'dusk',   weather: 'none' } },

  '琵琶行|白居易':             { year: 816, location: '浔阳', mood: { tod: 'night',  weather: 'none' }, related: ['长恨歌|白居易'] },
  '长恨歌|白居易':             { year: 806, location: '长安', mood: { tod: 'night',  weather: 'none' }, related: ['琵琶行|白居易'] },
  '忆江南|白居易':             { year: 838, location: '洛阳', mood: { tod: 'dawn',   weather: 'none' } },
  '赋得古原草送别|白居易':     { year: 787, location: '长安', mood: { tod: 'dusk',   weather: 'none' } },
  '钱塘湖春行|白居易':         { year: 823, location: '杭州', mood: { tod: 'dawn',   weather: 'none' } },
  '暮江吟|白居易':             { year: 822, location: '杭州', mood: { tod: 'dusk',   weather: 'none' } },

  '江雪|柳宗元':               { year: 809, location: '永州', mood: { tod: 'noon',   weather: 'snow' } },

  '回乡偶书|贺知章':           { year: 744, location: '越州', mood: { tod: 'noon',   weather: 'none' } },
  '咏柳|贺知章':               { year: 740, location: '长安', mood: { tod: 'noon',   weather: 'none' } },

  '春晓|孟浩然':               { year: 725, location: '襄阳', mood: { tod: 'dawn',   weather: 'rain' } },
  '过故人庄|孟浩然':           { year: 725, location: '襄阳', mood: { tod: 'noon',   weather: 'none' } },

  '登幽州台歌|陈子昂':         { year: 696, location: '幽州', mood: { tod: 'dusk',   weather: 'none' } },

  '出塞|王昌龄':               { year: 724, location: '玉门关', mood: { tod: 'night',  weather: 'none' } },
  '芙蓉楼送辛渐|王昌龄':       { year: 742, location: '镇江', mood: { tod: 'dawn',   weather: 'rain' } },

  '白雪歌送武判官归京|岑参':   { year: 754, location: '玉门关', mood: { tod: 'noon',   weather: 'snow' } },

  '左迁至蓝关示侄孙湘|韩愈':   { year: 819, location: '蓝关', mood: { tod: 'dusk',   weather: 'snow' } },

  '游子吟|孟郊':               { year: 800, location: '洛阳', mood: { tod: 'night',  weather: 'none' } },

  // 宋词
  '念奴娇·赤壁怀古|苏轼':      { year: 1082, location: '黄州', mood: { tod: 'dusk', weather: 'none' }, related: ['水调歌头·明月几时有|苏轼', '赤壁|杜牧', '赤壁怀古|苏轼'] },
  '水调歌头·明月几时有|苏轼':   { year: 1076, location: '密州', mood: { tod: 'night', weather: 'none' }, related: ['念奴娇·赤壁怀古|苏轼', '江城子·乙卯正月二十日夜记梦|苏轼'] },
  '江城子·乙卯正月二十日夜记梦|苏轼': { year: 1075, location: '密州', mood: { tod: 'night', weather: 'none' }, related: ['水调歌头·明月几时有|苏轼'] },
  '定风波·莫听穿林打叶声|苏轼':{ year: 1082, location: '黄州', mood: { tod: 'noon',  weather: 'rain' }, related: ['念奴娇·赤壁怀古|苏轼'] },
  '饮湖上初晴后雨|苏轼':       { year: 1073, location: '杭州', mood: { tod: 'noon',  weather: 'rain' } },
  '题西林壁|苏轼':             { year: 1084, location: '庐山', mood: { tod: 'noon',  weather: 'none' } },
  '惠崇春江晚景|苏轼':         { year: 1085, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  '江城子·密州出猎|苏轼':      { year: 1075, location: '密州', mood: { tod: 'noon',  weather: 'none' } },
  '蝶恋花·春景|苏轼':          { year: 1092, location: '杭州', mood: { tod: 'dawn',  weather: 'none' } },

  '泊船瓜洲|王安石':           { year: 1075, location: '镇江', mood: { tod: 'night', weather: 'none' } },
  '梅花|王安石':               { year: 1078, location: '金陵', mood: { tod: 'noon',  weather: 'snow' } },
  '登飞来峰|王安石':           { year: 1050, location: '杭州', mood: { tod: 'dawn',  weather: 'none' } },

  '青玉案·元夕|辛弃疾':        { year: 1175, location: '杭州', mood: { tod: 'night', weather: 'none' }, related: ['破阵子·为陈同甫赋壮词以寄之|辛弃疾', '永遇乐·京口北固亭怀古|辛弃疾'] },
  '破阵子·为陈同甫赋壮词以寄之|辛弃疾':{ year: 1188, location: '吉州', mood: { tod: 'night', weather: 'none' }, related: ['青玉案·元夕|辛弃疾'] },
  '永遇乐·京口北固亭怀古|辛弃疾':{ year: 1205, location: '镇江', mood: { tod: 'dusk', weather: 'none' }, related: ['念奴娇·赤壁怀古|苏轼', '破阵子·为陈同甫赋壮词以寄之|辛弃疾'] },
  '丑奴儿·书博山道中壁|辛弃疾':{ year: 1181, location: '吉州', mood: { tod: 'dusk', weather: 'none' } },
  '西江月·夜行黄沙道中|辛弃疾':{ year: 1181, location: '吉州', mood: { tod: 'night', weather: 'none' } },

  '声声慢·寻寻觅觅|李清照':    { year: 1151, location: '金陵', mood: { tod: 'dusk',  weather: 'rain' }, related: ['一剪梅·红藕香残玉簟秋|李清照', '武陵春·春晚|李清照'] },
  '一剪梅·红藕香残玉簟秋|李清照':{ year: 1103, location: '汴京', mood: { tod: 'dusk', weather: 'none' }, related: ['声声慢·寻寻觅觅|李清照'] },
  '武陵春·春晚|李清照':        { year: 1135, location: '金陵', mood: { tod: 'dawn',  weather: 'none' }, related: ['声声慢·寻寻觅觅|李清照'] },
  '如梦令·昨夜雨疏风骤|李清照':{ year: 1100, location: '汴京', mood: { tod: 'dawn',  weather: 'rain' } },
  '夏日绝句|李清照':           { year: 1129, location: '金陵', mood: { tod: 'noon',  weather: 'none' } },

  '游山西村|陆游':             { year: 1167, location: '越州', mood: { tod: 'noon',  weather: 'none' }, related: ['书愤|陆游', '示儿|陆游'] },
  '书愤|陆游':                 { year: 1186, location: '越州', mood: { tod: 'dusk',  weather: 'none' }, related: ['示儿|陆游'] },
  '示儿|陆游':                 { year: 1210, location: '越州', mood: { tod: 'night', weather: 'none' }, related: ['书愤|陆游'] },
  '钗头凤·红酥手|陆游':        { year: 1155, location: '越州', mood: { tod: 'dusk',  weather: 'none' } },

  '岳阳楼记|范仲淹':           { year: 1046, location: '岳阳', mood: { tod: 'dusk',  weather: 'rain' }, related: ['登岳阳楼|杜甫'] },
  '渔家傲·秋思|范仲淹':        { year: 1040, location: '延州', mood: { tod: 'night', weather: 'none' } },
  '醉翁亭记|欧阳修':           { year: 1046, location: '滁州', mood: { tod: 'noon',  weather: 'none' } },

  '晓出净慈寺送林子方|杨万里': { year: 1187, location: '杭州', mood: { tod: 'dawn',  weather: 'none' } },

  '春日|朱熹':                 { year: 1196, location: '建州', mood: { tod: 'noon',  weather: 'none' } },
  '观书有感|朱熹':             { year: 1196, location: '建州', mood: { tod: 'noon',  weather: 'none' } },

  // ═══ 补录 102 首 (2026-04-20 批量录入) ═══

  // ── 长安 ──
  '清平调|李白':                    { year: 743, mood: { tod: 'noon',  weather: 'none' }, related: ['将进酒|李白'] },
  '乐游原|李商隐':                  { year: 848, location: '长安', mood: { tod: 'dusk',  weather: 'none' }, related: ['夜雨寄北|李商隐', '锦瑟|李商隐'] },
  '和张仆射塞下曲|卢纶':            { year: 785, mood: { tod: 'night', weather: 'snow' }, related: ['出塞|王昌龄', '凉州词|王之涣'] },
  // ── 渭城 ──
  '观猎|王维':                      { year: 728, location: '渭城', mood: { tod: 'noon',  weather: 'none' }, related: ['使至塞上|王维'] },
  // ── 终南山 ──
  '终南山|王维':                    { year: 741, location: '终南山', mood: { tod: 'noon',  weather: 'none' }, related: ['终南别业|王维', '山居秋暝|王维'] },
  // ── 华山 ──
  '华山|寇准':                      { year: 985, mood: { tod: 'dawn',  weather: 'none' } },
  '登华山|金章宗':                  { year: 1195, mood: { tod: 'noon', weather: 'none' } },
  // ── 蓝关 ──
  '蓝桥驿见元九诗|白居易':          { year: 815, mood: { tod: 'dusk',  weather: 'none' }, related: ['赋得古原草送别|白居易'] },
  // ── 秦州 ──
  '月夜忆舍弟|杜甫':                { year: 759, location: '秦州', mood: { tod: 'night', weather: 'none' }, related: ['月夜|杜甫', '春望|杜甫'] },
  // ── 汉中 ──
  '蜀道难|李白':                    { year: 730, location: '汉中', mood: { tod: 'noon',  weather: 'none' }, related: ['将进酒|李白', '早发白帝城|李白'] },
  // ── 潼关 ──
  '山坡羊·潼关怀古|张养浩':         { year: 1329, mood: { tod: 'dusk', weather: 'none' } },
  '潼关|谭嗣同':                    { year: 1882, mood: { tod: 'dusk', weather: 'none' } },
  '潼关吏|杜甫':                    { year: 759, location: '潼关', mood: { tod: 'noon',  weather: 'none' }, related: ['春望|杜甫', '月夜忆舍弟|杜甫'] },
  // ── 洛阳 ──
  '春夜洛城闻笛|李白':              { year: 734, mood: { tod: 'night', weather: 'none' }, related: ['静夜思|李白'] },
  '秋思|张籍':                      { year: 808, mood: { tod: 'dusk',  weather: 'none' } },
  '洛阳女儿行|王维':                { year: 725, mood: { tod: 'noon',  weather: 'none' } },
  // ── 鹳雀楼 ──
  '同崔邠登鹳雀楼|李益':            { year: 800, mood: { tod: 'dusk',  weather: 'none' }, related: ['登鹳雀楼|王之涣'] },
  '登鹳雀楼|畅当':                  { year: 790, mood: { tod: 'noon',  weather: 'none' }, related: ['登鹳雀楼|王之涣', '同崔邠登鹳雀楼|李益'] },
  // ── 汴京 ──
  '雨霖铃|柳永':                    { year: 1005, location: '汴京', mood: { tod: 'dusk', weather: 'rain' }, related: ['望海潮|柳永'] },
  '如梦令|李清照':                  { year: 1100, mood: { tod: 'dawn', weather: 'rain' }, related: ['如梦令·昨夜雨疏风骤|李清照'] },
  '元日|王安石':                    { year: 1068, location: '汴京', mood: { tod: 'dawn', weather: 'none' } },
  '汴河曲|李益':                    { year: 790, mood: { tod: 'dusk',  weather: 'none' } },
  // ── 许昌 (曹操) ──
  '短歌行|曹操':                    { year: 208, location: '许昌', mood: { tod: 'night', weather: 'none' }, related: ['观沧海|曹操', '龟虽寿|曹操'] },
  '观沧海|曹操':                    { year: 207, location: '许昌', mood: { tod: 'noon',  weather: 'none' }, related: ['短歌行|曹操', '龟虽寿|曹操'] },
  '龟虽寿|曹操':                    { year: 207, location: '许昌', mood: { tod: 'noon',  weather: 'none' }, related: ['短歌行|曹操', '观沧海|曹操'] },
  // ── 太原 ──
  '太原早秋|李白':                  { year: 735, mood: { tod: 'dawn',  weather: 'none' } },
  '晋祠|李白':                      { year: 735, mood: { tod: 'noon',  weather: 'none' } },
  // ── 幽州 ──
  '己亥杂诗|龚自珍':                { year: 1839, mood: { tod: 'dusk', weather: 'none' } },
  '夜上受降城闻笛|李益':            { year: 785, mood: { tod: 'night', weather: 'none' } },
  // ── 凉州 ──
  '凉州词|王翰':                    { year: 720, mood: { tod: 'night', weather: 'none' }, related: ['凉州词|王之涣', '出塞|王昌龄'] },
  '从军行|王昌龄':                  { year: 727, location: '凉州', mood: { tod: 'dusk',  weather: 'none' }, related: ['出塞|王昌龄', '凉州词|王翰'] },
  // ── 阳关 ──
  '塞下曲|李白':                    { year: 735, mood: { tod: 'night', weather: 'snow' }, related: ['关山月|李白'] },
  // ── 泰山 ──
  '泰山吟|谢道韫':                  { year: 380, mood: { tod: 'noon',  weather: 'none' }, related: ['望岳|杜甫'] },
  '登泰山|张岱':                    { year: 1630, mood: { tod: 'dawn', weather: 'none' }, related: ['望岳|杜甫'] },
  // ── 密州 (苏轼) ──
  '水调歌头|苏轼':                  { year: 1076, mood: { tod: 'night', weather: 'none' }, related: ['水调歌头·明月几时有|苏轼', '江城子·密州出猎|苏轼'] },
  // ── 彭城 ──
  '永遇乐|苏轼':                    { year: 1078, mood: { tod: 'night', weather: 'none' }, related: ['念奴娇·赤壁怀古|苏轼'] },
  '浪淘沙|刘禹锡':                  { year: 826, location: '彭城', mood: { tod: 'noon',  weather: 'none' }, related: ['乌衣巷|刘禹锡', '望洞庭|刘禹锡'] },
  // ── 金陵 ──
  '乌衣巷|刘禹锡':                  { year: 826, location: '金陵', mood: { tod: 'dusk',  weather: 'none' }, related: ['浪淘沙|刘禹锡'] },
  '虞美人|李煜':                    { year: 978, mood: { tod: 'night', weather: 'none' } },
  '登金陵凤凰台|李白':              { year: 747, mood: { tod: 'dusk',  weather: 'none' }, related: ['黄鹤楼|崔颢'] },
  '桂枝香·金陵怀古|王安石':         { year: 1076, location: '金陵', mood: { tod: 'dusk', weather: 'none' }, related: ['念奴娇·赤壁怀古|苏轼', '永遇乐·京口北固亭怀古|辛弃疾'] },
  // ── 扬州 ──
  '寄扬州韩绰判官|杜牧':            { year: 833, location: '扬州', mood: { tod: 'night', weather: 'none' }, related: ['赤壁|杜牧', '泊秦淮|杜牧'] },
  '扬州慢|姜夔':                    { year: 1176, location: '扬州', mood: { tod: 'dusk', weather: 'none' }, related: ['淡黄柳|姜夔'] },
  '遣怀|杜牧':                      { year: 840, location: '扬州', mood: { tod: 'dusk',  weather: 'none' }, related: ['寄扬州韩绰判官|杜牧'] },
  // ── 镇江 ──
  '京口北固亭怀古|辛弃疾':          { year: 1205, location: '镇江', mood: { tod: 'dusk', weather: 'none' }, related: ['永遇乐·京口北固亭怀古|辛弃疾', '南乡子·登京口北固亭有怀|辛弃疾'] },
  '南乡子·登京口北固亭有怀|辛弃疾': { year: 1204, location: '镇江', mood: { tod: 'dusk', weather: 'none' }, related: ['永遇乐·京口北固亭怀古|辛弃疾'] },
  // ── 苏州 ──
  '横塘|范成大':                    { year: 1170, mood: { tod: 'noon', weather: 'none' } },
  '题破山寺后禅院|常建':            { year: 740, mood: { tod: 'dawn',  weather: 'none' }, related: ['枫桥夜泊|张继'] },
  // ── 杭州 ──
  '题临安邸|林升':                  { year: 1175, location: '杭州', mood: { tod: 'dusk', weather: 'none' } },
  '望海潮|柳永':                    { year: 1002, location: '杭州', mood: { tod: 'noon', weather: 'none' }, related: ['雨霖铃|柳永'] },
  '苏堤春晓|杨周':                  { year: 1550, mood: { tod: 'dawn', weather: 'none' } },
  // ── 滁州 ──
  '丰乐亭游春|欧阳修':              { year: 1046, mood: { tod: 'noon', weather: 'none' }, related: ['醉翁亭记|欧阳修'] },
  // ── 宣城 (李白晚年) ──
  '赠汪伦|李白':                    { year: 755, location: '宣城', mood: { tod: 'noon', weather: 'none' }, related: ['送友人|李白'] },
  '秋登宣城谢朓北楼|李白':          { year: 753, location: '宣城', mood: { tod: 'dusk', weather: 'none' }, related: ['独坐敬亭山|李白'] },
  // ── 池州 ──
  '九日齐山登高|杜牧':              { year: 844, mood: { tod: 'noon', weather: 'none' }, related: ['清明|杜牧', '山行|杜牧'] },
  // ── 合肥 ──
  '淡黄柳|姜夔':                    { year: 1191, location: '合肥', mood: { tod: 'dusk', weather: 'none' }, related: ['扬州慢|姜夔'] },
  // ── 庐山 ──
  '饮酒|陶渊明':                    { year: 420, mood: { tod: 'dusk',  weather: 'none' } },
  '庐山谣|李白':                    { year: 760, mood: { tod: 'noon',  weather: 'none' }, related: ['望庐山瀑布|李白'] },
  // ── 黄鹤楼 ──
  '黄鹤楼|崔颢':                    { year: 745, mood: { tod: 'dusk',  weather: 'none' }, related: ['登金陵凤凰台|李白', '黄鹤楼送孟浩然之广陵|李白'] },
  '菩萨蛮·黄鹤楼|毛泽东':           { year: 1927, mood: { tod: 'dusk', weather: 'rain' } },
  // ── 黄州 (苏轼) ──
  '定风波|苏轼':                    { year: 1082, location: '黄州', mood: { tod: 'noon', weather: 'rain' }, related: ['定风波·莫听穿林打叶声|苏轼', '念奴娇·赤壁怀古|苏轼'] },
  '卜算子·黄州定慧院寓居作|苏轼':   { year: 1083, location: '黄州', mood: { tod: 'night', weather: 'none' }, related: ['念奴娇·赤壁怀古|苏轼'] },
  // ── 襄阳 ──
  '秋登兰山寄张五|孟浩然':          { year: 727, location: '襄阳', mood: { tod: 'dusk',  weather: 'none' }, related: ['过故人庄|孟浩然'] },
  // ── 岳阳 ──
  '望洞庭|刘禹锡':                  { year: 824, location: '岳阳', mood: { tod: 'night', weather: 'none' }, related: ['浪淘沙|刘禹锡'] },
  '临洞庭湖赠张丞相|孟浩然':        { year: 733, location: '岳阳', mood: { tod: 'dawn',  weather: 'none' }, related: ['登岳阳楼|杜甫'] },
  // ── 潭州 ──
  '沁园春·长沙|毛泽东':             { year: 1925, mood: { tod: 'noon', weather: 'none' } },
  '题岳麓寺|张栻':                  { year: 1170, mood: { tod: 'dusk', weather: 'none' } },
  // ── 永州 (柳宗元贬谪) ──
  '渔翁|柳宗元':                    { year: 810, location: '永州', mood: { tod: 'dawn',  weather: 'none' }, related: ['江雪|柳宗元', '溪居|柳宗元'] },
  '小石潭记|柳宗元':                { year: 810, location: '永州', mood: { tod: 'noon',  weather: 'none' }, related: ['江雪|柳宗元', '渔翁|柳宗元'] },
  '溪居|柳宗元':                    { year: 811, location: '永州', mood: { tod: 'dawn',  weather: 'none' }, related: ['江雪|柳宗元', '渔翁|柳宗元'] },
  // ── 郴州 (秦观贬谪) ──
  '踏莎行·郴州旅舍|秦观':           { year: 1097, location: '郴州', mood: { tod: 'dusk', weather: 'rain' }, related: ['鹊桥仙|秦观'] },
  '鹊桥仙|秦观':                    { year: 1078, location: '汴京', mood: { tod: 'night', weather: 'none' }, related: ['踏莎行·郴州旅舍|秦观'] },
  // ── 南昌 ──
  '登快阁|黄庭坚':                  { year: 1082, location: '南昌', mood: { tod: 'dusk', weather: 'none' } },
  // ── 赣州 (文天祥) ──
  '过零丁洋|文天祥':                { year: 1279, location: '赣州', mood: { tod: 'dusk', weather: 'none' }, related: ['正气歌|文天祥'] },
  '正气歌|文天祥':                  { year: 1281, location: '幽州', mood: { tod: 'noon', weather: 'none' }, related: ['过零丁洋|文天祥'] },
  // ── 吉州 ──
  '破阵子|辛弃疾':                  { year: 1188, mood: { tod: 'night', weather: 'none' }, related: ['破阵子·为陈同甫赋壮词以寄之|辛弃疾'] },
  '菩萨蛮·书江西造口壁|辛弃疾':     { year: 1176, location: '吉州', mood: { tod: 'dusk', weather: 'none' }, related: ['永遇乐·京口北固亭怀古|辛弃疾'] },
  // ── 桂林 ──
  '独秀峰|袁枚':                    { year: 1780, mood: { tod: 'noon', weather: 'none' } },
  '送桂州严大夫|韩愈':              { year: 822, mood: { tod: 'noon', weather: 'none' } },
  // ── 柳州 (柳宗元贬谪) ──
  '登柳州城楼|柳宗元':              { year: 815, location: '柳州', mood: { tod: 'dusk', weather: 'rain' }, related: ['江雪|柳宗元', '渔翁|柳宗元'] },
  '酬曹侍御过象县见寄|柳宗元':      { year: 817, location: '柳州', mood: { tod: 'noon', weather: 'none' } },
  // ── 泉州 ──
  '秋日登清源山|陈允平':            { year: 1260, mood: { tod: 'dusk', weather: 'none' } },
  '咏泉州刺桐花|王毂':              { year: 880, mood: { tod: 'noon', weather: 'none' } },
  // ── 福州 ──
  '乌山|赵汝愚':                    { year: 1190, mood: { tod: 'noon', weather: 'none' } },
  '福州|陈轩':                      { year: 1080, mood: { tod: 'noon', weather: 'none' } },
  // ── 成都 (杜甫草堂) ──
  '蜀相|杜甫':                      { year: 760, location: '成都', mood: { tod: 'dusk', weather: 'none' }, related: ['春望|杜甫', '登高|杜甫'] },
  '绝句|杜甫':                      { year: 764, location: '成都', mood: { tod: 'noon', weather: 'none' }, related: ['江畔独步寻花|杜甫'] },
  '江畔独步寻花|杜甫':              { year: 761, location: '成都', mood: { tod: 'dawn', weather: 'none' }, related: ['春夜喜雨|杜甫', '绝句|杜甫'] },
  // ── 剑门 ──
  '剑门道中遇微雨|陆游':            { year: 1172, location: '剑门', mood: { tod: 'dusk', weather: 'rain' }, related: ['游山西村|陆游'] },
  '剑阁赋|李白':                    { year: 730, mood: { tod: 'noon', weather: 'none' }, related: ['蜀道难|李白'] },
  // ── 阆中 ──
  '阆山歌|杜甫':                    { year: 764, location: '阆中', mood: { tod: 'noon', weather: 'none' }, related: ['阆水歌|杜甫'] },
  '阆水歌|杜甫':                    { year: 764, location: '阆中', mood: { tod: 'dusk', weather: 'none' }, related: ['阆山歌|杜甫'] },
  // ── 白帝城 (杜甫晚年) ──
  '八阵图|杜甫':                    { year: 766, location: '白帝城', mood: { tod: 'dusk', weather: 'none' }, related: ['登高|杜甫', '登岳阳楼|杜甫'] },
  // ── 峨眉山 ──
  '峨眉山月歌|李白':                { year: 724, location: '峨眉山', mood: { tod: 'night', weather: 'none' }, related: ['早发白帝城|李白'] },
  '登峨眉山|李白':                  { year: 724, mood: { tod: 'noon', weather: 'none' }, related: ['峨眉山月歌|李白'] },
  // ── 巴山 (李商隐) ──
  '夜雨寄北|李商隐':                { year: 851, location: '巴山', mood: { tod: 'night', weather: 'rain' }, related: ['锦瑟|李商隐', '乐游原|李商隐'] },
  '锦瑟|李商隐':                    { year: 858, location: '长安', mood: { tod: 'night', weather: 'none' }, related: ['夜雨寄北|李商隐', '乐游原|李商隐'] },
  // ── 天姥山 ──
  '天台晓望|李白':                  { year: 747, mood: { tod: 'dawn', weather: 'none' }, related: ['梦游天姥吟留别|李白'] },
  // ── 荆州 ──
  '荆州歌|李白':                    { year: 725, mood: { tod: 'noon', weather: 'none' } },
  // ── 玉门关 ──
  '古从军行|李颀':                  { year: 750, mood: { tod: 'dusk', weather: 'none' }, related: ['出塞|王昌龄', '凉州词|王之涣'] },
  // ── 大散关 ──
  '秋夜将晓出篱门迎凉有感|陆游':    { year: 1192, location: '越州', mood: { tod: 'dawn', weather: 'none' }, related: ['书愤|陆游', '示儿|陆游'] },
  // ── 邯郸 ──
  '邯郸冬至夜思家|白居易':          { year: 804, location: '邯郸', mood: { tod: 'night', weather: 'snow' } },

  // ═══════════════════════════════════════════════════════════════════════
  // 批量精确标注 2026-04-21 — 覆盖唐诗三百首 / 宋词三百首中的常读诗词
  // 规则: 仅采用学界基本共识的年份; 争议大的 (>10 年) 不加, 宁缺勿滥.
  //       title 用 canonical 形式 (enrich 脚本会自动剥 乐府 prefix 做匹配).
  // ═══════════════════════════════════════════════════════════════════════

  // ── 李白 (补) ──
  '行路难三首 一|李白':            { year: 744, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '行路难三首 二|李白':            { year: 744, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '行路难三首 三|李白':            { year: 744, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '长相思三首 一|李白':            { year: 744, mood: { tod: 'night', weather: 'none' } },
  '长相思三首 二|李白':            { year: 744, mood: { tod: 'night', weather: 'none' } },
  '长相思|李白':                    { year: 744, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '清平调 一|李白':                 { year: 743, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '清平调 二|李白':                 { year: 743, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '清平调 三|李白':                 { year: 743, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '清平调词三首 一|李白':           { year: 743, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '清平调词三首 二|李白':           { year: 743, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '清平调词三首 三|李白':           { year: 743, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '子夜吴歌 春歌|李白':             { year: 744, location: '长安', mood: { tod: 'dawn',  weather: 'none' } },
  '子夜吴歌 夏歌|李白':             { year: 744, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '子夜吴歌 秋歌|李白':             { year: 744, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  '子夜吴歌 冬歌|李白':             { year: 744, location: '长安', mood: { tod: 'night', weather: 'snow' } },
  '子夜四时歌四首 春歌|李白':       { year: 744, mood: { tod: 'dawn',  weather: 'none' } },
  '子夜四时歌四首 夏歌|李白':       { year: 744, mood: { tod: 'noon',  weather: 'none' } },
  '子夜四时歌四首 秋歌|李白':       { year: 744, mood: { tod: 'dusk',  weather: 'none' } },
  '子夜四时歌四首 冬歌|李白':       { year: 744, mood: { tod: 'night', weather: 'snow' } },
  '春思|李白':                      { year: 744, location: '长安', mood: { tod: 'dawn',  weather: 'none' } },
  '玉阶怨|李白':                    { year: 744, mood: { tod: 'night', weather: 'none' } },
  '长干行二首 一|李白':             { year: 725, location: '金陵', mood: { tod: 'noon',  weather: 'none' } },
  '赠孟浩然|李白':                  { year: 730, location: '襄阳', mood: { tod: 'noon',  weather: 'none' } },
  '金陵酒肆留别|李白':              { year: 726, location: '金陵', mood: { tod: 'dusk',  weather: 'none' } },
  '宣州谢朓楼饯别校书叔云|李白':    { year: 753, location: '宣城', mood: { tod: 'dusk',  weather: 'none' } },
  '下终南山过斛斯山人宿置酒|李白':  { year: 730, location: '终南山', mood: { tod: 'night', weather: 'none' } },
  '夜泊牛渚怀古|李白':              { year: 739, location: '金陵', mood: { tod: 'night', weather: 'none' } },
  '听蜀僧濬弹琴|李白':              { year: 735, location: '成都', mood: { tod: 'dusk',  weather: 'none' } },
  '月下独酌四首 一|李白':           { year: 744, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '庐山谣寄卢侍御虚舟|李白':        { year: 760, location: '庐山', mood: { tod: 'noon',  weather: 'none' } },

  // ── 杜甫 (补) ──
  '兵车行|杜甫':                    { year: 751, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '丽人行|杜甫':                    { year: 753, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '哀江头|杜甫':                    { year: 757, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  '哀王孙|杜甫':                    { year: 756, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  '梦李白二首 一|杜甫':             { year: 759, location: '秦州', mood: { tod: 'night', weather: 'none' } },
  '梦李白二首 二|杜甫':             { year: 759, location: '秦州', mood: { tod: 'night', weather: 'none' } },
  '天末忆李白|杜甫':                { year: 759, location: '秦州', mood: { tod: 'dusk',  weather: 'none' } },
  '赠卫八处士|杜甫':                { year: 759, mood: { tod: 'night', weather: 'none' } },
  '佳人|杜甫':                      { year: 759, location: '秦州', mood: { tod: 'dusk',  weather: 'none' } },
  '客至|杜甫':                      { year: 761, location: '成都', mood: { tod: 'noon',  weather: 'none' } },
  '野望|杜甫':                      { year: 761, location: '成都', mood: { tod: 'dusk',  weather: 'none' } },
  '登楼|杜甫':                      { year: 764, location: '成都', mood: { tod: 'dusk',  weather: 'none' } },
  '宿府|杜甫':                      { year: 764, location: '成都', mood: { tod: 'night', weather: 'none' } },
  '阁夜|杜甫':                      { year: 766, location: '白帝城', mood: { tod: 'night', weather: 'none' } },
  '别房太尉墓|杜甫':                { year: 765, location: '阆中', mood: { tod: 'dusk',  weather: 'none' } },
  '奉济驿重送严公四韵|杜甫':        { year: 762, mood: { tod: 'noon',  weather: 'none' } },
  '春宿左省|杜甫':                  { year: 758, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '古柏行|杜甫':                    { year: 766, location: '白帝城', mood: { tod: 'noon',  weather: 'none' } },
  '观公孙大娘弟子舞剑器行|杜甫':    { year: 767, location: '白帝城', mood: { tod: 'noon',  weather: 'none' } },
  '咏怀古迹五首 一|杜甫':           { year: 766, location: '白帝城', mood: { tod: 'dusk',  weather: 'none' } },
  '咏怀古迹五首 二|杜甫':           { year: 766, location: '白帝城', mood: { tod: 'dusk',  weather: 'none' } },
  '咏怀古迹五首 三|杜甫':           { year: 766, location: '白帝城', mood: { tod: 'dusk',  weather: 'none' } },
  '咏怀古迹五首 四|杜甫':           { year: 766, location: '白帝城', mood: { tod: 'dusk',  weather: 'none' } },
  '咏怀古迹五首 五|杜甫':           { year: 766, location: '白帝城', mood: { tod: 'dusk',  weather: 'none' } },
  '寄韩谏议|杜甫':                  { year: 767, mood: { tod: 'night', weather: 'none' } },
  '丹青引赠曹将军霸|杜甫':          { year: 764, mood: { tod: 'noon',  weather: 'none' } },
  '韦讽录事宅观曹将军画马图|杜甫':  { year: 764, mood: { tod: 'noon',  weather: 'none' } },
  '至德二载甫自京金光门出问道归凤翔乾元初从左拾遗移华州掾与亲故别因出此门有悲往事|杜甫': { year: 758, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 王维 (补) ──
  '桃源行|王维':                    { year: 716, mood: { tod: 'noon',  weather: 'none' } },
  '送綦毋潜落第还乡|王维':          { year: 734, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  '归嵩山作|王维':                  { year: 722, location: '洛阳', mood: { tod: 'dusk',  weather: 'none' } },
  '辋川闲居赠裴秀才迪|王维':        { year: 745, mood: { tod: 'dusk',  weather: 'none' } },
  '酬张少府|王维':                  { year: 746, mood: { tod: 'dusk',  weather: 'none' } },
  '过香积寺|王维':                  { year: 735, mood: { tod: 'noon',  weather: 'none' } },
  '汉江临泛|王维':                  { year: 740, location: '襄阳', mood: { tod: 'noon',  weather: 'none' } },
  '积雨辋川庄作|王维':              { year: 748, mood: { tod: 'noon',  weather: 'rain' } },
  '和贾舍人早朝大明宫之作|王维':    { year: 758, mood: { tod: 'dawn',  weather: 'none' } },
  '酬郭给事|王维':                  { year: 760, mood: { tod: 'noon',  weather: 'none' } },
  '相思|王维':                      { year: 750, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '辋川集 鹿柴|王维':               { year: 748, location: '终南山', mood: { tod: 'dusk',  weather: 'none' } },
  '辋川集 竹里馆|王维':             { year: 748, location: '终南山', mood: { tod: 'night', weather: 'none' } },
  '杂诗三首 二|王维':               { year: 750, mood: { tod: 'dawn',  weather: 'none' } },
  '渭城曲|王维':                    { year: 737, mood: { tod: 'dawn',  weather: 'rain' } },

  // ── 李商隐 (补) ──
  '蝉|李商隐':                      { year: 848, mood: { tod: 'noon',  weather: 'none' } },
  '韩碑|李商隐':                    { year: 828, mood: { tod: 'noon',  weather: 'none' } },
  '风雨|李商隐':                    { year: 838, mood: { tod: 'dusk',  weather: 'rain' } },
  '寄令狐郎中|李商隐':              { year: 849, mood: { tod: 'dusk',  weather: 'none' } },
  '隋宫|李商隐':                    { year: 852, mood: { tod: 'dusk',  weather: 'none' } },
  '筹笔驿|李商隐':                  { year: 855, mood: { tod: 'dusk',  weather: 'none' } },
  '落花|李商隐':                    { year: 842, mood: { tod: 'dusk',  weather: 'none' } },
  '为有|李商隐':                    { year: 845, mood: { tod: 'night', weather: 'none' } },
  '春雨|李商隐':                    { year: 843, mood: { tod: 'night', weather: 'rain' } },
  '常娥|李商隐':                    { year: 848, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '贾生|李商隐':                    { year: 848, mood: { tod: 'night', weather: 'none' } },
  '凉思|李商隐':                    { year: 844, mood: { tod: 'dusk',  weather: 'none' } },
  '北青萝|李商隐':                  { year: 836, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 孟浩然 (补) ──
  '夏日南亭怀辛大|孟浩然':          { year: 728, mood: { tod: 'night', weather: 'none' } },
  '宿业师山房期丁大不至|孟浩然':    { year: 728, mood: { tod: 'night', weather: 'none' } },
  '夜归鹿门山歌|孟浩然':            { year: 728, mood: { tod: 'night', weather: 'none' } },
  '秦中感秋寄远上人|孟浩然':        { year: 727, mood: { tod: 'dusk',  weather: 'none' } },
  '宿桐庐江寄广陵旧游|孟浩然':      { year: 730, mood: { tod: 'night', weather: 'none' } },
  '早寒江上有怀|孟浩然':            { year: 734, mood: { tod: 'dawn',  weather: 'none' } },
  '留别王侍御维|孟浩然':            { year: 729, mood: { tod: 'dusk',  weather: 'none' } },
  '与诸子登岘山|孟浩然':            { year: 725, mood: { tod: 'noon',  weather: 'none' } },
  '岁暮归南山|孟浩然':              { year: 728, location: '襄阳', mood: { tod: 'dusk',  weather: 'none' } },
  '宿建德江|孟浩然':                { year: 730, location: '杭州', mood: { tod: 'night', weather: 'none' } },

  // ── 韦应物 (补) ──
  '郡斋雨中与诸文士燕集|韦应物':    { year: 783, mood: { tod: 'noon',  weather: 'rain' } },
  '初发扬子寄元大校书|韦应物':      { year: 781, mood: { tod: 'dawn',  weather: 'none' } },
  '寄李儋元锡|韦应物':              { year: 784, mood: { tod: 'dusk',  weather: 'none' } },
  '寄全椒山中道士|韦应物':          { year: 783, mood: { tod: 'dusk',  weather: 'none' } },
  '秋夜寄丘二十二员外|韦应物':      { year: 790, mood: { tod: 'night', weather: 'none' } },
  '淮上喜会梁川故人|韦应物':        { year: 789, mood: { tod: 'dusk',  weather: 'none' } },
  '夕次盱眙县|韦应物':              { year: 783, mood: { tod: 'dusk',  weather: 'none' } },
  '东郊|韦应物':                    { year: 782, mood: { tod: 'dawn',  weather: 'none' } },
  '滁州西涧|韦应物':                { year: 783, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 刘长卿 (补) ──
  '送灵澈上人|刘长卿':              { year: 775, mood: { tod: 'dusk',  weather: 'none' } },
  '新年作|刘长卿':                  { year: 760, mood: { tod: 'dawn',  weather: 'none' } },
  '长沙过贾谊宅|刘长卿':            { year: 773, mood: { tod: 'dusk',  weather: 'none' } },
  '自夏口至鹦鹉洲夕望岳阳寄源中丞|刘长卿': { year: 772, mood: { tod: 'dusk', weather: 'none' } },

  // ── 王昌龄 (补) ──
  '长信怨 二|王昌龄':               { year: 724, mood: { tod: 'night', weather: 'none' } },
  '同从弟销南斋玩月忆山阴崔少府|王昌龄': { year: 730, mood: { tod: 'night', weather: 'none' } },
  '春宫曲|王昌龄':                  { year: 726, mood: { tod: 'dawn',  weather: 'none' } },
  '闺怨|王昌龄':                    { year: 730, mood: { tod: 'noon',  weather: 'none' } },

  // ── 李煜 (南唐后主) ──
  '虞美人 二|李煜':                 { year: 978, mood: { tod: 'night', weather: 'none' } },
  '相见欢 一|李煜':                 { year: 975, mood: { tod: 'night', weather: 'none' } },
  '相见欢 二|李煜':                 { year: 975, mood: { tod: 'night', weather: 'none' } },
  '长相思 一|李煜':                 { year: 975, mood: { tod: 'night', weather: 'none' } },
  '清平乐|李煜':                    { year: 975, mood: { tod: 'night', weather: 'none' } },
  '锦堂春|李煜':                    { year: 978, mood: { tod: 'dusk',  weather: 'none' } },
  '浪淘沙 一|李煜':                 { year: 978, mood: { tod: 'night', weather: 'rain' } },
  '捣练子 一|李煜':                 { year: 977, mood: { tod: 'night', weather: 'none' } },
  '破陈子|李煜':                    { year: 976, mood: { tod: 'night', weather: 'none' } },

  // ── 杜牧 (补) ──
  '将赴吴兴登乐游原一绝|杜牧':      { year: 850, mood: { tod: 'dusk',  weather: 'none' } },
  '赠别二首 一|杜牧':               { year: 835, location: '扬州', mood: { tod: 'night', weather: 'none' } },
  '赠别二首 二|杜牧':               { year: 835, location: '扬州', mood: { tod: 'night', weather: 'none' } },
  '秋夕|杜牧':                      { year: 840, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '金谷园|杜牧':                    { year: 837, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 岑参 ──
  '与高适薛据慈恩寺浮图|岑参':      { year: 752, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '轮台歌奉送封大夫出师西征|岑参':  { year: 754, location: '玉门关', mood: { tod: 'noon',  weather: 'snow' } },
  '走马川行奉送出师西征|岑参':      { year: 754, location: '玉门关', mood: { tod: 'night', weather: 'snow' } },
  '寄左省杜拾遗|岑参':              { year: 758, location: '长安', mood: { tod: 'dawn',  weather: 'none' } },
  '奉和中书舍人贾至早朝大明宫|岑参':{ year: 758, mood: { tod: 'dawn',  weather: 'none' } },
  '逢入京使|岑参':                  { year: 749, location: '玉门关', mood: { tod: 'noon',  weather: 'none' } },

  // ── 卢纶 ──
  '和张仆射塞下曲 一|卢纶':         { year: 785, mood: { tod: 'night', weather: 'snow' } },
  '和张仆射塞下曲 二|卢纶':         { year: 785, mood: { tod: 'night', weather: 'none' } },
  '和张仆射塞下曲 三|卢纶':         { year: 785, mood: { tod: 'night', weather: 'snow' } },
  '和张仆射塞下曲 四|卢纶':         { year: 785, mood: { tod: 'noon',  weather: 'none' } },
  '晚次鄂州|卢纶':                  { year: 780, mood: { tod: 'dusk',  weather: 'none' } },
  '李端公|卢纶':                    { year: 780, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 崔颢 (补) ──
  '长干曲四首 一|崔颢':             { year: 730, mood: { tod: 'noon',  weather: 'none' } },
  '长干曲四首 二|崔颢':             { year: 730, mood: { tod: 'noon',  weather: 'none' } },
  '行经华阴|崔颢':                  { year: 730, mood: { tod: 'noon',  weather: 'none' } },

  // ── 张九龄 ──
  '感遇十二首 一|张九龄':           { year: 737, mood: { tod: 'dusk',  weather: 'none' } },
  '感遇十二首 二|张九龄':           { year: 737, mood: { tod: 'dusk',  weather: 'none' } },
  '感遇十二首 四|张九龄':           { year: 737, mood: { tod: 'dusk',  weather: 'none' } },
  '感遇十二首 七|张九龄':           { year: 737, mood: { tod: 'dusk',  weather: 'none' } },
  '望月怀远|张九龄':                { year: 737, mood: { tod: 'night', weather: 'none' } },

  // ── 张祜 ──
  '宫词二首 一|张祜':               { year: 825, mood: { tod: 'night', weather: 'none' } },
  '赠内人|张祜':                    { year: 830, mood: { tod: 'night', weather: 'none' } },
  '集灵台二首 一|张祜':             { year: 820, mood: { tod: 'dawn',  weather: 'none' } },
  '集灵台二首 二|张祜':             { year: 820, mood: { tod: 'dawn',  weather: 'none' } },
  '题金陵渡|张祜':                  { year: 830, mood: { tod: 'night', weather: 'none' } },

  // ── 白居易 (补) ──
  '花非花|白居易':                  { year: 830, mood: { tod: 'night', weather: 'none' } },
  '问刘十九|白居易':                { year: 817, location: '浔阳', mood: { tod: 'dusk',  weather: 'snow' } },
  '自河南经乱关内阻饥兄弟离散各在一处因望月有感聊书所怀寄上浮梁大兄於潜七兄乌江十五兄兼示符离及下邽弟妹|白居易': { year: 799, mood: { tod: 'night', weather: 'none' } },
  '后宫词|白居易':                  { year: 820, mood: { tod: 'night', weather: 'none' } },

  // ── 韩愈 ──
  '山石|韩愈':                      { year: 801, location: '洛阳', mood: { tod: 'dusk',  weather: 'none' } },
  '八月十五夜赠张功曹|韩愈':        { year: 805, location: '潭州', mood: { tod: 'night', weather: 'none' } },
  '谒衡岳庙遂宿岳寺题门楼|韩愈':    { year: 805, location: '潭州', mood: { tod: 'dusk',  weather: 'rain' } },
  '石鼓歌|韩愈':                    { year: 812, location: '洛阳', mood: { tod: 'noon',  weather: 'none' } },

  // ── 元稹 ──
  '遣悲怀三首 一|元稹':             { year: 811, mood: { tod: 'dusk',  weather: 'none' } },
  '遣悲怀三首 二|元稹':             { year: 811, mood: { tod: 'dusk',  weather: 'none' } },
  '遣悲怀三首 三|元稹':             { year: 811, mood: { tod: 'night', weather: 'none' } },
  '行宫|元稹':                      { year: 820, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 李颀 ──
  '琴歌|李颀':                      { year: 735, mood: { tod: 'night', weather: 'none' } },
  '送陈章甫|李颀':                  { year: 740, mood: { tod: 'dusk',  weather: 'none' } },
  '听安万善吹觱篥歌|李颀':          { year: 735, mood: { tod: 'night', weather: 'none' } },
  '古意|李颀':                      { year: 730, mood: { tod: 'noon',  weather: 'none' } },
  '听董大弹胡笳声兼寄语弄房给事|李颀': { year: 740, mood: { tod: 'night', weather: 'none' } },
  '送魏万之京|李颀':                { year: 737, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 高适 ──
  '燕歌行|高适':                    { year: 738, location: '幽州', mood: { tod: 'dusk',  weather: 'none' } },
  '送李少府贬峡中王少府贬长沙|高适':{ year: 755, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 刘禹锡 (补) ──
  '西塞山怀古|刘禹锡':              { year: 824, location: '黄鹤楼', mood: { tod: 'dusk',  weather: 'none' } },
  '蜀先主庙|刘禹锡':                { year: 820, mood: { tod: 'noon',  weather: 'none' } },
  '和乐天春词|刘禹锡':              { year: 826, mood: { tod: 'noon',  weather: 'none' } },

  // ── 宋之问 ──
  '题大庾岭北驿|宋之问':            { year: 705, mood: { tod: 'dusk',  weather: 'none' } },
  '渡汉江|宋之问':                  { year: 706, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 柳宗元 (补) ──
  '晨诣超师院读禅经|柳宗元':        { year: 810, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 温庭筠 ──
  '利州南渡|温庭筠':                { year: 855, mood: { tod: 'dusk',  weather: 'none' } },
  '瑶瑟怨|温庭筠':                  { year: 860, mood: { tod: 'night', weather: 'none' } },
  '送人东游|温庭筠':                { year: 856, mood: { tod: 'dusk',  weather: 'none' } },
  '苏武庙|温庭筠':                  { year: 855, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 李益 (补) ──
  '喜见外弟又言别|李益':            { year: 780, mood: { tod: 'dusk',  weather: 'none' } },
  '江南曲|李益':                    { year: 785, mood: { tod: 'noon',  weather: 'none' } },
  '江南词|李益':                    { year: 785, mood: { tod: 'noon',  weather: 'none' } },

  // ── 孟郊 (补) ──
  '列女操|孟郊':                    { year: 790, mood: { tod: 'noon',  weather: 'none' } },

  // ── 沈佺期 ──
  '独不见|沈佺期':                  { year: 695, mood: { tod: 'dusk',  weather: 'none' } },
  '古意呈补阙乔知之|沈佺期':        { year: 692, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 韩翃 ──
  '寒食|韩翃':                      { year: 760, mood: { tod: 'dusk',  weather: 'none' } },
  '同题仙游观|韩翃':                { year: 770, mood: { tod: 'noon',  weather: 'none' } },
  '酬程延秋夜即事见赠|韩翃':        { year: 775, mood: { tod: 'night', weather: 'none' } },

  // ── 司空曙 ──
  '贼平后送人北归|司空曙':          { year: 763, mood: { tod: 'dawn',  weather: 'none' } },
  '云阳馆与韩绅宿别|司空曙':        { year: 780, mood: { tod: 'night', weather: 'none' } },
  '喜外弟卢纶见宿|司空曙':          { year: 785, mood: { tod: 'night', weather: 'none' } },

  // ── 祖咏 ──
  '望蓟门|祖咏':                    { year: 725, mood: { tod: 'noon',  weather: 'none' } },
  '终南望余雪|祖咏':                { year: 720, mood: { tod: 'dusk',  weather: 'snow' } },

  // ── 元结 ──
  '贼退示官吏|元结':                { year: 763, mood: { tod: 'noon',  weather: 'none' } },
  '石鱼湖上醉歌|元结':              { year: 765, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 钱起 ──
  '谷口书斋寄杨补阙|钱起':          { year: 770, mood: { tod: 'dusk',  weather: 'none' } },
  '送僧归日本|钱起':                { year: 765, mood: { tod: 'dawn',  weather: 'none' } },
  '赠阙下裴舍人|钱起':              { year: 760, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 戴叔伦 ──
  '客夜与故人偶集|戴叔伦':          { year: 780, mood: { tod: 'night', weather: 'none' } },

  // ── 许浑 ──
  '秋日赴阙题潼关驿楼|许浑':        { year: 850, mood: { tod: 'dawn',  weather: 'none' } },
  '早秋三首 一|许浑':               { year: 844, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 马戴 ──
  '楚江怀古三首 一|马戴':           { year: 850, mood: { tod: 'dusk',  weather: 'none' } },
  '灞上秋居|马戴':                  { year: 845, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 崔涂 ──
  '巴山道中除夜书怀|崔涂':          { year: 888, mood: { tod: 'night', weather: 'snow' } },

  // ── 皇甫冉 ──
  '春思|皇甫冉':                    { year: 763, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 刘方平 ──
  '夜月|刘方平':                    { year: 755, mood: { tod: 'night', weather: 'none' } },
  '春怨|刘方平':                    { year: 755, mood: { tod: 'night', weather: 'none' } },

  // ── 朱庆余 ──
  '宫词|朱庆余':                    { year: 825, mood: { tod: 'night', weather: 'none' } },
  '近试上张籍水部|朱庆余':          { year: 826, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 王涯 ──
  '秋夜曲|王涯':                    { year: 820, mood: { tod: 'night', weather: 'none' } },

  // ── 王建 ──
  '新嫁娘词三首 三|王建':           { year: 800, mood: { tod: 'dawn',  weather: 'none' } },
  '故行宫|王建':                    { year: 810, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 柳中庸 ──
  '征怨|柳中庸':                    { year: 770, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 刘眘虚 ──
  '阙题|刘眘虚':                    { year: 740, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 明皇帝 (唐玄宗) ──
  '经邹鲁祭孔子而叹之|明皇帝':      { year: 725, mood: { tod: 'noon',  weather: 'none' } },

  // ── 韦庄 (晚唐-五代) ──
  '章台夜思|韦庄':                  { year: 880, mood: { tod: 'night', weather: 'none' } },
  '金陵图|韦庄':                    { year: 897, mood: { tod: 'dusk',  weather: 'rain' } },
  '台城|韦庄':                      { year: 895, mood: { tod: 'dusk',  weather: 'rain' } },

  // ── 南唐嗣主李璟 ──
  '摊破浣溪沙 一|李璟':             { year: 958, mood: { tod: 'dusk',  weather: 'none' } },
  '摊破浣溪沙 二|李璟':             { year: 958, mood: { tod: 'dusk',  weather: 'none' } },

  // ═══════════════════════════════════════════════════════════════════════
  // 宋词宋诗精确补录 (2026-04-21 第二轮)
  // ═══════════════════════════════════════════════════════════════════════

  // ── 柳永 ──
  '八声甘州|柳永':                  { year: 1018, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  '蝶恋花|柳永':                    { year: 1010, mood: { tod: 'night', weather: 'none' } },
  '少年游|柳永':                    { year: 1015, mood: { tod: 'dusk',  weather: 'none' } },
  '凤栖梧|柳永':                    { year: 1010, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  '鹤冲天|柳永':                    { year: 1008, location: '汴京', mood: { tod: 'noon',  weather: 'none' } },

  // ── 晏殊 ──
  '浣溪沙|晏殊':                    { year: 1040, mood: { tod: 'dusk',  weather: 'none' } },
  '蝶恋花|晏殊':                    { year: 1040, mood: { tod: 'dusk',  weather: 'none' } },
  '踏莎行|晏殊':                    { year: 1040, mood: { tod: 'dusk',  weather: 'none' } },
  '破阵子|晏殊':                    { year: 1040, mood: { tod: 'noon',  weather: 'none' } },
  '清平乐|晏殊':                    { year: 1040, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 晏几道 ──
  '临江仙|晏几道':                  { year: 1080, mood: { tod: 'night', weather: 'none' } },
  '鹧鸪天|晏几道':                  { year: 1085, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 欧阳修 ──
  '生查子 元夕|欧阳修':             { year: 1036, mood: { tod: 'night', weather: 'none' } },
  '生查子|欧阳修':                  { year: 1036, mood: { tod: 'night', weather: 'none' } },
  '踏莎行|欧阳修':                  { year: 1045, mood: { tod: 'dusk',  weather: 'none' } },
  '蝶恋花|欧阳修':                  { year: 1046, mood: { tod: 'dawn',  weather: 'none' } },
  '采桑子|欧阳修':                  { year: 1071, mood: { tod: 'noon',  weather: 'none' } },
  '朝中措|欧阳修':                  { year: 1047, mood: { tod: 'noon',  weather: 'none' } },
  '戏答元珍|欧阳修':                { year: 1036, location: '滁州', mood: { tod: 'dawn',  weather: 'none' } },

  // ── 范仲淹 ──
  '苏幕遮|范仲淹':                  { year: 1040, mood: { tod: 'dusk',  weather: 'none' } },
  '御街行|范仲淹':                  { year: 1040, mood: { tod: 'night', weather: 'none' } },

  // ── 王安石 (诗补) ──
  '书湖阴先生壁|王安石':            { year: 1082, mood: { tod: 'noon',  weather: 'none' } },
  '北山|王安石':                    { year: 1080, mood: { tod: 'noon',  weather: 'none' } },
  '江上|王安石':                    { year: 1075, mood: { tod: 'dusk',  weather: 'none' } },
  '浪淘沙令|王安石':                { year: 1075, mood: { tod: 'night', weather: 'none' } },

  // ── 苏轼 (补) ──
  '浣溪沙|苏轼':                    { year: 1082, mood: { tod: 'dawn',  weather: 'none' } },
  '水龙吟|苏轼':                    { year: 1081, mood: { tod: 'night', weather: 'none' } },
  '江城子|苏轼':                    { year: 1075, mood: { tod: 'night', weather: 'none' } },
  '卜算子|苏轼':                    { year: 1083, mood: { tod: 'night', weather: 'none' } },
  '蝶恋花|苏轼':                    { year: 1092, mood: { tod: 'dawn',  weather: 'none' } },
  '临江仙 夜归临皋|苏轼':           { year: 1082, mood: { tod: 'night', weather: 'none' } },
  '临江仙|苏轼':                    { year: 1082, mood: { tod: 'night', weather: 'none' } },
  '鹧鸪天|苏轼':                    { year: 1080, mood: { tod: 'dusk',  weather: 'none' } },
  '和子由渑池怀旧|苏轼':            { year: 1061, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  '六月二十日夜渡海|苏轼':          { year: 1100, mood: { tod: 'night', weather: 'none' } },
  '海棠|苏轼':                      { year: 1084, location: '黄州', mood: { tod: 'night', weather: 'none' } },
  '赠刘景文|苏轼':                  { year: 1090, location: '杭州', mood: { tod: 'noon',  weather: 'none' } },
  '春宵|苏轼':                      { year: 1081, location: '汴京', mood: { tod: 'night', weather: 'none' } },
  '饮湖上初晴后雨二首|苏轼':        { year: 1073, location: '杭州', mood: { tod: 'noon',  weather: 'rain' } },
  '六月二十七日望湖楼醉书|苏轼':    { year: 1072, location: '杭州', mood: { tod: 'noon',  weather: 'rain' } },
  '有美堂暴雨|苏轼':                { year: 1072, location: '杭州', mood: { tod: 'noon',  weather: 'rain' } },
  '新城道中|苏轼':                  { year: 1073, location: '杭州', mood: { tod: 'dawn',  weather: 'none' } },

  // ── 黄庭坚 ──
  '寄黄几复|黄庭坚':                { year: 1085, mood: { tod: 'dusk',  weather: 'none' } },
  '清明|黄庭坚':                    { year: 1082, mood: { tod: 'dusk',  weather: 'rain' } },
  '雨中登岳阳楼望君山|黄庭坚':      { year: 1101, mood: { tod: 'dusk',  weather: 'rain' } },
  '水调歌头|黄庭坚':                { year: 1091, mood: { tod: 'night', weather: 'none' } },
  '虞美人 宜州见梅作|黄庭坚':       { year: 1104, mood: { tod: 'noon',  weather: 'snow' } },

  // ── 秦观 (补) ──
  '浣溪沙|秦观':                    { year: 1094, mood: { tod: 'dusk',  weather: 'none' } },
  '鹊桥仙 纤云弄巧|秦观':           { year: 1078, location: '汴京', mood: { tod: 'night', weather: 'none' } },
  '满庭芳|秦观':                    { year: 1078, mood: { tod: 'dusk',  weather: 'none' } },
  '行香子|秦观':                    { year: 1079, mood: { tod: 'noon',  weather: 'none' } },

  // ── 贺铸 ──
  '青玉案|贺铸':                    { year: 1100, mood: { tod: 'dusk',  weather: 'rain' } },
  '鹧鸪天 重过阊门万事非|贺铸':     { year: 1105, mood: { tod: 'dusk',  weather: 'none' } },
  '半死桐|贺铸':                    { year: 1105, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 周邦彦 ──
  '兰陵王 柳|周邦彦':               { year: 1100, mood: { tod: 'dusk',  weather: 'none' } },
  '苏幕遮|周邦彦':                  { year: 1085, mood: { tod: 'noon',  weather: 'none' } },
  '少年游|周邦彦':                  { year: 1090, mood: { tod: 'night', weather: 'snow' } },
  '满庭芳 夏日溧水无想山作|周邦彦': { year: 1093, mood: { tod: 'noon',  weather: 'none' } },

  // ── 李清照 (补) ──
  '醉花阴|李清照':                  { year: 1103, mood: { tod: 'night', weather: 'none' } },
  '点绛唇|李清照':                  { year: 1100, mood: { tod: 'dawn',  weather: 'none' } },
  '渔家傲|李清照':                  { year: 1129, mood: { tod: 'dawn',  weather: 'none' } },
  '浣溪沙|李清照':                  { year: 1100, mood: { tod: 'dawn',  weather: 'none' } },
  '怨王孙|李清照':                  { year: 1103, mood: { tod: 'dusk',  weather: 'none' } },
  '永遇乐|李清照':                  { year: 1152, mood: { tod: 'night', weather: 'none' } },
  '凤凰台上忆吹箫|李清照':          { year: 1108, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 朱敦儒 ──
  '相见欢|朱敦儒':                  { year: 1135, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 岳飞 ──
  '满江红 怒发冲冠|岳飞':           { year: 1136, location: '汴京', mood: { tod: 'night', weather: 'none' } },
  '小重山|岳飞':                    { year: 1138, location: '汴京', mood: { tod: 'night', weather: 'none' } },

  // ── 张孝祥 ──
  '念奴娇 过洞庭|张孝祥':           { year: 1166, location: '岳阳', mood: { tod: 'night', weather: 'none' } },
  '六州歌头|张孝祥':                { year: 1163, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 陆游 (补) ──
  '钗头凤 世情薄|陆游':             { year: 1155, location: '越州', mood: { tod: 'dusk',  weather: 'none' } },
  '诉衷情|陆游':                    { year: 1190, mood: { tod: 'dusk',  weather: 'none' } },
  '卜算子 咏梅|陆游':               { year: 1175, mood: { tod: 'dusk',  weather: 'snow' } },
  '冬夜读书示子聿|陆游':            { year: 1199, location: '越州', mood: { tod: 'night', weather: 'none' } },
  '临安春雨初霁|陆游':              { year: 1186, location: '杭州', mood: { tod: 'dawn',  weather: 'rain' } },
  '十一月四日风雨大作|陆游':        { year: 1192, location: '越州', mood: { tod: 'night', weather: 'rain' } },
  '关山月|陆游':                    { year: 1177, location: '越州', mood: { tod: 'night', weather: 'none' } },

  // ── 辛弃疾 (补) ──
  '水龙吟 登建康赏心亭|辛弃疾':     { year: 1174, mood: { tod: 'dusk',  weather: 'none' } },
  '摸鱼儿|辛弃疾':                  { year: 1179, mood: { tod: 'dusk',  weather: 'none' } },
  '鹧鸪天|辛弃疾':                  { year: 1190, mood: { tod: 'noon',  weather: 'none' } },
  '清平乐 村居|辛弃疾':             { year: 1181, location: '吉州', mood: { tod: 'noon',  weather: 'none' } },
  '永遇乐 京口北固亭怀古|辛弃疾':   { year: 1205, location: '镇江', mood: { tod: 'dusk',  weather: 'none' } },
  '鹊桥仙|辛弃疾':                  { year: 1188, mood: { tod: 'night', weather: 'none' } },
  '水调歌头 带湖吾甚爱|辛弃疾':     { year: 1182, mood: { tod: 'noon',  weather: 'none' } },

  // ── 姜夔 (补) ──
  '暗香|姜夔':                      { year: 1191, location: '杭州', mood: { tod: 'night', weather: 'snow' } },
  '疏影|姜夔':                      { year: 1191, location: '杭州', mood: { tod: 'night', weather: 'snow' } },
  '踏莎行 自沔东来|姜夔':           { year: 1187, mood: { tod: 'night', weather: 'none' } },
  '长亭怨慢|姜夔':                  { year: 1191, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 吴文英 ──
  '风入松 听风听雨过清明|吴文英':   { year: 1242, mood: { tod: 'dusk',  weather: 'rain' } },
  '八声甘州|吴文英':                { year: 1245, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 史达祖 ──
  '双双燕|史达祖':                  { year: 1200, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 刘过 ──
  '唐多令|刘过':                    { year: 1203, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 蒋捷 ──
  '虞美人 听雨|蒋捷':               { year: 1290, mood: { tod: 'night', weather: 'rain' } },
  '一剪梅 舟过吴江|蒋捷':           { year: 1280, mood: { tod: 'dusk',  weather: 'rain' } },

  // ── 张炎 ──
  '解连环 孤雁|张炎':               { year: 1290, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 王沂孙 ──
  '眉妩 新月|王沂孙':               { year: 1280, mood: { tod: 'night', weather: 'none' } },

  // ── 文天祥 (补) ──
  '扬子江|文天祥':                  { year: 1276, location: '金陵', mood: { tod: 'dusk',  weather: 'none' } },
  '金陵驿|文天祥':                  { year: 1279, location: '金陵', mood: { tod: 'dusk',  weather: 'none' } },

  // ── 杨万里 (补) ──
  '小池|杨万里':                    { year: 1178, location: '杭州', mood: { tod: 'dawn',  weather: 'none' } },
  '舟过安仁|杨万里':                { year: 1192, mood: { tod: 'noon',  weather: 'none' } },
  '宿新市徐公店|杨万里':            { year: 1177, mood: { tod: 'noon',  weather: 'none' } },
  '闲居初夏午睡起|杨万里':          { year: 1178, mood: { tod: 'noon',  weather: 'none' } },

  // ── 范成大 (补) ──
  '四时田园杂兴|范成大':            { year: 1186, location: '苏州', mood: { tod: 'noon',  weather: 'none' } },

  // ── 朱熹 (补) ──
  '活水亭观书有感|朱熹':            { year: 1196, location: '建州', mood: { tod: 'noon',  weather: 'none' } },

  // ═══════════════════════════════════════════════════════════════════════
  // 词牌 × 作者 = 多首消歧义 (数组 + firstLine)
  // 同词牌多作的都放这里, 上面的 bare 词牌 singleton 会被 enrich 脚本
  // 自动以这里为准 (因为数组形式优先).
  // ═══════════════════════════════════════════════════════════════════════
  '浣溪沙|晏殊': [
    { firstLine: '一曲新词酒一杯', year: 1040, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '浣溪沙|苏轼': [
    { firstLine: '山下兰芽短浸溪', year: 1082, location: '黄州', mood: { tod: 'noon',  weather: 'none' } },
    { firstLine: '细雨斜风作晓寒', year: 1084, location: '黄州', mood: { tod: 'dawn',  weather: 'rain' } },
    { firstLine: '簌簌衣巾落枣花', year: 1078, location: '彭城', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '浣溪沙|秦观': [
    { firstLine: '漠漠轻寒上小楼', year: 1094, location: '郴州', mood: { tod: 'dusk',  weather: 'rain' } },
  ],
  '浣溪沙|李清照': [
    { firstLine: '小院闲窗春色深', year: 1100, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '蝶恋花|柳永': [
    { firstLine: '伫倚危楼风细细', year: 1015, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '蝶恋花|晏殊': [
    { firstLine: '槛菊愁烟兰泣露', year: 1040, location: '汴京', mood: { tod: 'dawn',  weather: 'none' } },
    { firstLine: '六曲阑干偎碧树', year: 1042, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '蝶恋花|欧阳修': [
    { firstLine: '庭院深深深几许', year: 1045, location: '汴京', mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '蝶恋花|李清照': [
    { firstLine: '暖雨晴风初破冻', year: 1103, location: '汴京', mood: { tod: 'dawn',  weather: 'none' } },
    { firstLine: '泪湿罗衣脂粉满', year: 1108, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '蝶恋花|苏轼': [
    { firstLine: '花褪残红青杏小', year: 1082, location: '黄州', mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '鹧鸪天|晏几道': [
    { firstLine: '彩袖殷勤捧玉钟', year: 1085, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
    { firstLine: '醉拍春衫惜旧香', year: 1088, location: '汴京', mood: { tod: 'night', weather: 'none' } },
  ],
  '鹧鸪天|苏轼': [
    { firstLine: '林断山明竹隐墙', year: 1082, location: '黄州', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '鹧鸪天|辛弃疾': [
    { firstLine: '陌上柔桑破嫩芽', year: 1190, mood: { tod: 'noon',  weather: 'none' } },
    { firstLine: '唱彻阳关泪未干', year: 1185, mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '鹧鸪天|黄庭坚': [
    { firstLine: '黄菊枝头生晓寒', year: 1091, mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '临江仙|晏几道': [
    { firstLine: '梦后楼台高锁', year: 1080, location: '汴京', mood: { tod: 'night', weather: 'none' } },
    { firstLine: '斗草阶前初见', year: 1085, location: '汴京', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '临江仙|苏轼': [
    { firstLine: '夜饮东坡醒复醉', year: 1082, location: '黄州', mood: { tod: 'night', weather: 'none' } },
  ],
  '临江仙|李清照': [
    { firstLine: '庭院深深深几许', year: 1135, location: '金陵', mood: { tod: 'night', weather: 'none' } },
  ],
  '水调歌头|苏轼': [
    { firstLine: '明月几时有', year: 1076, location: '密州', mood: { tod: 'night', weather: 'none' } },
  ],
  '水调歌头|黄庭坚': [
    { firstLine: '瑶草一何碧', year: 1091, mood: { tod: 'noon',  weather: 'none' } },
  ],
  '水调歌头|辛弃疾': [
    { firstLine: '带湖吾甚爱', year: 1182, mood: { tod: 'noon',  weather: 'none' } },
    { firstLine: '长恨复长恨', year: 1179, mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '踏莎行|晏殊': [
    { firstLine: '小径红稀', year: 1040, location: '汴京', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '踏莎行|欧阳修': [
    { firstLine: '候馆梅残', year: 1045, location: '汴京', mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '破阵子|晏殊': [
    { firstLine: '燕子来时新社', year: 1040, location: '汴京', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '破阵子|辛弃疾': [
    { firstLine: '醉里挑灯看剑', year: 1188, mood: { tod: 'night', weather: 'none' } },
  ],
  '清平乐|晏殊': [
    { firstLine: '金风细细', year: 1040, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '清平乐|李煜': [
    { firstLine: '别来春半', year: 975, location: '金陵', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '清平乐|黄庭坚': [
    { firstLine: '春归何处', year: 1100, mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '采桑子|欧阳修': [
    { firstLine: '轻舟短棹西湖好', year: 1071, mood: { tod: 'noon',  weather: 'none' } },
  ],
  '朝中措|欧阳修': [
    { firstLine: '平山栏槛倚晴空', year: 1047, location: '扬州', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '如梦令|李清照': [
    { firstLine: '常记溪亭日暮', year: 1099, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
    { firstLine: '昨夜雨疏风骤', year: 1100, location: '汴京', mood: { tod: 'dawn',  weather: 'rain' } },
  ],
  '生查子|欧阳修': [
    { firstLine: '去年元夜时', year: 1036, location: '汴京', mood: { tod: 'night', weather: 'none' } },
  ],
  '渔家傲|李清照': [
    { firstLine: '天接云涛连晓雾', year: 1129, location: '金陵', mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '渔家傲|范仲淹': [
    { firstLine: '塞下秋来风景异', year: 1040, location: '延州', mood: { tod: 'night', weather: 'none' } },
  ],
  '醉花阴|李清照': [
    { firstLine: '薄雾浓云愁永昼', year: 1103, location: '汴京', mood: { tod: 'night', weather: 'none' } },
  ],
  '点绛唇|李清照': [
    { firstLine: '蹴罢秋千', year: 1100, location: '汴京', mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '永遇乐|李清照': [
    { firstLine: '落日熔金', year: 1152, location: '金陵', mood: { tod: 'night', weather: 'none' } },
  ],
  '凤凰台上忆吹箫|李清照': [
    { firstLine: '香冷金猊', year: 1108, location: '汴京', mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '摸鱼儿|辛弃疾': [
    { firstLine: '更能消几番风雨', year: 1179, mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '水龙吟|苏轼': [
    { firstLine: '似花还似非花', year: 1081, location: '黄州', mood: { tod: 'night', weather: 'none' } },
  ],
  '水龙吟|辛弃疾': [
    { firstLine: '楚天千里清秋', year: 1174, location: '金陵', mood: { tod: 'dusk',  weather: 'none' } },
    { firstLine: '举头西北浮云', year: 1192, location: '镇江', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '诉衷情|陆游': [
    { firstLine: '当年万里觅封侯', year: 1190, location: '越州', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '六州歌头|张孝祥': [
    { firstLine: '长淮望断', year: 1163, location: '镇江', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '六州歌头|贺铸': [
    { firstLine: '少年侠气', year: 1100, mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '青玉案|贺铸': [
    { firstLine: '凌波不过横塘路', year: 1100, location: '苏州', mood: { tod: 'dusk',  weather: 'rain' } },
  ],
  '青玉案|辛弃疾': [
    { firstLine: '东风夜放花千树', year: 1175, location: '杭州', mood: { tod: 'night', weather: 'none' } },
  ],
  '少年游|柳永': [
    { firstLine: '长安古道马迟迟', year: 1015, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '少年游|周邦彦': [
    { firstLine: '朝云漠漠散轻丝', year: 1090, location: '汴京', mood: { tod: 'noon',  weather: 'rain' } },
  ],
  '苏幕遮|范仲淹': [
    { firstLine: '碧云天', year: 1040, location: '延州', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '苏幕遮|周邦彦': [
    { firstLine: '燎沉香', year: 1085, location: '汴京', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '江城子|苏轼': [
    { firstLine: '十年生死两茫茫', year: 1075, location: '密州', mood: { tod: 'night', weather: 'none' } },
    { firstLine: '老夫聊发少年狂', year: 1075, location: '密州', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '卜算子|苏轼': [
    { firstLine: '缺月挂疏桐', year: 1083, location: '黄州', mood: { tod: 'night', weather: 'none' } },
  ],
  '卜算子|陆游': [
    { firstLine: '驿外断桥边', year: 1175, location: '越州', mood: { tod: 'dusk',  weather: 'snow' } },
  ],
  '虞美人|李煜': [
    { firstLine: '春花秋月何时了', year: 978, location: '汴京', mood: { tod: 'night', weather: 'none' } },
    { firstLine: '风回小院庭芜绿', year: 977, location: '汴京', mood: { tod: 'dawn',  weather: 'none' } },
  ],
  '相见欢|李煜': [
    { firstLine: '无言独上西楼', year: 975, location: '金陵', mood: { tod: 'night', weather: 'none' } },
    { firstLine: '林花谢了春红', year: 975, location: '金陵', mood: { tod: 'dusk',  weather: 'rain' } },
  ],
  '浪淘沙|李煜': [
    { firstLine: '帘外雨潺潺', year: 978, location: '汴京', mood: { tod: 'night', weather: 'rain' } },
    { firstLine: '往事只堪哀', year: 977, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  ],
  '菩萨蛮|韦庄': [
    { firstLine: '人人尽说江南好', year: 895, location: '成都', mood: { tod: 'noon',  weather: 'none' } },
    { firstLine: '红楼别夜堪惆怅', year: 880, location: '长安', mood: { tod: 'night', weather: 'none' } },
    { firstLine: '如今却忆江南乐', year: 900, location: '成都', mood: { tod: 'noon',  weather: 'none' } },
  ],
  '菩萨蛮|温庭筠': [
    { firstLine: '小山重叠金明灭', year: 855, location: '长安', mood: { tod: 'dawn',  weather: 'none' } },
  ],

  // ═══════════════════════════════════════════════════════════════════════
  // 主要诗人/词人深挖 (2026-04-21 第三轮)
  // 只收有学界共识编年的作品; 疑年诗不加
  // ═══════════════════════════════════════════════════════════════════════

  // ── 李白 (深挖) ──
  '蜀道难|李白':                    { year: 730, mood: { tod: 'noon',  weather: 'none' } },
  '将进酒|李白':                    { year: 752, mood: { tod: 'night', weather: 'none' } },
  '关山月|李白':                    { year: 744, mood: { tod: 'night', weather: 'none' } },
  '塞下曲六首 一|李白':             { year: 735, mood: { tod: 'night', weather: 'snow' } },
  '塞下曲六首 二|李白':             { year: 735, mood: { tod: 'dusk',  weather: 'none' } },
  '战城南|李白':                    { year: 747, mood: { tod: 'dusk',  weather: 'none' } },
  '远别离|李白':                    { year: 750, mood: { tod: 'dusk',  weather: 'none' } },
  '北风行|李白':                    { year: 750, mood: { tod: 'night', weather: 'snow' } },
  '蜀道难|李白':                    { year: 730, mood: { tod: 'noon',  weather: 'none' } },
  '公无渡河|李白':                  { year: 744, mood: { tod: 'noon',  weather: 'none' } },
  '丁都护歌|李白':                  { year: 747, mood: { tod: 'noon',  weather: 'none' } },
  '侠客行|李白':                    { year: 744, mood: { tod: 'noon',  weather: 'none' } },
  '古风 一|李白':                   { year: 742, mood: { tod: 'noon',  weather: 'none' } },
  '古风 十|李白':                   { year: 745, mood: { tod: 'noon',  weather: 'none' } },
  '古风 十九|李白':                 { year: 756, mood: { tod: 'noon',  weather: 'none' } },
  '把酒问月|李白':                  { year: 750, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '山中问答|李白':                  { year: 744, mood: { tod: 'noon',  weather: 'none' } },
  '客中作|李白':                    { year: 746, mood: { tod: 'night', weather: 'none' } },
  '秋浦歌十七首 十五|李白':         { year: 754, mood: { tod: 'noon',  weather: 'none' } },
  '长门怨二首 一|李白':             { year: 744, mood: { tod: 'night', weather: 'none' } },
  '黄鹤楼闻笛|李白':                { year: 759, mood: { tod: 'night', weather: 'none' } },
  '赠汪伦|李白':                    { year: 755, mood: { tod: 'noon',  weather: 'none' } },
  '送友人入蜀|李白':                { year: 742, location: '成都', mood: { tod: 'noon',  weather: 'none' } },
  '越中览古|李白':                  { year: 726, location: '越州', mood: { tod: 'dusk',  weather: 'none' } },
  '苏台览古|李白':                  { year: 726, location: '苏州', mood: { tod: 'dusk',  weather: 'none' } },
  '望天门山|李白':                  { year: 725, location: '宣城', mood: { tod: 'noon',  weather: 'none' } },
  '秋登宣城谢朓北楼|李白':          { year: 753, mood: { tod: 'dusk',  weather: 'none' } },
  '独坐敬亭山|李白':                { year: 753, mood: { tod: 'noon',  weather: 'none' } },
  '劳劳亭|李白':                    { year: 748, mood: { tod: 'dusk',  weather: 'none' } },
  '忆东山二首 一|李白':             { year: 744, mood: { tod: 'noon',  weather: 'none' } },
  '峨眉山月歌送蜀僧晏入中京|李白':  { year: 755, mood: { tod: 'night', weather: 'none' } },
  '陪侍郎叔游洞庭醉后三首 三|李白': { year: 759, mood: { tod: 'noon',  weather: 'none' } },
  '与夏十二登岳阳楼|李白':          { year: 759, mood: { tod: 'dusk',  weather: 'none' } },
  '哭晁卿衡|李白':                  { year: 754, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 杜甫 (深挖) ──
  '望岳|杜甫':                      { year: 736, mood: { tod: 'noon',  weather: 'none' } },
  '前出塞九首 一|杜甫':             { year: 751, mood: { tod: 'noon',  weather: 'none' } },
  '后出塞五首 一|杜甫':             { year: 755, mood: { tod: 'dusk',  weather: 'none' } },
  '奉赠韦左丞丈二十二韵|杜甫':      { year: 748, mood: { tod: 'noon',  weather: 'none' } },
  '自京赴奉先县咏怀五百字|杜甫':    { year: 755, location: '长安', mood: { tod: 'night', weather: 'snow' } },
  '悲陈陶|杜甫':                    { year: 756, mood: { tod: 'night', weather: 'none' } },
  '悲青坂|杜甫':                    { year: 756, mood: { tod: 'night', weather: 'none' } },
  '对雪|杜甫':                      { year: 756, mood: { tod: 'night', weather: 'snow' } },
  '春望|杜甫':                      { year: 757, mood: { tod: 'noon',  weather: 'none' } },
  '羌村三首 一|杜甫':               { year: 757, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  '北征|杜甫':                      { year: 757, location: '长安', mood: { tod: 'noon',  weather: 'none' } },
  '三吏|杜甫':                      { year: 759, mood: { tod: 'noon',  weather: 'none' } },
  '新安吏|杜甫':                    { year: 759, mood: { tod: 'noon',  weather: 'none' } },
  '石壕吏|杜甫':                    { year: 759, mood: { tod: 'night', weather: 'none' } },
  '潼关吏|杜甫':                    { year: 759, mood: { tod: 'noon',  weather: 'none' } },
  '三别|杜甫':                      { year: 759, mood: { tod: 'noon',  weather: 'none' } },
  '新婚别|杜甫':                    { year: 759, mood: { tod: 'noon',  weather: 'none' } },
  '垂老别|杜甫':                    { year: 759, mood: { tod: 'noon',  weather: 'none' } },
  '无家别|杜甫':                    { year: 759, mood: { tod: 'dusk',  weather: 'none' } },
  '月夜忆舍弟|杜甫':                { year: 759, mood: { tod: 'night', weather: 'none' } },
  '蜀相|杜甫':                      { year: 760, mood: { tod: 'dusk',  weather: 'none' } },
  '春夜喜雨|杜甫':                  { year: 761, mood: { tod: 'night', weather: 'rain' } },
  '江村|杜甫':                      { year: 761, mood: { tod: 'noon',  weather: 'none' } },
  '水槛遣心二首|杜甫':              { year: 761, mood: { tod: 'noon',  weather: 'none' } },
  '百忧集行|杜甫':                  { year: 761, mood: { tod: 'dusk',  weather: 'none' } },
  '戏为六绝句 一|杜甫':             { year: 762, mood: { tod: 'noon',  weather: 'none' } },
  '赠花卿|杜甫':                    { year: 761, location: '成都', mood: { tod: 'noon',  weather: 'none' } },
  '江南逢李龟年|杜甫':              { year: 770, mood: { tod: 'dusk',  weather: 'none' } },
  '秋兴八首 一|杜甫':               { year: 766, location: '白帝城', mood: { tod: 'dusk',  weather: 'none' } },
  '秋兴八首 二|杜甫':               { year: 766, location: '白帝城', mood: { tod: 'dusk',  weather: 'none' } },
  '登岳阳楼|杜甫':                  { year: 768, mood: { tod: 'dusk',  weather: 'none' } },
  '又呈吴郎|杜甫':                  { year: 767, mood: { tod: 'noon',  weather: 'none' } },

  // ── 王维 (深挖) ──
  '九月九日忆山东兄弟|王维':        { year: 717, mood: { tod: 'noon',  weather: 'none' } },
  '相思|王维':                      { year: 750, mood: { tod: 'noon',  weather: 'none' } },
  '观猎|王维':                      { year: 728, mood: { tod: 'noon',  weather: 'none' } },
  '使至塞上|王维':                  { year: 737, mood: { tod: 'dusk',  weather: 'none' } },
  '竹里馆|王维':                    { year: 748, location: '终南山', mood: { tod: 'night', weather: 'none' } },
  '鹿柴|王维':                      { year: 748, mood: { tod: 'dusk',  weather: 'none' } },
  '山居秋暝|王维':                  { year: 757, mood: { tod: 'dusk',  weather: 'none' } },
  '送别 下马饮君酒|王维':           { year: 757, mood: { tod: 'dusk',  weather: 'none' } },
  '田园乐七首 六|王维':             { year: 745, mood: { tod: 'dawn',  weather: 'none' } },
  '少年行四首 一|王维':             { year: 720, mood: { tod: 'noon',  weather: 'none' } },
  '鸟鸣涧|王维':                    { year: 748, mood: { tod: 'night', weather: 'none' } },
  '杂诗|王维':                      { year: 750, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 白居易 (深挖, 作品多数可编年) ──
  '赋得古原草送别|白居易':          { year: 787, mood: { tod: 'dusk',  weather: 'none' } },
  '观刈麦|白居易':                  { year: 806, location: '许昌', mood: { tod: 'noon',  weather: 'none' } },
  '长恨歌|白居易':                  { year: 806, mood: { tod: 'night', weather: 'none' } },
  '琵琶行|白居易':                  { year: 816, mood: { tod: 'night', weather: 'none' } },
  '卖炭翁|白居易':                  { year: 809, location: '长安', mood: { tod: 'dawn',  weather: 'snow' } },
  '新丰折臂翁|白居易':              { year: 809, mood: { tod: 'noon',  weather: 'none' } },
  '杜陵叟|白居易':                  { year: 809, mood: { tod: 'noon',  weather: 'none' } },
  '上阳白发人|白居易':              { year: 809, mood: { tod: 'dusk',  weather: 'none' } },
  '轻肥|白居易':                    { year: 810, mood: { tod: 'noon',  weather: 'none' } },
  '井底引银瓶|白居易':              { year: 810, mood: { tod: 'noon',  weather: 'none' } },
  '村夜|白居易':                    { year: 808, mood: { tod: 'night', weather: 'none' } },
  '夜雪|白居易':                    { year: 816, location: '浔阳', mood: { tod: 'night', weather: 'snow' } },
  '暮江吟|白居易':                  { year: 822, mood: { tod: 'dusk',  weather: 'none' } },
  '大林寺桃花|白居易':              { year: 817, location: '庐山', mood: { tod: 'noon',  weather: 'none' } },
  '钱塘湖春行|白居易':              { year: 823, mood: { tod: 'dawn',  weather: 'none' } },
  '春题湖上|白居易':                { year: 823, mood: { tod: 'noon',  weather: 'none' } },
  '池上|白居易':                    { year: 824, mood: { tod: 'noon',  weather: 'none' } },
  '忆江南三首 一|白居易':           { year: 838, location: '洛阳', mood: { tod: 'dawn',  weather: 'none' } },
  '忆江南三首 二|白居易':           { year: 838, location: '洛阳', mood: { tod: 'dusk',  weather: 'none' } },
  '忆江南三首 三|白居易':           { year: 838, location: '洛阳', mood: { tod: 'dusk',  weather: 'none' } },
  '长相思 汴水流|白居易':           { year: 823, mood: { tod: 'dusk',  weather: 'none' } },
  '花非花|白居易':                  { year: 830, mood: { tod: 'night', weather: 'none' } },
  '浪淘沙 四|白居易':               { year: 820, mood: { tod: 'noon',  weather: 'none' } },

  // ── 刘禹锡 (深挖) ──
  '陋室铭|刘禹锡':                  { year: 824, location: '建州', mood: { tod: 'noon',  weather: 'none' } },
  '秋词二首 一|刘禹锡':             { year: 805, mood: { tod: 'dusk',  weather: 'none' } },
  '秋风引|刘禹锡':                  { year: 805, mood: { tod: 'dusk',  weather: 'none' } },
  '竹枝词 一|刘禹锡':               { year: 822, mood: { tod: 'dawn',  weather: 'none' } },
  '竹枝词九首 一|刘禹锡':           { year: 822, mood: { tod: 'noon',  weather: 'none' } },
  '玄都观桃花|刘禹锡':              { year: 815, mood: { tod: 'noon',  weather: 'none' } },
  '再游玄都观|刘禹锡':              { year: 828, mood: { tod: 'noon',  weather: 'none' } },
  '酬乐天扬州初逢席上见赠|刘禹锡':  { year: 826, location: '扬州', mood: { tod: 'night', weather: 'none' } },
  '金陵五题 乌衣巷|刘禹锡':         { year: 826, location: '金陵', mood: { tod: 'dusk',  weather: 'none' } },
  '石头城|刘禹锡':                  { year: 826, location: '金陵', mood: { tod: 'night', weather: 'none' } },
  '潇湘神 二|刘禹锡':               { year: 822, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 韩愈 (深挖) ──
  '早春呈水部张十八员外|韩愈':      { year: 823, location: '长安', mood: { tod: 'dawn',  weather: 'rain' } },
  '春雪|韩愈':                      { year: 815, location: '长安', mood: { tod: 'dawn',  weather: 'snow' } },
  '晚春|韩愈':                      { year: 813, location: '洛阳', mood: { tod: 'noon',  weather: 'none' } },
  '湘中|韩愈':                      { year: 795, mood: { tod: 'dusk',  weather: 'none' } },
  '听颖师弹琴|韩愈':                { year: 816, mood: { tod: 'night', weather: 'none' } },
  '左迁至蓝关示侄孙湘|韩愈':        { year: 819, mood: { tod: 'dusk',  weather: 'snow' } },

  // ── 柳宗元 (深挖) ──
  '江雪|柳宗元':                    { year: 809, mood: { tod: 'noon',  weather: 'snow' } },
  '渔翁|柳宗元':                    { year: 810, mood: { tod: 'dawn',  weather: 'none' } },
  '溪居|柳宗元':                    { year: 811, mood: { tod: 'dawn',  weather: 'none' } },
  '登柳州城楼寄漳汀封连四州|柳宗元':{ year: 815, location: '柳州', mood: { tod: 'dusk',  weather: 'rain' } },
  '与浩初上人同看山寄京华亲故|柳宗元': { year: 817, mood: { tod: 'noon',  weather: 'none' } },
  '酬曹侍御过象县见寄|柳宗元':      { year: 817, mood: { tod: 'noon',  weather: 'none' } },
  '登柳州峨山|柳宗元':              { year: 816, mood: { tod: 'noon',  weather: 'none' } },
  '杨柳枝|柳宗元':                  { year: 810, mood: { tod: 'noon',  weather: 'none' } },

  // ── 李商隐 (深挖) ──
  '无题 相见时难别亦难|李商隐':     { year: 851, location: '长安', mood: { tod: 'dusk',  weather: 'none' } },
  '无题 昨夜星辰昨夜风|李商隐':     { year: 848, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '无题 来是空言去绝踪|李商隐':     { year: 848, mood: { tod: 'night', weather: 'none' } },
  '无题 八岁偷照镜|李商隐':         { year: 830, mood: { tod: 'noon',  weather: 'none' } },
  '夜雨寄北|李商隐':                { year: 851, mood: { tod: 'night', weather: 'rain' } },
  '锦瑟|李商隐':                    { year: 858, mood: { tod: 'night', weather: 'none' } },
  '乐游原|李商隐':                  { year: 848, mood: { tod: 'dusk',  weather: 'none' } },
  '嫦娥|李商隐':                    { year: 848, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '花下醉|李商隐':                  { year: 845, mood: { tod: 'night', weather: 'none' } },

  // ── 杜牧 (深挖) ──
  '过华清宫绝句三首 一|杜牧':       { year: 833, mood: { tod: 'noon',  weather: 'none' } },
  '过华清宫|杜牧':                  { year: 833, mood: { tod: 'noon',  weather: 'none' } },
  '江南春|杜牧':                    { year: 834, mood: { tod: 'dawn',  weather: 'rain' } },
  '赤壁|杜牧':                      { year: 842, mood: { tod: 'dusk',  weather: 'none' } },
  '泊秦淮|杜牧':                    { year: 841, mood: { tod: 'night', weather: 'none' } },
  '寄扬州韩绰判官|杜牧':            { year: 833, mood: { tod: 'night', weather: 'none' } },
  '遣怀|杜牧':                      { year: 840, mood: { tod: 'dusk',  weather: 'none' } },
  '题乌江亭|杜牧':                  { year: 841, mood: { tod: 'noon',  weather: 'none' } },
  '山行|杜牧':                      { year: 835, mood: { tod: 'dusk',  weather: 'none' } },
  '秋夕|杜牧':                      { year: 840, mood: { tod: 'night', weather: 'none' } },
  '清明|杜牧':                      { year: 845, mood: { tod: 'dusk',  weather: 'rain' } },

  // ── 王昌龄 (深挖) ──
  '芙蓉楼送辛渐|王昌龄':            { year: 742, mood: { tod: 'dawn',  weather: 'rain' } },
  '出塞二首 一|王昌龄':             { year: 724, location: '玉门关', mood: { tod: 'night', weather: 'none' } },
  '从军行七首 一|王昌龄':           { year: 727, location: '凉州', mood: { tod: 'dusk',  weather: 'none' } },
  '从军行七首 二|王昌龄':           { year: 727, location: '凉州', mood: { tod: 'dusk',  weather: 'none' } },
  '从军行七首 四|王昌龄':           { year: 727, location: '凉州', mood: { tod: 'night', weather: 'none' } },
  '采莲曲|王昌龄':                  { year: 730, mood: { tod: 'noon',  weather: 'none' } },

  // ── 岑参 (深挖) ──
  '白雪歌送武判官归京|岑参':        { year: 754, mood: { tod: 'noon',  weather: 'snow' } },
  '碛中作|岑参':                    { year: 749, mood: { tod: 'dusk',  weather: 'none' } },
  '热海行送崔侍御还京|岑参':        { year: 753, mood: { tod: 'noon',  weather: 'none' } },
  '火山云歌送别|岑参':              { year: 750, mood: { tod: 'noon',  weather: 'none' } },
  '首秋轮台|岑参':                  { year: 754, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 高适 (深挖) ──
  '别董大二首 一|高适':             { year: 747, location: '邯郸', mood: { tod: 'dusk',  weather: 'snow' } },
  '别董大|高适':                    { year: 747, location: '邯郸', mood: { tod: 'dusk',  weather: 'snow' } },
  '除夜作|高适':                    { year: 750, location: '长安', mood: { tod: 'night', weather: 'none' } },
  '塞上听吹笛|高适':                { year: 738, mood: { tod: 'night', weather: 'snow' } },

  // ── 苏轼 (深挖补) ──
  '念奴娇 赤壁怀古|苏轼':           { year: 1082, location: '黄州', mood: { tod: 'dusk',  weather: 'none' } },
  '水调歌头 明月几时有|苏轼':       { year: 1076, location: '密州', mood: { tod: 'night', weather: 'none' } },
  '江城子 乙卯正月二十日夜记梦|苏轼': { year: 1075, location: '密州', mood: { tod: 'night', weather: 'none' } },
  '定风波 莫听穿林打叶声|苏轼':     { year: 1082, location: '黄州', mood: { tod: 'noon',  weather: 'rain' } },
  '题西林壁|苏轼':                  { year: 1084, mood: { tod: 'noon',  weather: 'none' } },
  '惠崇春江晚景|苏轼':              { year: 1085, mood: { tod: 'dusk',  weather: 'none' } },
  '饮湖上初晴后雨|苏轼':            { year: 1073, mood: { tod: 'noon',  weather: 'rain' } },
  '江城子 密州出猎|苏轼':           { year: 1075, location: '密州', mood: { tod: 'noon',  weather: 'none' } },
  '蝶恋花 春景|苏轼':               { year: 1092, location: '杭州', mood: { tod: 'dawn',  weather: 'none' } },
  '记承天寺夜游|苏轼':              { year: 1083, location: '黄州', mood: { tod: 'night', weather: 'none' } },
  '东栏梨花|苏轼':                  { year: 1077, location: '彭城', mood: { tod: 'noon',  weather: 'none' } },
  '和子由渑池怀旧|苏轼':            { year: 1061, mood: { tod: 'dusk',  weather: 'none' } },
  '出颍口初见淮山是日至寿州|苏轼':  { year: 1071, mood: { tod: 'noon',  weather: 'none' } },
  '吉祥寺赏牡丹|苏轼':              { year: 1072, mood: { tod: 'noon',  weather: 'none' } },
  '八月十五日看潮|苏轼':            { year: 1073, mood: { tod: 'noon',  weather: 'none' } },
  '除夜野宿常州城外|苏轼':          { year: 1073, mood: { tod: 'night', weather: 'none' } },
  '腊日游孤山访惠勤惠思二僧|苏轼':  { year: 1072, mood: { tod: 'noon',  weather: 'none' } },

  // ── 王安石 (深挖补) ──
  '泊船瓜洲|王安石':                { year: 1075, mood: { tod: 'night', weather: 'none' } },
  '梅花|王安石':                    { year: 1078, mood: { tod: 'noon',  weather: 'snow' } },
  '登飞来峰|王安石':                { year: 1050, mood: { tod: 'dawn',  weather: 'none' } },
  '元日|王安石':                    { year: 1068, mood: { tod: 'dawn',  weather: 'none' } },
  '明妃曲|王安石':                  { year: 1059, location: '汴京', mood: { tod: 'noon',  weather: 'none' } },
  '桂枝香 金陵怀古|王安石':         { year: 1076, location: '金陵', mood: { tod: 'dusk',  weather: 'none' } },

  // ── 陆游 (深挖补, 他晚年诗编年密集) ──
  '示儿|陆游':                      { year: 1210, mood: { tod: 'night', weather: 'none' } },
  '游山西村|陆游':                  { year: 1167, mood: { tod: 'noon',  weather: 'none' } },
  '书愤|陆游':                      { year: 1186, mood: { tod: 'dusk',  weather: 'none' } },
  '沈园二首 一|陆游':               { year: 1199, location: '越州', mood: { tod: 'dusk',  weather: 'none' } },
  '沈园二首 二|陆游':               { year: 1199, location: '越州', mood: { tod: 'dusk',  weather: 'none' } },
  '秋夜将晓出篱门迎凉有感二首 二|陆游': { year: 1192, location: '越州', mood: { tod: 'dawn',  weather: 'none' } },
  '秋夜将晓出篱门迎凉有感|陆游':    { year: 1192, mood: { tod: 'dawn',  weather: 'none' } },
  '观书有感|陆游':                  { year: 1196, location: '越州', mood: { tod: 'noon',  weather: 'none' } },
  '马上作|陆游':                    { year: 1172, location: '剑门', mood: { tod: 'noon',  weather: 'none' } },
  '夜游宫 记梦寄师伯浑|陆游':       { year: 1170, location: '成都', mood: { tod: 'night', weather: 'none' } },
  '金错刀行|陆游':                  { year: 1178, location: '越州', mood: { tod: 'noon',  weather: 'none' } },
  '长歌行|陆游':                    { year: 1170, location: '越州', mood: { tod: 'noon',  weather: 'none' } },
  '病起书怀|陆游':                  { year: 1178, location: '越州', mood: { tod: 'dusk',  weather: 'none' } },
  '对酒|陆游':                      { year: 1195, location: '越州', mood: { tod: 'night', weather: 'none' } },

  // ── 辛弃疾 (深挖补) ──
  '青玉案 元夕|辛弃疾':             { year: 1175, location: '杭州', mood: { tod: 'night', weather: 'none' } },
  '破阵子 为陈同甫赋壮词以寄之|辛弃疾': { year: 1188, location: '吉州', mood: { tod: 'night', weather: 'none' } },
  '永遇乐 京口北固亭怀古|辛弃疾':   { year: 1205, mood: { tod: 'dusk',  weather: 'none' } },
  '丑奴儿 书博山道中壁|辛弃疾':     { year: 1181, location: '吉州', mood: { tod: 'dusk',  weather: 'none' } },
  '西江月 夜行黄沙道中|辛弃疾':     { year: 1181, location: '吉州', mood: { tod: 'night', weather: 'none' } },
  '南乡子 登京口北固亭有怀|辛弃疾': { year: 1204, location: '镇江', mood: { tod: 'dusk',  weather: 'none' } },
  '菩萨蛮 书江西造口壁|辛弃疾':     { year: 1176, location: '吉州', mood: { tod: 'dusk',  weather: 'none' } },
  '贺新郎 别茂嘉十二弟|辛弃疾':     { year: 1190, location: '吉州', mood: { tod: 'dusk',  weather: 'none' } },
  '木兰花慢 可怜今夕月|辛弃疾':     { year: 1188, mood: { tod: 'night', weather: 'none' } },
  '太常引 建康中秋夜|辛弃疾':       { year: 1174, location: '金陵', mood: { tod: 'night', weather: 'none' } },
  '水龙吟 过南剑双溪楼|辛弃疾':     { year: 1192, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 李清照 (深挖补) ──
  '声声慢 寻寻觅觅|李清照':         { year: 1151, mood: { tod: 'dusk',  weather: 'rain' } },
  '一剪梅 红藕香残玉簟秋|李清照':   { year: 1103, mood: { tod: 'dusk',  weather: 'none' } },
  '武陵春 春晚|李清照':             { year: 1135, mood: { tod: 'dawn',  weather: 'none' } },
  '如梦令 昨夜雨疏风骤|李清照':     { year: 1100, mood: { tod: 'dawn',  weather: 'rain' } },
  '如梦令 常记溪亭日暮|李清照':     { year: 1099, mood: { tod: 'dusk',  weather: 'none' } },
  '夏日绝句|李清照':                { year: 1129, mood: { tod: 'noon',  weather: 'none' } },
  '蝶恋花|李清照':                  { year: 1103, mood: { tod: 'dusk',  weather: 'none' } },
  '临江仙|李清照':                  { year: 1135, mood: { tod: 'night', weather: 'none' } },
  '添字丑奴儿|李清照':              { year: 1135, mood: { tod: 'dusk',  weather: 'rain' } },

  // ── 欧阳修 (深挖补) ──
  '蝶恋花 庭院深深深几许|欧阳修':   { year: 1045, mood: { tod: 'dawn',  weather: 'none' } },
  '玉楼春|欧阳修':                  { year: 1045, location: '汴京', mood: { tod: 'dusk',  weather: 'none' } },
  '画眉鸟|欧阳修':                  { year: 1046, location: '滁州', mood: { tod: 'noon',  weather: 'none' } },
  '岳阳楼记|欧阳修':                { year: 1046, mood: { tod: 'dusk',  weather: 'rain' } },
  '秋声赋|欧阳修':                  { year: 1059, location: '汴京', mood: { tod: 'night', weather: 'none' } },

  // ── 黄庭坚 (深挖补) ──
  '登快阁|黄庭坚':                  { year: 1082, mood: { tod: 'dusk',  weather: 'none' } },
  '清平乐 春归何处|黄庭坚':         { year: 1100, mood: { tod: 'dusk',  weather: 'none' } },
  '鹧鸪天|黄庭坚':                  { year: 1090, mood: { tod: 'noon',  weather: 'none' } },
  '题落星寺|黄庭坚':                { year: 1091, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 秦观 (深挖补) ──
  '踏莎行 郴州旅舍|秦观':           { year: 1097, location: '郴州', mood: { tod: 'dusk',  weather: 'rain' } },
  '鹊桥仙|秦观':                    { year: 1078, mood: { tod: 'night', weather: 'none' } },
  '江城子 西城杨柳弄春柔|秦观':     { year: 1086, mood: { tod: 'dusk',  weather: 'none' } },
  '满庭芳 山抹微云|秦观':           { year: 1078, mood: { tod: 'dusk',  weather: 'none' } },

  // ── 姜夔 (深挖补) ──
  '扬州慢|姜夔':                    { year: 1176, mood: { tod: 'dusk',  weather: 'none' } },
  '淡黄柳|姜夔':                    { year: 1191, mood: { tod: 'dusk',  weather: 'none' } },
  '鹧鸪天 元夕有所梦|姜夔':         { year: 1197, location: '杭州', mood: { tod: 'night', weather: 'none' } },

  // ── 贺铸 (补) ──
  '六州歌头|贺铸':                  { year: 1100, mood: { tod: 'dusk',  weather: 'none' } },
  '天仙子|贺铸':                    { year: 1098, mood: { tod: 'night', weather: 'none' } },

  // ── 张炎 / 王沂孙 晚宋遗民词人 ──
  '高阳台 西湖春感|张炎':           { year: 1290, mood: { tod: 'dusk',  weather: 'rain' } },

  // ── 杨万里 (深挖补) ──
  '晓出净慈寺送林子方|杨万里':      { year: 1187, mood: { tod: 'dawn',  weather: 'none' } },
  '初入淮河四绝句|杨万里':          { year: 1189, mood: { tod: 'dawn',  weather: 'none' } },
  '过松源晨炊漆公店|杨万里':        { year: 1192, mood: { tod: 'dawn',  weather: 'none' } },

  // ── 范成大 (深挖补) ──
  '四时田园杂兴 春日 一|范成大':    { year: 1186, location: '苏州', mood: { tod: 'dawn',  weather: 'none' } },
  '四时田园杂兴 夏日|范成大':       { year: 1186, mood: { tod: 'noon',  weather: 'none' } },
  '横塘|范成大':                    { year: 1170, mood: { tod: 'noon',  weather: 'none' } },

  // ── 朱熹 (深挖补) ──
  '春日|朱熹':                      { year: 1196, mood: { tod: 'noon',  weather: 'none' } },
  '观书有感 二|朱熹':               { year: 1196, mood: { tod: 'noon',  weather: 'none' } },
  '观书有感 一|朱熹':               { year: 1196, mood: { tod: 'noon',  weather: 'none' } },
};

// 朝代中期估年 — 数据里没有明确 year 时 fallback
const DYNASTY_MID = {
  '先秦': -500, '汉': 50, '魏晋': 250, '南北朝': 500, '隋': 600,
  '唐': 750, '五代': 950, '宋': 1100, '北宋': 1050, '南宋': 1200,
  '元': 1320, '明': 1500, '清': 1800,
};

// ── 同词牌多首消歧义 ──
// 宋词大量用同一词牌反复填写 (如 苏轼 的《浣溪沙》《蝶恋花》各自数十首).
// 解决办法: 一个 key (词牌|作者) 的 value 可以是数组, 每项附 firstLine 前缀,
// 查找时按传入的 poem 的 firstLine 去匹配.
// 单首诗或词牌已含副标题的 (如 '江城子 乙卯正月二十日夜记梦|苏轼') 仍用对象.
function _pickEntry(entry, firstLine) {
  if (!entry) return null;
  if (!Array.isArray(entry)) return entry;
  if (!firstLine) return entry[0] || null;
  // 按 firstLine 前缀匹配任一
  for (const e of entry) {
    if (e.firstLine && firstLine.indexOf(e.firstLine) === 0) return e;
  }
  return null;    // 有歧义数据但 firstLine 不匹配任何一个, 宁缺勿错
}

// 查年份 — poem 可带 firstLine 参数用于同词牌多首消歧义
export function lookupYear(poem, firstLine) {
  const key = (poem.t || '') + '|' + (poem.a || '');
  const e = _pickEntry(POEM_META[key], firstLine);
  if (e && typeof e.year === 'number') return e.year;
  return DYNASTY_MID[poem.d] != null ? DYNASTY_MID[poem.d] : 1000;
}

export function lookupMood(poem, firstLine) {
  const key = (poem.t || '') + '|' + (poem.a || '');
  const e = _pickEntry(POEM_META[key], firstLine);
  return e?.mood || null;
}

export function lookupRelated(poem, firstLine) {
  const key = (poem.t || '') + '|' + (poem.a || '');
  const e = _pickEntry(POEM_META[key], firstLine);
  return e?.related || [];
}
