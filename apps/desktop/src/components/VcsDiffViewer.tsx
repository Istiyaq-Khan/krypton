import React, { useState } from "react"
import { GitBranch, GitCommit, Check, RotateCcw, XCircle, FileCode, ChevronDown, ChevronRight } from "lucide-react"

export interface DiffFile {
  path: string
  status: "added" | "modified" | "deleted"
  additions: number
  deletions: number
  hunks: Array<{
    header: string
    lines: Array<{
      type: "add" | "del" | "ctx"
      content: string
      oldLineNo?: number
      newLineNo?: number
    }>
  }>
}

export interface VcsDiffData {
  taskId: string
  branchName: string
  baseCommit: string
  currentCommit: string
  files: DiffFile[]
  summary: {
    filesChanged: number
    additions: number
    deletions: number
  }
}

interface VcsDiffViewerProps {
  diff: VcsDiffData | null
  onApproveMerge: () => void
  onRollbackStep: () => void
  onRejectAbort: () => void
  onClose?: () => void
}

export function VcsDiffViewer({
  diff,
  onApproveMerge,
  onRollbackStep,
  onRejectAbort,
  onClose,
}: VcsDiffViewerProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    diff?.files[0]?.path || ""
  )
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified")

  if (!diff) return null

  const selectedFile =
    diff.files.find((f) => f.path === selectedFilePath) || diff.files[0]

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800 bg-zinc-950/90 text-zinc-100 backdrop-blur-xl overflow-hidden shadow-2xl">
      {/* Top Banner: Branch, Commits & Action Buttons */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md bg-zinc-800/80 px-2.5 py-1 text-xs font-mono text-zinc-300">
            <GitBranch className="size-3.5 text-violet-400" />
            <span>{diff.branchName}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-500">
            <span>base: {diff.baseCommit.slice(0, 7)}</span>
            <span>→</span>
            <span className="text-zinc-300">head: {diff.currentCommit.slice(0, 7)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="text-emerald-400">+{diff.summary.additions}</span>
            <span className="text-rose-400">-{diff.summary.deletions}</span>
          </div>
        </div>

        {/* Action Gate Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRollbackStep}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-zinc-700 transition-colors cursor-pointer"
            title="Execute hard rollback (git reset --hard) to verified checkpoint"
          >
            <RotateCcw className="size-3.5" />
            <span>Rollback Step</span>
          </button>

          <button
            type="button"
            onClick={onRejectAbort}
            className="flex items-center gap-1.5 rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-1 text-xs font-medium text-rose-300 hover:bg-rose-900/60 transition-colors cursor-pointer"
            title="Reject changes and prune worktree"
          >
            <XCircle className="size-3.5" />
            <span>Reject & Abort</span>
          </button>

          <button
            type="button"
            onClick={onApproveMerge}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1 text-xs font-medium text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition-all cursor-pointer"
            title="Approve and merge isolated worktree branch into active branch"
          >
            <Check className="size-3.5 stroke-[2.5]" />
            <span>Approve & Merge</span>
          </button>
        </div>
      </div>

      {/* Main Diff Content Area: File Sidebar + Hunk Viewer */}
      <div className="flex flex-1 min-h-0">
        {/* File List Sidebar */}
        <div className="w-64 border-r border-zinc-800 bg-zinc-900/30 flex flex-col overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60">
            Changed Files ({diff.files.length})
          </div>
          <div className="flex flex-col gap-0.5 p-1.5">
            {diff.files.map((file) => {
              const isSelected = file.path === selectedFile?.path
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-violet-950/40 text-violet-200 border border-violet-500/40"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileCode className="size-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate font-mono text-[11px]">{file.path}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] shrink-0 ml-1">
                    <span className="text-emerald-400">+{file.additions}</span>
                    <span className="text-rose-400">-{file.deletions}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Diff Code Surface */}
        <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/80 overflow-y-auto font-mono text-xs">
          {selectedFile ? (
            <div className="flex flex-col">
              {/* File Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 py-2 backdrop-blur-md">
                <span className="font-mono text-xs font-semibold text-zinc-200">
                  {selectedFile.path}
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {selectedFile.status}
                  </span>
                </div>
              </div>

              {/* Hunks */}
              {selectedFile.hunks.map((hunk, hIdx) => (
                <div key={hIdx} className="flex flex-col border-b border-zinc-800/40">
                  {/* Hunk Header */}
                  <div className="bg-zinc-900/40 px-4 py-1 text-[11px] font-mono text-zinc-500 select-none">
                    {hunk.header}
                  </div>
                  {/* Lines */}
                  {hunk.lines.map((line, lIdx) => {
                    const isAdd = line.type === "add"
                    const isDel = line.type === "del"
                    return (
                      <div
                        key={lIdx}
                        className={`flex items-start px-4 py-0.5 leading-relaxed select-text ${
                          isAdd
                            ? "bg-emerald-950/30 text-emerald-200 border-l-2 border-emerald-500"
                            : isDel
                            ? "bg-rose-950/30 text-rose-200 border-l-2 border-rose-500 line-through opacity-80"
                            : "text-zinc-400"
                        }`}
                      >
                        <span className="w-8 select-none text-right text-[10px] text-zinc-600 mr-2 shrink-0">
                          {line.newLineNo || line.oldLineNo || " "}
                        </span>
                        <span className="w-4 select-none font-bold shrink-0 text-center">
                          {isAdd ? "+" : isDel ? "-" : " "}
                        </span>
                        <pre className="flex-1 font-mono whitespace-pre-wrap break-all text-xs">
                          {line.content}
                        </pre>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-zinc-500 text-xs">
              No file selected
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
