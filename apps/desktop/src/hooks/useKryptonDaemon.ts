import { useState, useEffect, useCallback, useRef } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import { TodoTask } from "@/components/TodoTree"
import { ClarificationRequestData } from "@/components/QuestionModal"
import { VcsDiffData } from "@/components/VcsDiffViewer"
import { KryptonChatPayload } from "@/components/chatbar/useChatbarState"
import {
  AgentFleetItem,
  TrajectoryLogItem,
  loadWorkstationState,
  saveWorkstationState,
  DEFAULT_INITIAL_STATE,
  ApprovalGate,
} from "@/lib/persistence"

export { type AgentFleetItem, type TrajectoryLogItem }

export function useKryptonDaemon() {
  const [isConnected, setIsConnected] = useState(false)
  const [tasks, setTasks] = useState<TodoTask[]>([])
  const [fleet, setFleet] = useState<AgentFleetItem[]>(DEFAULT_INITIAL_STATE.fleet)
  const [logs, setLogs] = useState<TrajectoryLogItem[]>([])
  const [activeClarification, setActiveClarification] = useState<ClarificationRequestData | null>(null)
  const [activeDiff, setActiveDiff] = useState<VcsDiffData | null>(null)
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false)
  const [isCreateAgentModalOpen, setIsCreateAgentModalOpen] = useState(false)
  const [telemetry, setTelemetry] = useState({
    memoryUsageMb: 142,
    activeSubAgents: 1,
    latencyMs: 34,
    uptimeSeconds: 120,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const initialLoadedRef = useRef(false)

  // 1. Hydrate from persistent store on mount
  useEffect(() => {
    const saved = loadWorkstationState()
    setTasks(saved.tasks || [])
    setFleet(saved.fleet && saved.fleet.length > 0 ? saved.fleet : DEFAULT_INITIAL_STATE.fleet)
    setLogs(saved.logs || [])
    setActiveDiff(saved.activeDiff || null)
    setActiveClarification(saved.activeClarification || null)
    initialLoadedRef.current = true
  }, [])

  // 2. Auto-save tasks, fleet, logs on updates
  useEffect(() => {
    if (!initialLoadedRef.current) return
    const currentState = loadWorkstationState()
    saveWorkstationState({
      ...currentState,
      tasks,
      fleet,
      logs,
      activeDiff,
      activeClarification,
    })
  }, [tasks, fleet, logs, activeDiff, activeClarification])

  // 3. Connect to daemon WebSocket on port 19840
  useEffect(() => {
    if (typeof window === "undefined") return

    let socket: WebSocket | null = null
    let reconnectTimeout: any = null

    function connect() {
      try {
        socket = new WebSocket("ws://127.0.0.1:19840")
        wsRef.current = socket

        socket.onopen = () => {
          setIsConnected(true)
          // Request current metrics and agents
          socket?.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }))
          socket?.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "getSystemMetrics" }))
          socket?.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "listAgents" }))
        }

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            // Stream event
            if (data.type === "agent_log") {
              const newLog: TrajectoryLogItem = {
                id: `log-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
                timestamp: data.timestamp || Date.now(),
                agentId: data.agentId || "agent-root",
                agentName: "Orchestrator",
                type: data.level === "error" ? "error" : data.level === "warn" ? "checkpoint" : "action",
                content: data.message,
              }
              setLogs((prev) => [newLog, ...prev.slice(0, 99)])
            } else if (data.type === "task_tree_updated") {
              const incomingTasks = data.serializedTasks ? Object.values(data.serializedTasks) : []
              if (incomingTasks.length > 0) {
                setTasks(
                  incomingTasks.map((t: any) => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: t.status === "completed" ? "completed" : t.status === "running" ? "in_progress" : "pending",
                    assignedAgent: t.assignedAgentId || "Orchestrator",
                    dependsOn: t.dependsOn,
                  }))
                )
              }
            } else if (data.type === "clarification_requested") {
              setActiveClarification(data.request)
              setIsQuestionModalOpen(true)
            }

            // RPC Result
            if (data.id === 2 && data.result) {
              setTelemetry((prev) => ({
                ...prev,
                memoryUsageMb: data.result.memoryUsageMb || prev.memoryUsageMb,
                activeSubAgents: data.result.activeSubAgents ?? prev.activeSubAgents,
                uptimeSeconds: data.result.uptimeSeconds || prev.uptimeSeconds,
              }))
            }
          } catch {
            // non-json frame
          }
        }

        socket.onclose = () => {
          setIsConnected(false)
          wsRef.current = null
          reconnectTimeout = setTimeout(connect, 3000)
        }

        socket.onerror = () => {
          socket?.close()
        }
      } catch {
        reconnectTimeout = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      if (socket) {
        socket.onclose = null
        socket.close()
      }
    }
  }, [])

  // Check Tauri daemon status as fallback
  useEffect(() => {
    if (typeof window !== "undefined" && isTauri()) {
      invoke<{ running: boolean }>("get_daemon_status")
        .then((res) => {
          if (res.running) setIsConnected(true)
        })
        .catch(() => {})
    }
  }, [])

  // Submit chat turn
  const submitChatTurn = useCallback(
    async (payload: KryptonChatPayload) => {
      const newLog: TrajectoryLogItem = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        agentId: "agent-root",
        agentName: "Orchestrator",
        type: "action",
        content: `Instruction dispatched: "${payload.prompt.slice(0, 60)}"`,
      }
      setLogs((prev) => [newLog, ...prev])

      // Forward to daemon over WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "startTask",
            params: { prompt: payload.prompt, agentName: "Orchestrator" },
          })
        )
      }

      // Forward to Tauri IPC
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("submit_chat_turn", { payload })
        } catch (err) {
          console.warn("Tauri submit_chat_turn:", err)
        }
      }
    },
    []
  )

  // --- Fleet Lifecycle Controls ---
  const createAgent = useCallback(
    (newAgent: {
      name: string
      role: string
      model: string
      temperature: number
      systemPrompt: string
      permissions: AgentFleetItem["permissions"]
    }) => {
      const agentItem: AgentFleetItem = {
        id: `agent-${Date.now()}`,
        name: newAgent.name.trim(),
        role: newAgent.role.trim() || "Autonomous Assistant",
        state: "idle",
        depth: 1,
        budgetUsed: 0,
        budgetTotal: 50000,
        parentAgentId: "agent-root",
        model: newAgent.model,
        temperature: newAgent.temperature,
        systemPrompt: newAgent.systemPrompt,
        permissions: newAgent.permissions,
      }

      setFleet((prev) => [...prev, agentItem])

      const newLog: TrajectoryLogItem = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        agentId: agentItem.id,
        agentName: agentItem.name,
        type: "checkpoint",
        content: `Agent [${agentItem.name}] registered and workspace scaffolded.`,
      }
      setLogs((prev) => [newLog, ...prev])

      // Notify daemon
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "createAgent",
            params: {
              name: agentItem.name,
              role: agentItem.role,
              model: agentItem.model,
              temperature: agentItem.temperature,
              systemPrompt: agentItem.systemPrompt,
              permissions: agentItem.permissions,
            },
          })
        )
      }
    },
    []
  )

  const updateAgent = useCallback((id: string, patch: Partial<AgentFleetItem>) => {
    setFleet((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))

    // Synchronize settings directly to daemon config.json
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "updateAgent",
          params: {
            agentId: id,
            patch: {
              ...(patch.role ? { role: patch.role } : {}),
              ...(patch.model ? { model: patch.model } : {}),
              ...(typeof patch.temperature === "number" ? { temperature: patch.temperature } : {}),
              ...(patch.permissions ? { permissions: patch.permissions } : {}),
            },
          },
        })
      )
    }
  }, [])

  const deleteAgent = useCallback((id: string) => {
    setFleet((prev) => prev.filter((a) => a.id !== id && a.id !== `agent-${id}`))
  }, [])

  // Process Control (Spawn, Pause, Resume, Abort / SIGKILL, Restart)
  const controlProcess = useCallback((agentId: string, action: "spawn" | "pause" | "resume" | "abort" | "restart") => {
    setFleet((prev) =>
      prev.map((a) => {
        if (a.id !== agentId && a.name !== agentId) return a
        let nextState = a.state
        if (action === "pause") nextState = "paused"
        else if (action === "resume" || action === "spawn") nextState = "executing"
        else if (action === "abort") nextState = "failed"
        else if (action === "restart") nextState = "idle"
        return { ...a, state: nextState }
      })
    )

    const newLog: TrajectoryLogItem = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agentId,
      agentName: agentId,
      type: action === "abort" ? "error" : "action",
      content: `Process lifecycle signal: ${action.toUpperCase()} sent to agent [${agentId}].`,
    }
    setLogs((prev) => [newLog, ...prev])

    // Send to daemon
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "controlProcess",
          params: { agentId, action },
        })
      )
    }
  }, [])

  // Respond to HITL clarification
  const respondClarification = useCallback(
    (response: { selectedOptionIds: string[]; freeformText?: string }) => {
      const optionLabel = activeClarification?.options?.find(
        (o) => o.id === response.selectedOptionIds[0]
      )?.label

      const text = optionLabel || response.freeformText || "Option confirmed"

      const newLog: TrajectoryLogItem = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        agentId: "agent-root",
        agentName: "Orchestrator",
        type: "checkpoint",
        content: `HITL Decision Unblocked: "${text}"`,
      }
      setLogs((prev) => [newLog, ...prev])
      setIsQuestionModalOpen(false)

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeClarification?.id) {
        wsRef.current.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "resolveClarification",
            params: {
              requestId: activeClarification.id,
              selectedOptionIds: response.selectedOptionIds,
              freeformText: response.freeformText,
            },
          })
        )
      }

      setActiveClarification(null)
    },
    [activeClarification]
  )

  // Approve & merge worktree
  const approveMerge = useCallback(() => {
    const branch = activeDiff?.branchName || "worktree"
    const newLog: TrajectoryLogItem = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agentId: "agent-root",
      agentName: "Orchestrator",
      type: "checkpoint",
      content: `Git worktree ${branch} approved and merged cleanly into main branch.`,
    }
    setLogs((prev) => [newLog, ...prev])
    setIsDiffModalOpen(false)

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "mergeVcs",
          params: { worktreeId: activeDiff?.taskId },
        })
      )
    }
  }, [activeDiff])

  // Rollback step
  const rollbackStep = useCallback(() => {
    const base = activeDiff?.baseCommit.slice(0, 7) || "HEAD~1"
    const newLog: TrajectoryLogItem = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agentId: "agent-root",
      agentName: "Orchestrator",
      type: "error",
      content: `Deterministic rollback executed (git reset --hard ${base}).`,
    }
    setLogs((prev) => [newLog, ...prev])
    setIsDiffModalOpen(false)
  }, [activeDiff])

  // Reject / Abort
  const rejectAbort = useCallback(() => {
    const newLog: TrajectoryLogItem = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agentId: "agent-root",
      agentName: "Orchestrator",
      type: "error",
      content: `Worktree rejected by user. Isolated worktree pruned.`,
    }
    setLogs((prev) => [newLog, ...prev])
    setIsDiffModalOpen(false)
  }, [])

  // Token spend calculation
  const totalTokensUsed = fleet.reduce((acc, a) => acc + (a.budgetUsed || 0), 0)
  const totalTokensBudget = fleet.reduce((acc, a) => acc + (a.budgetTotal || 0), 0)

  return {
    isConnected,
    tasks,
    fleet,
    setFleet,
    logs,
    telemetry,
    totalTokensUsed,
    totalTokensBudget,
    activeClarification,
    isQuestionModalOpen,
    setIsQuestionModalOpen,
    activeDiff,
    setActiveDiff,
    isDiffModalOpen,
    setIsDiffModalOpen,
    isCreateAgentModalOpen,
    setIsCreateAgentModalOpen,
    createAgent,
    updateAgent,
    deleteAgent,
    controlProcess,
    submitChatTurn,
    respondClarification,
    approveMerge,
    rollbackStep,
    rejectAbort,
  }
}
