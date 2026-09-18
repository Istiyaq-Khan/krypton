"use client"

import React from "react"
import { X, Layers, Activity, GitBranch, Bot, Plus } from "lucide-react"
import { TodoTree, TodoTask } from "@/components/TodoTree"
import { VcsDiffViewer, VcsDiffData } from "@/components/VcsDiffViewer"
import { AgentFleetItem, TrajectoryLogItem } from "@/hooks/useKryptonDaemon"

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
}: OutputsDrawerProps) {
  if (!isOpen) return null

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-zinc-800/80 bg-zinc-950 text-zinc-300 select-none z-20 transition-all">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-900 bg-zinc-950/80">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs text-zinc-200">Outputs & State</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 transition-colors"
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
          <span>Fleet</span>
        </button>
      </div>

      {/* Drawer Content Area */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {activeTab === "dag" && (
          <div className="flex flex-col gap-2">
            <TodoTree tasks={tasks} />
          </div>
        )}

        {activeTab === "audit" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-900 text-[11px] text-zinc-500">
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
                    <span className="text-violet-400">[{log.agentName}]</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="leading-relaxed break-words">{log.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {activeTab === "fleet" && (
          <div className="flex flex-col gap-2.5">
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
              Active Agents ({fleet.length})
            </div>
            {fleet.map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-100">{agent.name}</span>
                  <span className="rounded-full bg-violet-950/80 border border-violet-500/40 px-2 py-0.5 text-[10px] text-violet-300">
                    {agent.state}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">{agent.role}</div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono mt-1 pt-1 border-t border-zinc-800/80">
                  <span>Tokens: {(agent.budgetUsed / 1000).toFixed(1)}k</span>
                  <span>Depth: {agent.depth}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
