"use client"

import React, { useRef, useEffect, useState } from "react"
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Terminal,
  Check,
  X,
  Play,
  FileCode,
} from "lucide-react"
import { EmptyHeroState } from "./EmptyHeroState"
import { UserMessageBubble } from "./UserMessageBubble"
import { AgentThoughtTrace } from "./AgentThoughtTrace"
import { ToolExecutionCard } from "./ToolExecutionCard"
import { AgentThread, StreamMessage } from "@/lib/persistence"

interface ExecutionStreamProps {
  thread: AgentThread | null
  projectName: string
  onSelectPrompt: (prompt: string) => void
  onReviewDiff: () => void
  onResolveApproval?: (messageId: string, approved: boolean) => void
  onCreateProject?: () => void
  isStreaming?: boolean
}

export function ExecutionStream({
  thread,
  projectName,
  onSelectPrompt,
  onReviewDiff,
  onResolveApproval,
  onCreateProject,
  isStreaming = false,
}: ExecutionStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)

  const messages = thread?.messages || []
  const hasMessages = messages.length > 0

  // Scroll handler to detect manual user scroll-up override
  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    setIsUserScrolledUp(distanceFromBottom > 120)
  }

  // Auto-scroll lock unless user explicitly scrolled up
  useEffect(() => {
    if (hasMessages && !isUserScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, hasMessages, isUserScrolledUp, isStreaming])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex flex-1 flex-col overflow-y-auto px-4 py-6 scroll-smooth"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        {!hasMessages ? (
          <EmptyHeroState
            projectName={projectName}
            onSelectPrompt={onSelectPrompt}
            onCreateProject={onCreateProject}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg, idx) => {
              if (msg.sender === "user") {
                return (
                  <UserMessageBubble
                    key={msg.id}
                    prompt={msg.prompt || ""}
                    codeSnippet={msg.codeSnippet}
                  />
                )
              }

              const isLatestMessage = idx === messages.length - 1

              return (
                <div key={msg.id} className="flex flex-col w-full my-2 animate-in fade-in-50 duration-200">
                  {/* Collapsible Thought Stream Trace */}
                  {msg.thoughtTrace && <AgentThoughtTrace trace={msg.thoughtTrace} />}

                  {/* Assistant Text / Markdown Content */}
                  {msg.assistantText && (
                    <div className="prose prose-invert max-w-none text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans space-y-2.5">
                      {msg.assistantText.split("\n\n").map((block, bIdx) => {
                        const lines = block.split("\n")
                        const firstLine = lines[0].trim()

                        if (firstLine.startsWith("### ")) {
                          return (
                            <div key={bIdx} className="space-y-1 mt-3 mb-1">
                              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">
                                {firstLine.replace("### ", "")}
                              </h3>
                              {lines.slice(1).map((line, lIdx) => (
                                <p
                                  key={lIdx}
                                  className="text-zinc-300 leading-relaxed"
                                  dangerouslySetInnerHTML={{
                                    __html: line
                                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
                                      .replace(/`(.*?)`/g, '<code class="bg-zinc-800/80 px-1 py-0.5 rounded font-mono text-violet-300 text-xs">$1</code>'),
                                  }}
                                />
                              ))}
                            </div>
                          )
                        }

                        if (lines.some((l) => l.trim().startsWith("- ") || l.trim().startsWith("* ") || /^\d+\.\s/.test(l.trim()))) {
                          return (
                            <div key={bIdx} className="space-y-1.5 pl-1 text-zinc-300">
                              {lines.map((line, lIdx) => {
                                const trimmed = line.trim()
                                const isNumber = /^\d+\.\s/.test(trimmed)
                                const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ")

                                if (isNumber) {
                                  const num = trimmed.match(/^(\d+)\.\s/)?.[1] || `${lIdx + 1}`
                                  const text = trimmed.replace(/^\d+\.\s+/, "")
                                  return (
                                    <div key={lIdx} className="flex items-start gap-2">
                                      <span className="font-mono text-zinc-500 text-xs shrink-0">{num}.</span>
                                      <span
                                        className="leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                          __html: text
                                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
                                            .replace(/`(.*?)`/g, '<code class="bg-zinc-800/80 px-1 py-0.5 rounded font-mono text-violet-300 text-xs">$1</code>'),
                                        }}
                                      />
                                    </div>
                                  )
                                }

                                if (isBullet) {
                                  const text = trimmed.replace(/^[-*]\s+/, "")
                                  return (
                                    <div key={lIdx} className="flex items-start gap-2">
                                      <span className="text-zinc-500 shrink-0 mt-0.5">•</span>
                                      <span
                                        className="leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                          __html: text
                                            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
                                            .replace(/`(.*?)`/g, '<code class="bg-zinc-800/80 px-1 py-0.5 rounded font-mono text-violet-300 text-xs">$1</code>'),
                                        }}
                                      />
                                    </div>
                                  )
                                }

                                return (
                                  <p
                                    key={lIdx}
                                    className="leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                      __html: line
                                        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
                                        .replace(/`(.*?)`/g, '<code class="bg-zinc-800/80 px-1 py-0.5 rounded font-mono text-violet-300 text-xs">$1</code>'),
                                    }}
                                  />
                                )
                              })}
                            </div>
                          )
                        }

                        return (
                          <p
                            key={bIdx}
                            className="leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: block
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
                                .replace(/`(.*?)`/g, '<code class="bg-zinc-800/80 px-1 py-0.5 rounded font-mono text-violet-300 text-xs">$1</code>'),
                            }}
                          />
                        )
                      })}

                      {/* Smooth typing cursor when streaming */}
                      {isStreaming && isLatestMessage && (
                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-violet-400 rounded-sm animate-pulse align-middle" />
                      )}
                    </div>
                  )}

                  {/* Tool Execution Cards */}
                  {msg.toolExecutions &&
                    msg.toolExecutions.map((tool) => (
                      <ToolExecutionCard
                        key={tool.id}
                        tool={tool}
                        onReview={onReviewDiff}
                        onUndo={() => {}}
                      />
                    ))}

                  {/* LIVE INTERACTIVE APPROVAL GATE */}
                  {msg.approvalGate && (
                    <div className="my-3 flex w-full max-w-2xl flex-col rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-xs shadow-xl backdrop-blur-md animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="size-4 text-amber-400" />
                          <span className="font-semibold text-amber-200">{msg.approvalGate.title}</span>
                          <span className="rounded bg-amber-950/80 border border-amber-600/40 px-1.5 py-0.5 text-[10px] text-amber-300 font-mono">
                            [{msg.approvalGate.agentName}]
                          </span>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono capitalize ${
                            msg.approvalGate.status === "pending"
                              ? "bg-amber-900/60 text-amber-300 animate-pulse"
                              : msg.approvalGate.status === "approved"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-600/40"
                              : "bg-rose-950 text-rose-300 border border-rose-600/40"
                          }`}
                        >
                          {msg.approvalGate.status}
                        </span>
                      </div>

                      <p className="mt-2 text-zinc-300 leading-relaxed font-sans">
                        {msg.approvalGate.description}
                      </p>

                      {msg.approvalGate.command && (
                        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-black/60 border border-zinc-800 p-2 font-mono text-[11px] text-zinc-200">
                          <Terminal className="size-3 text-sky-400 shrink-0" />
                          <code className="truncate">{msg.approvalGate.command}</code>
                        </div>
                      )}

                      {msg.approvalGate.status === "pending" ? (
                        <div className="flex items-center justify-end gap-2.5 pt-3 mt-3 border-t border-amber-500/20">
                          <button
                            type="button"
                            onClick={() => onResolveApproval?.(msg.id, false)}
                            className="flex items-center gap-1.5 rounded-lg border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/60 px-3 py-1.5 text-xs text-rose-300 font-medium transition-colors cursor-pointer"
                          >
                            <X className="size-3.5" />
                            <span>Reject & Abort</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onResolveApproval?.(msg.id, true)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs text-white font-medium shadow-md shadow-emerald-900/30 transition-colors cursor-pointer"
                          >
                            <Check className="size-3.5" />
                            <span>Approve & Execute</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-amber-500/10 text-[11px] text-zinc-400">
                          {msg.approvalGate.status === "approved" ? (
                            <>
                              <CheckCircle2 className="size-3.5 text-emerald-400" />
                              <span>Permitted by human operator at {new Date(msg.approvalGate.timestamp).toLocaleTimeString()}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="size-3.5 text-rose-400" />
                              <span>Action denied and aborted by human operator</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  )
}
