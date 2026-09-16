import React from "react"
import { CheckCircle2, Circle, Clock, AlertCircle, PlayCircle, ArrowRight, CornerDownRight } from "lucide-react"

export interface TodoTask {
  id: string
  title: string
  description?: string
  status: "pending" | "in_progress" | "completed" | "failed" | "blocked"
  assignedAgent?: string
  dependsOn?: string[]
  durationMs?: number
  isDynamicFix?: boolean
}

interface TodoTreeProps {
  tasks: TodoTask[]
  onSelectTask?: (task: TodoTask) => void
  selectedTaskId?: string
}

export function TodoTree({ tasks, onSelectTask, selectedTaskId }: TodoTreeProps) {
  const getStatusIcon = (status: TodoTask["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
      case "in_progress":
        return <PlayCircle className="size-4 text-violet-400 shrink-0 animate-spin" />
      case "failed":
        return <AlertCircle className="size-4 text-rose-400 shrink-0" />
      case "blocked":
        return <Clock className="size-4 text-amber-400 shrink-0" />
      default:
        return <Circle className="size-4 text-zinc-500 shrink-0" />
    }
  }

  const getStatusBadge = (status: TodoTask["status"]) => {
    switch (status) {
      case "completed":
        return <span className="rounded-full bg-emerald-950/70 border border-emerald-600/40 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Completed</span>
      case "in_progress":
        return <span className="rounded-full bg-violet-950/70 border border-violet-500/50 px-2 py-0.5 text-[10px] font-medium text-violet-200 animate-pulse">In Progress</span>
      case "failed":
        return <span className="rounded-full bg-rose-950/70 border border-rose-600/40 px-2 py-0.5 text-[10px] font-medium text-rose-300">Failed</span>
      case "blocked":
        return <span className="rounded-full bg-amber-950/70 border border-amber-600/40 px-2 py-0.5 text-[10px] font-medium text-amber-300">Blocked</span>
      default:
        return <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">Pending</span>
    }
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return null
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex items-center justify-between px-2 pb-2 border-b border-zinc-800">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Task Execution DAG ({tasks.length})
        </span>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>{tasks.filter((t) => t.status === "completed").length} Done</span>
          <span>·</span>
          <span>{tasks.filter((t) => t.status === "in_progress").length} Active</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        {tasks.map((task, idx) => {
          const isSelected = task.id === selectedTaskId
          const hasDependencies = task.dependsOn && task.dependsOn.length > 0

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask?.(task)}
              className={`group flex flex-col gap-1.5 rounded-xl border p-3 transition-all cursor-pointer ${
                isSelected
                  ? "border-violet-500/50 bg-violet-950/20 shadow-md shadow-violet-950/20"
                  : task.isDynamicFix
                  ? "border-amber-500/40 bg-amber-950/10 hover:border-amber-500/60"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/60"
              }`}
            >
              {/* Task Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {getStatusIcon(task.status)}
                  <span className="font-mono text-xs text-zinc-500">
                    #{idx + 1}
                  </span>
                  <span className="text-sm font-medium text-zinc-100 truncate">
                    {task.title}
                  </span>
                  {task.isDynamicFix && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 border border-amber-500/40">
                      Replanned
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {task.durationMs && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      {formatDuration(task.durationMs)}
                    </span>
                  )}
                  {getStatusBadge(task.status)}
                </div>
              </div>

              {/* Description if present */}
              {task.description && (
                <p className="text-xs text-zinc-400 pl-6 leading-relaxed line-clamp-2">
                  {task.description}
                </p>
              )}

              {/* Metadata row: assigned agent & dependencies */}
              <div className="flex items-center justify-between pl-6 text-[11px] text-zinc-500 pt-1">
                {task.assignedAgent && (
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-zinc-600">agent:</span>
                    <span className="text-zinc-300">[{task.assignedAgent}]</span>
                  </div>
                )}

                {hasDependencies && (
                  <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-500 ml-auto">
                    <CornerDownRight className="size-3 text-zinc-600" />
                    <span>depends on: {task.dependsOn?.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
