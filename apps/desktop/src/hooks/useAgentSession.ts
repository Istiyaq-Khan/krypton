"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  ProjectWorkspace,
  AgentThread,
  StreamMessage,
  loadWorkstationState,
  saveWorkstationState,
  normalizeWorkspacePath,
  ToolExecutionEvent,
  ThoughtTrace,
  ApprovalGate,
} from "@/lib/persistence"
import {
  DiscoveredModel,
  loadCachedModels,
  persistCachedModels,
  getActiveProviderConfig,
  testAndFetchModels,
  ModelProviderId,
} from "@/lib/modelDiscovery"
import { generateDynamicResponse } from "@/lib/dynamicInference"

export { type ProjectWorkspace, type AgentThread, type StreamMessage, type ToolExecutionEvent, type ThoughtTrace, type DiscoveredModel }

export function useAgentSession() {
  // Load persistent state
  const [initialLoaded, setInitialLoaded] = useState(false)
  const [projects, setProjects] = useState<ProjectWorkspace[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>("")
  const [activeThreadId, setActiveThreadId] = useState<string>("")
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false)
  const [rightDrawerTab, setRightDrawerTab] = useState<"dag" | "audit" | "diff" | "fleet">("dag")
  const [askForApproval, setAskForApproval] = useState(true)
  const [selectedModel, setSelectedModel] = useState("5.6 Terra High")
  const [activeAgentName, setActiveAgentName] = useState("Orchestrator")

  // Refs to avoid stale closures in WebSocket event listeners
  const activeProjectIdRef = useRef<string>(activeProjectId)
  const activeThreadIdRef = useRef<string>(activeThreadId)
  const activeAgentMsgIdRef = useRef<string>("")

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId
  }, [activeProjectId])

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId
  }, [activeThreadId])

  // Discovered / Cached models state
  const [availableModels, setAvailableModels] = useState<DiscoveredModel[]>([])
  const [activeProvider, setActiveProvider] = useState<string>("openai")
  const [isRefreshingModels, setIsRefreshingModels] = useState(false)
  const [refreshModelsError, setRefreshModelsError] = useState<string | null>(null)

  // Navigation history tracking for titlebar Back/Forward controls
  const [navHistory, setNavHistory] = useState<Array<{ projectId: string; threadId: string }>>([])
  const [navHistoryIndex, setNavHistoryIndex] = useState(-1)
  const isNavigatingHistory = useRef(false)

  // Real-time streaming status
  const [isStreaming, setIsStreaming] = useState(false)
  const [latestAssistantText, setLatestAssistantText] = useState("")
  const activeWsRef = useRef<WebSocket | null>(null)

  // Initialize from persistent storage on mount
  useEffect(() => {
    const saved = loadWorkstationState()
    setProjects(saved.projects)
    const initialProjId = saved.activeProjectId || saved.projects[0]?.id || ""
    const initialThreadId = saved.activeThreadId || saved.projects[0]?.activeThreadId || ""
    setActiveProjectId(initialProjId)
    setActiveThreadId(initialThreadId)
    setSelectedModel(saved.selectedModel || "5.6 Terra High")
    setAskForApproval(saved.askForApproval ?? true)
    setInitialLoaded(true)

    if (initialProjId) {
      setNavHistory([{ projectId: initialProjId, threadId: initialThreadId }])
      setNavHistoryIndex(0)
    }

    // Load cached models and provider settings from local store
    async function loadModelsAndProvider() {
      const cached = await loadCachedModels()
      if (cached && cached.models && cached.models.length > 0) {
        setAvailableModels(cached.models)
        if (cached.provider) {
          setActiveProvider(cached.provider)
        }
      }

      const provCfg = await getActiveProviderConfig()
      if (provCfg && provCfg.provider) {
        setActiveProvider(provCfg.provider)
        if (provCfg.model && (!cached || cached.models.length === 0)) {
          setSelectedModel(provCfg.model)
        }
      }
    }

    loadModelsAndProvider()
  }, [])

  // In-app refresh models routine querying provider endpoint
  const refreshModels = useCallback(async (): Promise<{
    success: boolean
    models?: DiscoveredModel[]
    error?: string
  }> => {
    setIsRefreshingModels(true)
    setRefreshModelsError(null)

    try {
      const provCfg = await getActiveProviderConfig()
      const provider = (provCfg?.provider || activeProvider || "openai") as ModelProviderId
      const apiKey = provCfg?.apiKey
      const baseUrl = provCfg?.baseUrl

      const res = await testAndFetchModels({
        provider,
        apiKey,
        baseUrl,
      })

      setIsRefreshingModels(false)
      if (res.success && res.models.length > 0) {
        setAvailableModels(res.models)
        await persistCachedModels({
          provider,
          baseUrl,
          models: res.models,
          updatedAt: Date.now(),
        })
        return { success: true, models: res.models }
      } else {
        const err = res.error || "Failed to refresh models."
        setRefreshModelsError(err)
        return { success: false, error: err }
      }
    } catch (err: any) {
      setIsRefreshingModels(false)
      const errStr = String(err?.message || err)
      setRefreshModelsError(errStr)
      return { success: false, error: errStr }
    }
  }, [activeProvider])

  // Auto-persist changes whenever projects or active thread changes
  useEffect(() => {
    if (!initialLoaded) return
    const currentState = loadWorkstationState()
    saveWorkstationState({
      ...currentState,
      projects,
      activeProjectId,
      activeThreadId,
      selectedModel,
      askForApproval,
    })
  }, [projects, activeProjectId, activeThreadId, selectedModel, askForApproval, initialLoaded])

  // Process incoming WebSocket packet from daemon
  const handleDaemonPacket = useCallback((packet: any) => {
    if (!packet || typeof packet !== "object") return
    const currentProjId = activeProjectIdRef.current
    const currentThreadId = activeThreadIdRef.current
    const currentMsgId = activeAgentMsgIdRef.current

    if (packet.type === "token_stream") {
      setLatestAssistantText((prev) => prev + (packet.delta || ""))
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== currentProjId) return proj
          return {
            ...proj,
            threads: proj.threads.map((t) => {
              if (t.id !== currentThreadId) return t
              return {
                ...t,
                messages: t.messages.map((m) =>
                  m.id === currentMsgId
                    ? { ...m, assistantText: (m.assistantText || "") + (packet.delta || "") }
                    : m
                ),
              }
            }),
          }
        })
      )
      if (packet.isComplete) {
        setIsStreaming(false)
        setProjects((prev) =>
          prev.map((proj) => {
            if (proj.id !== currentProjId) return proj
            return {
              ...proj,
              threads: proj.threads.map((t) => {
                if (t.id !== currentThreadId) return t
                const hasPendingApproval = t.messages.some(
                  (m) => m.approvalGate && m.approvalGate.status === "pending"
                )
                return {
                  ...t,
                  status: hasPendingApproval ? "running" : "completed",
                }
              }),
            }
          })
        )
      }
    } else if (packet.type === "tool_approval_requested" && packet.approval) {
      const gate: ApprovalGate = {
        id: packet.approval.id,
        taskId: packet.approval.taskId,
        agentId: packet.approval.agentId,
        agentName: packet.approval.agentName,
        type: packet.approval.type,
        title: packet.approval.title,
        description: packet.approval.description,
        command: packet.approval.command,
        diff: packet.approval.diff,
        status: "pending",
        timestamp: packet.approval.timestamp || Date.now(),
      }

      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== currentProjId) return proj
          return {
            ...proj,
            threads: proj.threads.map((t) => {
              if (t.id !== currentThreadId) return t
              return {
                ...t,
                status: "running",
                messages: t.messages.map((m) =>
                  m.id === currentMsgId ? { ...m, approvalGate: gate } : m
                ),
              }
            }),
          }
        })
      )
    } else if (packet.type === "tool_execution" && packet.tool) {
      const toolEvent: ToolExecutionEvent = {
        id: packet.tool.id,
        type: packet.tool.type,
        title: packet.tool.title,
        subtitle: packet.tool.subtitle,
        durationMs: packet.tool.durationMs || 100,
        status: packet.tool.status || "success",
        stdout: packet.tool.stdout,
        exitCode: packet.tool.exitCode ?? 0,
        command: packet.tool.command,
      }

      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== currentProjId) return proj
          return {
            ...proj,
            threads: proj.threads.map((t) => {
              if (t.id !== currentThreadId) return t
              return {
                ...t,
                messages: t.messages.map((m) => {
                  if (m.id !== currentMsgId) return m
                  const existing = m.toolExecutions || []
                  return {
                    ...m,
                    toolExecutions: [...existing, toolEvent],
                  }
                }),
              }
            }),
          }
        })
      )
    } else if (packet.type === "agent_log" && packet.message) {
      const logText = packet.message
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== currentProjId) return proj
          return {
            ...proj,
            threads: proj.threads.map((t) => {
              if (t.id !== currentThreadId) return t
              return {
                ...t,
                messages: t.messages.map((m) => {
                  if (m.id !== currentMsgId || !m.thoughtTrace) return m
                  const newStep = {
                    title: logText.length > 50 ? logText.slice(0, 47) + "..." : logText,
                    detail: logText,
                    timestamp: packet.timestamp || Date.now(),
                    status: logText.includes("complete") ? ("done" as const) : ("in_progress" as const),
                  }
                  return {
                    ...m,
                    thoughtTrace: {
                      ...m.thoughtTrace,
                      steps: [...m.thoughtTrace.steps.slice(-3), newStep],
                    },
                  }
                }),
              }
            }),
          }
        })
      )
    }
  }, [])

  // Establish WebSocket connection to local daemon runtime on port 19840
  useEffect(() => {
    if (typeof window === "undefined") return

    let socket: WebSocket | null = null
    let reconnectTimer: any = null

    function connectWs() {
      try {
        socket = new WebSocket("ws://127.0.0.1:19840")
        activeWsRef.current = socket

        socket.onopen = () => {
          console.log("⚡ Connected to Krypton Daemon WebSocket stream")
        }

        socket.onmessage = (event) => {
          try {
            const packet = JSON.parse(event.data)
            handleDaemonPacket(packet)
          } catch {
            // non-json frame
          }
        }

        socket.onclose = () => {
          activeWsRef.current = null
          reconnectTimer = setTimeout(connectWs, 3000)
        }

        socket.onerror = () => {
          socket?.close()
        }
      } catch {
        reconnectTimer = setTimeout(connectWs, 3000)
      }
    }

    connectWs()

    return () => {
      clearTimeout(reconnectTimer)
      if (socket) {
        socket.onclose = null
        socket.close()
      }
    }
  }, [handleDaemonPacket])

  // Active project calculation (clean null when unpopulated)
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null
  }, [projects, activeProjectId])

  // Active thread calculation
  const activeThread = useMemo(() => {
    if (!activeProject) return null
    return activeProject.threads.find((t) => t.id === activeThreadId) || activeProject.threads[0] || null
  }, [activeProject, activeThreadId])

  // Push new state into navigation history stack
  const pushHistory = useCallback((projId: string, threadId: string) => {
    if (isNavigatingHistory.current) {
      isNavigatingHistory.current = false
      return
    }
    setNavHistory((prev) => {
      const next = prev.slice(0, navHistoryIndex + 1)
      next.push({ projectId: projId, threadId })
      return next
    })
    setNavHistoryIndex((prev) => prev + 1)
  }, [navHistoryIndex])

  const canGoBack = navHistoryIndex > 0
  const canGoForward = navHistoryIndex >= 0 && navHistoryIndex < navHistory.length - 1

  const goBack = useCallback(() => {
    if (navHistoryIndex > 0) {
      const target = navHistory[navHistoryIndex - 1]
      isNavigatingHistory.current = true
      setNavHistoryIndex(navHistoryIndex - 1)
      setActiveProjectId(target.projectId)
      setActiveThreadId(target.threadId)
    }
  }, [navHistory, navHistoryIndex])

  const goForward = useCallback(() => {
    if (navHistoryIndex < navHistory.length - 1) {
      const target = navHistory[navHistoryIndex + 1]
      isNavigatingHistory.current = true
      setNavHistoryIndex(navHistoryIndex + 1)
      setActiveProjectId(target.projectId)
      setActiveThreadId(target.threadId)
    }
  }, [navHistory, navHistoryIndex])

  // Switch active project by ID or normalized path
  const selectProject = useCallback(
    (projectIdOrPath: string) => {
      const rawTarget = projectIdOrPath.trim()
      if (!rawTarget) return

      const normTarget = normalizeWorkspacePath(rawTarget)
      const proj = projects.find(
        (p) =>
          p.id === rawTarget ||
          (normTarget && normalizeWorkspacePath(p.path) === normTarget) ||
          p.name === rawTarget
      )
      if (!proj) return

      setActiveProjectId(proj.id)
      const nextThreadId =
        proj.activeThreadId && proj.threads.some((t) => t.id === proj.activeThreadId)
          ? proj.activeThreadId
          : proj.threads[0]?.id || ""
      setActiveThreadId(nextThreadId)
      pushHistory(proj.id, nextThreadId)
    },
    [projects, pushHistory]
  )

  // Select a specific thread
  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    pushHistory(activeProjectId, threadId)
  }, [activeProjectId, pushHistory])

  // Create a new blank chat session
  const createNewChat = useCallback(() => {
    const newThreadId = `thread-${Date.now()}`
    const newThread: AgentThread = {
      id: newThreadId,
      projectId: activeProjectId,
      title: "New Autonomous Session",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "idle",
      messages: [],
    }

    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id === activeProjectId) {
          return {
            ...proj,
            activeThreadId: newThreadId,
            threads: [newThread, ...proj.threads],
          }
        }
        return proj
      })
    )
    setActiveThreadId(newThreadId)
    pushHistory(activeProjectId, newThreadId)
  }, [activeProjectId, pushHistory])

  // Create or switch to an existing project workspace (strictly idempotent)
  const createProject = useCallback(
    (name: string, path: string, branch = "main") => {
      const trimmedName = name.trim()
      const trimmedPath = path.trim() || trimmedName
      if (!trimmedName && !trimmedPath) return null

      const normTarget = normalizeWorkspacePath(trimmedPath)

      // 1. Guard against existing workspace by path or ID/name
      const existing = projects.find(
        (p) =>
          (normTarget && normalizeWorkspacePath(p.path) === normTarget) ||
          p.id === trimmedPath ||
          p.id === trimmedName ||
          p.name.toLowerCase() === trimmedName.toLowerCase()
      )

      if (existing) {
        // Workspace already exists: activate it idempotently without mutating or expanding array
        setActiveProjectId(existing.id)
        const targetThreadId =
          existing.activeThreadId && existing.threads.some((t) => t.id === existing.activeThreadId)
            ? existing.activeThreadId
            : existing.threads[0]?.id || ""
        setActiveThreadId(targetThreadId)
        pushHistory(existing.id, targetThreadId)
        return existing
      }

      // 2. Workspace does not exist: create unique new project workspace
      const newProjId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      const initialThreadId = `thread-${Date.now()}`
      const newProj: ProjectWorkspace = {
        id: newProjId,
        name: trimmedName || trimmedPath,
        path: trimmedPath,
        branch,
        activeThreadId: initialThreadId,
        threads: [
          {
            id: initialThreadId,
            projectId: newProjId,
            title: "Initial Session",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: "idle",
            messages: [],
          },
        ],
      }

      setProjects((prev) => {
        // Atomic functional check to prevent race conditions from concurrent calls
        const alreadyInState = prev.some(
          (p) =>
            (normTarget && normalizeWorkspacePath(p.path) === normTarget) ||
            p.id === newProjId ||
            p.id === trimmedPath
        )
        if (alreadyInState) return prev
        return [newProj, ...prev]
      })

      setActiveProjectId(newProjId)
      setActiveThreadId(initialThreadId)
      pushHistory(newProjId, initialThreadId)
      return newProj
    },
    [projects, pushHistory]
  )

  // Delete a thread
  const deleteThread = useCallback((threadId: string) => {
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== activeProjectId) return proj
        const remaining = proj.threads.filter((t) => t.id !== threadId)
        return {
          ...proj,
          threads: remaining,
          activeThreadId: remaining[0]?.id || "",
        }
      })
    )
  }, [activeProjectId])

  // Submit user prompt & execute real streaming pipeline
  const submitPrompt = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim()
      if (!trimmed) return

      const userMsgId = `msg-u-${Date.now()}`
      const agentMsgId = `msg-a-${Date.now()}`
      const startTime = Date.now()

      activeAgentMsgIdRef.current = agentMsgId

      const userMsg: StreamMessage = {
        id: userMsgId,
        sender: "user",
        timestamp: startTime,
        prompt: trimmed,
      }

      const initialAgentMsg: StreamMessage = {
        id: agentMsgId,
        sender: "agent",
        timestamp: startTime,
        thoughtTrace: {
          id: `trace-${Date.now()}`,
          durationFormatted: "Analyzing...",
          durationSeconds: 0,
          steps: [
            {
              title: "Decomposing objective into topological task DAG",
              detail: `Objective: "${trimmed.slice(0, 56)}"`,
              timestamp: startTime,
              status: "in_progress",
            },
          ],
        },
        assistantText: "",
      }

      setIsStreaming(true)
      setLatestAssistantText("")

      // Extract conversation history from active thread
      const activeProj = projects.find((p) => p.id === activeProjectId)
      const currentThread = activeProj?.threads.find((t) => t.id === activeThreadId)
      const conversationHistory = (currentThread?.messages || []).slice(-10).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.prompt || m.assistantText || "",
      }))

      // Append messages to active thread
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== activeProjectId) return proj

          let currentThreads = [...proj.threads]
          let thread = currentThreads.find((t) => t.id === activeThreadId)

          if (!thread) {
            const firstTitle = trimmed.length > 34 ? trimmed.slice(0, 34) + "..." : trimmed
            thread = {
              id: activeThreadId || `thread-${Date.now()}`,
              projectId: activeProjectId,
              title: firstTitle,
              createdAt: startTime,
              updatedAt: startTime,
              status: "running",
              messages: [userMsg, initialAgentMsg],
            }
            currentThreads.unshift(thread)
          } else {
            const title =
              thread.title === "New Autonomous Session" || thread.title === "Initial Session"
                ? trimmed.length > 34 ? trimmed.slice(0, 34) + "..." : trimmed
                : thread.title

            currentThreads = currentThreads.map((t) =>
              t.id === thread!.id
                ? {
                    ...t,
                    title,
                    updatedAt: startTime,
                    status: "running" as const,
                    messages: [...t.messages, userMsg, initialAgentMsg],
                  }
                : t
            )
          }

          return { ...proj, threads: currentThreads }
        })
      )

      // Forward to Tauri native IPC if running inside Tauri
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("submit_chat_turn", {
            payload: {
              turnId: `turn-${Date.now()}`,
              prompt: trimmed,
              context: [],
              runtimeConfig: {
                model: selectedModel,
                enableWebSearch: false,
              },
              dispatchedAt: Date.now(),
            },
          })
        } catch (err) {
          console.warn("Tauri submit_chat_turn notification:", err)
        }
      }

      // Forward to Daemon WebSocket if connected
      if (activeWsRef.current && activeWsRef.current.readyState === WebSocket.OPEN) {
        activeWsRef.current.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "startTask",
            params: {
              prompt: trimmed,
              agentName: activeAgentName || "Orchestrator",
              model: selectedModel,
              provider: activeProvider,
              workspacePath: activeProject?.path || "",
              conversationHistory,
              askForApproval,
            },
          })
        )
      } else {
        // Disconnected fallback: generate dynamic contextual response without mock canned AST
        const dynamicResponse = generateDynamicResponse(trimmed, activeAgentName, selectedModel, activeProject?.path)
        const words = dynamicResponse.split(" ")
        let accumulatedText = ""
        for (let i = 0; i < words.length; i++) {
          await new Promise((r) => setTimeout(r, 20))
          accumulatedText += (i === 0 ? "" : " ") + words[i]
          const currentAccum = accumulatedText

          setProjects((prev) =>
            prev.map((proj) => {
              if (proj.id !== activeProjectIdRef.current) return proj
              return {
                ...proj,
                threads: proj.threads.map((t) => {
                  if (t.id !== activeThreadIdRef.current) return t
                  return {
                    ...t,
                    messages: t.messages.map((m) =>
                      m.id === agentMsgId ? { ...m, assistantText: currentAccum } : m
                    ),
                  }
                }),
              }
            })
          )
        }
        setIsStreaming(false)
        setProjects((prev) =>
          prev.map((proj) => {
            if (proj.id !== activeProjectIdRef.current) return proj
            return {
              ...proj,
              threads: proj.threads.map((t) => {
                if (t.id !== activeThreadIdRef.current) return t
                return { ...t, status: "completed" }
              }),
            }
          })
        )
      }
    },
    [activeProjectId, activeThreadId, selectedModel, activeProvider, activeAgentName, askForApproval, activeProject, projects]
  )

  // Resolve an approval gate in a message and wire back to daemon
  const resolveMessageApproval = useCallback(
    (messageId: string, approved: boolean) => {
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== activeProjectId) return proj
          return {
            ...proj,
            threads: proj.threads.map((t) => {
              if (t.id !== activeThreadId) return t
              const targetMsg = t.messages.find((m) => m.id === messageId)
              const approvalId = targetMsg?.approvalGate?.id

              // Wire approval/rejection action back to daemon's paused execution promise
              if (approvalId && activeWsRef.current && activeWsRef.current.readyState === WebSocket.OPEN) {
                activeWsRef.current.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: Date.now(),
                    method: "resolveApproval",
                    params: {
                      approvalId,
                      approved,
                    },
                  })
                )
              }

              return {
                ...t,
                status: "completed",
                messages: t.messages.map((m) => {
                  if (m.id !== messageId || !m.approvalGate) return m
                  return {
                    ...m,
                    approvalGate: {
                      ...m.approvalGate,
                      status: approved ? "approved" : "rejected",
                    },
                  }
                }),
              }
            }),
          }
        })
      )
    },
    [activeProjectId, activeThreadId]
  )

  return {
    projects,
    activeProject,
    activeThread,
    activeProjectId,
    activeThreadId,
    selectProject,
    selectThread,
    createNewChat,
    createProject,
    deleteThread,
    submitPrompt,
    resolveMessageApproval,
    isLeftSidebarOpen,
    setIsLeftSidebarOpen,
    isRightDrawerOpen,
    setIsRightDrawerOpen,
    rightDrawerTab,
    setRightDrawerTab,
    askForApproval,
    setAskForApproval,
    selectedModel,
    setSelectedModel,
    availableModels,
    setAvailableModels,
    activeProvider,
    isRefreshingModels,
    refreshModelsError,
    refreshModels,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    isStreaming,
    latestAssistantText,
    activeAgentName,
    setActiveAgentName,
  }
}

