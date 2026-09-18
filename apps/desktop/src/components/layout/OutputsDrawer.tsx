"use client"

import React, { useState } from "react"
import {
  X,
  Layers,
  Activity,
  GitBranch,
  Bot,
  Plus,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Shield,
  FileCode,
  Globe,
  Sliders,
  Cpu,
} from "lucide-react"
import { TodoTree, TodoTask } from "@/components/TodoTree"
import { VcsDiffViewer, VcsDiffData } from "@/components/VcsDiffViewer"
import { AgentFleetItem, TrajectoryLogItem } from "@/hooks/useKryptonDaemon"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface OutputsDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTab: "dag" | "audit" | "diff" | "fleet"
  onTabChange: (tab: "dag" | "audit" | "diff" | "fleet") => void
  tasks: TodoTask[]
  logs: TrajectoryLogItem[]
  fleet: AgentFleetItem[]
  diffData: VcsDiffData | null
  onApproveMerge: () => void
  onRollbackStep: () => void
  onRejectAbort: () => void
  onCreateAgent?: (newAgent: {
    name: string
    role: string
    model: string
    temperature: number
    systemPrompt: string
    permissions: AgentFleetItem["permissions"]
  }) => void
  onControlProcess?: (agentId: string, action: "spawn" | "pause" | "resume" | "abort" | "restart") => void
  telemetry?: {
    memoryUsageMb: number
    activeSubAgents: number
    latencyMs: number
    uptimeSeconds: number
  }
}

export function OutputsDrawer({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  tasks,
  logs,
  fleet,
  diffData,
  onApproveMerge,
  onRollbackStep,
  onRejectAbort,
  onCreateAgent,
  onControlProcess,
  telemetry,
}: OutputsDrawerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentRole, setNewAgentRole] = useState("")
  const [newAgentModel, setNewAgentModel] = useState("5.6 Terra High")
  const [newAgentPrompt, setNewAgentPrompt] = useState("")
  const [newAgentPerms, setNewAgentPerms] = useState({
    terminal: true,
    filesystem: true,
    web: false,
    astLinter: true,
  })

  if (!isOpen) return null

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAgentName.trim()) return

    onCreateAgent?.({
      name: newAgentName.trim(),
      role: newAgentRole.trim() || "Autonomous Agent",
      model: newAgentModel,
      temperature: 0.2,
      systemPrompt: newAgentPrompt.trim() || "Autonomous agent assistant.",
      permissions: newAgentPerms,
    })

    setNewAgentName("")
    setNewAgentRole("")
    setNewAgentPrompt("")
    setIsCreateModalOpen(false)
  }

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-zinc-800/80 bg-zinc-950 text-zinc-300 select-none z-20 transition-all">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-900 bg-zinc-950/80">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-zinc-200">Mission Control & Runtime</span>
          {telemetry && (
            <span className="flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
              <Cpu className="size-3 text-emerald-400" />
              {telemetry.memoryUsageMb}MB
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title="Close Drawer"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-zinc-900 px-2 pt-1 gap-1 text-xs">
        <button
          type="button"
          onClick={() => onTabChange("dag")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-md font-medium transition-colors cursor-pointer ${
            activeTab === "dag"
              ? "border-b-2 border-violet-500 text-zinc-100 bg-zinc-900/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
          }`}
        >
          <Layers className="size-3.5" />
          <span>Task DAG</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("audit")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-md font-medium transition-colors cursor-pointer ${
            activeTab === "audit"
              ? "border-b-2 border-violet-500 text-zinc-100 bg-zinc-900/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
          }`}
        >
          <Activity className="size-3.5" />
          <span>Audit Log</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("diff")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-md font-medium transition-colors cursor-pointer ${
            activeTab === "diff"
              ? "border-b-2 border-violet-500 text-zinc-100 bg-zinc-900/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
          }`}
        >
          <GitBranch className="size-3.5" />
          <span>Diff</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("fleet")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-md font-medium transition-colors cursor-pointer ${
            activeTab === "fleet"
              ? "border-b-2 border-violet-500 text-zinc-100 bg-zinc-900/60"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
          }`}
        >
          <Bot className="size-3.5" />
          <span>Fleet ({fleet.length})</span>
        </button>
      </div>

      {/* Drawer Content Area */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {/* TAB 1: TASK DAG */}
        {activeTab === "dag" && (
          <div className="flex flex-col gap-2">
            {tasks.length > 0 ? (
              <TodoTree tasks={tasks} />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center text-center text-zinc-500">
                <Layers className="size-8 stroke-1 text-zinc-600 mb-2" />
                <span>No active task DAG. Dispatch an objective to generate plan.</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AUDIT LOG */}
        {activeTab === "audit" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-900 text-[11px] text-zinc-500 font-mono">
              <span>events.jsonl append stream</span>
              <span>{logs.length} entries</span>
            </div>
            <div className="flex flex-col gap-2 font-mono text-[11px]">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 rounded-lg border border-zinc-900 bg-zinc-900/40 p-2 text-zinc-300"
                >
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="text-violet-400 font-semibold">[{log.agentName}]</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="leading-relaxed break-words">{log.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: VCS WORKTREE DIFF */}
        {activeTab === "diff" && (
          <div className="h-full">
            {diffData ? (
              <VcsDiffViewer
                diff={diffData}
                onApproveMerge={onApproveMerge}
                onRollbackStep={onRollbackStep}
                onRejectAbort={onRejectAbort}
              />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center text-center text-zinc-500">
                <GitBranch className="size-8 stroke-1 text-zinc-600 mb-2" />
                <span>No active Git worktree diffs pending review</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FLEET LIFECYCLE & PROCESS CONTROL */}
        {activeTab === "fleet" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
                Supervised Agent Fleet
              </span>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1 rounded-lg bg-violet-600 hover:bg-violet-500 px-2 py-1 text-xs text-white font-medium transition-colors cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Create Agent</span>
              </button>
            </div>

            {fleet.map((agent) => {
              const usedK = Math.round((agent.budgetUsed || 0) / 1000)
              const totalK = Math.round((agent.budgetTotal || 100000) / 1000)
              const budgetPercent = Math.min(100, Math.round(((agent.budgetUsed || 0) / (agent.budgetTotal || 100000)) * 100))

              return (
                <div
                  key={agent.id}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 transition-all hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-100">{agent.name}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">D:{agent.depth}</span>
                    </div>

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-mono capitalize ${
                        agent.state === "executing"
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 animate-pulse"
                          : agent.state === "paused"
                          ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                          : agent.state === "failed"
                          ? "bg-rose-950/80 text-rose-300 border border-rose-500/40"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {agent.state}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-400 leading-snug">{agent.role}</div>

                  {/* Model & Tool Permissions Badges */}
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono">
                      {agent.model || "5.6 Terra High"}
                    </span>
                    {agent.permissions?.terminal && (
                      <span className="flex items-center gap-0.5 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-sky-400">
                        <Terminal className="size-2.5" /> PTY
                      </span>
                    )}
                    {agent.permissions?.astLinter && (
                      <span className="flex items-center gap-0.5 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-emerald-400">
                        <Shield className="size-2.5" /> AST
                      </span>
                    )}
                    {agent.permissions?.filesystem && (
                      <span className="flex items-center gap-0.5 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-amber-400">
                        <FileCode className="size-2.5" /> FS
                      </span>
                    )}
                  </div>

                  {/* Token Budget Progress Bar */}
                  <div className="flex flex-col gap-1 pt-1 border-t border-zinc-800/70">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Tokens: {usedK}k / {totalK}k</span>
                      <span>{budgetPercent}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-violet-500 transition-all"
                        style={{ width: `${budgetPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Real Process Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 mt-1">
                    <span className="text-[10px] text-zinc-500 font-mono">Process Signals</span>
                    <div className="flex items-center gap-1">
                      {agent.state === "executing" ? (
                        <button
                          type="button"
                          onClick={() => onControlProcess?.(agent.id, "pause")}
                          className="flex size-6 items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-amber-400 transition-colors cursor-pointer"
                          title="Pause Execution"
                        >
                          <Pause className="size-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onControlProcess?.(agent.id, "resume")}
                          className="flex size-6 items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-colors cursor-pointer"
                          title="Resume/Spawn Process"
                        >
                          <Play className="size-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onControlProcess?.(agent.id, "restart")}
                        className="flex size-6 items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                        title="Restart Agent"
                      >
                        <RotateCcw className="size-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onControlProcess?.(agent.id, "abort")}
                        className="flex size-6 items-center justify-center rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors cursor-pointer"
                        title="Abort / SIGKILL Process"
                      >
                        <Square className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CREATE AGENT MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md bg-zinc-950 border border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Provision Autonomous Agent</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3 pt-2 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Agent Name</label>
              <input
                type="text"
                placeholder="e.g. SecurityAuditor"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Role Description</label>
              <input
                type="text"
                placeholder="e.g. Penetration Testing & AST Verification"
                value={newAgentRole}
                onChange={(e) => setNewAgentRole(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none focus:border-violet-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">Model Engine</label>
              <select
                value={newAgentModel}
                onChange={(e) => setNewAgentModel(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none cursor-pointer"
              >
                <option value="5.6 Terra High">5.6 Terra High (Recommended)</option>
                <option value="Claude 3.7 Sonnet">Claude 3.7 Sonnet</option>
                <option value="DeepSeek R1">DeepSeek R1</option>
                <option value="Ollama Local">Ollama Local (Offline)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 font-medium">System Directives & Soul</label>
              <textarea
                placeholder="Core reasoning instructions, operating directives, and safety boundaries..."
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
                rows={3}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-zinc-100 outline-none focus:border-violet-500 resize-none font-sans"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 font-medium">Tool Permissions</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAgentPerms.terminal}
                    onChange={(e) => setNewAgentPerms((p) => ({ ...p, terminal: e.target.checked }))}
                    className="accent-violet-500"
                  />
                  <span>Terminal PTY</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAgentPerms.filesystem}
                    onChange={(e) => setNewAgentPerms((p) => ({ ...p, filesystem: e.target.checked }))}
                    className="accent-violet-500"
                  />
                  <span>Filesystem</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAgentPerms.astLinter}
                    onChange={(e) => setNewAgentPerms((p) => ({ ...p, astLinter: e.target.checked }))}
                    className="accent-violet-500"
                  />
                  <span>AST Linter</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAgentPerms.web}
                    onChange={(e) => setNewAgentPerms((p) => ({ ...p, web: e.target.checked }))}
                    className="accent-violet-500"
                  />
                  <span>Web Search</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg px-3 py-1.5 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-1.5 text-white font-medium"
              >
                Scaffold Agent
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
