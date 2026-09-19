# Voice Micro-HUD & Floating Interactive Pill Architecture

This document details the floating **Voice Micro-HUD**, global operating system shortcut listeners, real-time speech transcription (VTT) engines, multi-click gesture arbiter, and overlay window positioning in **Krypton**.

---

## 1. Floating Interactive Pill Layout

The Voice Micro-HUD operates as a decoupled, top-level, free-floating interactive pill overlay:

```
┌────────────────────────────────────────────────────────────────────────┐
│  (● Orb)  │  [@ Orchestrator ▾]  │  "Deploy new service..." [↺] [↑]   │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Anatomy:
1. **Animated Orb (Left)**:
   - **Organic Dynamic Visualizer**: Canvas-based animated orb with ambient radial glow, counter-rotating orbital rings, and audio-reactive particle aura.
   - **State Color Palette**:
     - `idle`: Ambient violet aura (`rgb(168, 85, 247)`)
     - `listening`: Vibrant emerald glow (`rgb(16, 185, 129)`) with live audio frequency reaction
     - `thinking`: Electric blue spinning orbits (`rgb(59, 130, 246)`)
     - `speaking`: Rose pink pulse (`rgb(236, 72, 153)`) with synthesized speech readout
     - `error`: Rose red diagnostic warning (`rgb(244, 63, 94)`)
   - **Multi-Click Gesture Arbiter**:
     - **Single Click**: Toggle recording / push-to-talk listening state.
     - **Double Click**: Collapse/compress the HUD into compact circular orb-only mode. Double-clicking again expands it back to the full pill.
     - **Triple Click**: Trigger smooth SVG/CSS exit dismiss animation (`opacity-0 scale-75`) and close/hide the Voice HUD.

2. **Agent Selector Button (Middle)**:
   - Displays the active agent persona name (`[Orchestrator]`, `[CoderBot]`, etc.).
   - Declares `style={{ WebkitAppRegion: "no-drag" }}` and `data-tauri-drag-region="false"`.
   - Clicking opens a sleek, custom floating glassmorphism panel (not a native `<select>`) listing all configured fleet agents.
   - Selecting an agent immediately switches the active conversation context across the entire application shell.

3. **Live Transcription Display Area (Right)**:
   - Renders real-time transcription text returned by the active VTT engine.
   - **Dynamic Collapsing**: When idle and no transcription is present, this region collapses into a minimal clean idle status badge (`Idle` / `Listening`).
   - When speech is detected, smoothly expands with live streaming text, audio amplitude meter, and quick Send/Dispatch (`ArrowUp`) and Clear (`RotateCcw`) actions.

---

## 2. Free-Floating & Multi-Monitor Dragging Architecture

The Voice HUD provides seamless positioning anywhere across multi-monitor display matrices:

### Key Architectural Invariants:
1. **Top-Level Z-Index Elevation (`z-[9999]`)**: Elevated above all workstation elements, sidebars, diff viewers, and settings panels.
2. **Native Drag Region Integration**: Container declares `style={{ WebkitAppRegion: "drag" }}` and `data-tauri-drag-region="true"`, allowing Tauri to delegate window movement to native OS window managers without boundary clipping.
3. **Fluid Multi-Monitor Tracking**: In web and app workstation modes, pointer move listeners run at window scope without rigid boundary clamping, preventing the HUD from getting trapped or locked at display borders.
4. **Pointer Event Isolation**: All interactive buttons, inputs, and dropdown panels declare `style={{ WebkitAppRegion: "no-drag" }}` and `data-tauri-drag-region="false"`.

---

## 3. Synchronized Toggle Architecture

Krypton unifies all Voice HUD invocation entry points into a single synchronized handler:

```
[ Window Header: Logo Menu ] ──┐
[ Window Header: View Menu ] ──┼──▶ toggleVoiceHud() ──▶ [ Toggles isVoiceAgentVisible ]
[ Chatbar Microphone Button ] ─┤                       └─▶ [ Invokes Tauri toggle_overlay ]
[ Hotkey: Ctrl+Shift+Space ] ──┘
```

- **Chatbar Microphone Button**: Clicking the mic button in the bottom command context bar immediately toggles the Voice HUD instance.
- **Top Menu**: Selecting `Krypton -> Toggle Voice Micro-HUD` or `View -> Toggle Voice Micro-HUD` toggles the same HUD instance.
- **Global Shortcut**: `Ctrl+Shift+Space` (or `Cmd+Shift+Space` on macOS) invokes the same unified toggle routine.

---

## 4. Voice-To-Text (VTT) Engine Architectures

Krypton supports multiple decoupled speech transcription architectures, configured during onboarding or in Krypton Settings:

| Engine Identifier | Architecture | Latency / Environment | Execution Mechanics |
| :--- | :--- | :--- | :--- |
| **`whisper_local`** | Encoder-Decoder Autoregressive | Zero-latency local host (CPU/GPU) | Whisper.cpp / ONNX runtime with Mel-spectrogram processing and language tokens. |
| **`nvidia/parakeet-tdt-0.6b-v3`** | Fast Conformer RNN-T / TDT | Ultra-low latency streaming | NeMo / Sherpa-ONNX 0.6B streaming conformer transducer with joint network decoding. |
| **`whisper_api`** | Cloud REST API | High-accuracy cloud endpoint | OpenAI-compatible Audio Transcriptions multipart form-data endpoint (`/v1/audio/transcriptions`). |
| **`custom`** | User-Configured Endpoint | Remote / Self-Hosted | Connects to custom speech recognition servers via configurable base URL and optional token. |

---

## 5. Overlay Window Configuration (`tauri.conf.json`)

```json
{
  "label": "overlay",
  "title": "Krypton Voice HUD",
  "url": "/overlay",
  "width": 640,
  "height": 130,
  "resizable": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "center": true,
  "visible": false
}
```

The secondary transparent Tauri window mounts the unified `FloatingVoiceAgent` pill, providing a consistent HUD experience across both desktop and web workstation environments.
