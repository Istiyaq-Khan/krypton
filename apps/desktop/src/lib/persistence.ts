import { TodoTask } from "@/components/TodoTree"
import { VcsDiffData } from "@/components/VcsDiffViewer"
import { ClarificationRequestData } from "@/components/QuestionModal"

export interface FileDiffMetric {
  path: string
  status: "added" | "modified" | "deleted"
  additions: number
  deletions: number
}

export interface ToolExecutionEvent {
  id: string
  type: "file_edit" | "terminal_command" | "ast_linter" | "test_run" | "browser_action"
  title: string
  subtitle?: string
  additions?: number
  deletions?: number
  files?: FileDiffMetric[]
  command?: string
  stdout?: string
  durationMs: number
  status: "success" | "running" | "failed"
  exitCode?: number
}

export interface ThoughtTraceStep {
  title: string
  detail: string
  timestamp: number
  status: "done" | "in_progress" | "pending"
}

export interface ThoughtTrace {
  id: string
  durationFormatted: string
  durationSeconds: number
  steps: ThoughtTraceStep[]
}

export interface ApprovalGate {
  id: string
  taskId?: string
  agentId: string
  agentName: string
  type: "terminal_command" | "file_write" | "vcs_merge" | "security_violation"
  title: string
  description: string
  command?: string
  diff?: string
  status: "pending" | "approved" | "rejected"
  timestamp: number
}

export interface StreamMessage {
  id: string
  sender: "user" | "agent" | "system"
  timestamp: number
  prompt?: string
  codeSnippet?: string
  configJson?: string
  thoughtTrace?: ThoughtTrace
  assistantText?: string
  toolExecutions?: ToolExecutionEvent[]
  tasks?: TodoTask[]
  diffData?: VcsDiffData
  approvalGate?: ApprovalGate
}

export interface AgentThread {
  id: string
  projectId: string
  title: string
  createdAt: number
  updatedAt: number
  status: "idle" | "running" | "completed" | "error"
  messages: StreamMessage[]
  summary?: string
}

export interface ProjectWorkspace {
  id: string
  name: string
  path: string
  branch: string
  activeThreadId: string
  threads: AgentThread[]
}

export interface AgentFleetItem {
  id: string
  name: string
  role: string
  state: "idle" | "planning" | "executing" | "awaiting_input" | "verifying" | "completed" | "failed" | "paused"
  depth: number
  budgetUsed: number
  budgetTotal: number
  parentAgentId?: string
  model: string
  temperature: number
  systemPrompt: string
  permissions: {
    terminal: boolean
    filesystem: boolean
    web: boolean
    astLinter: boolean
  }
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

export interface WorkstationState {
  version: number
  projects: ProjectWorkspace[]
  activeProjectId: string
  activeThreadId: string
  fleet: AgentFleetItem[]
  tasks: TodoTask[]
  logs: TrajectoryLogItem[]
  activeDiff: VcsDiffData | null
  activeClarification: ClarificationRequestData | null
  pendingApprovals: ApprovalGate[]
  selectedModel: string
  askForApproval: boolean
}

const STORAGE_KEY = "krypton_workstation_state_v2"

// Pure initial state representing a clean Krypton runtime environment without mock artifacts
export const DEFAULT_INITIAL_STATE: WorkstationState = {
  version: 2,
  projects: [],
  activeProjectId: "",
  activeThreadId: "",
  fleet: [
    {
      id: "agent-root",
      name: "Orchestrator",
      role: "System Orchestrator & Task Decomposer",
      state: "idle",
      depth: 0,
      budgetUsed: 0,
      budgetTotal: 100000,
      model: "5.6 Terra High",
      temperature: 0.2,
      systemPrompt: "Decompose user objectives into acyclic task DAGs. Supervise sub-agents and gate privileged operations.",
      permissions: {
        terminal: true,
        filesystem: true,
        web: true,
        astLinter: true,
      },
    },
    {
      id: "agent-coder",
      name: "CoderBot",
      role: "Full-Stack Actor & Tool Synthesizer",
      state: "idle",
      depth: 1,
      budgetUsed: 0,
      budgetTotal: 50000,
      parentAgentId: "agent-root",
      model: "Claude 3.7 Sonnet",
      temperature: 0.1,
      systemPrompt: "Synthesize type-safe TypeScript/Python patches inside isolated worktrees. Never execute unverified code.",
      permissions: {
        terminal: true,
        filesystem: true,
        web: false,
        astLinter: true,
      },
    },
    {
      id: "agent-tester",
      name: "TesterBot",
      role: "AST Linter & Verification Harness",
      state: "idle",
      depth: 2,
      budgetUsed: 0,
      budgetTotal: 25000,
      parentAgentId: "agent-coder",
      model: "DeepSeek R1",
      temperature: 0.0,
      systemPrompt: "Run static AST analysis and unit tests inside sandboxed subprocesses. Enforce hard rollbacks on failure.",
      permissions: {
        terminal: true,
        filesystem: false,
        web: false,
        astLinter: true,
      },
    },
  ],
  tasks: [],
  logs: [],
  activeDiff: null,
  activeClarification: null,
  pendingApprovals: [],
  selectedModel: "5.6 Terra High",
  askForApproval: true,
}

/**
 * Loads persistent state from localStorage with safe fallback.
 */
export function loadWorkstationState(): WorkstationState {
  if (typeof window === "undefined") {
    return DEFAULT_INITIAL_STATE
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      saveWorkstationState(DEFAULT_INITIAL_STATE)
      return DEFAULT_INITIAL_STATE
    }

    const parsed = JSON.parse(raw) as WorkstationState
    if (parsed.version !== 2 || !Array.isArray(parsed.projects)) {
      saveWorkstationState(DEFAULT_INITIAL_STATE)
      return DEFAULT_INITIAL_STATE
    }

    if (!parsed.fleet || parsed.fleet.length === 0) {
      parsed.fleet = DEFAULT_INITIAL_STATE.fleet
      saveWorkstationState(parsed)
    }

    return parsed
  } catch (err) {
    console.error("Failed to load workstation state from storage, resetting:", err)
    return DEFAULT_INITIAL_STATE
  }
}

/**
 * Saves workstation state to persistent storage.
 */
export function saveWorkstationState(state: WorkstationState): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error("Failed to save workstation state to storage:", err)
  }
}
