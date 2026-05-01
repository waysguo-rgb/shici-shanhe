<template>
  <div id="cv" ref="cvRef"></div>
  <div id="ui">
    <div id="hdr"><div id="hdr-in">
      <h1>诗词山河<span class="hdr-mini-seal">山河</span></h1>
      <p id="sub">跨越三千年 · {{ locationCount }}处河山 · {{ poemCount }}首诗词</p>
    </div></div>
    <div id="tod-controls">
      <button :class="{active: todMode==='dawn'}" @click="setTod('dawn')" title="晨">晨</button>
      <button :class="{active: todMode==='noon'}" @click="setTod('noon')" title="昼">昼</button>
      <button :class="{active: todMode==='dusk'}" @click="setTod('dusk')" title="暮">暮</button>
      <button :class="{active: todMode==='night'}" @click="setTod('night')" title="夜">夜</button>
      <span class="tod-sep"></span>
      <button :class="{active: rainOn}" @click="toggleRain" :title="rainOn ? '停雨' : '落雨'">雨</button>
    </div>
    <!-- 顶部朝代条已删除 — 与底部时间轴重复 -->
    <div id="dyn-controls" style="display:none"></div>
    <div id="journey-controls">
      <button class="journey-toggle" @click="toggleDrawer" :class="{active: !!activePoet, open: drawerOpen}">
        <span v-if="!activePoet">诗人档案</span>
        <span v-else>{{ activePoet }} · {{ poets.find(p=>p.name===activePoet)?.life }}</span>
        <span class="caret">▾</span>
      </button>
      <div v-if="activePoet" class="journey-actions">
        <button @click="toggleJourneyPlay" :class="{playing: journeyPlaying}">
          {{ journeyPlaying ? '■ 停' : '▶ 播放' }}
        </button>
        <button @click="clearJourney" title="清除">×</button>
      </div>
    </div>

    <!-- 左侧诗人档案浮动小卡片 (始终显示, 默认李白) -->
    <div id="poet-card" v-if="cardPoet && !drawerOpen">
      <div class="pc-hdr">
        <span class="pc-title">诗人档案</span>
        <button class="pc-close" @click="cardPoet = ''" title="收起">✕</button>
      </div>
      <div class="pc-body">
        <div class="pc-avatar" :data-a="cardPoet.charAt(0)">{{ cardPoet.charAt(0) }}</div>
        <div class="pc-info">
          <div class="pc-name">{{ cardPoet }}</div>
          <div class="pc-life">{{ cardInfo?.life || '—' }}</div>
          <div class="pc-school">{{ cardInfo?.dyn || '' }}{{ cardInfo?.dyn ? '代' : '' }}<span v-if="cardInfo?.desc"> · {{ cardSchool }}</span></div>
          <div class="pc-tags" v-if="cardTags">{{ cardTags }}</div>
        </div>
      </div>
      <div class="pc-stats">
        <span>足迹 <b>{{ cardStops }}</b> 处</span>
        <span class="pc-sep"></span>
        <span>诗作 <b>{{ cardPoems }}</b> 首</span>
      </div>
      <button class="pc-detail" @click="toggleDrawer">查看详情 →</button>
    </div>
    <div id="rlbls"></div>
    <div id="labels"></div>
  </div>
  <!-- 诗人档案抽屉 (左侧滑入, 不全屏遮罩, 地图保留可视) -->
  <Transition name="drawer-slide">
    <div id="poet-drawer" v-if="drawerOpen">
      <div class="drawer-panel" @click.stop>
        <div class="drawer-hdr">
          <span class="dh-title">诗人档案</span>
          <span class="dh-cnt">{{ allPoets.length }} 位 · {{ allPoetCount }} 首</span>
          <button class="close-x" @click="drawerOpen = false">✕</button>
        </div>
        <div class="poet-chips">
          <button v-for="p in allPoets" :key="p.name"
                  class="poet-chip"
                  :class="{on: drawerPoet === p.name, journey: p.hasJourney}"
                  @click="selectPoet(p.name)">
            <span v-if="p.hasJourney" class="chip-mark">📜</span>{{ p.name }}<span class="chip-cnt">{{ p.poemCount }}</span>
          </button>
        </div>
        <div v-if="drawerPoet && currentPoetInfo" class="poet-archive">
          <div class="poet-hdr">
            <div class="ph-line">
              <span class="ph-name">{{ drawerPoet }}</span>
              <span v-if="currentPoetInfo.dyn" class="ph-dyn">{{ currentPoetInfo.dyn }}</span>
              <span v-if="currentPoetInfo.life" class="ph-life">{{ currentPoetInfo.life }}</span>
            </div>
            <div v-if="currentPoetInfo.desc" class="ph-desc">{{ currentPoetInfo.desc }}</div>
          </div>
          <div class="poet-poems">
            <div v-for="(poem, i) in currentPoetPoems" :key="poem.title + '|' + i"
                 class="dp-row"
                 :class="{noloc: !poem.hasLocation, nolines: !poem.lines}"
                 @click="onDrawerPoemClick(poem)">
              <span class="dp-year">{{ formatYear(poem.year) }}</span>
              <span class="dp-title">{{ poem.title }}</span>
              <span v-if="poem.hasLocation" class="dp-loc">📍{{ poem.location }}</span>
              <span v-else-if="poem.location" class="dp-loc dim">·{{ poem.location }}</span>
              <span v-else class="dp-loc dim">无定</span>
            </div>
          </div>
        </div>
        <div v-else class="drawer-hint">↑ 上方选择一位诗人</div>
      </div>
    </div>
  </Transition>

  <!-- 印章: 点击切换名句立牌显隐 -->
  <div id="seal" :class="{off: !boardsVisible}"
       :title="boardsVisible ? '隐藏名句立牌' : '显示名句立牌'"
       @click="toggleBoards">
    <span><i>诗</i><i>词</i><i>山</i><i>河</i></span>
  </div>

  <!-- Scroll Panel -->
  <div id="po" :class="{vis: (panelOpen || panelClosing) && scrollMode, 'journey-on': !!activePoet, closing: panelClosing}">
    <div id="po-bg" @click="closePanel"></div>
    <!-- 排序切换 (卷轴上方的浮条) -->
    <div class="po-sort">
      <button class="po-sort-btn" :class="{on: sortMode==='time'}"   @click="setSortMode('time')">时序</button>
      <button class="po-sort-btn" :class="{on: sortMode==='author'}" @click="setSortMode('author')">作者</button>
    </div>
    <div id="po-wrap">
      <div class="roller"><div class="roller-cap top"></div><div class="roller-band2 top"></div><div class="roller-band top"></div><div class="roller-wood"></div><div class="roller-band bot"></div><div class="roller-band2 bot"></div><div class="roller-cap bot"></div></div>
      <div id="po-box" ref="poBox"><div id="po-c" ref="poContent"></div></div>
      <button id="po-arr-l" class="po-arr" title="向左翻阅" @click.stop="scrollPanel(-1)"><svg viewBox="0 0 24 24"><path d="M15 4 L7 12 L15 20 L17 18 L11 12 L17 6 Z"/></svg></button>
      <button id="po-arr-r" class="po-arr" title="向右翻阅" @click.stop="scrollPanel(1)"><svg viewBox="0 0 24 24"><path d="M9 4 L17 12 L9 20 L7 18 L13 12 L7 6 Z"/></svg></button>
      <div class="roller"><div class="roller-cap top"></div><div class="roller-band2 top"></div><div class="roller-band top"></div><div class="roller-wood"></div><div class="roller-band bot"></div><div class="roller-band2 bot"></div><div class="roller-cap bot"></div></div>
    </div>
  </div>

  <!-- Loading -->
  <div id="ld" v-if="loading" :class="{off: loadingOff}">
    <div class="ld-title">
      <span class="ld-char ld-char-1">诗</span>
      <span class="ld-char ld-char-2">词</span>
      <span class="ld-char ld-char-3">山</span>
      <span class="ld-char ld-char-4">河</span>
    </div>
    <p>正在生成三维山河…</p>
    <div class="bar"><div class="fill" ref="prog"></div></div>
  </div>

  <!-- 右上角工具栏: 搜索 + 收藏 + 图谱 + 简洁 (mockup 风格: 圆按钮+下方小字标签) -->
  <div id="tools">
    <div class="tool-cell">
      <button class="tool-btn" :class="{open: searchOpen}" @click="toggleSearch" :title="'搜索诗词'">🔍</button>
      <span class="tool-l">搜索</span>
    </div>
    <div class="tool-cell">
      <button class="tool-btn" :class="{open: favsOpen, 'has-count': favs.length}" @click="toggleFavs" :title="'收藏夹'">
        <span>★</span>
        <span v-if="favs.length" class="tool-badge">{{ favs.length }}</span>
      </button>
      <span class="tool-l">收藏</span>
    </div>
    <div class="tool-cell">
      <button class="tool-btn" :class="{open: graphOpen}" @click="toggleGraph" :title="'诗词图谱'">图</button>
      <span class="tool-l">图谱</span>
    </div>
    <div class="tool-cell">
      <button class="tool-btn" :class="{open: simpleMode}" @click="toggleSimple" :title="simpleMode ? '退出简洁模式' : '进入简洁模式 (隐装饰)'">≡</button>
      <span class="tool-l">简洁</span>
    </div>
  </div>

  <!-- 搜索弹层 -->
  <div id="search-pane" v-if="searchOpen" @click.self="searchOpen = false">
    <div class="search-box">
      <input ref="searchInput" v-model="searchQuery" type="text" placeholder="搜诗词 · 作者 · 地名 · 诗句" @keydown.escape="searchOpen = false">
      <button class="close-x" @click="searchOpen = false">✕</button>
      <div class="search-results" v-if="searchQuery.trim()">
        <div v-if="searchResults.length === 0" class="search-empty">无匹配</div>
        <div v-for="r in searchResults" :key="r.locIdx + '|' + r.pi" class="search-hit" @click="jumpToPoem(r.locIdx, r.pi)">
          <div class="hit-avatar" :data-a="(r.poem.a || '').charAt(0)"></div>
          <div class="hit-body">
            <div class="hit-main"><span class="hit-title">{{ r.poem.t }}</span><span class="hit-author">· {{ r.poem.a }} · {{ r.poem.d }}</span></div>
            <div class="hit-sub">{{ r.locName }}{{ r.snippet ? ' · ' + r.snippet : '' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 收藏夹弹层 -->
  <div id="favs-pane" v-if="favsOpen" @click.self="favsOpen = false">
    <div class="favs-box">
      <div class="favs-hdr">
        <span>收藏夹 · {{ favs.length }}</span>
        <button class="close-x" @click="favsOpen = false">✕</button>
      </div>
      <div class="favs-list" v-if="favs.length">
        <div v-for="(f, idx) in favs" :key="f.locName + '|' + f.title" class="fav-item" @click="jumpToFav(f)">
          <div class="fav-main"><span class="fav-title">{{ f.title }}</span></div>
          <div class="fav-sub">{{ f.dynasty }} · {{ f.author }} · {{ f.locName }}</div>
          <button class="fav-del" @click.stop="removeFav(idx)" title="移除收藏">✕</button>
        </div>
      </div>
      <div v-else class="favs-empty">尚无收藏 · 打开诗词点 ♡ 即可收藏</div>
    </div>
  </div>

  <!-- 诗词知识图谱 -->
  <div id="graph-pane" v-if="graphOpen" @click.self="graphOpen = false">
    <div class="graph-box">
      <div class="graph-hdr">
        <span>诗人图谱 · 横轴 = 年代, 节点 = 诗人, 金线 = 互有关联</span>
        <button class="close-x" @click="graphOpen = false">✕</button>
      </div>
      <div ref="graphMount" class="graph-3d-mount"></div>
      <div class="graph-tip" ref="graphTip" v-show="graphHoverNode || graphHoverEdge">
        <!-- 边 hover: 显示具体关联诗对 -->
        <div v-if="graphHoverEdge" class="gt-edge">
          <div class="gt-title">{{ graphHoverEdge._aName }} ⇄ {{ graphHoverEdge._bName }}</div>
          <div class="gt-sub">{{ graphHoverEdge.evidences?.length || graphHoverEdge.w || 1 }} 处关联</div>
          <div v-for="(ev, i) in (graphHoverEdge.evidences || []).slice(0, 4)" :key="i" class="gt-evid">
            《{{ ev.aTitle }}》 ({{ ev.aAuthor }}) ⇄ 《{{ ev.bTitle }}》 ({{ ev.bAuthor }})
            <span v-if="ev.locName" class="gt-evid-loc">— {{ ev.locName }}</span>
          </div>
        </div>
        <!-- 节点 hover: 诗人档案 -->
        <div v-else-if="graphHoverNode">
          <div class="gt-title">{{ graphHoverNode.a }}<span class="gt-dyn" v-if="graphHoverNode.dyn"> · {{ graphHoverNode.dyn }}</span></div>
          <div class="gt-sub">{{ graphHoverNode.poemCount }} 首 · 中位 {{ graphHoverNode.year }} 年</div>
          <div class="gt-rel" v-if="graphHoverNode.locs && graphHoverNode.locs.length">足迹 {{ graphHoverNode.locs.slice(0, 4).join('、') }}{{ graphHoverNode.locs.length > 4 ? '...' : '' }}</div>
          <div v-if="graphHoverNode.peers && graphHoverNode.peers.length" class="gt-peers">
            <div class="gt-peers-hdr">与 {{ graphHoverNode.peers.length }} 位诗人有关联</div>
            <div v-for="p in graphHoverNode.peers.slice(0, 4)" :key="p.peer" class="gt-peer">
              <span class="gt-peer-name">{{ p.peer }}</span>
              <span class="gt-peer-cnt">{{ p.count }} 处</span>
              <div class="gt-peer-evid">
                《{{ p.samples[0] }}》<span v-if="p.peerSamples && p.peerSamples[0]"> ⇄ 《{{ p.peerSamples[0] }}》</span>
                <span v-if="p.count > 1" class="gt-more">{{ ' 等' + p.count + ' 首' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 底部朝代时间轴条 + 卷轴模式开关 -->
  <div id="bottom-bar">
    <div class="bb-section bb-mode">
      <span class="bb-icon">📜</span>
      <span class="bb-label">卷轴模式</span>
      <button class="bb-toggle" :class="{on: scrollMode}" @click="scrollMode = !scrollMode" :title="scrollMode ? '关闭卷轴模式' : '开启卷轴模式'">
        <span class="bb-toggle-knob"></span>
      </button>
    </div>
    <div class="bb-section bb-dyn">
      <button v-for="d in DYNASTY_BTNS_FULL" :key="d"
              class="bb-dyn-btn"
              :class="{on: activeDynasty===d}"
              @click="setDyn(d)"
              :title="d + ' 朝代'">{{ d }}</button>
    </div>
  </div>

  <!-- 背景音乐控件组 (默认半透明常驻, hover 变清晰) -->
  <audio ref="bgmRef" loop></audio>
  <div id="bgm-controls" :class="{playing: !bgmMuted}">
    <span class="bgm-name" :title="'当前曲目'">♪ 《{{ currentTrackName }}》</span>
    <span class="bgm-wave" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i>
    </span>
    <button class="bgm-btn" @click="toggleMute" :title="bgmMuted ? '取消静音' : '静音'">
      {{ bgmMuted ? '🔇' : '🔊' }}
    </button>
    <button class="bgm-btn" @click="switchTrack" :title="'切换到《' + nextTrackName + '》'">
      ⇄
    </button>
    <input type="range" id="bgm-volume" min="0" max="1" step="0.01" v-model.number="bgmVolume" :title="'音量 ' + Math.round(bgmVolume*100) + '%'">
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import * as THREE from 'three'
import {
  init as initScene,
  camera, scene as threeScene, locBeams, setActiveI, setCamTo, setLookTo, setIsAnim,
  getLocations, getPos3D, getLbls, setBeam, pulseBeam,
  setTimeOfDay, getTimeOfDay, setRain, getRain, emitRipple,
  toggleLineBoards, setBoardsDyn, raycastLineBoard,
  setSimpleMode, getSimpleMode, setTone,
  setDistantMountainTexture, setDistantMountainsVisible
} from './core/SceneManager.js'
import {
  initJourneyPlayer, listPoets, activateJourney as jpActivate,
  deactivateJourney as jpDeactivate, playJourney as jpPlay, stopJourney as jpStop,
  isJourneyPlaying
} from './core/JourneyPlayer.js'
import { listAllPoets, getPoetPoems } from './data/poet_index.js'
import * as PoetGraph3D from './core/PoetGraph3D.js'

// ═══ State ═══
const cvRef = ref(null)
const prog = ref(null)
const poBox = ref(null)
const poContent = ref(null)
const loading = ref(true)
const loadingOff = ref(false)
const panelOpen = ref(false)
const locations = ref([])
const activeIdx = ref(-1)

// ═══ Search + Favorites ═══
const searchOpen = ref(false)
const searchQuery = ref('')
const searchInput = ref(null)
const favsOpen = ref(false)
const FAVS_KEY = 'poetry-favs-v1'
const favs = ref(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'))

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    favsOpen.value = false
    nextTick(() => searchInput.value?.focus())
  }
}
function toggleFavs() {
  favsOpen.value = !favsOpen.value
  if (favsOpen.value) searchOpen.value = false
}

// 搜索结果: 匹配 标题/作者/朝代/地名/诗句, 最多 30 条
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  const hits = []
  const locs = locations.value
  for (let i = 0; i < locs.length; i++) {
    const loc = locs[i]
    const locNameLower = loc.n.toLowerCase()
    for (let pi = 0; pi < loc.ps.length; pi++) {
      const p = loc.ps[pi]
      let snippet = ''
      const inTitle  = p.t.toLowerCase().includes(q)
      const inAuthor = p.a.toLowerCase().includes(q)
      const inDyn    = p.d.toLowerCase().includes(q)
      const inLoc    = locNameLower.includes(q)
      let inLine = false
      for (let k = 0; k < p.l.length; k++) {
        if (p.l[k].toLowerCase().includes(q)) { snippet = p.l[k]; inLine = true; break }
      }
      if (inTitle || inAuthor || inDyn || inLoc || inLine) {
        hits.push({ locIdx: i, locName: loc.n, pi, poem: p, snippet: inLine ? snippet : '' })
        if (hits.length >= 30) return hits
      }
    }
  }
  return hits
})

function isFav(locName, title) {
  return favs.value.some(f => f.locName === locName && f.title === title)
}
function addFav(locName, poem) {
  if (isFav(locName, poem.t)) return
  favs.value.push({ locName, title: poem.t, author: poem.a, dynasty: poem.d })
  localStorage.setItem(FAVS_KEY, JSON.stringify(favs.value))
}
function toggleFav(locName, poem) {
  const i = favs.value.findIndex(f => f.locName === locName && f.title === poem.t)
  if (i >= 0) {
    favs.value.splice(i, 1)
  } else {
    favs.value.push({ locName, title: poem.t, author: poem.a, dynasty: poem.d })
  }
  localStorage.setItem(FAVS_KEY, JSON.stringify(favs.value))
  // Re-render to update heart icons in currently open panel
  refreshFavButtons()
}
function removeFav(idx) {
  favs.value.splice(idx, 1)
  localStorage.setItem(FAVS_KEY, JSON.stringify(favs.value))
  refreshFavButtons()
}

// Update visible heart icon to match favs state (called after toggle)
// 新版卷轴只显单首, 直接重渲染当前首; 兼容旧版仍保留按 dataset 查的逻辑
function refreshFavButtons() {
  // 新版卷轴只显单首 — 重渲染当前首即同步 ♥ 状态
  if (_currentLoc && panelOpen.value) _renderSinglePoem()
}

async function jumpToPoem(locIdx, poemIdx) {
  searchOpen.value = false
  selectLoc(locIdx)
  await nextTick()
  await new Promise(r => setTimeout(r, 600))   // 等 _renderPanel 完成
  // 新版卷轴: 直接把 _currentIdx 定位到目标诗 (按 .ps[poemIdx] 在 _currentList 里的位置)
  const targetItem = _currentList.find(x => x.pi === poemIdx)
  if (targetItem) {
    _currentIdx = _currentList.indexOf(targetItem)
    _renderSinglePoem()
    nextTick(() => {
      const wrap = poContent.value?.parentElement   // #po-box
      if (wrap) {
        wrap.classList.add('highlighted')
        setTimeout(() => wrap.classList.remove('highlighted'), 1600)
      }
    })
  }
}

async function jumpToFav(f) {
  favsOpen.value = false
  const locs = locations.value
  const locIdx = locs.findIndex(l => l.n === f.locName)
  if (locIdx < 0) return
  const poemIdx = locs[locIdx].ps.findIndex(p => p.t === f.title)
  if (poemIdx < 0) return
  jumpToPoem(locIdx, poemIdx)
}

// ═══ Time of day state ═══
const todMode = ref('noon')   // 'dawn' | 'noon' | 'dusk' | 'night'
function setTod(mode) {
  if (todMode.value === mode) return;
  todMode.value = mode;
  setTimeOfDay(mode);
}
// ═══ Weather (rain) state ═══
const rainOn = ref(false)
function toggleRain() {
  rainOn.value = !rainOn.value;
  setRain(rainOn.value);
}

// ═══ 诗词知识图谱 state (3D 化, 用 PoetGraph3D 模块) ═══
const graphOpen = ref(false)
const graphMount = ref(null)
const graphTip = ref(null)
const graphHoverNode = ref(null)
const graphHoverEdge = ref(null)
let _graphNodes = []
let _graphEdges = []
function toggleGraph() {
  graphOpen.value = !graphOpen.value
  if (graphOpen.value) {
    nextTick(() => _initGraph())
  } else {
    // 关闭时 dispose 3D scene
    PoetGraph3D.dispose()
    graphHoverNode.value = null
    graphHoverEdge.value = null
  }
}
// 朝代色带 (横轴背景区段) - 保证年代清晰可读
const _ERA_BANDS = [
  { name: '先秦', from: -1000, to: -221, color: 'rgba(140,150,160,0.18)' },
  { name: '汉',   from: -206,  to: 220,  color: 'rgba(165,130,80,0.20)' },
  { name: '魏晋', from: 220,   to: 420,  color: 'rgba(120,150,160,0.18)' },
  { name: '南北朝', from: 420, to: 589,  color: 'rgba(130,130,170,0.18)' },
  { name: '隋',   from: 581,   to: 618,  color: 'rgba(170,150,110,0.22)' },
  { name: '唐',   from: 618,   to: 907,  color: 'rgba(220,170,90,0.32)' },
  { name: '五代', from: 907,   to: 960,  color: 'rgba(170,150,110,0.22)' },
  { name: '宋',   from: 960,   to: 1279, color: 'rgba(140,180,160,0.30)' },
  { name: '元',   from: 1271,  to: 1368, color: 'rgba(150,150,180,0.22)' },
  { name: '明',   from: 1368,  to: 1644, color: 'rgba(180,140,160,0.22)' },
  { name: '清',   from: 1644,  to: 1912, color: 'rgba(170,160,140,0.22)' },
]

function _initGraph() {
  const L = getLocations()
  if (!L || L.length === 0) return
  // 节点 = 作者; 边 = 作者间的关联 (基于诗的 related 字段); 边记录"证据"——具体哪首诗与哪首诗关联
  const authorMap = new Map()
  const poemKeyToAuthor = new Map()
  L.forEach((loc) => {
    loc.ps.forEach((p) => {
      const a = p.a; if (!a) return
      let rec = authorMap.get(a)
      if (!rec) { rec = { name: a, dyn: p.d || '', years: [], poemCount: 0, locs: new Set(), evidencesByPeer: new Map() }; authorMap.set(a, rec) }
      rec.years.push(p.year || 1000)
      rec.poemCount++
      rec.locs.add(loc.n)
      poemKeyToAuthor.set(p.t + '|' + a, a)
    })
  })
  // edgeMap: k='A|B' (sort 后) → { weight, evidences: [{aTitle, aAuthor, bTitle, bAuthor, locName}] }
  const edgeMap = new Map()
  L.forEach(loc => {
    loc.ps.forEach(p => {
      const A = p.a; if (!A || !p.related) return
      p.related.forEach(rkey => {
        const parts = rkey.split('|')
        const bTitle = parts[0], bAuthor = parts[1] || ''
        const B = poemKeyToAuthor.get(rkey) || bAuthor
        if (!B || A === B) return
        const k = A < B ? A + '|' + B : B + '|' + A
        let rec = edgeMap.get(k)
        if (!rec) { rec = { weight: 0, evidences: [] }; edgeMap.set(k, rec) }
        rec.weight++
        rec.evidences.push({ aTitle: p.t, aAuthor: A, bTitle, bAuthor: B, locName: loc.n })
        // 同时把这条证据存进两位作者各自的 evidencesByPeer
        const recA = authorMap.get(A); const recB = authorMap.get(B)
        if (recA) {
          let arr = recA.evidencesByPeer.get(B); if (!arr) { arr = []; recA.evidencesByPeer.set(B, arr) }
          arr.push({ ownTitle: p.t, peerTitle: bTitle, locName: loc.n })
        }
        if (recB) {
          let arr = recB.evidencesByPeer.get(A); if (!arr) { arr = []; recB.evidencesByPeer.set(A, arr) }
          arr.push({ ownTitle: bTitle, peerTitle: p.t, locName: loc.n })
        }
      })
    })
  })

  _graphNodes = []
  const nameToIdx = new Map()
  for (const rec of authorMap.values()) {
    rec.years.sort((a, b) => a - b)
    const medianYear = rec.years[Math.floor(rec.years.length / 2)]
    const idx = _graphNodes.length
    // 把 evidencesByPeer 转成 [{peer, count, samples:[ownTitle...]}] 列表 (按 count 倒排)
    const peers = []
    for (const [peer, evs] of rec.evidencesByPeer) {
      peers.push({ peer, count: evs.length, samples: evs.slice(0, 3).map(e => e.ownTitle), peerSamples: evs.slice(0, 3).map(e => e.peerTitle) })
    }
    peers.sort((a, b) => b.count - a.count)
    _graphNodes.push({
      a: rec.name, dyn: rec.dyn, year: medianYear,
      poemCount: rec.poemCount, locs: Array.from(rec.locs),
      relatedCount: peers.length,
      peers,
      x: 0, y: 0,
    })
    nameToIdx.set(rec.name, idx)
  }
  _graphEdges = []
  for (const [k, rec] of edgeMap) {
    const [A, B] = k.split('|')
    const si = nameToIdx.get(A), ti = nameToIdx.get(B)
    if (si == null || ti == null) continue
    _graphEdges.push({ s: si, t: ti, w: rec.weight, evidences: rec.evidences })
  }

  // 3D 图谱: 装载 PoetGraph3D, 把 nodes/edges 数据交给它去布局 + 渲染
  const mountEl = graphMount.value
  if (!mountEl) return
  PoetGraph3D.mount(mountEl, {
    onHoverNode: (n) => {
      graphHoverNode.value = n
      if (n) graphHoverEdge.value = null
    },
    onHoverEdge: (e) => {
      if (e) {
        // 给 edge 包装两端作者名 (模板里直接展示)
        const A = _graphNodes[e.s], B = _graphNodes[e.t]
        graphHoverEdge.value = { ...e, _aName: A?.a || '', _bName: B?.a || '' }
        graphHoverNode.value = null
      } else {
        graphHoverEdge.value = null
      }
    },
    onClickNode: (n) => {
      if (!n) return
      // 关闭图谱 + 打开诗人档案抽屉
      graphOpen.value = false
      PoetGraph3D.dispose()
      drawerPoet.value = n.a
      drawerOpen.value = true
      // 若 selectPoet 存在 (会同步抽屉 + 激活游记), 直接调
      if (typeof selectPoet === 'function') selectPoet(n.a)
    },
  })
  PoetGraph3D.setData({ nodes: _graphNodes, edges: _graphEdges })
  // tip 跟随鼠标 — graph-tip 用 mountEl 内坐标
  if (mountEl._tipMoveBound) return
  mountEl._tipMoveBound = true
  mountEl.addEventListener('mousemove', (ev) => {
    if (!graphTip.value) return
    const rect = mountEl.getBoundingClientRect()
    graphTip.value.style.left = (ev.clientX - rect.left + 14) + 'px'
    graphTip.value.style.top  = (ev.clientY - rect.top  + 14) + 'px'
  })
}
// _redrawGraph / _bindGraphEvents 已迁移到 src/core/PoetGraph3D.js (3D 渲染)

// ═══ 诗词面板排序 state ═══
const sortMode = ref('time')   // 'time' | 'author'
function setSortMode(m) {
  if (sortMode.value === m) return
  sortMode.value = m
  // 重新渲染当前面板
  if (activeIdx.value >= 0) {
    const L = getLocations()
    _renderPanel(activeIdx.value, L[activeIdx.value])
  }
}

// ═══ 朝代滤镜 state ═══
const DYNASTY_BTNS = ['唐', '宋', '元', '明', '清']
const DYNASTY_BTNS_FULL = ['先秦', '秦汉', '魏晋', '隋唐', '宋', '元', '明', '清']
const activeDynasty = ref('')   // 默认不激活 (避免淡化大量非唐地点)
// 卷轴模式开关 (装饰 toggle, 不绑功能)
const scrollMode = ref(true)
// 朝代显示名 → 实际诗集 dynasty 字段映射 (mockup 8 朝代 → 数据 5 朝代)
const DYNASTY_MAP = { '先秦':'', '秦汉':'', '魏晋':'', '隋唐':'唐', '宋':'宋', '元':'元', '明':'明', '清':'清' }
function setDyn(d) {
  const L = getLocations()
  const lbls = getLbls()
  if (!L || !lbls || lbls.length === 0) return
  // 切换逻辑: 再点同一朝代 → 清除
  if (activeDynasty.value === d) {
    activeDynasty.value = ''
    lbls.forEach(el => el.classList.remove('dynasty-dim'))
    setBoardsDyn('')
    return
  }
  activeDynasty.value = d
  const real = DYNASTY_MAP[d] !== undefined ? DYNASTY_MAP[d] : d
  if (!real) {
    // 没诗的朝代 (先秦/秦汉/魏晋) → 全 dim
    L.forEach((loc, i) => lbls[i].classList.add('dynasty-dim'))
    setBoardsDyn('_none_')
    return
  }
  L.forEach((loc, i) => {
    const hasDyn = loc.ps && loc.ps.some(p => p.d === real)
    lbls[i].classList.toggle('dynasty-dim', !hasDyn)
  })
  setBoardsDyn(real)
}

// ═══ 名句立牌 toggle (点击左下印章触发) ═══
const boardsVisible = ref(false)   // mockup 风格: 默认隐藏名句立牌, 让画面干净
function toggleBoards() {
  boardsVisible.value = toggleLineBoards()
}

// ═══ 简洁模式 (tools 栏"简"按钮) ═══
const simpleMode = ref(false)
function toggleSimple() {
  simpleMode.value = !simpleMode.value
  setSimpleMode(simpleMode.value)
  // 同步 UI 状态 (避免印章按钮跟实际显示脱节)
  boardsVisible.value = !simpleMode.value
  if (simpleMode.value) rainOn.value = false
}

// ═══ 诗人游记 + 档案抽屉 state ═══
const poets = listPoets()                // [{name, dyn, life, desc, stopCount}, ...]  仅 5 位有完整 stops
const activePoet = ref('')               // '' = 无 / '李白' 等. 仅有 journey 的诗人会被设
const journeyPlaying = ref(false)

// 抽屉 state
const drawerOpen = ref(false)
const drawerPoet = ref('')               // 抽屉里当前选中的诗人 (可以是无 journey 的)
const allPoets = computed(() => listAllPoets(locations.value))
const allPoetCount = computed(() => allPoets.value.reduce((s, p) => s + p.poemCount, 0))
const currentPoetInfo = computed(() => allPoets.value.find(p => p.name === drawerPoet.value) || null)
const currentPoetPoems = computed(() => drawerPoet.value ? getPoetPoems(drawerPoet.value, locations.value) : [])

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
}

// 右侧竖排导航 — 5 个视图切换 (映射到现有功能)
const sideView = ref('overview')
function setSideView(v) {
  sideView.value = v
  if (v === 'poet') drawerOpen.value = true
  else if (v === 'timeline') graphOpen.value = true
  else if (v === 'mood') {
    // 提示当前心境 — 暂用 toast/console
    if (currentSpeakEl) console.log('当前心境模式')
  }
}

// 左侧浮动诗人小卡片 — 默认隐藏, 用户主动选诗人后才显示
const cardPoet = ref('')
const cardInfo = computed(() => allPoets.value.find(p => p.name === cardPoet.value) || null)
const cardSchool = computed(() => {
  // 简短流派标签 (从 desc 截前 6-10 字)
  const d = cardInfo.value?.desc || ''
  if (!d) return ''
  return d.split(/[,，。 ]/)[0].slice(0, 12)
})
const cardTags = computed(() => {
  // 一些"山水/酒中仙/田园" 类标签 — 简化版从 desc 抽
  const d = cardInfo.value?.desc || ''
  if (!d) return ''
  if (cardPoet.value === '李白') return '山水知己 · 酒中仙'
  if (cardPoet.value === '杜甫') return '诗圣 · 沉郁顿挫'
  if (cardPoet.value === '苏轼') return '豪放派 · 一代文豪'
  if (cardPoet.value === '王维') return '诗佛 · 山水田园'
  if (cardPoet.value === '白居易') return '现实主义 · 香山居士'
  return ''
})
const cardStops = computed(() => {
  // 从 locations 反查作者足迹数
  if (!cardPoet.value) return 0
  const locs = locations.value || []
  let n = 0
  for (const loc of locs) if (loc.ps?.some(p => p.a === cardPoet.value)) n++
  return n
})
const cardPoems = computed(() => cardInfo.value?.poemCount || 0)
// 抽屉激活诗人 → 同步到卡片
watch(() => drawerPoet.value, v => { if (v) cardPoet.value = v })

function selectPoet(name) {
  // 再点同一位 → 仍只切换地图状态 (取消激活), 不关抽屉
  if (drawerPoet.value === name && activePoet.value === name) {
    jpDeactivate()
    activePoet.value = ''
    journeyPlaying.value = false
    return
  }
  drawerPoet.value = name
  const p = allPoets.value.find(x => x.name === name)
  if (p?.hasJourney && !simpleMode.value) {
    // 有游记且非简洁模式 → 激活地图足迹
    if (activePoet.value !== name) {
      jpActivate(name)
      activePoet.value = name
      journeyPlaying.value = false
    }
  } else if (activePoet.value) {
    // 切到无游记诗人 → 清地图状态
    jpDeactivate()
    activePoet.value = ''
    journeyPlaying.value = false
  }
}

function formatYear(y) {
  if (y == null) return ''
  return y < 0 ? '前' + (-y) : String(y)
}

function onDrawerPoemClick(poem) {
  if (poem.hasLocation) {
    // 跳到地图 + 打开卷轴 + 滚动到该诗
    drawerOpen.value = false
    selectLoc(poem.locIdx)
    setTimeout(() => {
      const pe = poContent.value?.querySelector(`.pe[data-pi="${poem.pi}"]`)
      const box = poBox.value
      if (pe && box) {
        const peRect = pe.getBoundingClientRect()
        const boxRect = box.getBoundingClientRect()
        const target = box.scrollLeft + (peRect.left - boxRect.left) - (boxRect.width - peRect.width) / 2
        box.scrollTo({ left: target, behavior: 'smooth' })
        pe.classList.add('highlighted')
        setTimeout(() => pe.classList.remove('highlighted'), 1600)
      }
    }, 700)
  } else {
    // 无地点 → 打开"无地"卷轴
    drawerOpen.value = false
    openMetaPoem(poem)
  }
}

function openMetaPoem(poem) {
  // 合成 loc 给 _renderPanel; locName 用 '_meta_' 前缀的特殊键避免和地图地点撞 fav
  const synth = {
    n: '_meta_·' + poem.author + (poem.location ? '·' + poem.location : ''),
    displayN: poem.author + (poem.location ? ' · ' + poem.location : ''),
    ps: [{
      t: poem.title,
      a: poem.author,
      d: poem.dynasty || '',
      year: poem.year,
      l: poem.lines,           // 可能是 null
      hl: true,
      excerpt: false,
      _metaOnly: true,
    }]
  }
  // 关闭"游记激活态"对面板的过滤干扰
  activeIdx.value = -1
  setActiveI(-1)
  _renderPanel(-1, synth)
}
function toggleJourneyPlay() {
  if (!activePoet.value) return;
  if (journeyPlaying.value) {
    jpStop();
    journeyPlaying.value = false;
  } else {
    jpPlay(6000);
    journeyPlaying.value = true;
  }
}
function clearJourney() {
  jpDeactivate();
  activePoet.value = '';
  journeyPlaying.value = false;
}

// ═══ BGM state ═══
const bgmRef = ref(null)
const bgmIdx = ref(0)           // 当前曲目索引
const bgmMuted = ref(false)     // 是否静音
const bgmVolume = ref(0.20)     // 用户默认 20% (朗读时侧链自动降到 10%)
let _bgmDuckFade = null
const BGM_TRACKS = [
  { name: '云水禅心', file: 'assets/bgm/' + encodeURIComponent('云水禅心') + '.mp3' },
  { name: '半月琴',   file: 'assets/bgm/' + encodeURIComponent('半月琴')   + '.mp3' },
]
const nextTrackName = computed(() => BGM_TRACKS[(bgmIdx.value + 1) % BGM_TRACKS.length].name)
const currentTrackName = computed(() => BGM_TRACKS[bgmIdx.value % BGM_TRACKS.length].name)

// ═══ Audio state ═══
let currentAudio = null
let currentSpeakEl = null
let speaking = false

// ═══ Computed ═══
const locationCount = computed(() => locations.value.length)
const poemCount = computed(() => locations.value.reduce((s, l) => s + l.ps.length, 0))

// ═══ Load location data ═══
// locations.json uses full names (name/lon/lat/poems/title/author/dynasty/lines)
// but the engine uses short names (n/lo/la/ps/t/a/d/l) for compactness
async function loadLocations() {
  const resp = await fetch('assets/locations/locations.json')
  const raw = await resp.json()
  const { lookupYear, lookupMood, lookupRelated } = await import('./data/poem_meta.js')
  return raw.map(loc => ({
    n: loc.name,
    lo: loc.lon,
    la: loc.lat,
    icon: loc.icon,
    tier: loc.tier || 3,           // 文化重要性分级 1/2/3, 用于 overview 下的标签筛选
    ps: loc.poems.map(p => {
      const out = {
        t: p.title,
        a: p.author,
        d: p.dynasty,
        l: p.lines,
        hl: p.hl,
        excerpt: p.excerpt,
      }
      // 合并 meta: 年份(明确/朝代估) + 意境 + 关联诗 keys
      out.year    = lookupYear(out)
      out.mood    = lookupMood(out)       // {tod, weather} | null
      out.related = lookupRelated(out)    // [] 空数组或 key 列表
      return out
    })
  }))
}

// ═══ Mount ═══
onMounted(async () => {
  const _loadStart = Date.now()

  // Load data
  const locs = await loadLocations()
  locations.value = locs

  // Init 3D scene
  await initScene(
    cvRef.value,
    prog.value,
    locs,
    onLabelClick,
    onLabelEnter,
    onLabelLeave
  )
  // mockup 风格: 默认隐藏名句立牌, 让地图干净
  try { toggleLineBoards() } catch(e) { console.warn('toggleLineBoards init skipped:', e) }

  // Init 诗人游记 player (scene / 场上 label / camera 控制都已就绪)
  initJourneyPlayer({
    scene: threeScene,
    L: getLocations(),
    pos3D: getPos3D(),
    lbls: getLbls(),
    setCamTo, setLookTo, setIsAnim,
    openPanel: (i) => selectLoc(i),
  })

  // Remove loading screen — 保证最少 3.2 秒的可见时间, 让 hanzi-writer 至少写
  // 完 "诗词" 两字. 场景加载比这快就补时, 慢就直接进场.
  const _MIN_LD_MS = 3200
  const _elapsed = Date.now() - _loadStart
  const _rem = Math.max(0, _MIN_LD_MS - _elapsed)
  setTimeout(() => {
    loadingOff.value = true
    setTimeout(() => { loading.value = false }, 800)
    // (默认打开"黄鹤楼"卷轴的初始化已禁用 — 让用户主动点击)
  }, _rem)

  // Keyboard handler
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (drawerOpen.value) drawerOpen.value = false
      else closePanel()
    }
  })

  // 点击立牌 → 对应 location 面板. 用 raycaster 测 3D sprite hit.
  // 挂在 #cv 而不是 window, 避免和 UI 按钮冲突 (#tools / #seal 等 z-index 高于 #cv).
  const cvEl = cvRef.value
  if (cvEl) {
    cvEl.addEventListener('click', ev => {
      if (panelOpen.value) return    // 面板开着就不处理
      const rect = cvEl.getBoundingClientRect()
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      const idx = raycastLineBoard(ndcX, ndcY)
      if (idx >= 0) selectLoc(idx)
    })
  }

  // Setup scroll drag on panel
  setupScrollDrag()

  // Start BGM + proximity-based button reveal
  setupBgm()
})

// ═══ BGM control ═══
function setupBgm() {
  const bgm = bgmRef.value
  if (!bgm) return
  bgm.src = BGM_TRACKS[bgmIdx.value].file
  bgm.volume = bgmVolume.value
  bgm.play().catch(() => {
    // Autoplay blocked by browser policy. Resume on first user gesture.
    const resume = () => {
      if (!bgmMuted.value) bgm.play().catch(() => {})
      window.removeEventListener('click', resume)
      window.removeEventListener('keydown', resume)
      window.removeEventListener('touchstart', resume)
    }
    window.addEventListener('click', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
    window.addEventListener('touchstart', resume, { once: true })
  })
}

function toggleMute() {
  const bgm = bgmRef.value
  if (!bgm) return
  bgmMuted.value = !bgmMuted.value
  if (bgmMuted.value) bgm.pause()
  else bgm.play().catch(() => {})
}

// Web Audio 合成的"毛笔擦过纸面"短音: 白噪声 + 带通滤波 + 频率上滑 + 快速衰减
function _playBrushSweep() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const now = ctx.currentTime;
    const dur = 0.40;
    // 白噪声 buffer
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    // 带通 + 频率从 700 Hz 滑到 2400 Hz (刷过纸面的高亮扫声)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(700, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + dur);
    // 包络: 0 → 0.07 (3%衰减保持) → 0.001
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.08, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now); src.stop(now + dur);
    setTimeout(() => { try { ctx.close() } catch(e){} }, 900);
  } catch(e) {}
}

function switchTrack() {
  const bgm = bgmRef.value
  if (!bgm) return
  _playBrushSweep()
  bgmIdx.value = (bgmIdx.value + 1) % BGM_TRACKS.length
  bgm.src = BGM_TRACKS[bgmIdx.value].file
  bgm.currentTime = 0
  if (!bgmMuted.value) bgm.play().catch(() => {})
}

// Slider ↔ audio.volume (also un-mutes if user drags volume up)
watch(bgmVolume, (v) => {
  const bgm = bgmRef.value
  if (!bgm) return
  // 只有在未处于 ducked 状态时才把 slider 值直接写到 audio.volume
  if (!_bgmDucked) bgm.volume = v
  if (v > 0 && bgmMuted.value) {
    bgmMuted.value = false
    bgm.play().catch(() => {})
  }
})

// ═══ BGM 侧链衰减 (朗读期间自动降噪) ═══
let _bgmDucked = false
function _animateBgmVolume(to, duration) {
  const bgm = bgmRef.value
  if (!bgm) return
  if (_bgmDuckFade) cancelAnimationFrame(_bgmDuckFade)
  const from = bgm.volume
  const start = performance.now()
  const step = (t) => {
    const k = Math.min(1, (t - start) / duration)
    bgm.volume = from + (to - from) * k
    if (k < 1) _bgmDuckFade = requestAnimationFrame(step)
    else _bgmDuckFade = null
  }
  _bgmDuckFade = requestAnimationFrame(step)
}
function duckBgm() {
  if (_bgmDucked) return
  _bgmDucked = true
  _animateBgmVolume(Math.min(0.10, bgmVolume.value * 0.5), 350)
}
function unduckBgm() {
  if (!_bgmDucked) return
  _bgmDucked = false
  _animateBgmVolume(bgmVolume.value, 700)
}

// ═══ Label interaction ═══
function onLabelClick(i) { selectLoc(i) }
function onLabelEnter(i) { setBeam(i, true) }
function onLabelLeave(i) { if (activeIdx.value !== i) setBeam(i, false) }

// ═══ Select location → open scroll panel ═══
function selectLoc(i) {
  const L = getLocations()
  const pos3D = getPos3D()
  const lbls = getLbls()
  activeIdx.value = i
  setActiveI(i)
  stopSpeak()

  lbls.forEach((e, j) => e.classList.toggle('on', j === i))
  locBeams.forEach((b, j) => { if (b) { b[0].userData.target = j === i ? 0.85 : 0; b[1].userData.target = j === i ? 0.40 : 0 } })

  // 水墨涟漪从该点发出 (交互仪式感) + camera 开飞
  emitRipple(pos3D[i])

  const p = pos3D[i]
  setCamTo(new THREE.Vector3(p.x + 4, p.y + 10, p.z + 15))
  setLookTo(new THREE.Vector3(p.x, p.y - 4, p.z - 2))
  setIsAnim(true)

  // 面板延迟 500ms 开 — 让涟漪扩散大约一半再被 panel 背景覆盖, 看得见"点"到"开"
  // 的仪式感
  setTimeout(() => _renderPanel(i, L[i]), 500)
}

// 卷轴当前状态: 一次只显单首诗, 左右箭头翻页 (参考图 mockup style).
let _currentLoc = null
let _currentList = []   // [{ p, pi }] 排序后
let _currentIdx = 0     // 在 _currentList 中的位置

// 唐宋常见年号映射 (粗略覆盖, 用于"天宝元年(742)"风格显示)
const ERA_TABLE = [
  // 唐
  { y0: 618, y1: 626, n: '武德', dyn: '唐' },
  { y0: 627, y1: 649, n: '贞观', dyn: '唐' },
  { y0: 650, y1: 655, n: '永徽', dyn: '唐' },
  { y0: 656, y1: 661, n: '显庆', dyn: '唐' },
  { y0: 662, y1: 712, n: '神龙·开元前', dyn: '唐' },
  { y0: 713, y1: 741, n: '开元', dyn: '唐' },
  { y0: 742, y1: 756, n: '天宝', dyn: '唐' },
  { y0: 757, y1: 762, n: '至德·上元', dyn: '唐' },
  { y0: 763, y1: 779, n: '宝应·大历', dyn: '唐' },
  { y0: 780, y1: 805, n: '建中·贞元', dyn: '唐' },
  { y0: 806, y1: 820, n: '元和', dyn: '唐' },
  { y0: 821, y1: 841, n: '长庆·开成', dyn: '唐' },
  { y0: 842, y1: 859, n: '会昌·大中', dyn: '唐' },
  { y0: 860, y1: 906, n: '咸通·乾符', dyn: '唐' },
  // 宋 (北宋)
  { y0: 960, y1: 975, n: '建隆·乾德', dyn: '宋' },
  { y0: 976, y1: 997, n: '太平兴国', dyn: '宋' },
  { y0: 998, y1: 1022, n: '咸平·天禧', dyn: '宋' },
  { y0: 1023, y1: 1063, n: '天圣·嘉祐', dyn: '宋' },
  { y0: 1064, y1: 1077, n: '治平·熙宁', dyn: '宋' },
  { y0: 1078, y1: 1085, n: '元丰', dyn: '宋' },
  { y0: 1086, y1: 1094, n: '元祐', dyn: '宋' },
  { y0: 1095, y1: 1100, n: '绍圣·元符', dyn: '宋' },
  { y0: 1101, y1: 1125, n: '建中·宣和', dyn: '宋' },
  // 南宋
  { y0: 1127, y1: 1162, n: '建炎·绍兴', dyn: '宋' },
  { y0: 1163, y1: 1189, n: '隆兴·淳熙', dyn: '宋' },
  { y0: 1190, y1: 1224, n: '绍熙·嘉定', dyn: '宋' },
  { y0: 1225, y1: 1279, n: '宝庆·咸淳', dyn: '宋' },
]
function _formatEra(year, dyn) {
  if (typeof year !== 'number') return ''
  if (year < 0) return '前' + (-year) + '年'
  for (const e of ERA_TABLE) {
    if (year >= e.y0 && year <= e.y1 && (!dyn || dyn === e.dyn || !e.dyn)) {
      const n = year - e.y0 + 1
      const cn = ['元','二','三','四','五','六','七','八','九','十'][n-1] || (n + '')
      return e.n + cn + '年 (' + year + ')'
    }
  }
  return year + ' 年'
}
function _moodToHuman(mood, poem) {
  if (!mood) return _genericMoodGuess(poem)
  const tod = { dawn:'晨', noon:'昼', dusk:'暮', night:'夜' }[mood.tod]
  const w   = mood.weather === 'rain' ? '雨' : mood.weather === 'snow' ? '雪' : ''
  // 用诗题/作者推送别/怀古/田园等关键词
  const t = (poem?.t || '')
  const tags = []
  if (/送|别|赠/.test(t)) tags.push('送别')
  if (/思|忆|怀/.test(t)) tags.push('怀远')
  if (/登|望/.test(t)) tags.push('登临')
  if (/山|林|田|村/.test(t)) tags.push('山水田园')
  if (/春|秋|冬|夏|风|月|雨|雪/.test(t)) tags.push('感时')
  if (/古|怀古|赤壁|乌江/.test(t)) tags.push('怀古')
  if (tags.length === 0) tags.push(tod || '清远', w || '婉约')
  return tags.slice(0, 2).join(' · ')
}
function _genericMoodGuess(poem) {
  const t = (poem?.t || '')
  if (/送|别|赠/.test(t)) return '送别 · 怀远'
  if (/登|望/.test(t)) return '登临 · 壮阔'
  return '清远 · 婉约'
}

function _buildSortedList(loc) {
  let list = loc.ps.map((p, pi) => ({ p, pi }))
  if (activePoet.value) {
    const matched = list.filter(x => x.p.a === activePoet.value)
    if (matched.length > 0) list = matched
  }
  if (sortMode.value === 'author') {
    list.sort((a, b) => {
      const aa = a.p.a || '', ba = b.p.a || ''
      if (aa !== ba) return aa.localeCompare(ba, 'zh')
      return (a.p.year || 0) - (b.p.year || 0)
    })
  } else {
    list.sort((a, b) => (a.p.year || 0) - (b.p.year || 0))
  }
  return list
}

function _renderPanel(i, loc) {
  _currentLoc = loc
  _currentList = _buildSortedList(loc)
  // 默认显示代表作 (hl=true 那首), 找不到则第 0 个
  const hlIdx = _currentList.findIndex(x => x.p.hl === true)
  _currentIdx = hlIdx >= 0 ? hlIdx : 0
  panelOpen.value = true
  _renderSinglePoem()
}

function _renderSinglePoem() {
  if (!_currentLoc || !_currentList.length) return
  const loc = _currentLoc
  const { p: poem, pi } = _currentList[_currentIdx]
  const titleStr = loc.displayN || loc.n
  const yearStr = poem.year != null ? (poem.year < 0 ? ('前' + (-poem.year)) : String(poem.year)) : ''
  const showFav = !poem._metaOnly
  const faved = showFav ? isFav(loc.n, poem.t) : false
  const speakable = !!(poem.l && poem.l.length)
  // 心境标签
  const todLabel = poem.mood?.tod ? { dawn: '晨', noon: '昼', dusk: '暮', night: '夜' }[poem.mood.tod] : ''
  const wLabel   = poem.mood?.weather === 'rain' ? '雨' : poem.mood?.weather === 'snow' ? '雪' : ''
  const moodTxt = [todLabel, wLabel].filter(Boolean).join(' · ') || '—'
  // 关联诗 (取前 2)
  const relateds = (poem.related || []).slice(0, 2).map(k => k.split('|')[1] || k.split('|')[0]).join('、') || '—'

  let h = ''
  // ── 左元信息列 (HTML 顺序 1) ──
  const titleLen = poem.t.length
  // 标题档位: 短(<=6, 默认 24px 单列) / 长(7-10, 22px 双列) / 超长(>10, 20px 三列)
  const lenAttr = titleLen > 10 ? ' data-len="xlong"' : (titleLen > 6 ? ' data-len="long"' : '')

  // ── 中央诗文 + 简笔山水 (HTML 顺序 2) ──
  h += '<div class="po-body">'
  h += '<div class="po-verses' + (speakable ? '' : ' po-verses-stub') + '" data-pi="' + pi + '" title="' + (speakable ? '点击朗读' : '此诗暂无朗读') + '">'
  if (speakable) {
    poem.l.forEach((l, li) => { h += `<div class="pv" style="animation-delay:${(li * .07 + .15).toFixed(2)}s">${l}</div>` })
  } else {
    h += '<div class="pv pv-stub" style="animation-delay:0.15s">（正文未录入 · 待补）</div>'
  }
  h += '</div>'
  // 简笔山水占位 — SVG: 远山 + 楼阁 + 帆船 (mockup 黄鹤楼·江上风格)
  h += '<div class="po-paint" aria-hidden="true">' +
    '<svg viewBox="0 0 220 220" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">' +
      '<defs>' +
        '<linearGradient id="pf-sky" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#f7eeda" stop-opacity="0"/>' +
          '<stop offset="1" stop-color="#e8d5b0" stop-opacity="0.35"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<rect width="220" height="220" fill="url(#pf-sky)"/>' +
      // 远山三层 (淡墨渐深)
      '<path d="M0 110 Q 30 80, 60 95 T 130 90 T 220 105 L 220 220 L 0 220 Z" fill="rgba(70,55,40,0.16)"/>' +
      '<path d="M0 135 Q 40 105, 85 125 T 170 130 T 220 138 L 220 220 L 0 220 Z" fill="rgba(50,38,28,0.26)"/>' +
      '<path d="M0 165 Q 50 145, 100 158 T 180 162 T 220 168 L 220 220 L 0 220 Z" fill="rgba(35,25,15,0.40)"/>' +
      // 楼阁 silhouette (黄鹤楼/亭台)
      '<g transform="translate(135,118)" fill="rgba(50,30,16,0.85)">' +
        '<polygon points="0,30 30,30 35,22 -5,22"/>' +              // 屋檐 1
        '<rect x="2" y="30" width="26" height="14" />' +             // 一层
        '<polygon points="-2,44 32,44 36,38 -6,38"/>' +              // 屋檐 2
        '<rect x="5" y="50" width="20" height="12" />' +             // 二层
        '<polygon points="0,62 30,62 34,57 -4,57"/>' +               // 屋顶
        '<line x1="15" y1="0" x2="15" y2="22" stroke="rgba(50,30,16,0.85)" stroke-width="1"/>' +  // 旗杆
      '</g>' +
      // 帆船 (江上一叶)
      '<g transform="translate(55,178)" fill="rgba(40,25,12,0.8)">' +
        '<path d="M0 8 L 20 8 L 17 12 L 3 12 Z"/>' +                  // 船身
        '<line x1="10" y1="8" x2="10" y2="-8" stroke="rgba(40,25,12,0.8)" stroke-width="0.8"/>' +  // 桅杆
        '<path d="M10 -8 L 18 0 L 10 5 Z" fill="rgba(252,242,218,0.92)" stroke="rgba(40,25,12,0.6)" stroke-width="0.5"/>' +  // 帆
      '</g>' +
      // 水波纹 (淡墨横线)
      '<path d="M40 200 Q 80 197, 120 201 T 200 203" stroke="rgba(40,28,16,0.32)" fill="none" stroke-width="0.7"/>' +
      '<path d="M20 208 Q 70 205, 130 209 T 210 210" stroke="rgba(40,28,16,0.22)" fill="none" stroke-width="0.6"/>' +
      '<path d="M0 214 Q 60 212, 130 215 T 220 215" stroke="rgba(40,28,16,0.16)" fill="none" stroke-width="0.5"/>' +
    '</svg>' +
  '</div>'
  h += '</div>'

  // ── 右元信息列 ──
  // 年份带年号 (如 "天宝元年 (742)") — 用 _formatEra 简单换算唐宋年号
  const yrFmt = poem.year != null ? _formatEra(poem.year, poem.d) : '约'
  // 心境用更人文的描述 (基于 mood 字段映射)
  const moodHuman = _moodToHuman(poem.mood, poem)
  h += '<div class="po-meta">'
  h += '<div class="pm-row"><span class="pm-k">◈ 创作年份</span><span class="pm-v">' + yrFmt + '</span></div>'
  h += '<div class="pm-row"><span class="pm-k">◈ 创作地点</span><span class="pm-v">' + titleStr + '</span></div>'
  h += '<div class="pm-row"><span class="pm-k">◈ 诗人心境</span><span class="pm-v">' + moodHuman + '</span></div>'
  h += '<div class="pm-row"><span class="pm-k">◈ 意境</span><span class="pm-v">' + (moodTxt !== '—' ? moodTxt : '清远') + '</span></div>'
  h += '<div class="pm-row"><span class="pm-k">◈ 关联诗人</span><span class="pm-v">' + (relateds !== '—' ? relateds : '—') + '</span></div>'
  h += '<div class="pm-row pm-pageinfo">' + titleStr + ' · 共 ' + _currentList.length + ' 首 · 第 ' + (_currentIdx + 1) + ' 首</div>'
  h += '<div class="pm-actions">'
  h += '<button class="po-play' + (speakable ? '' : ' disabled') + '" data-pi="' + pi + '" title="' + (speakable ? '朗读此诗' : '暂无朗读') + '">▶</button>'
  if (showFav) {
    h += '<button class="po-fav' + (faved ? ' on' : '') + '" data-pi="' + pi + '" title="收藏">' + (faved ? '♥' : '♡') + '</button>'
  }
  h += '</div></div>'

  // ── 右印章标题块 (HTML 顺序最后, 显示在右侧) ──
  // 印章字内显示作者名 (单字: 取作者首字; 双字以上完整显示)
  const sealName = poem.a || ''
  // 印章卡片: 整块可点 = 朗读开关 (data-action 给委托用)
  h += '<div class="po-stamp" data-action="speak"' + (speakable ? '' : ' data-disabled="1"') + ' title="' + (speakable ? '点击朗读 / 再次点击停止' : '此诗暂无朗读') + '">'
  h += '<div class="po-stamp-title"' + lenAttr + '>' + poem.t + '</div>'
  h += '<div class="po-stamp-meta">' + (poem.d || '') + '</div>'    // 朝代 (作者已在下方印章里, 不再重复)
  h += '<div class="po-stamp-seal">' + sealName + '</div>'
  h += '</div>'

  poContent.value.innerHTML = h

  // 事件委托: 容器只注册一次 click; 每次 innerHTML 重写后仍生效 (防 listener 累积).
  if (!poContent.value._delegated) {
    poContent.value._delegated = true
    poContent.value.addEventListener('click', (ev) => {
      const t = ev.target
      const item = _currentList[_currentIdx]
      const locNow = _currentLoc
      if (!item) return
      const poemNow = item.p
      // 印章卡片 / ▶ 按钮 → 朗读开关 (再次点击停止)
      if (t.closest('.po-stamp') || t.closest('.po-play')) {
        ev.stopPropagation()
        if (!poemNow.l) return
        const versesEl2 = poContent.value.querySelector('.po-verses')
        speakPoem(poemNow, versesEl2)
        if (activeIdx.value >= 0) pulseBeam(activeIdx.value)
        return
      }
      // 收藏
      if (t.closest('.po-fav')) {
        ev.stopPropagation()
        if (locNow && !poemNow._metaOnly) {
          toggleFav(locNow.n, poemNow)
          _renderSinglePoem()
        }
        return
      }
      // 正文区点击 → 切换字体 (毛笔字 ↔ 易辨字体). 只切, 不朗读.
      if (t.closest('.po-verses')) {
        ev.stopPropagation()
        poContent.value.classList.toggle('readable')
        return
      }
    })
  }

  // 应用心境到场景
  _applyCurrentMood(poem)

  nextTick(() => {
    document.querySelectorAll('.roller-wood').forEach(el => { el.style.backgroundPositionY = '0px' })
    updateArrows()
  })
}

// 翻页: 切下/上一首, 回绕
function _gotoPoem(delta) {
  if (!_currentList.length) return
  _currentIdx = (_currentIdx + delta + _currentList.length) % _currentList.length
  _renderSinglePoem()
}

// ═══ 意境 → 切场景 + LUT 调色 (翻页时根据诗的 mood + 标题/年代综合判断) ═══
let _lastAppliedMoodPi = -1
function _pickToneByPoem(poem) {
  // 多标签综合: mood 优先, 然后看标题/作者关键字
  const t = (poem.t || '') + (poem.l ? poem.l.join('') : '')
  if (poem.mood?.weather === 'snow' || /雪|寒/.test(t))   return 'snow'
  if (poem.mood?.weather === 'rain' || /雨|湿/.test(t))   return 'spring'
  if (poem.mood?.tod === 'night' || /夜|月|宿/.test(t))   return 'night'
  if (poem.mood?.tod === 'dusk'  || /暮|秋|落日|送/.test(t)) return 'autumn'
  if (poem.mood?.tod === 'dawn'  || /春|晓|柳|花/.test(t)) return 'spring'
  // 默认: 唐诗用唐风暖, 其他用 default
  if (poem.d === '唐') return 'tang'
  return 'default'
}
function _applyCurrentMood(poem) {
  if (!poem) { _lastAppliedMoodPi = -1; return }
  // 1. 时辰/天气 (现有)
  if (poem.mood?.tod)  setTimeOfDay(poem.mood.tod)
  if (poem.mood?.weather === 'rain' || poem.mood?.weather === 'snow') setRain(true)
  else if (poem.mood?.weather === 'none') setRain(false)
  if (poem.mood?.tod)  todMode.value = poem.mood.tod
  if (poem.mood?.weather != null) rainOn.value = (poem.mood.weather === 'rain' || poem.mood.weather === 'snow')
  // 2. LUT 色调 (新) — 根据诗自动选预设, 平滑过渡
  try { setTone(_pickToneByPoem(poem), 0.05) } catch(_) {}
}

// ═══ Close panel ═══
const panelClosing = ref(false)
function closePanel() {
  if (!panelOpen.value || panelClosing.value) return
  panelClosing.value = true
  stopSpeak()
  // 等反向卷起动画 (.closing 类播 unfurl/clipReveal reverse) ~600ms 再真正隐藏
  setTimeout(() => {
    panelOpen.value = false
    panelClosing.value = false
    const lbls = getLbls()
    lbls.forEach(e => e.classList.remove('on'))
    locBeams.forEach(b => { if (b) { b[0].userData.target = 0; b[1].userData.target = 0 } })
    activeIdx.value = -1
    setActiveI(-1)
  }, 600)
}

// ═══ 翻页 (替代原 scrollPanel — 现在卷轴只显单首, 箭头切换上/下一首) ═══
function scrollPanel(dir) {
  // dir = 1 → 下一首, dir = -1 → 上一首
  _gotoPoem(dir)
}

function updateArrows() {
  const box = poBox.value
  if (!box) return
  const maxScroll = box.scrollWidth - box.clientWidth
  const arrL = document.getElementById('po-arr-l')
  const arrR = document.getElementById('po-arr-r')
  if (maxScroll < 5) {
    arrL && arrL.classList.remove('show')
    arrR && arrR.classList.remove('show')
    return
  }
  const canRight = box.scrollLeft < maxScroll - 5
  const canLeft = box.scrollLeft > 5
  arrR && arrR.classList.toggle('show', canRight)
  arrL && arrL.classList.toggle('show', canLeft)
}

// ═══ Scroll drag (mousemove/touchmove 用 rAF 节流, 拖动只在每帧最多更新一次 scrollLeft) ═══
function setupScrollDrag() {
  const box = poBox.value
  if (!box) return
  let dragging = false, startX = 0, startScroll = 0
  let pendingX = 0, rafId = 0
  const flushScroll = () => {
    rafId = 0
    if (dragging) box.scrollLeft = startScroll - (pendingX - startX)
  }
  const schedule = (x) => {
    pendingX = x
    if (!rafId) rafId = requestAnimationFrame(flushScroll)
  }
  box.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    if (e.target.closest('.po-arr') || e.target.closest('.pt')) return
    dragging = true; startX = e.clientX; startScroll = box.scrollLeft
    box.classList.add('dragging'); e.preventDefault()
  })
  window.addEventListener('mousemove', e => { if (dragging) schedule(e.clientX) })
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; box.classList.remove('dragging') } })
  box.addEventListener('touchstart', e => {
    if (e.target.closest('.po-arr') || e.target.closest('.pt')) return
    dragging = true; startX = e.touches[0].clientX; startScroll = box.scrollLeft
  }, { passive: true })
  window.addEventListener('touchmove', e => { if (dragging) schedule(e.touches[0].clientX) }, { passive: true })
  window.addEventListener('touchend', () => { dragging = false })
  // scroll 回调本身浏览器已 rAF-合并; 这里写背景位置走 GPU 合成不触发 layout
  box.addEventListener('scroll', () => {
    const off = box.scrollLeft * 0.7
    const rollers = document.querySelectorAll('.roller-wood')
    if (rollers[0]) rollers[0].style.backgroundPositionY = (-off) + 'px, ' + (-off * 2) + 'px'
    if (rollers[1]) rollers[1].style.backgroundPositionY = (off) + 'px, ' + (off * 2) + 'px'
    updateArrows()
  })
  box.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { box.scrollLeft -= e.deltaY; e.preventDefault() }
  }, { passive: false })
}

// ═══ TTS / Audio ═══
function stopSpeak() {
  speechSynthesis.cancel()
  if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null }
  if (currentSpeakEl) currentSpeakEl.classList.remove('pt-speaking')
  currentSpeakEl = null; speaking = false
  unduckBgm()
}

function pickBestVoice() {
  const voices = speechSynthesis.getVoices()
  const zh = voices.filter(v => v.lang && v.lang.startsWith('zh'))
  let v = zh.find(vv => /Natural|Neural/i.test(vv.name))
  if (!v) v = zh.find(vv => /Female|晓|云|Xiaoxiao|Yunxi|Xiaoyi|Xiaochen|Tingting/i.test(vv.name))
  if (!v) v = zh[0]
  return v
}

function mkUtt(text, rate, pitch, volume) {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-CN'; u.rate = rate; u.pitch = pitch; u.volume = volume || 1.0
  const v = pickBestVoice(); if (v) u.voice = v
  return u
}

function speakPoem(poem, titleEl) {
  if (currentSpeakEl === titleEl && speaking) { stopSpeak(); return }
  stopSpeak()
  currentSpeakEl = titleEl
  if (titleEl) titleEl.classList.add('pt-speaking')
  speaking = true
  duckBgm()

  const L = getLocations()
  const loc = activeIdx.value >= 0 ? L[activeIdx.value] : null
  // 统一约定: 所有 mp3 命名为 `{title}·{author}.mp3`, 不再有 title-only 的旧格式.
  // 保证同题不同作者的诗 (如《登鹳雀楼》王之涣 / 畅当) 永不撞车.
  const enc = encodeURIComponent
  const audioPath = loc
    ? 'assets/audio/' + enc(loc.n) + '/' + enc(poem.t + '·' + poem.a) + '.mp3'
    : null
  const tryAudio = new Promise((resolve, reject) => {
    if (!audioPath) { reject(); return }
    const a = new Audio(audioPath)
    let settled = false
    const finish = (fn, val) => { if (settled) return; settled = true; clearTimeout(t); fn(val) }
    const t = setTimeout(() => finish(reject, new Error('audio load timeout')), 3000)
    a.addEventListener('canplay', () => finish(resolve, a), { once: true })
    a.addEventListener('error',   () => finish(reject, new Error('audio load error')), { once: true })
    a.load()
  })
  tryAudio.then(a => {
    currentAudio = a
    a.play().catch(() => fallbackTTS())
    a.addEventListener('ended', () => {
      speaking = false
      if (titleEl) titleEl.classList.remove('pt-speaking')
      currentAudio = null
      if (currentSpeakEl === titleEl) currentSpeakEl = null
      unduckBgm()
    })
  }).catch(() => fallbackTTS())

  function fallbackTTS() {
    const utterances = []
    utterances.push(mkUtt(poem.t + '，' + poem.a, 0.78, 1.02))
    poem.l.forEach((line, idx) => {
      const isLast = (idx === poem.l.length - 1)
      const rate = isLast ? 0.68 : 0.74 + (idx % 2) * 0.02
      const pitch = 1.0 + Math.sin(idx * 0.9) * 0.06
      utterances.push(mkUtt(line, rate, pitch))
    })
    let idx = 0
    function next() {
      if (idx >= utterances.length || !speaking) {
        speaking = false
        if (titleEl) titleEl.classList.remove('pt-speaking')
        if (currentSpeakEl === titleEl) currentSpeakEl = null
        unduckBgm()
        return
      }
      const u = utterances[idx++]
      u.onend = () => setTimeout(next, 180)
      u.onerror = u.onend
      speechSynthesis.speak(u)
    }
    next()
  }
}
speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', () => {})
</script>
