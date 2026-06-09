---
title: Lingua Cue
emoji: 🎙️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
---

<div align="center">

<h1>Lingua Cue</h1>

<p>
  <img alt="awesome coffee chat" src="https://img.shields.io/badge/awesome-coffee%20chat-ff5aa5?style=for-the-badge">
  <img alt="status MVP" src="https://img.shields.io/badge/status-MVP-555555?style=for-the-badge">
  <img alt="ASR SenseVoice Small" src="https://img.shields.io/badge/ASR-SenseVoice%20Small-00897b?style=for-the-badge">
  <img alt="terms 900 plus" src="https://img.shields.io/badge/terms-900%2B-315cbb?style=for-the-badge">
  <img alt="stack Node plus Python" src="https://img.shields.io/badge/stack-Node%20%2B%20Python-444444?style=for-the-badge">
  <a href="https://gazybe-lingua-cue.hf.space">
    <img alt="Hugging Face Space live" src="https://img.shields.io/badge/HF%20Space-live-f59e0b?style=for-the-badge">
  </a>
  <img alt="snapshot 2026-06-09" src="https://img.shields.io/badge/snapshot-2026--06--09-5baa00?style=for-the-badge">
</p>

<p><strong>中英混合 coffee chat 的实时术语提示器。</strong></p>

<p><em>实时转写 · 缩写解释 · 场景消歧 · 本地免费 ASR · 个人词库</em></p>

<p>
  <a href="#运行">运行</a> |
  <a href="#当前语音识别引擎">ASR</a> |
  <a href="#实时性策略">实时性</a> |
  <a href="#准确性策略">准确性</a>
</p>

</div>

一个面向 coffee chat 的中英混合术语提示原型。它用浏览器实时草稿配合本地 SenseVoice 做转写，在前端本地识别缩写、行业短语和高歧义词，并根据当前语境给出一句话解释、上下文证据和置信度。

## 运行

默认的免费本地 ASR 模式使用 `SenseVoiceSmall`，这是更适合中文加英文混说的本地模型；`whisper.cpp` 仍作为备用 fallback。首次配置：

```bash
python3 -m venv .venv-asr
.venv-asr/bin/python -m pip install funasr-onnx funasr modelscope torch torchaudio jieba whisper.cpp-cli
bash vendor/whisper.cpp/models/download-ggml-model.sh small

node server.mjs
```

打开 `http://localhost:5174`。

如果你误打开了 `http://localhost:5173` 或直接打开 `index.html`，页面也会自动尝试连接 `http://localhost:5174` 的本地 ASR 代理；前提是 `node server.mjs` 正在运行。

## iOS SwiftUI App

仓库里也包含一个原生 iOS MVP：`ios/LinguaCue/LinguaCue.xcodeproj`。

它实现了 SwiftUI 对话界面、iOS Speech 实时草稿转录、本地术语识别/解释，以及一个打开应用的 App Intent 快捷入口。运行前需要安装完整 Xcode，并把 developer directory 指向 Xcode.app：

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
open ios/LinguaCue/LinguaCue.xcodeproj
```

如果修改了 `ios/LinguaCue/project.yml`，可以重新生成工程：

```bash
cd ios/LinguaCue
xcodegen generate
```

如果需要强制回到 whisper.cpp，可以这样启动：

```bash
LOCAL_ASR_ENGINE=whisper LOCAL_ASR_MODEL=vendor/whisper.cpp/models/ggml-small.bin node server.mjs
```

如果只想跑静态原型和浏览器 ASR，不需要本地模型：

```bash
python3 -m http.server 5173
```

打开 `http://localhost:5173`，并在界面里把“识别”切到“浏览器 ASR”。

Chrome / Edge 对实时语音识别支持最好。Safari 或 Firefox 可以使用样例播放和手动输入来体验术语解释流程。

## 当前语音识别引擎

默认推荐使用 `本地 SenseVoice`，它通过本地 Node 代理调用常驻 Python worker 里的 `SenseVoiceSmall`。音频会在浏览器里打包成 16k mono WAV 分片发给本地代理，不需要付费 API。

为了提升中英混说质量，当前默认使用 `iic/SenseVoiceSmall`，语言默认偏向中文 `zh`。它比 whisper.cpp 的分片 CLI 更适合这个场景：中文识别更强、对短音频延迟更低、常驻 worker 不需要每次请求重新加载模型。如果 SenseVoice 不可用，服务端会自动 fallback 到 whisper.cpp。

为了让 coffee chat 里有更自然的字幕体感，页面会在本地模式下额外启动一层浏览器实时草稿：草稿先以“草稿”行快速出现，SenseVoice 结果随后作为最终转写落到对话流里。草稿只是显示层，不进入正式对话流，也不触发术语卡片，避免临时误听把右侧解释带偏。

`OpenAI ASR` 仍保留为可选云端模式：设置 `OPENAI_API_KEY=... node server.mjs` 后可以调用 `gpt-4o-transcribe`。如果最重要的是免费和本地，保持使用 `本地 SenseVoice`。

备用的 `浏览器 ASR` 使用 Web Speech API，也就是浏览器提供的语音识别能力；这个原型没有直接控制它的底层模型。Chrome / Edge 的识别质量、断句、热词和服务稳定性都由浏览器实现决定，因此中英混说、行业词和长时间连续识别会有明显波动。

生产版如果要更低延迟，可以把当前分片上传方式替换成 OpenAI Realtime transcription WebSocket / WebRTC 流式方案。

## 实时性策略

- 使用 `interimResults` 读取增量转写，不等一句话完全结束才分析。
- 本地 SenseVoice 模式下用浏览器 ASR 生成实时草稿，再用 SenseVoiceSmall 分片结果做最终转写；术语判断只基于落定结果。
- 前端本地词库匹配，避免每个片段都走网络请求。
- 对相同片段做节流处理，默认约 320-350ms 刷新一次解释。
- 先给粗解释，等最终转写落定后再合并同一术语并刷新置信度。
- 在转写结果进入解释层前做轻量纠错，例如 `start up` 统一成 `startup`，并在 Startup / SaaS 场景下把高概率误听的 `step` 标成 `startup`。
- 浏览器 ASR 监听过程中遇到 `onend`、`no-speech`、`aborted` 或静默假活状态时，会自动重连，不需要手动停止再开始。

## 准确性策略

- 每个术语有基础含义、领域解释、证据词和歧义说明。
- 根据所选场景重新计算上下文解释，例如 Startup / SaaS、求职、VC、产品增长。
- 置信度由证据词命中、场景匹配、文本长度和歧义惩罚共同决定。
- 高歧义词不会强行装作确定，例如 `PM`、`IC`、`ICP` 会显示可能的其他含义。
- 词库外的大写缩写会作为“未收录候选”提示，低置信展示，避免把不确定内容包装成确定答案。
- 开启 `AI 补全` 后，未知候选会先低置信显示，再异步补解释；当前是前端模拟层，后续可替换成真实 LLM API。
- 用户点击“记住解释”后，该术语会保存进浏览器本地个人词库，下次命中会优先展示。
- 纠错后的 transcript 会保留原始识别提示，避免用户不知道系统改了什么。

## 新词 fallback 流程

```text
本地词库命中 -> 立即解释
个人词库命中 -> 立即解释
词库外缩写/短语 -> 低置信候选
AI 补全开启 -> 异步更新解释卡
仍不确定 -> 明确建议追问
用户确认 -> 保存进个人词库
```

## 当前边界

- Web Speech API 的识别质量取决于浏览器、麦克风、噪音和口音。
- 如果浏览器或内置预览环境禁止麦克风，应用会显示“麦克风受限”，并建议改用 Chrome / Edge、样例播放或手动输入。
- 当前版本使用本地规则词库，适合 MVP 验证；生产版可以接入 LLM 做更强的上下文消歧。
- 真正上线前需要加入明确的录音告知、会话删除、隐私控制和本地/云端处理选项。
