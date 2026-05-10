# 水墨贴图管线 · TODO 清单

> 此文档单独保存，供后续 session 继续推进"贴图素材生成 + 接入 shader"这条线。
> 来源：与 ChatGPT 关于"诗词山河"项目水墨化升级的对话整理 + 已完成的代码改动 + 待生成的素材清单。

---

## 0. 一句话定位

把项目从"3D 地形 + 程序水墨化"推到"3D 地形 + 真实水墨贴图融合"，让画面从"技术正确"升级到"作品级气质"。
**贴图不替代地形结构，只决定表现质感。**

---

## 1. ChatGPT 核心建议要点（精华版）

### 1.1 项目层级路线
ChatGPT 把项目分了几个递进阶段：
1. **DEM 地形（骨架）** — 已做（SRTM/ASTER）
2. **河流嵌入地形（血管）** — 已做（spline 凹陷长江/黄河/珠江）
3. **水墨 Shader（皮肤）** — 部分做了（InkWashPass 程序版）
4. **云雾（气）** — 部分做了
5. **三层山水（前景 DEM + 中景低模 + 远景贴图）** — 远景已禁用（用户反馈不好看），保留前景
6. **LUT 调色（统一气质）** — 已做（程序 LUT，7 预设，平滑插值）
7. **意境联动（多标签叠加 + LUT 混合）** — 已做
8. **粒子（雨/花瓣/月光 三合一）** — 已做（CPU 版）
9. **空间音效（古琴/雨声/虫鸣）** — 未做
10. **天空系统（昼夜流转 + 月相 + 云层 shader）** — 未做（已有 MoonBuilder/CloudBuilder 简化版）

### 1.2 GPT Image 2 在管线里的角色
- ❌ **不用做地形** — 它是 2D 模型，无法生成 3D mesh
- ❌ **不用做"中国地图整图"** — 旋转视角下会穿帮
- ✅ **只做"风格资产"** — 宣纸/皴法/墨扩散/云雾/水面/远山/LUT 等可平铺纹理
- ✅ **替代程序 noise** — 程序 noise 永远有"计算机味"，GPT 生成的笔触有"毛笔味"

### 1.3 Shader 升级方向（高级感来源）
- **墨分五色** — 高山深墨 / 中山中墨 / 平原淡墨 / 溪谷留白
- **皴法笔触** — brushTex 替代程序 noise，让山体有"披麻皴 / 斧劈皴"感
- **墨晕染** — diffusionTex 让边缘有"宣纸吸墨"的化开感
- **留白** — 平原区域不要填满色彩，让宣纸基色"透出来"
- **空气透视** — 远山泛白溶进雾里（已通过 fog 实现）
- **LUT 混合而非切换** — 意境切换时插值 LUT_A 与 LUT_B（已做程序版本）

### 1.4 镜头层（已做）
- 卷轴式约束（不能翻到地球底面） — 已做
- 镜头呼吸（轻微 sin 浮动） — 已做
- 缓慢移动（GSAP 风格的 lerp） — 已有 setCamTo

---

## 2. 我已做的代码改动（哪些 hooks 已留好）

### 2.1 InkWashPass 已加 LUT uniform（程序版，等贴图替换）
位置：`src/core/InkWashPass.js`

```js
uniforms: {
  // ... 原有 uPaperStrength/uWarmth/uDesat/uVignette/uEdgeStrength/uEdgeThreshold/uTime
  // ── 程序化 LUT (3 段调色, 等真贴图来替换为 sampler2D) ──
  uShadowTint:    { value: new THREE.Vector3(0.20, 0.14, 0.10) },
  uMidTint:       { value: new THREE.Vector3(0.78, 0.70, 0.55) },
  uHighlightTint: { value: new THREE.Vector3(0.98, 0.94, 0.86) },
  uToneStrength:  { value: 0.35 },
}
```

**升级路径**：
- 程序 LUT → 真 LUT 贴图：把 `uShadowTint/uMidTint/uHighlightTint` 替换为单个 `uniform sampler2D uLUT`，shader 用 `applyLUT(uLUT, color)` 函数采样
- 已暴露 `setTone(name, lerpSpeed)` 和 `updateTone()` API（在 `SceneManager.animate()` 里每帧调用）
- 7 个预设：`default / tang / night / spring / autumn / snow / dusk`
- App.vue 的 `_pickToneByPoem(poem)` 会按诗的 mood + 标题关键字自动选 preset

### 2.2 InkWashPass shader 已分层（待加贴图 sampler）

shader 主体已分 7 段：Sobel 墨边 / 宣纸纤维（程序 vnoise）/ 暖色偏移 / 降饱和 / 程序 LUT / 暗角 / 底部水渍。

**待替换的 stub**：
- 第 1 段宣纸纤维 → 用真 paper.png 贴图替换 `vnoise`
- 第 1.5 段（新增）皴法 → 加 brushTex sampler，按 luma 决定 brush 强度
- 第 1.7 段（新增）墨扩散 → 加 inkBleedTex sampler，做边缘 bleed
- 第 5 段程序 LUT → 真 LUT 贴图（256×16）

### 2.3 WaterMaterial tint 已改淡蓝白
位置：`src/core/SceneManager.js` line ~556
```js
const waterMat = makeWaterMaterial(skyCube, { tint: new THREE.Color(0xdde8f2), intensity: 0.65 });
```
**升级路径**：把当前 normalMap 替换成 water.png 水墨水波纹理（在 WaterMaterial.js 加 sampler）

### 2.4 Fog 调成宣纸暖米黄
位置：`src/core/SceneManager.js` line ~252
```js
scene.fog = new THREE.FogExp2(0xc8a878, 0.0017);
```
（如果换 mist.png 贴图做"漂浮云雾层"，可以取代部分程序 fog）

### 2.5 地形 tColor 出口已水墨化
位置：`src/core/TerrainBuilder.js` + `TerrainCompute.js`（worker，必须同步改）
```js
// 1. desat 55%（朝灰墨调）
// 2. 朝宣纸基色 #d8c098 混 20%
```
**TerrainCache version: v12**（改 tColor 必 bump）

### 2.6 地形主山脉 spline + 河流凹陷已加
- `src/core/helpers.js` 加了 `ridgeChain()` / `riverChannel()`
- 8 大山脉：昆仑 / 秦岭 / 横断（破碎） / 天山 / 大兴安岭 / 长白 / 太行 / 南岭
- 3 大河流：长江 / 黄河 / 珠江（凹陷地形）
- TerrainBuilder + TerrainCompute 双源同步

---

## 3. 待生成贴图清单（GPT Image 2 用）

> 用户说："不用远景了"。原 distant_mountains 已禁用，**不必生成**。
> 其余 8 张按优先级列出。每张都给英文（推荐用）+ 中文备选。

> **通用约束（每张 prompt 结尾都加）**：`4K resolution, no text, no signature, no watermark, no border`
> **保存路径**：所有贴图放到 `public/assets/textures/` 下

---

### ⭐⭐⭐ 必做 3 张（最影响质感）

#### T1. paper.png — 宣纸纹理（全局乘）
**英文**:
```
Seamless tileable traditional Chinese rice paper (xuan paper / 宣纸) texture, fine natural fibers visible, subtle warm beige-cream tone (#f0e0c0 average), no ink stains, no patterns, no edges visible, very subtle hand-made paper grain at multiple scales (coarse fibers + fine speckle), uniform lighting with no highlights or shadows. Must tile perfectly when repeated. 2048x2048, photographic detail. No text, no signature, no watermark, no border.
```
**中文**:
```
无缝可平铺的传统中国宣纸纹理，能看见自然纤维细节，米黄温暖色调（平均 #f0e0c0），无墨迹，无图案，无可见边缘，多尺度手工纸纹（粗纤维 + 细斑点），均匀无高光无阴影光照。必须重复平铺无接缝。2048x2048 摄影级细节。无文字无签名无水印无边框。
```
**接入位置**: `InkWashPass.js` 加 `uPaperTex: { value: null }` uniform，shader 第 1 段把 `vnoise` 改成 `texture2D(uPaperTex, vUv*2.0).rgb` 乘进 col

---

#### T2. brush_pima.png — 披麻皴笔触
**英文**:
```
Seamless tileable Chinese ink brush stroke texture, "pi-ma cun" (披麻皴) technique, parallel long flowing brush lines like hemp fibers running diagonally, dry brush effect with broken ink density, pure black ink on transparent or white background, no color, used as an overlay multiply layer for terrain shading. Must tile perfectly. 2048x2048. Subtle organic variation, not too dense (about 30% coverage). No text, no border, no watermark.
```
**中文**:
```
无缝可平铺中国水墨笔触纹理，披麻皴技法，平行长流畅笔线像麻纤维斜向流淌，干笔效果带断墨浓淡变化，纯黑墨于透明或白色背景，无色彩，作为地形渲染的叠加 multiply 层。必须完美平铺。2048x2048。微妙有机变化，不过密（约 30% 覆盖率）。无文字无边框无水印。
```
**接入位置**: `InkWashPass.js` 加 `uBrushTex` uniform，新增 shader 段：`color *= 0.7 + texture2D(uBrushTex, vUv*6.0).r * 0.5;` 让山体有皴法感

---

#### T3. ink_bleed.png — 墨扩散（高级感核心）
**英文**:
```
Seamless tileable ink wash diffusion texture, watercolor-style ink bleeding patterns on absorbent rice paper, soft cloudy stains with darker centers fading to lighter edges, irregular organic shapes, pure black ink on white background, overall low density (about 25% coverage), used to add wet edges and ink bleed effects in shader. 2048x2048. Tile perfectly. No text, no border, no signature, no watermark.
```
**中文**:
```
无缝可平铺墨晕扩散纹理，水彩风格墨在宣纸吸水扩散图案，柔软云状斑点中心深向边缘渐淡，不规则有机形状，纯黑墨于白色背景，整体低密度（约 25% 覆盖率），用于 shader 加湿边和墨扩散效果。2048x2048 完美平铺。无文字无边框无签名无水印。
```
**接入位置**: `InkWashPass.js` 加 `uInkBleedTex`，新增 shader 段：`col.rgb = mix(col.rgb, vec3(0.1), texture2D(uInkBleedTex, vUv*3.0).r * 0.2);`

---

### ⭐⭐ 推荐 3 张

#### T4. brush_fupi.png — 斧劈皴笔触（与 T2 配合用于陡崖）
**英文**:
```
Seamless tileable Chinese ink brush texture, "fu-pi cun" (斧劈皴) technique, sharp angular axe-cut brush strokes suggesting cliff faces, strong contrast between heavy ink and light, irregular short diagonal slashes, pure black ink on white or transparent background, used as overlay for steep mountain rendering. Must tile perfectly. 2048x2048. About 35% ink coverage. No text, no border, no watermark.
```
**接入**: 同 T2，按地形坡度 mix（陡坡用 fupi、缓坡用 pima）

#### T5. mist.png — 云雾贴图
**英文**:
```
Seamless tileable Chinese ink wash mist and cloud texture, soft horizontal cloud bands and drifting fog, very light grey on transparent background (alpha channel), atmospheric and ethereal, no harsh edges, suitable for additive blending over a 3D landscape scene, multiple soft layers of overlapping mist. 2048x1024 horizontal. Must tile horizontally seamlessly. PNG with transparent alpha. No text, no border, no watermark.
```
**接入**: 可做新 plane 漂浮在山间（CloudBuilder 加一层），或 InkWashPass 加 `uMistTex` 做雾叠加

#### T6. water.png — 水面纹理
**英文**:
```
Seamless tileable Chinese ink wash water surface texture, very subtle horizontal ink lines suggesting calm water ripples, light grey-blue tone on white background (#dde8f2 base with grey ripples), almost minimal, traditional painting style, used as river/lake surface in shader. 2048x2048 tiles perfectly. No text, no signature, no watermark.
```
**接入**: `WaterMaterial.js` 加 `uWaterTex` 替换或叠加现有 normalMap

---

### ⭐ 锦上添花 2 张（程序 LUT 已能用，真 LUT 仅是精度提升）

#### T7. lut_tang_warm.png — 唐风暖色 LUT（256×16）
**英文**:
```
A 256x16 pixel color lookup table (LUT) image, formatted as a horizontal strip of 16 squares (each 16x16 pixels), encoding a 16x16x16 3D color cube unwrapped horizontally. The squares represent blue channel slices, each 16x16 inner pixels representing red (x) by green (y) at that blue level. The LUT should apply a warm Tang-dynasty Chinese painting color grade: lift shadows toward warm sepia brown, push midtones toward warm beige-amber, gently desaturate cool colors (greens, blues), keep highlights creamy off-white. Output exactly 256x16 pixels, no anti-aliasing between cells, sharp grid. Reference: filmic warm autumn LUT. PNG, no text, no border.
```
> ⚠️ GPT Image 2 生成 LUT 可能不准确（它是图像模型不是色彩工具）。如果生成的偏色严重，**更可靠的方法**：用 Photoshop / DaVinci Resolve 调一张参考图色，export 成 LUT。或者直接用现成的免费 cinematic LUT 包（OpenColorIO 社区有）。
> 如果不想麻烦，**程序版 LUT 已经够用**（`InkWashPass.js` 的 7 个 TONE_PRESETS）。

#### T8. lut_night_cool.png — 夜诗冷调 LUT（256×16）
**英文**:
```
A 256x16 pixel color lookup table (LUT) image in horizontal strip format (16 squares of 16x16 each), encoding a 3D color cube. The grade should evoke a cold misty Chinese night: shift overall toward cool blue-grey, lift shadows to deep ink blue (#1a2540), push midtones toward muted slate, desaturate warm colors significantly, keep highlights pale moonlit silver-blue. Used for poems like 枫桥夜泊. Exactly 256x16 pixels, sharp cell boundaries, no anti-aliasing. PNG, no text.
```

---

## 4. 接入步骤（每张贴图怎么进 shader）

### 4.1 通用流程
1. 把生成的 PNG 放到 `public/assets/textures/`
2. 在 SceneManager init 时用 `THREE.TextureLoader().load(...)` 加载
3. 把加载好的 texture 写到 `inkWashPass.uniforms.uXxxTex.value`
4. shader 里加 `uniform sampler2D uXxxTex;` 声明 + 在主体里 `texture2D(uXxxTex, vUv*scale)` 采样

### 4.2 示例：接入 paper.png
```js
// SceneManager.js init() 里
const paperTex = new THREE.TextureLoader().load('assets/textures/paper.png');
paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
inkWash.uniforms.uPaperTex = { value: paperTex };
```
```glsl
// InkWashPass.js fragment shader 顶部加
uniform sampler2D uPaperTex;
// 在第 1 段（宣纸纤维）替换 vnoise 为：
vec3 paperRgb = texture2D(uPaperTex, vUv * 2.5).rgb;
col.rgb *= mix(vec3(1.0), paperRgb, uPaperStrength);
```

### 4.3 注意事项
- **wrapS/wrapT 必须设为 RepeatWrapping** — 否则平铺会有缝
- **mipmap 默认开**（`generateMipmaps: true`），远处看会自动降采样
- **SRGB color space**：`paperTex.colorSpace = THREE.SRGBColorSpace`（除了 LUT 这种 raw data 用 LinearSRGBColorSpace）
- **图片大小不要超 4K**：超过会让显存吃紧

---

## 5. 命名规范 + 路径

```
public/assets/textures/
├── paper.png             # T1 宣纸（必做）
├── brush_pima.png        # T2 披麻皴（必做）
├── brush_fupi.png        # T4 斧劈皴
├── ink_bleed.png         # T3 墨扩散（必做）
├── mist.png              # T5 云雾
├── water.png             # T6 水面
├── lut_tang_warm.png     # T7 唐风 LUT
└── lut_night_cool.png    # T8 夜诗 LUT
```

---

## 6. 优先级建议（资源有限时按序生成）

| 顺序 | 贴图 | 理由 |
|---|---|---|
| 1 | **paper.png** | 全局乘，影响每个像素，质感升级最明显 |
| 2 | **brush_pima.png** | 替代山体程序 noise，山脊立刻有"毛笔感" |
| 3 | **ink_bleed.png** | 边缘晕染，宣纸吸墨效果，"高级感"主要来源 |
| 4 | brush_fupi.png | 与 T2 配合（陡坡用），收益递减 |
| 5 | mist.png | 云雾层，可加可不加 |
| 6 | water.png | 水面流动，已有简化版可顶替 |
| 7-8 | lut_*.png | 程序 LUT 已能用，仅精度提升 |

**只生成 T1+T2+T3 三张就能看到质变**。

---

## 7. 接下 session 怎么继续

1. 读这个文档（你已经在读了 ✓）
2. 用 GPT Image 2 按上面 prompt 批量生成 PNG，放到 `public/assets/textures/`
3. 跟 Claude 说："按 `docs/textures-pipeline.md` 第 4 节，把 paper / brush_pima / ink_bleed 接进 InkWashPass"
4. Claude 会改 SceneManager.js + InkWashPass.js，加载贴图 + 改 shader
5. 跑 `npm run dev` 看效果，按需调 `uPaperStrength` 等 uniform 精细化
6. 满意后 git commit + push

---

## 8. 兜底说明

如果你最终还是不想生成这些贴图（嫌麻烦或 GPT Image 2 效果不理想），**当前的程序版本完全可用**：
- 程序 LUT 已经能切 7 套色调
- 程序 noise 已经做了基本笔触
- fog + 地形 desat 已经够"水墨"

贴图只是把"7 分像水墨"推到"9 分像水墨"。差的那 2 分需要时间和精力，按需投入。

---

**最后修改**：2026-04-27
