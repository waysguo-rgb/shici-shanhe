// 诗人聚合索引 — 把 POEM_META + POET_JOURNEYS + 已加载 locations 三源合并,
// 给"诗人档案抽屉"提供数据.
//
// 两个导出:
//   listAllPoets(locations)        → [{name, dyn, life, desc, hasJourney, poemCount}]
//   getPoetPoems(name, locations)  → [{title, author, year, dynasty, location, lonlat,
//                                      lines, locIdx, pi, hasLocation}]  (按 year 升序)
//
// 设计要点:
// - locations 由调用方 (App.vue) 在加载 locations.json 后传入, 这里不直接 fetch
// - 同一首诗可能同时出现在 locations.ps 和 POEM_META 里, 用 (title, author) 元组去重,
//   优先取 location 来源 (有完整 lines/lonlat)
// - POEM_META 的 array 形式 (词牌|作者: [...]) 每个子项是独立的诗, 平铺展开
// - 没有 dynasty 信息的 meta 条目, 按作者→朝代映射回填 (用 POET_JOURNEYS 的 dyn 字段)
// - 缺 year 的不在 meta 里就用朝代中点估值 (复用 lookupYear 的 fallback 逻辑)

import { POEM_META } from './poem_meta.js';
import { POET_JOURNEYS } from './poet_journeys.js';
// manual_lines 体积小 (1KB), 静态 import OK
import MANUAL_LINES from './manual_lines.json';

// meta_lines.json 体积 252KB, 改为 lazy dynamic import — 首屏不阻塞 3D 场景初始化.
// 用户实际打开抽屉看正文时才需要它, 此时一定已加载完.
let _META_LINES = null;
let _metaLinesPromise = null;
function _ensureMetaLines() {
  if (_META_LINES) return _META_LINES;
  if (!_metaLinesPromise) {
    _metaLinesPromise = import('./meta_lines.json').then(m => {
      _META_LINES = m.default || m;
      return _META_LINES;
    }).catch(err => { console.warn('meta_lines.json load failed:', err); _META_LINES = {}; return _META_LINES; });
  }
  return null;   // 数据未就绪时返回 null, 前端走"正文未录入"占位回退
}
// 主动预热 — 不 await, 让首屏先开 3D
export function preloadMetaLines() { _ensureMetaLines(); return _metaLinesPromise; }
// 启动后空闲时挂起预加载 (不阻塞 first paint)
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => _ensureMetaLines(), { timeout: 2000 });
  } else {
    setTimeout(_ensureMetaLines, 1500);
  }
}

// manual_lines.json 优先 (里面 '_comment' 等非诗 key 不参与查找: 非数组或空数组视为无).
function _lookupLines(key) {
  const m = MANUAL_LINES[key];
  if (Array.isArray(m) && m.length) return m;
  const meta = _ensureMetaLines();        // null 时表示还没加载完
  if (meta) return meta[key] || null;
  return null;
}

const DYNASTY_MID = {
  '先秦': -500, '汉': 50, '魏晋': 250, '南北朝': 500, '隋': 600,
  '唐': 750, '五代': 950, '宋': 1100, '北宋': 1050, '南宋': 1200,
  '元': 1320, '明': 1500, '清': 1800,
};

// ─── 1. 作者 → 朝代 映射 ───
// 来自 POET_JOURNEYS (5 位有 dyn) + 手工补常见诗人朝代.
// 不在表里的作者抽屉里只能显示姓名, 不显朝代.
const AUTHOR_DYN = {
  // 唐
  '李白': '唐', '杜甫': '唐', '王维': '唐', '白居易': '唐', '王之涣': '唐',
  '王勃': '唐', '王昌龄': '唐', '孟浩然': '唐', '陈子昂': '唐', '张继': '唐',
  '杜牧': '唐', '柳宗元': '唐', '贺知章': '唐', '李商隐': '唐', '韦应物': '唐',
  '韩愈': '唐', '刘禹锡': '唐', '元稹': '唐', '李贺': '唐', '温庭筠': '唐',
  '岑参': '唐', '高适': '唐', '崔颢': '唐', '常建': '唐', '韩翃': '唐',
  '张志和': '唐', '骆宾王': '唐', '宋之问': '唐', '杨炯': '唐', '卢纶': '唐',
  '畅当': '唐', '司空曙': '唐', '钱起': '唐', '李益': '唐', '皎然': '唐',
  '贾岛': '唐', '皮日休': '唐', '陆龟蒙': '唐', '聂夷中': '唐', '罗隐': '唐',
  '皇甫冉': '唐', '戴叔伦': '唐', '权德舆': '唐', '张九龄': '唐', '储光羲': '唐',
  // 五代
  '李煜': '五代', '冯延巳': '五代', '韦庄': '五代', '温庭筠': '唐',
  // 宋
  '苏轼': '宋', '辛弃疾': '宋', '李清照': '宋', '陆游': '宋', '欧阳修': '宋',
  '王安石': '宋', '范仲淹': '宋', '柳永': '宋', '秦观': '宋', '黄庭坚': '宋',
  '晏殊': '宋', '晏几道': '宋', '周邦彦': '宋', '姜夔': '宋', '吴文英': '宋',
  '岳飞': '宋', '文天祥': '宋', '杨万里': '宋', '范成大': '宋', '朱熹': '宋',
  '苏洵': '宋', '苏辙': '宋', '张孝祥': '宋', '贺铸': '宋', '叶绍翁': '宋',
  '林升': '宋', '陈与义': '宋', '志南': '宋', '蒋捷': '宋', '吕本中': '宋',
  '黄巢': '唐',
  // 元后
  '马致远': '元', '关汉卿': '元', '张养浩': '元',
};

function _dynOf(author) {
  return AUTHOR_DYN[author] || '';
}

// ─── 2. 平铺 POEM_META 成 [{title, author, year, location, mood, related, dynasty}] ───
function _flattenMeta() {
  const out = [];
  for (const key in POEM_META) {
    const sep = key.lastIndexOf('|');
    if (sep < 0) continue;
    const title = key.slice(0, sep);
    const author = key.slice(sep + 1);
    const val = POEM_META[key];
    if (Array.isArray(val)) {
      // 词牌多首: 每个子项独立, title 后缀首句以做区分
      for (const e of val) {
        const subTitle = e.firstLine ? `${title} · ${e.firstLine}` : title;
        out.push({
          title: subTitle,
          baseTitle: title,
          firstLine: e.firstLine,
          author,
          year: typeof e.year === 'number' ? e.year : null,
          location: e.location || null,
          dynasty: _dynOf(author),
        });
      }
    } else if (val && typeof val === 'object') {
      out.push({
        title,
        baseTitle: title,
        firstLine: null,
        author,
        year: typeof val.year === 'number' ? val.year : null,
        location: val.location || null,
        dynasty: _dynOf(author),
      });
    }
  }
  return out;
}

// ─── 模块级缓存 + 倒排索引 ───
// locations 引用变了才重建 (App.vue 里加载一次后引用稳定).
// 让 listAllPoets / getPoetPoems 从 O(总诗) → O(诗人作品).
let _cachedLocations = null;
let _cachedMetaFlat = null;       // 全部 meta 平铺一次, 不再每次重做
let _authorMetaIdx = null;        // Map<author, MetaEntry[]>
let _authorLocIdx = null;         // Map<author, [{li, pi}]>
let _cachedAllPoets = null;       // listAllPoets 结果缓存
let _journeyMap = null;           // Map<name, journey-entry>  (常驻)

function _buildIndex(locations) {
  if (locations === _cachedLocations && _authorMetaIdx) return;
  _cachedLocations = locations;

  if (!_cachedMetaFlat) _cachedMetaFlat = _flattenMeta();

  _authorMetaIdx = new Map();
  for (const m of _cachedMetaFlat) {
    const arr = _authorMetaIdx.get(m.author);
    if (arr) arr.push(m); else _authorMetaIdx.set(m.author, [m]);
  }

  _authorLocIdx = new Map();
  if (locations && locations.length) {
    for (let li = 0; li < locations.length; li++) {
      const ps = locations[li].ps || [];
      for (let pi = 0; pi < ps.length; pi++) {
        const a = ps[pi].a;
        if (!a) continue;
        const arr = _authorLocIdx.get(a);
        if (arr) arr.push({ li, pi }); else _authorLocIdx.set(a, [{ li, pi }]);
      }
    }
  }

  if (!_journeyMap) {
    _journeyMap = new Map();
    for (const pj of POET_JOURNEYS) _journeyMap.set(pj.name, pj);
  }

  _cachedAllPoets = null;
}

// ─── 3. 列出所有诗人 ───
export function listAllPoets(locations) {
  _buildIndex(locations);
  if (_cachedAllPoets) return _cachedAllPoets;

  // 收集所有作者 (meta 和 locations 的并集)
  const authors = new Set([..._authorMetaIdx.keys(), ..._authorLocIdx.keys()]);

  // 计算每位 poemCount + 朝代 (合并去重: meta 的 baseTitle|author + locations 的 title|author)
  const counts = new Map();
  const dyns = new Map();

  for (const a of authors) {
    const seen = new Set();
    let cnt = 0;
    let dyn = '';

    const ms = _authorMetaIdx.get(a);
    if (ms) {
      for (const m of ms) {
        const k = m.firstLine ? (m.baseTitle + '|' + a + '|' + m.firstLine) : (m.baseTitle + '|' + a);
        if (seen.has(k)) continue;
        seen.add(k);
        cnt++;
        if (!dyn && m.dynasty) dyn = m.dynasty;
      }
    }

    const ls = _authorLocIdx.get(a);
    if (ls) {
      for (const { li, pi } of ls) {
        const p = locations[li].ps[pi];
        const k = (p.t || '') + '|' + a;
        if (seen.has(k)) continue;
        seen.add(k);
        cnt++;
        if (!dyn && p.d) dyn = p.d;
      }
    }

    counts.set(a, cnt);
    dyns.set(a, dyn);
  }

  const out = [];
  for (const name of authors) {
    const pj = _journeyMap.get(name);
    out.push({
      name,
      dyn: dyns.get(name) || pj?.dyn || '',
      life: pj?.life || '',
      desc: pj?.desc || '',
      hasJourney: !!pj,
      poemCount: counts.get(name),
    });
  }

  const DYN_ORDER = ['唐', '五代', '北宋', '宋', '南宋', '元', '明', '清', '汉', '魏晋', '南北朝', '隋', '先秦', ''];
  out.sort((a, b) => {
    if (a.hasJourney !== b.hasJourney) return a.hasJourney ? -1 : 1;
    const da = DYN_ORDER.indexOf(a.dyn);
    const db = DYN_ORDER.indexOf(b.dyn);
    if (da !== db) return da - db;
    return b.poemCount - a.poemCount;
  });

  _cachedAllPoets = out;
  return out;
}

// ─── 4. 取某诗人的全部诗 (时序) ───
//   返回每条:
//     {title, author, year, dynasty, location, lonlat, lines, locIdx, pi, hasLocation}
export function getPoetPoems(name, locations) {
  _buildIndex(locations);
  const out = [];
  const seen = new Set();   // baseTitle|author 去重 key

  // 4a. 已定位的 (倒排表 O(该诗人作品数), 不再扫描全 locations)
  const ls = _authorLocIdx.get(name);
  if (ls) {
    for (const { li, pi } of ls) {
      const loc = locations[li];
      const p = loc.ps[pi];
      const key = (p.t || '') + '|' + name;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        title: p.t,
        author: name,
        year: typeof p.year === 'number' ? p.year : (DYNASTY_MID[p.d] != null ? DYNASTY_MID[p.d] : 1000),
        dynasty: p.d || _dynOf(name),
        location: loc.n,
        lonlat: [loc.lo, loc.la],
        lines: p.l,
        locIdx: li,
        pi,
        hasLocation: true,
      });
    }
  }

  // 4b. 仅 meta 里的 (倒排表)
  const seenMeta = new Set();
  const ms = _authorMetaIdx.get(name) || [];
  for (const m of ms) {
    if (m.firstLine) {
      const k2 = m.baseTitle + '|' + m.author + '|' + m.firstLine;
      if (seenMeta.has(k2)) continue;
      seenMeta.add(k2);
    } else {
      const key = m.baseTitle + '|' + m.author;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    // 查 meta_lines.json 拿正文 (494/727 命中, 缺的显示占位)
    const linesKey = m.firstLine
      ? `${m.baseTitle}|${m.author}|${m.firstLine}`
      : `${m.baseTitle}|${m.author}`;
    out.push({
      title: m.title,
      author: m.author,
      year: m.year != null ? m.year : (DYNASTY_MID[m.dynasty] != null ? DYNASTY_MID[m.dynasty] : 1000),
      dynasty: m.dynasty || _dynOf(name),
      location: m.location,    // string hint (e.g. '密州'), 可能 lonlat 没 (该地不在 locations)
      lonlat: null,
      lines: _lookupLines(linesKey),
      locIdx: -1,
      pi: -1,
      hasLocation: false,
    });
  }

  // 时序升序
  out.sort((a, b) => (a.year || 0) - (b.year || 0));
  return out;
}
