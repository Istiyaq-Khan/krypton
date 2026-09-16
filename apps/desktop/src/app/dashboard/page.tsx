"use client"

import React, { useState } from "react"
import { useKryptonDaemon } from "@/hooks/useKryptonDaemon"
import { TodoTree } from "@/components/TodoTree"
import { QuestionModal } from "@/components/QuestionModal"
import { VcsDiffViewer } from "@/components/VcsDiffViewer"
import { Chatbar } from "@/components/chatbar/Chatbar"
import {
  Cpu,
  GitBranch,
  ShieldCheck,
  Terminal,
  Layers,
  Sparkles,
  Bot,
  Activity,
  Mic,
  FileDiff,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  ArrowRight,
} from "lucide-react"

export default function DashboardPage() {
  const {
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
  } = useKryptonDaemon()

  const [selectedAgentId, setSelectedAgentId] = useState<string>("agent-root")

  const budgetPercentage = Math.min(
    100,
    Math.round((totalTokensUsed / totalTokensBudget) * 100)
  )

  const selectedAgent = fleet.find((a) => a.id === selectedAgentId) || fleet[0]

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none">
      {/* 1. Global Navigation Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-5 backdrop-blur-xl z-20">
        {/* Brand & Version */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-xl bg-violet-600 shadow-md shadow-violet-600/30 text-white font-bold text-sm tracking-wider">
            K
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-zinc-100">
              Krypton
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              v0.1.0-alpha
            </span>
          </div>

          {/* Daemon Health Pill */}
          <div className="ml-2 flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs">
            <span
              className={`size-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            <span className="text-[11px] font-medium text-zinc-300">
              {isConnected ? "Daemon Online" : "Daemon Offline"}
            </span>
          </div>
        </div>

        {/* Status Metrics & Quick Triggers */}
        <div className="flex items-center gap-3">
          {/* Live Token Spend Meter */}
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
            <Flame className="size-3.5 text-amber-400" />
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 text-[10px] text-zinc-400 font-mono">
                <span>Tokens</span>
                <span className="text-zinc-200">
                  {(totalTokensUsed / 1000).toFixed(1)}k / {(totalTokensBudget / 1000).toFixed(0)}k
                </span>
              </div>
              <div className="h-1 w-28 rounded-full bg-zinc-800 mt-1 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${budgetPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Git Worktree Pill */}
          {activeDiff && (
            <button
              type="button"
              onClick={() => setIsDiffModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all cursor-pointer"
              title="Click to view worktree visual diff & merge approval gate"
            >
              <GitBranch className="size-3.5 text-violet-400" />
              <span className="font-mono text-[11px]">{activeDiff.branchName}</span>
              <span className="rounded bg-violet-950/80 text-violet-300 px-1.5 py-0.2 text-[10px] font-mono border border-violet-500/40">
                +{activeDiff.summary.additions} -{activeDiff.summary.deletions}
              </span>
              <FileDiff className="size-3.5 text-zinc-400 ml-1" />
            </button>
          )}

          {/* Voice HUD Link */}
          <a
            href="/overlay"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-violet-600/20 border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-600/30 transition-all cursor-pointer"
            title="Open Floating Voice Micro-HUD overlay window"
          >
            <Mic className="size-3.5 text-violet-400" />
            <span>Voice HUD</span>
          </a>
        </div>
      </header>

      {/* 2. Main Tri-Pane Grid Dashboard */}
      <main className="grid flex-1 grid-cols-12 gap-4 p-4 min-h-0 overflow-hidden relative">
        {/* Left Column (col-span-3): Agent Fleet & Hierarchy */}
        <section className="col-span-3 flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-violet-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Agent Fleet ({fleet.length})
              </h2>
            </div>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              Max Depth: 3
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {fleet.map((agent) => {
              const isSelected = agent.id === selectedAgentId
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  style={{ marginLeft: `${agent.depth * 14}px` }}
                  className={`group flex flex-col gap-1.5 rounded-xl border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? "border-violet-500/60 bg-violet-950/20 shadow-md shadow-violet-950/30"
                      : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-6 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-violet-300">
                        D{agent.depth}
                      </span>
                      <span className="font-semibold text-xs text-zinc-100 truncate">
                        {agent.name}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        agent.state === "executing"
                          ? "bg-violet-950/80 text-violet-300 border border-violet-500/40 animate-pulse"
                          : agent.state === "idle"
                          ? "bg-zinc-800 text-zinc-400"
                          : "bg-emerald-950/80 text-emerald-300"
                      }`}
                    >
                      {agent.state}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed truncate">
                    {agent.role}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/40">
                    <span>Budget: {(agent.budgetUsed / 1000).toFixed(1)}k</span>
                    <span>Cap: {(agent.budgetTotal / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              )
            })}

            {/* Long-term Memory Snapshot Card */}
            <div className="mt-auto rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                <BookOpen className="size-3.5 text-indigo-400" />
                <span>Distilled Memory (MEMORY.md)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400 font-mono">
                User prefers TypeScript strict contracts, Conventional Commits, and isolated worktree execution.
              </p>
            </div>
          </div>
        </section>

        {/* Center Column (col-span-5): Dynamic Todo DAG & Plan Repair */}
        <section className="col-span-5 flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-violet-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Autonomous Task DAG
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>Dynamic Error Replanning Active</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <TodoTree tasks={tasks} />
          </div>
        </section>

        {/* Right Column (col-span-4): Trajectory Log & Audit Stream */}
        <section className="col-span-4 flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl overflow-hidden shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-violet-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Execution Trajectory & Audit
              </h2>
            </div>
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              events.jsonl
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 font-mono text-xs">
            {logs.map((log) => {
              const dateStr = new Date(log.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })

              return (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 rounded-xl border border-zinc-800/70 bg-zinc-900/50 p-2.5 transition-colors hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-400">[{log.agentName}]</span>
                      <span className="rounded bg-zinc-800 px-1 py-0.2 text-zinc-300">
                        {log.type}
                      </span>
                    </div>
                    <span>{dateStr}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-300 break-words">
                    {log.content}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* Floating Context-Staging Chatbar Anchored at Bottom Center */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4">
          <Chatbar onSubmit={submitChatTurn} />
        </div>
      </main>

      {/* 3. Human-in-the-Loop Clarification Modal */}
      <QuestionModal
        request={activeClarification}
        isOpen={isQuestionModalOpen}
        onResolve={respondClarification}
        onDismiss={() => setIsQuestionModalOpen(false)}
      />

      {/* 4. Git Worktree Visual Diff Viewer Modal */}
      {isDiffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-6">
          <div className="h-[90vh] w-full max-w-5xl flex flex-col">
            <div className="flex justify-end pb-2">
              <button
                type="button"
                onClick={() => setIsDiffModalOpen(false)}
                className="rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                Close Diff Inspector
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <VcsDiffViewer
                diff={activeDiff}
                onApproveMerge={approveMerge}
                onRollbackStep={rollbackStep}
                onRejectAbort={rejectAbort}
                onClose={() => setIsDiffModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
