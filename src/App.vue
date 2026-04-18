<template>
  <div id="cv" ref="cvRef"></div>
  <div id="ui">
    <div id="hdr"><div id="hdr-in"><h1>诗词山河</h1><p id="sub">跨越三千年 · {{ locationCount }}处河山 · {{ poemCount }}首诗词</p></div></div>
    <div id="rlbls"></div>
    <div id="labels"></div>
  </div>

  <!-- Scroll Panel -->
  <div id="po" :class="{vis: panelOpen}">
    <div id="po-bg" @click="closePanel"></div>
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
    <p>正在生成三维山河…</p>
    <div class="bar"><div class="fill" ref="prog"></div></div>
  </div>

  <!-- 右上角工具栏: 搜索 + 收藏 -->
  <div id="tools">
    <button class="tool-btn" :class="{open: searchOpen}" @click="toggleSearch" :title="'搜索诗词'">🔍</button>
    <button class="tool-btn" :class="{open: favsOpen, 'has-count': favs.length}" @click="toggleFavs" :title="'收藏夹'">
      <span>★</span>
      <span v-if="favs.length" class="tool-badge">{{ favs.length }}</span>
    </button>
  </div>

  <!-- 搜索弹层 -->
  <div id="search-pane" v-if="searchOpen" @click.self="searchOpen = false">
    <div class="search-box">
      <input ref="searchInput" v-model="searchQuery" type="text" placeholder="搜诗词 · 作者 · 地名 · 诗句" @keydown.escape="searchOpen = false">
      <button class="close-x" @click="searchOpen = false">✕</button>
      <div class="search-results" v-if="searchQuery.trim()">
        <div v-if="searchResults.length === 0" class="search-empty">无匹配</div>
        <div v-for="r in searchResults" :key="r.locIdx + '|' + r.pi" class="search-hit" @click="jumpToPoem(r.locIdx, r.pi)">
          <div class="hit-main"><span class="hit-title">{{ r.poem.t }}</span><span class="hit-author">· {{ r.poem.a }} · {{ r.poem.d }}</span></div>
          <div class="hit-sub">{{ r.locName }}{{ r.snippet ? ' · ' + r.snippet : '' }}</div>
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

  <!-- 背景音乐控件组 (默认半透明常驻, hover 变清晰) -->
  <audio ref="bgmRef" loop></audio>
  <div id="bgm-controls">
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
  camera, locBeams, setActiveI, setCamTo, setLookTo, setIsAnim,
  getLocations, getPos3D, getLbls, setBeam, pulseBeam
} from './core/SceneManager.js'

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

// Update all visible heart icons to match favs state (called after toggle)
function refreshFavButtons() {
  const nodes = document.querySelectorAll('.pe .fav-toggle')
  nodes.forEach(btn => {
    const loc = btn.dataset.loc, t = btn.dataset.title
    btn.classList.toggle('on', isFav(loc, t))
    btn.textContent = isFav(loc, t) ? '♥' : '♡'
  })
}

async function jumpToPoem(locIdx, poemIdx) {
  searchOpen.value = false
  selectLoc(locIdx)
  await nextTick()
  await new Promise(r => setTimeout(r, 200))
  // Scroll horizontally so the target poem sits in view
  const pes = poContent.value?.querySelectorAll('.pe')
  if (!pes || !pes[poemIdx]) return
  const pe = pes[poemIdx]
  const box = poBox.value
  if (box && pe) {
    const peRect = pe.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()
    // center the poem in the box view
    const target = box.scrollLeft + (peRect.left - boxRect.left) - (boxRect.width - peRect.width) / 2
    box.scrollTo({ left: target, behavior: 'smooth' })
    pe.classList.add('highlighted')
    setTimeout(() => pe.classList.remove('highlighted'), 1600)
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

// ═══ BGM state ═══
const bgmRef = ref(null)
const bgmIdx = ref(0)           // 当前曲目索引
const bgmMuted = ref(false)     // 是否静音
const bgmVolume = ref(0.38)     // 0 ~ 1
const BGM_TRACKS = [
  { name: '云水禅心', file: 'assets/bgm/' + encodeURIComponent('云水禅心') + '.mp3' },
  { name: '半月琴',   file: 'assets/bgm/' + encodeURIComponent('半月琴')   + '.mp3' },
]
const nextTrackName = computed(() => BGM_TRACKS[(bgmIdx.value + 1) % BGM_TRACKS.length].name)

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
  return raw.map(loc => ({
    n: loc.name,
    lo: loc.lon,
    la: loc.lat,
    icon: loc.icon,
    ps: loc.poems.map(p => ({
      t: p.title,
      a: p.author,
      d: p.dynasty,
      l: p.lines,
      hl: p.hl,
      excerpt: p.excerpt
    }))
  }))
}

// ═══ Mount ═══
onMounted(async () => {
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

  // Remove loading screen
  loadingOff.value = true
  setTimeout(() => { loading.value = false }, 800)

  // Keyboard handler
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel() })

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

function switchTrack() {
  const bgm = bgmRef.value
  if (!bgm) return
  bgmIdx.value = (bgmIdx.value + 1) % BGM_TRACKS.length
  bgm.src = BGM_TRACKS[bgmIdx.value].file
  bgm.currentTime = 0
  if (!bgmMuted.value) bgm.play().catch(() => {})
}

// Slider ↔ audio.volume (also un-mutes if user drags volume up)
watch(bgmVolume, (v) => {
  const bgm = bgmRef.value
  if (!bgm) return
  bgm.volume = v
  if (v > 0 && bgmMuted.value) {
    bgmMuted.value = false
    bgm.play().catch(() => {})
  }
})

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

  const p = pos3D[i]
  setCamTo(new THREE.Vector3(p.x + 4, p.y + 10, p.z + 15))
  setLookTo(new THREE.Vector3(p.x, p.y - 4, p.z - 2))
  setIsAnim(true)

  const loc = L[i]
  let h = '<div class="ph"><div class="pln">' + loc.n + '</div></div><div class="pms">'
  loc.ps.forEach((poem, pi) => {
    const tl = poem.t.length
    const titleCls = tl > 8 ? 'pt pt-xs' : (tl > 6 ? 'pt pt-s' : (tl > 4 ? 'pt pt-m' : 'pt'))
    const hlCls = (poem.hl === true || (poem.hl !== false && pi === 0)) ? ' hl' : ''
    const faved = isFav(loc.n, poem.t)
    h += '<div class="pe' + hlCls + '"><div class="pm">' +
      '<div class="pd-row">' +
        '<div class="ps">' + poem.d + '</div>' +
        '<div class="pa">' + poem.a + '</div>' +
        '<button class="fav-toggle' + (faved ? ' on' : '') + '" data-pi="' + pi + '" data-loc="' + loc.n + '" data-title="' + poem.t + '" title="收藏">' + (faved ? '♥' : '♡') + '</button>' +
      '</div>' +
      '<div class="' + titleCls + '" data-pi="' + pi + '" title="点击朗读">' + poem.t + '</div>'
    if (poem.excerpt) h += '<div class="pexc">节选</div>'
    h += '</div><div class="pl">'
    poem.l.forEach((l, li) => { h += `<div class="pv" style="animation-delay:${(pi * .20 + li * .06 + .20).toFixed(2)}s">${l}</div>` })
    h += '</div></div>'
  })
  h += '</div>'
  poContent.value.innerHTML = h
  panelOpen.value = true

  // Bind title click → speak
  poContent.value.querySelectorAll('.pt').forEach(el => {
    el.addEventListener('click', ev => {
      ev.stopPropagation()
      const pi = parseInt(el.dataset.pi, 10)
      const poem = loc.ps[pi]
      if (poem) { speakPoem(poem, el); pulseBeam(activeIdx.value) }
    })
  })

  // Bind fav toggle (heart button) click
  poContent.value.querySelectorAll('.fav-toggle').forEach(el => {
    el.addEventListener('click', ev => {
      ev.stopPropagation()
      const pi = parseInt(el.dataset.pi, 10)
      const poem = loc.ps[pi]
      if (poem) toggleFav(loc.n, poem)
    })
  })

  // Bind verse-body click → toggle readable font globally (草书 ↔ 楷体)
  // Guard against drag-scroll: only treat as click if mouse barely moved.
  poContent.value.querySelectorAll('.pl').forEach(el => {
    let dx = 0, dy = 0, mdX = 0, mdY = 0
    el.addEventListener('mousedown', ev => { mdX = ev.clientX; mdY = ev.clientY })
    el.addEventListener('mouseup', ev => {
      dx = Math.abs(ev.clientX - mdX); dy = Math.abs(ev.clientY - mdY)
      if (dx < 6 && dy < 6) {
        ev.stopPropagation()
        poContent.value.classList.toggle('readable')
      }
    })
  })

  // Reset scroll position
  nextTick(() => {
    const box = poBox.value
    if (box) {
      box.scrollLeft = box.scrollWidth - box.clientWidth
      document.querySelectorAll('.roller-wood').forEach(el => { el.style.backgroundPositionY = '0px' })
      updateArrows()
    }
  })
}

// ═══ Close panel ═══
function closePanel() {
  panelOpen.value = false
  const lbls = getLbls()
  lbls.forEach(e => e.classList.remove('on'))
  locBeams.forEach(b => { if (b) { b[0].userData.target = 0; b[1].userData.target = 0 } })
  activeIdx.value = -1
  setActiveI(-1)
  stopSpeak()
}

// ═══ Scroll arrows ═══
function scrollPanel(dir) {
  const box = poBox.value
  if (!box) return
  box.scrollBy({ left: dir * Math.max(260, box.clientWidth * 0.7), behavior: 'smooth' })
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

// ═══ Scroll drag ═══
function setupScrollDrag() {
  const box = poBox.value
  if (!box) return
  let dragging = false, startX = 0, startScroll = 0
  box.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    if (e.target.closest('.po-arr') || e.target.closest('.pt')) return
    dragging = true; startX = e.clientX; startScroll = box.scrollLeft
    box.classList.add('dragging'); e.preventDefault()
  })
  window.addEventListener('mousemove', e => { if (dragging) box.scrollLeft = startScroll - (e.clientX - startX) })
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; box.classList.remove('dragging') } })
  box.addEventListener('touchstart', e => {
    if (e.target.closest('.po-arr') || e.target.closest('.pt')) return
    dragging = true; startX = e.touches[0].clientX; startScroll = box.scrollLeft
  }, { passive: true })
  window.addEventListener('touchmove', e => { if (dragging) box.scrollLeft = startScroll - (e.touches[0].clientX - startX) }, { passive: true })
  window.addEventListener('touchend', () => { dragging = false })
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

  const L = getLocations()
  const loc = activeIdx.value >= 0 ? L[activeIdx.value] : null
  const audioPath = loc ? 'assets/audio/' + encodeURIComponent(loc.n) + '/' + encodeURIComponent(poem.t) + '.mp3' : null
  const tryAudio = new Promise((resolve, reject) => {
    if (!audioPath) { reject(); return }
    const a = new Audio(audioPath)
    let settled = false
    const finish = (fn, val) => { if (settled) return; settled = true; clearTimeout(t); fn(val) }
    // 原本 300ms 太短, 即便文件存在也常被超时抢先触发 fallback.
    // 放宽到 3s: 文件真缺失时浏览器会在几百 ms 内 fire 'error',
    // 走到 3s 说明网络/磁盘真的卡, 此时 fallback 到 TTS 合理.
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
