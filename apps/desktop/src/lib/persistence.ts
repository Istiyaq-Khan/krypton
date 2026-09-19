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
 * Normalizes a workspace filesystem path for deterministic comparison and keying.
 * - Trims whitespace
 * - Replaces backslashes with forward slashes
 * - Strips leading `./`
 * - Strips redundant trailing slashes
 * - Normalizes Windows drive letter to lowercase
 */
export function normalizeWorkspacePath(rawPath: string): string {
  if (!rawPath) return ""
  let normalized = rawPath.trim().replace(/\\/g, "/")

  // Normalize Windows drive letter casing if present (e.g. C:/ -> c:/)
  normalized = normalized.replace(/^([a-zA-Z]):/, (_, letter: string) => `${letter.toLowerCase()}:`)

  // Remove redundant consecutive slashes except if starting with protocol / UNC
  normalized = normalized.replace(/([^:]\/)\/+/g, "$1")

  // Remove leading ./
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2)
  }

  // Remove trailing slashes unless it's root (e.g. "/" or "c:/")
  while (normalized.length > 1 && normalized.endsWith("/") && !/^[a-zA-Z]:\/$/.test(normalized)) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}

/**
 * Migration & hydration sanitizer that filters out duplicate workspace entries,
 * validates required fields, merges unique conversation threads, and ensures active pointers are valid.
 */
export function sanitizeWorkspaces(rawProjects: unknown[]): ProjectWorkspace[] {
  if (!Array.isArray(rawProjects)) return []

  const sanitized: ProjectWorkspace[] = []

  for (const item of rawProjects) {
    if (!item || typeof item !== "object") continue
    const candidate = item as Partial<ProjectWorkspace>

    const id = typeof candidate.id === "string" ? candidate.id.trim() : ""
    const name = typeof candidate.name === "string" ? candidate.name.trim() : ""
    const path = typeof candidate.path === "string" ? candidate.path.trim() : ""
    const branch = typeof candidate.branch === "string" ? candidate.branch.trim() : "main"

    if (!id && !path) continue

    const effectiveId = id || `proj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const effectiveName = name || path || "untitled-workspace"
    const normPath = normalizeWorkspacePath(path || name || effectiveId)

    // Check if we've already added a project with this ID or this normalized path
    const existingIndex = sanitized.findIndex(
      (p) => p.id === effectiveId || (normPath && normalizeWorkspacePath(p.path) === normPath)
    )

    // Sanitize candidate threads
    const candidateThreads: AgentThread[] = Array.isArray(candidate.threads)
      ? candidate.threads.filter(
          (t): t is AgentThread =>
            Boolean(t && typeof t === "object" && typeof t.id === "string" && t.id.trim())
        )
      : []

    if (existingIndex >= 0) {
      // Duplicate found! Merge any threads from candidate into existing project so no history is lost
      const existingProj = sanitized[existingIndex]
      const existingThreadIds = new Set(existingProj.threads.map((t) => t.id))
      for (const t of candidateThreads) {
        if (!existingThreadIds.has(t.id)) {
          existingProj.threads.push(t)
          existingThreadIds.add(t.id)
        }
      }
      // Continue without adding duplicate workspace entry
      continue
    }

    // Deduplicate threads within candidate
    const uniqueThreads: AgentThread[] = []
    const seenThreadIds = new Set<string>()
    for (const t of candidateThreads) {
      if (!seenThreadIds.has(t.id)) {
        seenThreadIds.add(t.id)
        uniqueThreads.push(t)
      }
    }

    // Ensure at least one thread exists
    if (uniqueThreads.length === 0) {
      const fallbackThreadId = `thread-${Date.now()}`
      uniqueThreads.push({
        id: fallbackThreadId,
        projectId: effectiveId,
        title: "Initial Session",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "idle",
        messages: [],
      })
    }

    const activeThreadId =
      candidate.activeThreadId && uniqueThreads.some((t) => t.id === candidate.activeThreadId)
        ? candidate.activeThreadId
        : uniqueThreads[0].id

    sanitized.push({
      id: effectiveId,
      name: effectiveName,
      path: path || normPath,
      branch,
      activeThreadId,
      threads: uniqueThreads,
    })
  }

  return sanitized
}

/**
 * Loads persistent state from localStorage with safe fallback and hydration deduplication sanitization.
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

    const originalLength = parsed.projects.length
    const sanitizedProjects = sanitizeWorkspaces(parsed.projects)
    const isStateModified =
      sanitizedProjects.length !== originalLength ||
      !parsed.projects.every((p, idx) => p.id === sanitizedProjects[idx]?.id)

    parsed.projects = sanitizedProjects

    // Validate activeProjectId
    const activeProjectExists = parsed.projects.some((p) => p.id === parsed.activeProjectId)
    if (!activeProjectExists) {
      parsed.activeProjectId = parsed.projects[0]?.id || ""
    }

    // Validate activeThreadId
    const activeProj = parsed.projects.find((p) => p.id === parsed.activeProjectId)
    if (activeProj) {
      const threadExists = activeProj.threads.some((t) => t.id === parsed.activeThreadId)
      if (!threadExists) {
        parsed.activeThreadId = activeProj.activeThreadId || activeProj.threads[0]?.id || ""
      }
    } else {
      parsed.activeThreadId = ""
    }

    if (!parsed.fleet || parsed.fleet.length === 0) {
      parsed.fleet = DEFAULT_INITIAL_STATE.fleet
    }

    if (isStateModified) {
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
