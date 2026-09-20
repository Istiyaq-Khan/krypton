import { useState, useRef, useEffect, useCallback } from "react"
import { SynapseAudioPipeline } from "@/lib/synapse/audioPipeline"

export interface StagedContextItem {
  id: string
  name: string
  category: "file" | "folder" | "snippet" | "mcp" | "skill"
  path?: string
  rawContent?: string
  metadata?: {
    lineCount?: number
    byteSize?: number
    mcpServer?: string
    language?: string
  }
}

export interface KryptonChatPayload {
  turnId: string
  prompt: string
  context: StagedContextItem[]
  runtimeConfig: {
    model: string
    agentName?: string
    enableWebSearch: boolean
  }
  dispatchedAt: number
}

export interface CommandItem {
  id: string
  label: string
  description: string
  type: "tool" | "context"
  category: "mcp" | "skill" | "file" | "folder"
  iconName: string
  detail?: string
}

export const AVAILABLE_TOOLS: CommandItem[] = [
  {
    id: "tool-git-commit",
    label: "vcs_commit",
    description: "Generate atomic semantic commit inside current worktree",
    type: "tool",
    category: "mcp",
    iconName: "GitCommit",
    detail: "krypton-vcs",
  },
  {
    id: "tool-browser-axtree",
    label: "browser_navigate",
    description: "Navigate active page via blind accessibility tree (AXTree)",
    type: "tool",
    category: "mcp",
    iconName: "Globe",
    detail: "krypton-browser",
  },
  {
    id: "tool-ast-linter",
    label: "lint_code_ast",
    description: "Validate synthesized Python/TS against security linter",
    type: "tool",
    category: "mcp",
    iconName: "ShieldAlert",
    detail: "krypton-sandbox",
  },
  {
    id: "tool-terminal-pty",
    label: "terminal_exec",
    description: "Execute interactive shell command via PTY pool",
    type: "tool",
    category: "mcp",
    iconName: "Terminal",
    detail: "krypton-pty",
  },
]

export const AVAILABLE_CONTEXT: CommandItem[] = [
  {
    id: "ctx-agents-md",
    label: "AGENTS.md",
    description: "Root agent permissions, recursion boundaries & caps",
    type: "context",
    category: "file",
    iconName: "FileCode",
    detail: "182 lines · 8.4 KB",
  },
  {
    id: "ctx-soul-md",
    label: "SOUL.md",
    description: "Immutable behavioral guidelines and operating directives",
    type: "context",
    category: "file",
    iconName: "FileText",
    detail: "94 lines · 3.2 KB",
  },
  {
    id: "ctx-todo-tree",
    label: "TODO.md",
    description: "Live state of active task DAG and execution status",
    type: "context",
    category: "file",
    iconName: "CheckSquare",
    detail: "420 lines · 18.1 KB",
  },
  {
    id: "ctx-worktree",
    label: "worktrees/active",
    description: "Isolated Git worktree workspace for active coding task",
    type: "context",
    category: "folder",
    iconName: "FolderGit2",
    detail: "Git Worktree",
  },
]

export function useChatbarState(
  onSubmit?: (payload: KryptonChatPayload) => void,
  initialAgentName = "Orchestrator"
) {
  const [prompt, setPrompt] = useState("")
  const [stagedContext, setStagedContext] = useState<StagedContextItem[]>([])
  const [model, setModel] = useState("claude-3-7-sonnet")
  const [agentName, setAgentName] = useState(initialAgentName)
  const [enableWebSearch, setEnableWebSearch] = useState(false)
  const [textareaHeight, setTextareaHeight] = useState(24)
  const [isOverflowing, setIsOverflowing] = useState(false)

  // Autocomplete state
  const [activeTrigger, setActiveTrigger] = useState<"/" | "@" | null>(null)
  const [triggerQuery, setTriggerQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false)
  const [audioAmplitude, setAudioAmplitude] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const pipelineRef = useRef<SynapseAudioPipeline | null>(null)
  const basePromptRef = useRef("")

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize logic with 192px clamp
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    if (!el.value) {
      setTextareaHeight(24)
      setIsOverflowing(false)
      return
    }

    el.style.height = "auto"
    const scrollH = el.scrollHeight
    if (scrollH > 192) {
      setTextareaHeight(192)
      setIsOverflowing(true)
    } else {
      setTextareaHeight(Math.max(24, scrollH))
      setIsOverflowing(false)
    }
  }, [])

  // Smart paste ingestion heuristic (>=10 newlines OR >=300 chars)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasteText = e.clipboardData.getData("text")
      if (!pasteText) return

      const newlineCount = (pasteText.match(/\n/g) || []).length
      const charCount = pasteText.length

      if (newlineCount >= 10 || charCount >= 300) {
        e.preventDefault()

        const lines = pasteText.split("\n")
        const previewFirst = lines[0]?.trim() || "Snippet"
        const detectedLang =
          pasteText.includes("import ") || pasteText.includes("export ")
            ? "typescript"
            : pasteText.includes("def ") || pasteText.includes("class ")
            ? "python"
            : "text"

        const snippetItem: StagedContextItem = {
          id: `snippet-${Date.now()}`,
          name: previewFirst.length > 28 ? previewFirst.slice(0, 25) + "..." : previewFirst,
          category: "snippet",
          rawContent: pasteText,
          metadata: {
            lineCount: lines.length,
            byteSize: new Blob([pasteText]).size,
            language: detectedLang,
          },
        }

        setStagedContext((prev) => [...prev, snippetItem])
      }
    },
    []
  )

  // Trigger detection (/ for tools, @ for workspace context)
  const checkTriggers = useCallback((value: string, cursorPos: number) => {
    const textBeforeCursor = value.slice(0, cursorPos)
    const match = textBeforeCursor.match(/(?:^|\s)([/@])([^\s]*)$/)

    if (match && (match[1] === "/" || match[1] === "@")) {
      setActiveTrigger(match[1] as "/" | "@")
      setTriggerQuery(match[2] || "")
      setSelectedIndex(0)
    } else {
      setActiveTrigger(null)
      setTriggerQuery("")
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setPrompt(val)
    checkTriggers(val, e.target.selectionStart || 0)
    adjustHeight()
  }

  // Filtered command items
  const filteredCommands: CommandItem[] =
    activeTrigger === "/"
      ? AVAILABLE_TOOLS.filter((t) =>
          t.label.toLowerCase().includes(triggerQuery.toLowerCase())
        )
      : activeTrigger === "@"
      ? AVAILABLE_CONTEXT.filter((c) =>
          c.label.toLowerCase().includes(triggerQuery.toLowerCase())
        )
      : []

  // Commit selected command
  const commitCommand = useCallback(
    (item: CommandItem) => {
      const el = textareaRef.current
      if (!el) return

      const cursorPos = el.selectionStart || 0
      const textBeforeCursor = prompt.slice(0, cursorPos)
      const textAfterCursor = prompt.slice(cursorPos)

      // Replace the trigger word
      const updatedBefore = textBeforeCursor.replace(/(?:^|\s)([/@])[^\s]*$/, " ")
      const newPrompt = (updatedBefore + textAfterCursor).trimStart()

      setPrompt(newPrompt)
      setActiveTrigger(null)
      setTriggerQuery("")

      // Stage as context item
      const newItem: StagedContextItem = {
        id: item.id,
        name: item.label,
        category: item.type === "tool" ? "mcp" : (item.category as any),
        path: item.category === "file" ? item.label : undefined,
        metadata: {
          mcpServer: item.detail,
          lineCount: item.detail?.includes("lines")
            ? parseInt(item.detail.split(" ")[0])
            : undefined,
        },
      }

      setStagedContext((prev) => {
        if (prev.some((p) => p.id === newItem.id)) return prev
        return [...prev, newItem]
      })

      setTimeout(() => {
        if (el) {
          el.focus()
          adjustHeight()
        }
      }, 10)
    },
    [prompt, adjustHeight]
  )

  // Keyboard controls for autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeTrigger && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex(
          (prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length
        )
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        const selected = filteredCommands[selectedIndex]
        if (selected) {
          commitCommand(selected)
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setActiveTrigger(null)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitTurn()
    }
  }

  const removeContextItem = (id: string) => {
    setStagedContext((prev) => prev.filter((item) => item.id !== id))
  }

  // Audio recording toggle using Web Audio API and offline STT pipeline
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording and finalize transcription
      setIsRecording(false)
      setAudioAmplitude(0)
      if (pipelineRef.current) {
        try {
          await pipelineRef.current.stop()
        } catch (err) {
          console.warn("[Chatbar] Audio recording stop notice:", err)
        } finally {
          pipelineRef.current = null
        }
      }
    } else {
      // Start recording
      try {
        basePromptRef.current = prompt
        const pipeline = new SynapseAudioPipeline({
          engine: "whisper_gguf",
          broadcastToSynapse: false,
          onAmplitude: (amp) => setAudioAmplitude(amp),
          onTranscription: (text, isFinal) => {
            const base = basePromptRef.current
            setPrompt(base ? `${base.trimEnd()} ${text}` : text)
            if (isFinal) {
              basePromptRef.current = ""
              adjustHeight()
            }
          },
          onError: (err) => {
            console.warn("[Chatbar] Audio hardware error:", err)
            setIsRecording(false)
            setAudioAmplitude(0)
          },
        })

        pipelineRef.current = pipeline
        await pipeline.start()
        setIsRecording(true)
      } catch (err) {
        console.warn("[Chatbar] Audio hardware permission denied or unavailable:", err)
        setIsRecording(false)
        setAudioAmplitude(0)
      }
    }
  }

  // Teardown and cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipelineRef.current) {
        pipelineRef.current.stop().catch(() => {})
        pipelineRef.current = null
      }
    }
  }, [])

  // Submit turn & serialize payload
  const submitTurn = () => {
    if (!prompt.trim() && stagedContext.length === 0) return

    const payload: KryptonChatPayload = {
      turnId: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prompt: prompt.trim(),
      context: [...stagedContext],
      runtimeConfig: {
        model,
        agentName,
        enableWebSearch,
      },
      dispatchedAt: Date.now(),
    }

    if (onSubmit) {
      onSubmit(payload)
    }

    // Reset prompt and height
    setPrompt("")
    setTextareaHeight(24)
    setIsOverflowing(false)
    setActiveTrigger(null)
  }

  return {
    prompt,
    setPrompt,
    stagedContext,
    setStagedContext,
    model,
    setModel,
    agentName,
    setAgentName,
    enableWebSearch,
    setEnableWebSearch,
    textareaHeight,
    isOverflowing,
    textareaRef,
    handleInputChange,
    handlePaste,
    handleKeyDown,
    removeContextItem,
    activeTrigger,
    filteredCommands,
    selectedIndex,
    setSelectedIndex,
    commitCommand,
    isRecording,
    audioAmplitude,
    toggleRecording,
    submitTurn,
  }
}
