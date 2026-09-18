"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import { TodoTask } from "@/components/TodoTree"
import { VcsDiffData } from "@/components/VcsDiffViewer"
import { ClarificationRequestData } from "@/components/QuestionModal"

export interface ProjectWorkspace {
  id: string
  name: string
  path: string
  branch: string
  activeThreadId: string
  threads: AgentThread[]
}

export interface FileDiffMetric {
  path: string
  status: "added" | "modified" | "deleted"
  additions: number
  deletions: number
}

export interface ToolExecutionEvent {
  id: string
  type: "file_edit" | "terminal_command" | "ast_linter" | "test_run"
  title: string
  subtitle?: string
  additions?: number
  deletions?: number
  files?: FileDiffMetric[]
  command?: string
  stdout?: string
  durationMs: number
  status: "success" | "running" | "failed"
}

export interface ThoughtTrace {
  id: string
  durationFormatted: string
  durationSeconds: number
  steps: Array<{
    title: string
    detail: string
    timestamp: number
    status: "done" | "in_progress" | "pending"
  }>
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

export interface UserProfileInfo {
  username: string
  avatarUrl?: string
  tokenUsagePercent: number
  tokensUsed: number
  tokensLimit: number
  planName: string
}

// Initial realistic demonstration threads matching Codex reference images
const INITIAL_PROJECTS: ProjectWorkspace[] = [
  {
    id: "proj-clash-bot",
    name: "clash bot engine",
    path: "E:/all my code/clash-bot-engine",
    branch: "add-node-graph-strategy",
    activeThreadId: "thread-automations-ui",
    threads: [
      {
        id: "thread-hatch-pet",
        projectId: "proj-clash-bot",
        title: "$hatch-pet create a pet based on user stats",
        createdAt: Date.now() - 3600000 * 24,
        updatedAt: Date.now() - 3600000 * 20,
        status: "completed",
        messages: [],
      },
      {
        id: "thread-gateway-issues",
        projectId: "proj-clash-bot",
        title: "Fix gateway and telegram issues",
        createdAt: Date.now() - 3600000 * 12,
        updatedAt: Date.now() - 3600000 * 8,
        status: "completed",
        messages: [
          {
            id: "msg-gw-1",
            sender: "user",
            timestamp: Date.now() - 3600000 * 8,
            prompt: `when i run this mantis gateway command .when i try to close with ctrl + c it cannot fully close and i cannot type any command again .and when i run this telegram it send me same massage 2 time .and this api is vary slow when i try to use this same api in another paltfrom in work ( telegram si api ) .and when i tryt ot run this 3 agent by webui i get this erorr API Error: 404 page not found i think this have a ai provider erorr .i when you analyze all my code and analyze this and slove this all problem and if you find any erorr when you fixing this also slove this .fro understanding full codebase read this AGENTS.md .and this is my config [
{
  "dashboard_api_key": "daring drum coach clown dynamic arrest bag bean boil confirm bundle earn decade concert connect chunk crazy age bitter danger anger drum airport dynamic acquire canyon account curtain apple dove awesome arrow",
  "browser_path": "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "browser_user_data": "D:/all my code/mantis/home/chrome_profile",
  "subagent_config": {
    "inherent_main_agent": true
  }
}`,
            codeSnippet: `python src/mantis/channels/cli.py gateway --port 8080`,
          },
          {
            id: "msg-gw-2",
            sender: "agent",
            timestamp: Date.now() - 3600000 * 7.8,
            thoughtTrace: {
              id: "trace-gw-1",
              durationFormatted: "Worked for 11m 51s",
              durationSeconds: 711,
              steps: [
                {
                  title: "Inspect SIGINT signal handlers in gateway supervisor",
                  detail: "Found orphaned child processes keeping stdin/stderr pipe locks open on Windows.",
                  timestamp: Date.now() - 700000,
                  status: "done",
                },
                {
                  title: "Trace Telegram event deduplication router",
                  detail: "Telegram polling loop lacked update_id acknowledgement persistence.",
                  timestamp: Date.now() - 400000,
                  status: "done",
                },
                {
                  title: "Verify AST safety on patched Python signal trap",
                  detail: "AST linter confirmed zero hazardous unconstrained os.kill calls.",
                  timestamp: Date.now() - 100000,
                  status: "done",
                },
              ],
            },
            assistantText: `Fixed the gateway, Telegram duplicate replies, provider routing, and documentation.

### What changed:
- **Hardened Ctrl+C shutdown** in \`gateway.py\`: stops automation cleanly, starts API without uvicorn reload in fleet mode, and kills Windows subprocess trees so \`npm\`, \`node\`, or \`uvicorn\` children do not keep the terminal trapped.
- **Fixed Telegram double-send** in \`agent_loop.py\` and \`telegram_bot.py\`: final answers now emit once, Telegram uses per-agent allowlists, disables polling signal handlers in worker threads, and drops stale updates.`,
            toolExecutions: [
              {
                id: "tool-gw-1",
                type: "file_edit",
                title: "Edited 3 files",
                additions: 142,
                deletions: 38,
                durationMs: 1420,
                status: "success",
                files: [
                  { path: "src/mantis/channels/gateway.py", status: "modified", additions: 78, deletions: 24 },
                  { path: "src/mantis/channels/telegram_bot.py", status: "modified", additions: 46, deletions: 11 },
                  { path: "src/mantis/agent/agent_loop.py", status: "modified", additions: 18, deletions: 3 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "thread-slack-support",
        projectId: "proj-clash-bot",
        title: "Add Slack channel support",
        createdAt: Date.now() - 3600000 * 6,
        updatedAt: Date.now() - 3600000 * 5,
        status: "completed",
        messages: [],
      },
      {
        id: "thread-refactor-metadata",
        projectId: "proj-clash-bot",
        title: "Refactor dynamic LLM metadata",
        createdAt: Date.now() - 3600000 * 4,
        updatedAt: Date.now() - 3600000 * 3,
        status: "completed",
        messages: [],
      },
      {
        id: "thread-automations-ui",
        projectId: "proj-clash-bot",
        title: "Fix automations UI",
        createdAt: Date.now() - 3600000 * 2,
        updatedAt: Date.now() - 60000,
        status: "completed",
        messages: [
          {
            id: "msg-ui-1",
            sender: "user",
            timestamp: Date.now() - 3600000 * 1.5,
            prompt: "Please refactor the automations UI, ensure the job runner model bindings are validated, and connect the scheduler API endpoint.",
          },
          {
            id: "msg-ui-2",
            sender: "agent",
            timestamp: Date.now() - 3600000 * 1.4,
            thoughtTrace: {
              id: "trace-ui-1",
              durationFormatted: "Worked for 4m 32s",
              durationSeconds: 272,
              steps: [
                {
                  title: "Load automation model contracts",
                  detail: "Loaded src/mantis/automation/models.py Zod schemas.",
                  timestamp: Date.now() - 250000,
                  status: "done",
                },
                {
                  title: "Execute dry-run API smoke check",
                  detail: "All 72 endpoints passed validation.",
                  timestamp: Date.now() - 150000,
                  status: "done",
                },
                {
                  title: "Synthesize reactive store and review diffs",
                  detail: "Prepared 12 files for worktree commit.",
                  timestamp: Date.now() - 30000,
                  status: "done",
                },
              ],
            },
            assistantText: `API app import smoke check passed (API OK 72 routes).

### Note
- Telegram/Discord delivery is implemented directly via their APIs using configured tokens/allowlists.
- WhatsApp direct push from scheduler is intentionally logged/skipped unless runtime client integration is expanded further.

### Next steps
1. **Start gateway**: \`python src/mantis/channels/cli.py gateway\`
2. Open \`/automations\`, create one \`every 60\` isolated test job for a known \`agent_id\`, verify \`next_run_at\` and \`last_run_status\`.
3. If NVIDIA still times out for heavy prompts, increase \`MANTIS_NVIDIA_READ_TIMEOUT\` (e.g. \`300\`).`,
            toolExecutions: [
              {
                id: "tool-ui-1",
                type: "file_edit",
                title: "Edited 12 files",
                additions: 1552,
                deletions: 978,
                durationMs: 3820,
                status: "success",
                files: [
                  { path: "src/mantis/automation/models.py", status: "modified", additions: 30, deletions: 17 },
                  { path: "src/mantis/automation/store.py", status: "modified", additions: 225, deletions: 116 },
                  { path: "src/mantis/automation/engine.py", status: "modified", additions: 271, deletions: 101 },
                  { path: "src/mantis/automation/scheduler.py", status: "modified", additions: 184, deletions: 89 },
                  { path: "src/mantis/automation/routes.py", status: "modified", additions: 310, deletions: 212 },
                  { path: "src/mantis/automation/frontend.tsx", status: "modified", additions: 532, deletions: 443 },
                ],
              },
            ],
            tasks: [
              {
                id: "task-auto-1",
                title: "Validate AST boundaries in automations engine",
                status: "completed",
                assignedAgent: "Orchestrator",
                durationMs: 450,
              },
              {
                id: "task-auto-2",
                title: "Inject job queue supervisor and timeout watchdog",
                status: "completed",
                assignedAgent: "CoderBot",
                durationMs: 1200,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "proj-xenon",
    name: "xenon-agent",
    path: "E:/all my code/xenon-agent",
    branch: "main",
    activeThreadId: "",
    threads: [],
  },
  {
    id: "proj-mantis",
    name: "mantis",
    path: "E:/all my code/mantis",
    branch: "master",
    activeThreadId: "",
    threads: [],
  },
]

export function useAgentSession() {
  const [projects, setProjects] = useState<ProjectWorkspace[]>(INITIAL_PROJECTS)
  const [activeProjectId, setActiveProjectId] = useState<string>("proj-clash-bot")
  const [activeThreadId, setActiveThreadId] = useState<string>("thread-automations-ui")
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false)
  const [rightDrawerTab, setRightDrawerTab] = useState<"dag" | "audit" | "diff" | "fleet">("dag")
  const [askForApproval, setAskForApproval] = useState(false)
  const [selectedModel, setSelectedModel] = useState("5.6 Terra High")

  const [userProfile] = useState<UserProfileInfo>({
    username: "razin-khan",
    tokenUsagePercent: 61,
    tokensUsed: 91500,
    tokensLimit: 150000,
    planName: "Pro Tier",
  })

  // Active project
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0]
  }, [projects, activeProjectId])

  // Active thread
  const activeThread = useMemo(() => {
    if (!activeProject) return null
    return activeProject.threads.find((t) => t.id === activeThreadId) || null
  }, [activeProject, activeThreadId])

  // Switch active project
  const selectProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId)
    const proj = projects.find((p) => p.id === projectId)
    if (proj && proj.threads.length > 0) {
      setActiveThreadId(proj.threads[proj.threads.length - 1].id)
    } else {
      setActiveThreadId("")
    }
  }, [projects])

  // Select a specific thread
  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
  }, [])

  // Create a new blank chat session
  const createNewChat = useCallback(() => {
    const newThreadId = `thread-${Date.now()}`
    const newThread: AgentThread = {
      id: newThreadId,
      projectId: activeProjectId,
      title: "New Session",
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
  }, [activeProjectId])

  // Post user message and simulate/dispatch agent turn
  const submitPrompt = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return

      const userMsg: StreamMessage = {
        id: `msg-u-${Date.now()}`,
        sender: "user",
        timestamp: Date.now(),
        prompt: promptText.trim(),
      }

      // Generate initial assistant response placeholder
      const agentMsgId = `msg-a-${Date.now()}`
      const startTime = Date.now()

      const agentMsg: StreamMessage = {
        id: agentMsgId,
        sender: "agent",
        timestamp: startTime,
        thoughtTrace: {
          id: `trace-${Date.now()}`,
          durationFormatted: "Thinking...",
          durationSeconds: 0,
          steps: [
            {
              title: "Analyzing prompt and AST safety constraints",
              detail: `Evaluating: "${promptText.slice(0, 48)}..."`,
              timestamp: startTime,
              status: "in_progress",
            },
          ],
        },
        assistantText: "Planning actions and validating dependencies...",
      }

      // Append messages to active thread or create one if empty
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id !== activeProjectId) return proj

          let updatedThreads = [...proj.threads]
          let currentThread = updatedThreads.find((t) => t.id === activeThreadId)

          if (!currentThread) {
            // Create thread on first prompt
            const firstTitle = promptText.length > 38 ? promptText.slice(0, 38) + "..." : promptText
            currentThread = {
              id: activeThreadId || `thread-${Date.now()}`,
              projectId: activeProjectId,
              title: firstTitle,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              status: "running",
              messages: [userMsg, agentMsg],
            }
            updatedThreads.unshift(currentThread)
          } else {
            // Update existing thread title if it was "New Session"
            const updatedTitle =
              currentThread.title === "New Session"
                ? promptText.length > 38
                  ? promptText.slice(0, 38) + "..."
                  : promptText
                : currentThread.title

            updatedThreads = updatedThreads.map((t) =>
              t.id === currentThread!.id
                ? {
                    ...t,
                    title: updatedTitle,
                    updatedAt: Date.now(),
                    status: "running" as const,
                    messages: [...t.messages, userMsg, agentMsg],
                  }
                : t
            )
          }

          return {
            ...proj,
            threads: updatedThreads,
          }
        })
      )

      // Send to Tauri backend if running natively
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("submit_chat_turn", {
            payload: {
              turn_id: `turn-${Date.now()}`,
              prompt: promptText,
              model: selectedModel,
              context: [],
              enable_web_search: false,
            },
          })
        } catch (e) {
          console.warn("Tauri submit_chat_turn invocation note:", e)
        }
      }

      // Simulate completion progression after brief interval
      setTimeout(() => {
        setProjects((prev) =>
          prev.map((proj) => {
            if (proj.id !== activeProjectId) return proj
            return {
              ...proj,
              threads: proj.threads.map((t) => {
                if (t.id !== activeThreadId) return t
                return {
                  ...t,
                  status: "completed",
                  messages: t.messages.map((m) => {
                    if (m.id !== agentMsgId) return m
                    return {
                      ...m,
                      thoughtTrace: {
                        id: m.thoughtTrace!.id,
                        durationFormatted: "Worked for 8s",
                        durationSeconds: 8,
                        steps: [
                          {
                            title: "Analyzed request & repository contracts",
                            detail: "Validated AST permissions and isolated worktree context.",
                            timestamp: startTime,
                            status: "done",
                          },
                          {
                            title: "Executed autonomous execution step",
                            detail: "Verified syntax and generated clean output.",
                            timestamp: startTime + 4000,
                            status: "done",
                          },
                        ],
                      },
                      assistantText: `Completed execution for: "${promptText}". All AST validation checks passed and worktree state is synchronized.`,
                      toolExecutions: [
                        {
                          id: `tool-${Date.now()}`,
                          type: "file_edit",
                          title: "Edited 1 file",
                          additions: 14,
                          deletions: 2,
                          durationMs: 620,
                          status: "success",
                          files: [
                            {
                              path: "src/mantis/automation/models.py",
                              status: "modified",
                              additions: 14,
                              deletions: 2,
                            },
                          ],
                        },
                      ],
                    }
                  }),
                }
              }),
            }
          })
        )
      }, 2500)
    },
    [activeProjectId, activeThreadId, selectedModel]
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
    submitPrompt,
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
    userProfile,
  }
}
