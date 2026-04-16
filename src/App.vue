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
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
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
    h += '<div class="pe' + hlCls + '"><div class="pm"><div class="ps">' + poem.d + '</div><div class="' + titleCls + '" data-pi="' + pi + '" title="点击朗读">' + poem.t + '</div><div class="pa">' + poem.a + '</div>'
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
    a.addEventListener('canplay', () => resolve(a), { once: true })
    a.addEventListener('error', () => reject(), { once: true })
    a.load(); setTimeout(() => reject(), 300)
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
