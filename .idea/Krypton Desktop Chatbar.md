# RFC / Architecture Specification: Krypton Desktop Chatbar

## 1. System Intent & Mental Model
The Chatbar is an autonomous context-staging console for the Krypton agent runtime, not a static form input. It acts as an event-driven router with three responsibilities:
- **Lexical Parsing:** Intercepting keystrokes to detect command triggers (`/`) and context lookups (`@`).
- **Context Staging:** Managing an ephemeral pipeline of attached files, code snippets, and active tool bindings before execution.
- **IPC Dispatch:** Packaging normalized text and staged context into a validated payload for the Tauri/Bun background daemon.

---

## 2. Visual & Design Architecture (Nova Design Language)

### 2.1 Aesthetic Profile
- **Form Factor:** Floating, isolated pill anchored at the bottom-center of the viewport.
- **Depth & Blur:** Low-opacity dark backdrop (`zinc-900/90`) paired with hardware-accelerated blur (`backdrop-blur-xl`) and an ambient shadow layer (`shadow-2xl`).
- **Borders & Separation:** 1px perimeter border (`border-zinc-800`). Interactive states shift to `border-zinc-700` and `ring-1 ring-violet-500/30`.
- **Accent Hierarchy:** Violet (`#8B5CF6`) is reserved strictly for affirmative actions: active toggles, inline command badges, focus states, and the submission button.
- **Iconography Rule:** Strictly use `lucide-react`. The agent must NOT generate inline `<svg>` elements or mock graphics paths.

### 2.2 Structural Layout (Vertical Stacking)
The container holds three vertically stacked sub-regions:
1. **Context & Attachment Tray (Top):** Conditionally rendered when items are staged. Displays horizontally scrolling chips.
2. **Text Processing Surface (Middle):** Unbordered, transparent textarea with continuous text wrap.
3. **Action & Execution Toolbar (Bottom):** Fixed 36px bar hosting context toggles, model selector, audio visualizer, and the primary submit trigger.

---

## 3. Behavioral Engine & State Machines

### 3.1 Input Ceiling & Growth Logic
- **Base State:** 1 physical line (~24px height).
- **Expansion Rule:** Measure `scrollHeight` on every text mutation and dynamically assign `height`.
- **Max-Height Ceiling:** Hard clamp at **192px** (`max-h-48`).
- **Scroll Transition:**
  - `scrollHeight <= 192px`: Textarea expands; `overflow-y` remains `hidden`.
  - `scrollHeight > 192px`: Textarea height locks at `192px`; `overflow-y` switches to `auto`.
- **Reset Trigger:** Clearing input resets height to base single-line height immediately.

### 3.2 Smart Paste Ingestion Engine
To prevent log dumps and large files from degrading chat readability, the agent must intercept the native `onPaste` event:
- **Heuristic Evaluation:**
  - Condition A: Clipboard plain text contains $\ge 10$ newline characters (`\n`).
  - Condition B: Clipboard plain text total length $\ge 300$ characters.
- **Execution Path:**
  - If either condition is met: Cancel default paste behavior (`e.preventDefault()`).
  - Generate an in-memory snippet object containing: a unique timestamp ID, detected language/extension, total line count, and byte size.
  - Stage the snippet directly into the Attachment Tray.
  - Leave the textarea clear (or at the current cursor position).
  - If neither condition is met: Allow native paste into the cursor position.

### 3.3 Autocomplete & Trigger Parsing (`/` and `@`)
The agent must track cursor selection index (`selectionStart`) on input updates:
- **Detection Pattern:** Inspect the word directly preceding the cursor:
  - Leading `/` triggers the **Tool & Action Registry Menu**.
  - Leading `@` triggers the **Workspace & Context Menu**.
- **Menu Alignment:** Render as an absolute floating popover anchored directly above the chatbar container with `z-index: 50`.
- **Event Trapping & Keyboard Control:**
  - `ArrowDown` / `ArrowUp`: Move visual selection up and down the filtered list.
  - `Enter` / `Tab`: Commit current selection, dismiss the menu, and clear the trigger prefix from the input buffer.
  - `Escape`: Instantly close the open menu without modifying text.
- **Click-Outside Policy:** Register a root window `mousedown` listener. If a click targets an element outside the palette container, unmount the palette immediately.

### 3.4 Context Chips & Content Inspection Popovers
- **Tray Layout:** Horizontal flexbox with `overflow-x-auto` and hidden scrollbars.
- **Chip Components:** Icon corresponding to entity type (code, PDF, image, tool), truncated display label, metadata pill (e.g., `124 lines` or `4.2 KB`), and a click-to-remove button.
- **Hover Inspection Rules:**
  - Trigger: Hovering on a chip for $\ge 200\text{ms}$.
  - Real Data Mandate: For file or snippet context, render the **genuine textual content** (up to the first 10 lines) with monospace styling. **Do not fabricate or mock an "AI Summary" card.**
  - For MCP Tools or Skills, display the verified server name, registration status, and tool schema description.

### 3.5 Real-Time Voice Waveform Pipeline
Hardware access must be strictly verified before altering UI state:
- **Inactive / Idle:** Renders an idle microphone icon.
- **Click Event:** Request audio stream via `navigator.mediaDevices.getUserMedia({ audio: true })`.
- **Rejection State:** If user denies permission, log error, leave state idle, and trigger a notification. Do not display mock activity.
- **Active Streaming:**
  - Initialize Web Audio API `AudioContext` and instantiate an `AnalyserNode` with `fftSize = 32`.
  - Pipe live PCM audio to compute dynamic decibel amplitude.
  - Replace the mic icon with an active recording pill containing 4 vertical reactive bars that scale dynamically between 4px and 20px based on live volume.
  - Clicking stop terminates all media stream tracks, closes the `AudioContext`, and transitions audio data to the transcription pipeline.

---

## 4. Hardware & Backend Integration (Tauri + Bun IPC)

### 4.1 Data Transfer Schema
The chatbar output must strictly conform to this serialization schema upon form submission:

```typescript
interface KryptonChatPayload {
  turnId: string;
  prompt: string;
  context: Array<{
    id: string;
    name: string;
    category: 'file' | 'folder' | 'snippet' | 'mcp' | 'skill';
    path?: string;
    rawContent?: string;
    metadata?: {
      lineCount?: number;
      byteSize?: number;
      mcpServer?: string;
    };
  }>;
  runtimeConfig: {
    model: string;
    enableWebSearch: boolean;
  };
  dispatchedAt: number;
}

```

### 4.2 Daemon Execution Flow

1. **Frontend Dispatch:** Chatbar serializes `KryptonChatPayload` and fires the Tauri IPC command `submit_chat_turn`.
2. **Rust Core (Tauri v2):** Receives invocation, verifies payload integrity, and pipes the data across the local IPC domain socket to the Bun daemon.
3. **Bun Daemon Processing:**
* Reads staged file paths directly from the local filesystem (zero memory serialization overhead on large files).
* Binds declared MCP tools from the registry to the current LLM execution context.
* Starts streaming model responses back to the UI via Tauri window events.



---

## 5. Agent Implementation Directive

When building this component inside the codebase, follow these procedural steps:

1. **Dependency Audit:** Verify `@radix-ui` primitives, `lucide-react`, and `clsx` / `tailwind-merge` are present in `package.json`. Do not install custom icon packs.
2. **Decomposition:** Create modular sub-components under `src/components/chatbar/`:
* `AttachmentTray.tsx`: Chip container with horizontal scroll constraints.
* `HoverPreviewCard.tsx`: Floating portal rendering raw file lines or MCP schema.
* `CommandMenu.tsx`: Keyboard-navigable list for `/` and `@` symbols.
* `AudioWaveform.tsx`: Canvas or CSS bars coupled to an `AnalyserNode`.


3. **State Cohesion:** Encapsulate chatbar logic inside a custom hook (`useChatbarState`) to keep the presentation container declarative.
4. **Boundary Isolation:** Isolate keyboard handlers so `Enter` key presses inside autocomplete menus never trigger a form submission.