import { useState, useEffect, useCallback, useRef } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import { TodoTask } from "@/components/TodoTree"
import { ClarificationRequestData } from "@/components/QuestionModal"
import { VcsDiffData } from "@/components/VcsDiffViewer"
import { KryptonChatPayload } from "@/components/chatbar/useChatbarState"

export interface AgentFleetItem {
  id: string
  name: string
  role: string
  state: "idle" | "planning" | "executing" | "awaiting_input" | "verifying" | "completed" | "failed"
  depth: number
  budgetUsed: number
  budgetTotal: number
  parentAgentId?: string
}

export interface TrajectoryLogItem {
  id: string
  timestamp: number
  agentId: string
  agentName: string
  type: "action" | "tool_call" | "observation" | "checkpoint" | "error"
  content: string
  metadata?: Record<string, unknown>
}

// Initial rich demonstration data
const INITIAL_TASKS: TodoTask[] = [
  {
    id: "task-1",
    title: "Inspect target repository & scaffold isolated worktree",
    description: "Verify base commit hash and provision worktree at ~/.krypton/worktrees/task-auth-89a1",
    status: "completed",
    assignedAgent: "Orchestrator",
    durationMs: 420,
  },
  {
    id: "task-2",
    title: "Implement token authentication gateway & AST safety check",
    description: "Run AST safety linter before applying crypto middleware patches",
    status: "completed",
    assignedAgent: "CoderBot",
    dependsOn: ["task-1"],
    durationMs: 1250,
  },
  {
    id: "task-3",
    title: "Fix syntax diagnostic in auth header parser",
    description: "Pause downstream tests, inject remediation patch Task 3b into DAG",
    status: "completed",
    assignedAgent: "CoderBot",
    dependsOn: ["task-2"],
    durationMs: 650,
    isDynamicFix: true,
  },
  {
    id: "task-4",
    title: "Execute pre-completion verification test suite",
    description: "Run compiler typecheck and unit tests inside sandboxed subprocess jail",
    status: "in_progress",
    assignedAgent: "TesterBot",
    dependsOn: ["task-3"],
    durationMs: 890,
  },
  {
    id: "task-5",
    title: "Present visual diff & request human merge approval",
    description: "Human-in-the-Loop audit gate before merging krypton/task-auth-89a1 into main branch",
    status: "pending",
    assignedAgent: "Orchestrator",
    dependsOn: ["task-4"],
  },
]

const INITIAL_FLEET: AgentFleetItem[] = [
  {
    id: "agent-root",
    name: "Orchestrator",
    role: "System Orchestrator & Task Decomposer",
    state: "executing",
    depth: 0,
    budgetUsed: 14200,
    budgetTotal: 100000,
  },
  {
    id: "agent-coder",
    name: "CoderBot",
    role: "Full-Stack Actor & Tool Synthesizer",
    state: "idle",
    depth: 1,
    budgetUsed: 8400,
    budgetTotal: 30000,
    parentAgentId: "agent-root",
  },
  {
    id: "agent-tester",
    name: "TesterBot",
    role: "AST Linter & Verification Harness",
    state: "executing",
    depth: 2,
    budgetUsed: 3100,
    budgetTotal: 20000,
    parentAgentId: "agent-coder",
  },
]

const INITIAL_DIFF: VcsDiffData = {
  taskId: "task-auth-89a1",
  branchName: "krypton/task-auth-89a1",
  baseCommit: "a81fe29b3c401",
  currentCommit: "90b1ec7f14a02",
  summary: {
    filesChanged: 2,
    additions: 38,
    deletions: 7,
  },
  files: [
    {
      path: "src/auth/token_gateway.ts",
      status: "modified",
      additions: 26,
      deletions: 5,
      hunks: [
        {
          header: "@@ -12,8 +12,14 @@ export class TokenGateway {",
          lines: [
            { type: "ctx", content: "  private readonly secretKey: string;" },
            { type: "del", content: "-   return jwt.verify(token, this.secretKey);" },
            { type: "add", content: "+   const payload = jwt.verify(token, this.secretKey, { algorithms: ['HS256'] });" },
            { type: "add", content: "+   if (!payload.sub || typeof payload.sub !== 'string') {" },
            { type: "add", content: "+     throw new SecurityValidationError('Invalid token subject');" },
            { type: "add", content: "+   }" },
            { type: "ctx", content: "    return payload;" },
          ],
        },
      ],
    },
    {
      path: "src/auth/linter_rules.ts",
      status: "added",
      additions: 12,
      deletions: 2,
      hunks: [
        {
          header: "@@ -1,4 +1,8 @@",
          lines: [
            { type: "add", content: "+ export const BANNED_MODULES = ['child_process', 'os.system'];" },
            { type: "add", content: "+ export function validateAstSafety(tree: AstTree): boolean {" },
            { type: "add", content: "+   return !hasHazardousCalls(tree, BANNED_MODULES);" },
            { type: "add", content: "+ }" },
          ],
        },
      ],
    },
  ],
}

export function useKryptonDaemon() {
  const [isConnected, setIsConnected] = useState(true)
  const [tasks, setTasks] = useState<TodoTask[]>(INITIAL_TASKS)
  const [fleet, setFleet] = useState<AgentFleetItem[]>(INITIAL_FLEET)
  const [logs, setLogs] = useState<TrajectoryLogItem[]>([
    {
      id: "log-1",
      timestamp: Date.now() - 35000,
      agentId: "agent-root",
      agentName: "Orchestrator",
      type: "action",
      content: "Decomposed prompt into 5-step dynamic task DAG.",
    },
    {
      id: "log-2",
      timestamp: Date.now() - 25000,
      agentId: "agent-coder",
      agentName: "CoderBot",
      type: "tool_call",
      content: "Executed AST linter on synthesized token_gateway.ts.",
    },
    {
      id: "log-3",
      timestamp: Date.now() - 10000,
      agentId: "agent-tester",
      agentName: "TesterBot",
      type: "observation",
      content: "Unit test suite passed: 14/14 tests green.",
    },
  ])
  const [activeClarification, setActiveClarification] =
    useState<ClarificationRequestData | null>(null)
  const [activeDiff, setActiveDiff] = useState<VcsDiffData | null>(INITIAL_DIFF)
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false)

  // Check daemon status via Tauri IPC on mount if available
  useEffect(() => {
    let unmounted = false

    async function checkStatus() {
      if (typeof window !== "undefined" && isTauri()) {
        try {
          const status = await invoke<{ running: boolean }>("get_daemon_status")
          if (!unmounted) {
            setIsConnected(status.running)
          }
        } catch (err) {
          console.warn("Tauri IPC call failed, running simulated mode:", err)
        }
      }
    }

    checkStatus()
    return () => {
      unmounted = true
    }
  }, [])

  // Submit chat turn to daemon
  const submitChatTurn = useCallback(
    async (payload: KryptonChatPayload) => {
      // Add immediate log
      const newLog: TrajectoryLogItem = {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        agentId: "agent-root",
        agentName: "Orchestrator",
        type: "action",
        content: `Prompt dispatched: "${payload.prompt.slice(0, 60)}..."`,
      }
      setLogs((prev) => [newLog, ...prev])

      // Forward to Tauri backend if running inside Tauri
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("submit_chat_turn", { payload })
        } catch (err) {
          console.warn("Tauri submit_chat_turn failed:", err)
        }
      }

      // If user prompted for clarification or review, open modal in mock mode
      if (payload.prompt.toLowerCase().includes("clarif") || payload.prompt.toLowerCase().includes("choose")) {
        setTimeout(() => {
          setActiveClarification({
            id: `clarif-${Date.now()}`,
            agentId: "agent-coder",
            agentName: "CoderBot",
            prompt: "The synthesized AST linter detected an ambiguous network binding. Should we allow ephemeral localhost socket binding?",
            options: [
              { id: "opt-1", label: "Permit Localhost Only (127.0.0.1)", description: "Restricted to local loopback port", hotkeyHint: "1" },
              { id: "opt-2", label: "Deny Network Access", description: "Enforce strict offline isolation jail", hotkeyHint: "2" },
              { id: "opt-3", label: "Prompt Every Socket Bind", description: "Human-in-the-loop per socket call", hotkeyHint: "3" },
            ],
            allowFreeform: true,
          })
          setIsQuestionModalOpen(true)
        }, 600)
      }
    },
    []
  )

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
      setActiveClarification(null)
    },
    [activeClarification]
  )

  // Approve & merge worktree
  const approveMerge = useCallback(() => {
    const newLog: TrajectoryLogItem = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agentId: "agent-root",
      agentName: "Orchestrator",
      type: "checkpoint",
      content: `Git worktree ${activeDiff?.branchName} approved and merged cleanly into main branch.`,
    }
    setLogs((prev) => [newLog, ...prev])
    setIsDiffModalOpen(false)

    // Update tasks
    setTasks((prev) =>
      prev.map((t) => (t.id === "task-5" ? { ...t, status: "completed" } : t))
    )
  }, [activeDiff])

  // Rollback step
  const rollbackStep = useCallback(() => {
    const newLog: TrajectoryLogItem = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agentId: "agent-root",
      agentName: "Orchestrator",
      type: "error",
      content: `Deterministic rollback executed (git reset --hard ${activeDiff?.baseCommit.slice(0, 7)}).`,
    }
    setLogs((prev) => [newLog, ...prev])
    setIsDiffModalOpen(false)
  }, [activeDiff])

  // Prune / Reject
  const rejectAbort = useCallback(() => {
    const newLog: TrajectoryLogItem = {
      id: `log-${Date.now()}`,
      timestamp: Date.now(),
      agentId: "agent-root",
      agentName: "Orchestrator",
      type: "error",
      content: `Task aborted by user. Worktree ${activeDiff?.branchName} pruned.`,
    }
    setLogs((prev) => [newLog, ...prev])
    setIsDiffModalOpen(false)
  }, [activeDiff])

  // Total token spend calculation
  const totalTokensUsed = fleet.reduce((acc, a) => acc + a.budgetUsed, 0)
  const totalTokensBudget = fleet.reduce((acc, a) => acc + a.budgetTotal, 0)

  return {
    isConnected,
    tasks,
    fleet,
    logs,
    totalTokensUsed,
    totalTokensBudget,
    activeClarification,
    isQuestionModalOpen,
    setIsQuestionModalOpen,
    activeDiff,
    isDiffModalOpen,
    setIsDiffModalOpen,
    submitChatTurn,
    respondClarification,
    approveMerge,
    rollbackStep,
    rejectAbort,
  }
}
