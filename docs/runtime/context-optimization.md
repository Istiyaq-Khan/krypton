# Context Optimization & Output Offloading

This document details large tool output masking, disk offloading, and dynamic context compaction in **Krypton** to prevent LLM context-window exhaustion.

---

## 1. Context Window Exhaustion Defense

Autonomous desktop agents frequently execute commands that produce massive stdout payloads (e.g. `npm install`, build logs, compiler outputs, or web scrape HTML). Unconstrained, these payloads flood the LLM prompt context, triggering context overflow, performance degradation, and token budget exhaustion.

Krypton employs a two-tier defense mechanism:
1. **Observation Offloader**: Intercepts tool outputs exceeding 1,500 tokens (~6KB).
2. **Context Compactor**: Condenses conversation history when utilization reaches 90%.

---

## 2. Tool Observation Masking (`offloader.ts`)

When a tool or command execution finishes:

```
[Tool Returns Output]
          │
     Is length > 1,500 tokens (~6KB)?
          │
    ┌─────┴─────┐
    │           │
   YES          NO
    │           │
    │           └─► Pass raw output directly into prompt context
    ▼
[Persist Raw Log to Disk]
Path: ~/.krypton/cache/outputs/run_step_<id>.log
    │
    ▼
[Generate Masked Summary]
  - Head: First 25 lines of output
  - Metadata: Total lines, byte size, disk file path
  - Tail: Last 25 lines of output (critical error stack traces)
    │
    ▼
[Inject Masked Summary into Prompt Context]
```

### Injected Context Payload Example:
```
[TOOL OUTPUT TRUNCATED - EXCEEDED 1,500 TOKENS]
File: ~/.krypton/cache/outputs/run_step_abc123.log
Total Lines: 4,820 | Size: 184.2 KB

--- HEAD (Lines 1-25) ---
... initial compile output ...

--- [4,770 lines omitted - available in log file] ---

--- TAIL (Lines 4795-4820) ---
error TS2304: Cannot find name 'ConfigSchema'.
Found 1 error in packages/shared-types/src/config.ts:42
```

---

## 3. Dynamic Context Compaction (`condenser.ts`)

Before every model generation cycle, Krypton computes current token utilization against the active model's context ceiling (e.g. 128k or 200k tokens):

- **Threshold**: When prompt token utilization exceeds **90%**, compaction triggers automatically.
- **Distillation Process**:
  1. The condenser synthesizes a compact checkpoint summarizing the original user objective, current task progress, and active Git diff references.
  2. Discards intermediate conversational banter, stale tool calls, and superseded file readings.
  3. Replaces the message history with the distilled state checkpoint turn, reducing prompt size by 70–80% without losing task continuity.
