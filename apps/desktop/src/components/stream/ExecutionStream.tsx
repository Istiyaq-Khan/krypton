"use client"

import React, { useRef, useEffect } from "react"
import { EmptyHeroState } from "./EmptyHeroState"
import { UserMessageBubble } from "./UserMessageBubble"
import { AgentThoughtTrace } from "./AgentThoughtTrace"
import { ToolExecutionCard } from "./ToolExecutionCard"
import { QuotaBanner } from "./QuotaBanner"
import { AgentThread } from "@/hooks/useAgentSession"

interface ExecutionStreamProps {
  thread: AgentThread | null
  projectName: string
  onSelectPrompt: (prompt: string) => void
  onReviewDiff: () => void
}

export function ExecutionStream({
  thread,
  projectName,
  onSelectPrompt,
  onReviewDiff,
}: ExecutionStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  const messages = thread?.messages || []
  const hasMessages = messages.length > 0

  useEffect(() => {
    if (hasMessages) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length, hasMessages])

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 scroll-smooth">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        {!hasMessages ? (
          <EmptyHeroState projectName={projectName} onSelectPrompt={onSelectPrompt} />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => {
              if (msg.sender === "user") {
                return (
                  <UserMessageBubble
                    key={msg.id}
                    prompt={msg.prompt || ""}
                    codeSnippet={msg.codeSnippet}
                  />
                )
              }

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
                    </div>
                  )}

                  {/* Tool Execution Cards (e.g. Edited 12 files) */}
                  {msg.toolExecutions &&
                    msg.toolExecutions.map((tool) => (
                      <ToolExecutionCard
                        key={tool.id}
                        tool={tool}
                        onReview={onReviewDiff}
                        onUndo={() => {}}
                      />
                    ))}
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
