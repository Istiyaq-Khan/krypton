# Krypton Synapse — Architecture & Pluggable Offline STT Specification

This document details the architecture, window management, pluggable speech-to-text (STT) runtime engines, offline audio streaming capture pipeline, multi-click gesture arbiter, and global shortcut listeners for **Krypton Synapse** (formerly Voice HUD).

---

## 1. Architectural Overview & Design Invariants

**Krypton Synapse** is an autonomous desktop speech and steering companion. Elevated above all system windows, Synapse provides immediate conversational steering, fleet agent context switching, real-time audio visualization, and zero-latency local speech-to-text with zero external cloud dependencies.

```
┌────────────────────────────────────────────────────────────────────────┐
│  (● Orb)  │  [@ Orchestrator ▾]  │  "Deploy new service..." [↺] [↑]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Design Invariants:
1. **Single-Window Desktop Architecture**: In native Tauri desktop mode, Synapse runs exclusively as an independent, frameless, transparent OS-level window (`label: "synapse"`). The dashboard never spawns duplicate in-DOM pill elements.
2. **True WebView2 Transparency**: The Synapse container declares `data-synapse-window="true"`, ensuring `html` and `body` remain `background: transparent !important;` without unpainted black borders or opaque rectangular backdrops.
3. **Pluggable Local STT Runtime**: Speech inference is decoupled from cloud providers through a unified runtime loader supporting quantized Whisper GGUF and streaming Moonshine ONNX engines.
4. **100% Offline Audio Pipeline**: Raw PCM audio buffers are captured via Web Audio API (`AudioContext` + `ScriptProcessorNode` / `AudioWorkletNode`) and fed directly to local engines, strictly bypassing browser Web Speech API network calls (`webkitSpeechRecognition`) to eliminate network connectivity errors.

---

## 2. Component Anatomy & Gesture Arbiter

Synapse operates as a decoupled, top-level, free-floating interactive pill overlay:

### 1. Animated Visualizer Orb (Left)
- **Dynamic Visualizer**: Canvas-based animated orb with ambient radial glow, counter-rotating orbital rings, and live audio frequency reaction.
- **State Color Palette**:
  - `idle`: Ambient violet aura (`rgb(168, 85, 247)`)
  - `listening`: Vibrant emerald glow (`rgb(16, 185, 129)`) with live audio amplitude reaction
  - `thinking`: Electric blue spinning orbits (`rgb(59, 130, 246)`)
  - `speaking`: Rose pink pulse (`rgb(236, 72, 153)`) with synthesized speech readout
  - `error`: Rose red diagnostic warning (`rgb(244, 63, 94)`)
- **Multi-Click Gesture Arbiter**:
  - **Single Click**: Toggle recording / push-to-talk listening state.
  - **Double Click**: Collapse pill into compact circular orb-only mode (54px width). Double-clicking again expands back to full pill.
  - **Triple Click**: Trigger smooth SVG/CSS exit dismiss animation (`opacity-0 scale-75`) and close/hide the Synapse window.

### 2. Agent Selector Button (Middle)
- Displays the active agent persona name (`[Orchestrator]`, `[CoderBot]`, etc.).
- Declares `style={{ WebkitAppRegion: "no-drag" }}` and `data-tauri-drag-region="false"`.
- Clicking opens a sleek, custom floating glassmorphism panel listing all configured fleet agents.
- Selecting an agent immediately switches the active conversation context across the entire application shell.

### 3. Live Transcription Display Area (Right)
- Renders real-time transcription text returned by the active offline STT engine.
- **Dynamic Collapsing**: When idle and no transcription is present, this region collapses into a minimal clean idle status badge (`Idle` / `Listening`).
- When speech is detected, smoothly expands with live streaming text, audio amplitude meter, and quick Send/Dispatch (`ArrowUp`) and Clear (`RotateCcw`) actions.

---

## 3. Window Lifecycle & Single-Instance Guarantee

To eliminate unpainted black boxes and duplicate interfaces, Krypton enforces a strict desktop window lifecycle:

```
[ Window Header: Logo / View Menu ] ──┐
                                       ├──▶ toggle_synapse ──▶ [ Tauri Window: "synapse" ]
[ Hotkey: Ctrl+Shift+Space ] ─────────┘        (Tauri)                │
                                                                       ▼
                                                          [ Single Frameless Window ]
                                                          (transparent, alwaysOnTop)

[ Chatbar Microphone Button ] ────────▶ Inline Dictation ───▶ Textarea Prompt Insertion
```

- **Tauri Mode (`isTauri()`)**: Invoking Synapse (`Ctrl+Shift+Space` or WindowHeader menu) triggers the native Tauri command `toggle_synapse`. Only the dedicated `synapse` window is toggled. The chat toolbar microphone button is dedicated strictly to **Inline Chat Dictation** and never triggers `toggle_synapse`.
- **Web Preview Mode (`!isTauri()`)**: In browser preview environments where native Tauri windows do not exist, the dashboard conditionally mounts the in-DOM `<KryptonSynapse />` component as an interactive fallback when invoked from the header.
- **Tauri Window Definition (`tauri.conf.json`)**:
  ```json
  {
    "label": "synapse",
    "title": "Krypton Synapse",
    "url": "/synapse",
    "width": 640,
    "height": 130,
    "resizable": false,
    "decorations": false,
    "transparent": true,
    "shadow": false,
    "alwaysOnTop": true,
    "skipTaskbar": true,
    "center": true,
    "visible": false
  }
  ```

---

## 4. Pluggable STT Runtime Loader (`SttRuntimeLoader`)

Speech transcription is abstracted behind the `ISttEngine` interface, managed by `SttRuntimeLoader`:

```
                           ┌──▶ Runtime A: Whisper C++ / GGUF Engine
[ SttRuntimeLoader ] ──────┼──▶ Runtime B: ONNX / Moonshine Transducer
                           └──▶ Custom / Streaming Transducer Providers
```

### Supported Engines:

| Engine ID | Architecture | Engine Mechanics | Use Case |
| :--- | :--- | :--- | :--- |
| **`whisper_gguf`** | `encoder_decoder_autoregressive` | Autoregressive Transformer with 80-channel log-Mel spectrogram | High accuracy, multi-lingual conversational speech |
| **`moonshine_onnx`** | `moonshine_onnx` | ONNX streaming conformer transducer | Ultra-low latency, real-time live mic streaming |
| **`whisper_local`** | `encoder_decoder_autoregressive` | Legacy Whisper local alias | Backward compatibility with v1 configs |
| **`whisper_api`** | `cloud_api` | OpenAI-compatible HTTP multipart audio endpoint | Remote fallback if requested |

### Engine Interface Contract:
```typescript
export interface ISttEngine {
  readonly id: SttEngineId;
  readonly architecture: string;
  isModelLoaded(): boolean;
  loadModel(modelPath: string): Promise<void>;
  transcribe(audioPcm: Float32Array | Buffer, sampleRate?: number): Promise<SttTranscriptionResult>;
  streamTranscribe?(chunk: Float32Array | Buffer, onPartial: (text: string) => void): Promise<SttTranscriptionResult>;
  dispose(): Promise<void>;
}
```

---

## 5. Model Storage & SHA-256 Hash Verification

All speech model weights are standardized under the unified Krypton filesystem path:
```
path.join(os.homedir(), ".krypton", "models")
```

### Automated Model Provisioning:
1. **Cache Verification**: When an engine is selected, `downloadSttModel()` computes the file's SHA-256 hash using streaming `crypto.createHash("sha256")`.
2. **Cache Hit**: If the model exists and the checksum matches `manifest.sha256`, the model loads immediately without re-downloading.
3. **Atomic Download & Verification**: New downloads stream into a temporary `.tmp` file. If the downloaded checksum matches the manifest, it atomically renames to the canonical filename. If corrupted, the temp file is purged and an error is thrown.

### Canonical Model Catalog:
- `whisper-tiny-q8_0` (`ggml-tiny-q8_0.bin`): `be07e048e1e599ad147f9453950b7be50d99ef82b9b73489e5264b3bfd82c0cc`
- `whisper-base-q5_1` (`ggml-base-q5_1.bin`): `60ed5bc3dd14eea856493d334349b405782ddcaf0028787455f64b4f45809690`
- `moonshine-tiny-onnx` (`moonshine-tiny.onnx`): `e4d3f5a892b1c70e248b61c94b32549a888c3a3721345d911b33e2154407b99c`

---

## 6. Offline Local Audio Streaming Pipeline

The audio capture pipeline (`apps/desktop/src/lib/synapse/audioPipeline.ts`) operates entirely on-device:

1. **Hardware Acquisition**: Opens single-channel 16kHz audio stream via `navigator.mediaDevices.getUserMedia`.
2. **Audio Processing**: Routes PCM frames through Web Audio `AudioContext` and `ScriptProcessorNode` to collect raw Float32 samples.
3. **Reactive Visualization**: `AnalyserNode` frequency bins drive the canvas visualizer orb in real time.
4. **Offline Transcription**: Audio samples are decoded locally through the active STT engine or native sidecar.
5. **IPC Streaming**: Emits `synapse:transcription` events across windows so both Synapse and the main chatbar update synchronously.

---

## 7. Global Shortcuts & Dragging Architecture

### Dragging & Multi-Monitor Support:
1. **Top-Level Z-Index Elevation (`z-[9999]`)**: Elevated above all workstation elements, sidebars, diff viewers, and settings panels.
2. **Native Drag Region Integration**: Container declares `style={{ WebkitAppRegion: "drag" }}` and `data-tauri-drag-region="true"`, allowing Tauri to delegate window movement to native OS window managers without boundary clipping.
3. **Pointer Event Isolation**: All interactive buttons, inputs, and dropdown panels declare `style={{ WebkitAppRegion: "no-drag" }}` and `data-tauri-drag-region="false"`.

### Global Hotkeys:
- `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS): Global operating system shortcut to summon or dismiss Krypton Synapse.

---

## 8. Inline Chat Dictation vs. Krypton Synapse (User Manual Specification)

Krypton provides two distinct voice interaction modalities designed for different operational workflows:

| Dimension | Inline Chat Dictation (`InlineVoiceRecorder`) | Krypton Synapse (`KryptonSynapse`) |
| :--- | :--- | :--- |
| **Primary Purpose** | Hands-free prompt composition and inline editing | Autonomous system steering and multi-agent orchestration |
| **Invocation Surface** | Microphone icon located in the bottom chat toolbar (`CommandContextBar`) | Global OS hotkey (`Ctrl+Shift+Space`) or `WindowHeader` View menu |
| **Visual Presentation** | Compact inline toolbar button; expands to pulsing equalizer bars and REC indicator | Floating transparent frameless OS overlay window (`label: "synapse"`) |
| **State Machine** | `idle` ➔ `recording` ➔ `transcribing` ➔ `inserted` | `idle` ➔ `listening` ➔ `thinking` ➔ `speaking` ➔ `error` |
| **Execution Behavior** | Pipes recognized text directly into the active prompt textarea for manual review before sending | Autonomously submits and dispatches recognized commands directly into the active agent runtime |
| **Speech Output (TTS)** | Silent; text insertion only | Synthesizes spoken agent responses using browser SpeechSynthesis |
| **IPC Isolation** | `broadcastToSynapse: false` prevents triggering overlay window or auto-dispatch | Broadcasts `synapse:transcription` across windows for unified overlay presence |
| **STT Model Source** | Shared local model catalog (`~/.krypton/models/ggml-tiny-q8_0.bin`) | Shared local model catalog (`~/.krypton/models/ggml-tiny-q8_0.bin`) |
| **Network Dependency** | 100% Offline; Web Audio PCM buffers processed locally | 100% Offline; Web Audio PCM buffers processed locally |

### User Workflow Guide:
- **When to use Inline Chat Dictation**: Click the chatbar microphone when you want to speak your prompt, inspect or edit the recognized text, attach additional files/context chips, and manually hit `Enter` or click the dispatch button.
- **When to use Krypton Synapse**: Press `Ctrl+Shift+Space` when working across external applications (IDE, browser, terminal) and you need hands-free steering, agent switching (`@CoderBot`, `@TesterBot`), and immediate autonomous task execution.

