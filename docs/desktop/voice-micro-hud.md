# Voice Micro-HUD & Global Overlay

This document covers the floating Voice Micro-HUD, global operating system shortcut listeners, real-time speech transcription, and overlay window positioning in **Krypton**.

---

## 1. Floating Window Architecture

The Voice Micro-HUD operates as a secondary, always-on-top desktop overlay:

```
┌────────────────────────────────────────────────────────┐
│  [● MIC]  | |ı|ı||ı|ı|  "Build a landing page"  [@Orch]│
└────────────────────────────────────────────────────────┘
```

### Tauri Window Configuration (`tauri.conf.json`)
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

### Key Window Properties:
- **Transparent Background**: Renders cleanly on top of code editors, browsers, and terminal windows with no opaque rectangular bounds.
- **Skip Taskbar**: Does not clutter the OS taskbar or dock; acts as a transient system utility like Spotlight or Raycast.
- **Dynamic Positioning**: Centered dynamically on the monitor where the cursor currently resides (`center_overlay`).

---

## 2. Global Hotkey Management (`hotkey.rs`)

Krypton registers a system-wide global shortcut to summon and dismiss the Voice Micro-HUD instantly:
- **Default Shortcut**: `CommandOrControl+Shift+Space`.
- **Customizable**: Configurable via `~/.krypton/config.json` (`hotkey` property).
- **Behavior**:
  - If overlay is hidden: Shows the window, focuses input, and engages microphone capture.
  - If overlay is visible: Hides the window and halts audio capture.

---

## 3. Real-Time Audio Capture & Transcription (`audio.rs`)

The audio pipeline bridges native microphone recording to high-speed transcription engines:

### 1. Native Audio Stream (`cpal`)
- Rust captures audio input from the default input device at 16kHz mono.
- Employs a ring buffer to stream audio chunks without blocking the UI thread.

### 2. Speech-to-Text (STT) Processing
- **Local Engine (Zero-Latency)**: High-efficiency local inference via Whisper.cpp / Parakeet v3 running natively on the host CPU/GPU.
- **Cloud Fallback**: Optional toggle to fast cloud transcription endpoints (Groq / OpenAI Whisper) for low-power host machines.

### 3. Dispatch & Mid-Flight Steering
Once speech transcription stabilizes, the text instruction is either:
1. Dispatched as a new primary objective to the chosen target agent.
2. Injected into the **Mid-Flight Steering Queue** (`Buffer B`) of an actively executing agent task, redirecting behavior dynamically without restarting.
