# 诗词朗读音频

## 文件命名规则

```
assets/audio/<地点名>/<诗词标题>.mp3
```

**示例：**
```
assets/audio/长安/春望.mp3
assets/audio/长安/长恨歌.mp3
assets/audio/长安/九月九日忆山东兄弟.mp3
assets/audio/洛阳/春夜洛城闻笛.mp3
assets/audio/黄鹤楼/黄鹤楼送孟浩然之广陵.mp3
assets/audio/苏州/枫桥夜泊.mp3
```

**地点和标题必须和** `assets/locations/locations.json` **里的字段一致**，因为代码是用 JS 编码后通过 `fetch` 去找文件的。

## 加载逻辑

`诗词山河.html` 里的 `speakPoem(poem, titleEl)` 函数：

1. 先尝试 `new Audio('assets/audio/<地点>/<标题>.mp3')`
2. 300ms 内能 `canplay` → 播放专业录音
3. 否则回退到浏览器 TTS（分句多段 + 抑扬顿挫）

## 建议来源

- **央视诗词朗读** — 中国诗词大会嘉宾朗诵片段
- **喜马拉雅** — 搜 "中华古诗词" / "唐诗宋词"
- **懒人听书** — 有专业主播的朗读专辑
- **豆瓣音乐** — 朗诵艺术家专辑（濮存昕、鲍国安、徐涛等）
- **B 站** — 搜 "诗词朗诵 濮存昕" / "中国诗词大会朗诵"
- **自己用 AI 生成** —
  - **Microsoft Azure TTS** （有免费额度）— `zh-CN-XiaoxiaoNeural` + SSML emotion style `poetry-reading`
  - **阿里云语音合成** — `zhixiao` 等诗词专用音色
  - **火山引擎** — 有专门的朗读/情感音色
  - **Eleven Labs** — 中文支持有限但有情感变化

## 文件格式

- **推荐**: MP3, 128–192 kbps, 单声道
- **也支持**: OGG, WAV, M4A（浏览器 `<audio>` 原生支持的格式即可）

## 音量和时长

- **音量规范化** 到 -14 LUFS 左右，避免不同录音音量忽大忽小
- **时长**：四句五言绝句约 20–30 秒，八句律诗约 45–60 秒。长恨歌节选建议 60–90 秒

## 不录音也没关系

如果不提供 MP3，代码会自动回退到**浏览器 TTS 分句朗读**：
- 标题 + 作者开场
- 每句单独合成 utterance，微调 rate / pitch 产生抑扬顿挫
- 句间 180ms 停顿
- 优先使用神经网络音色（Edge 的晓晓/云希）

**最佳效果**：用 Microsoft Edge 浏览器（支持神经网络中文音色），或放入人工朗读的 MP3 文件。
