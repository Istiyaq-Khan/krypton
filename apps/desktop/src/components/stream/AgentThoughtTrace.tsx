"use client"

import React, { useState } from "react"
import { ChevronRight, ChevronDown, CheckCircle2, Clock, Sparkles } from "lucide-react"
import { ThoughtTrace } from "@/hooks/useAgentSession"

interface AgentThoughtTraceProps {
  trace: ThoughtTrace
}

export function AgentThoughtTrace({ trace }: AgentThoughtTraceProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="my-3 flex flex-col items-start select-none">
      {/* Collapsible Pill Trigger (Matching Image 4: "Worked for 11m 51s >") */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer py-1 px-1.5 -ml-1.5 rounded-md hover:bg-zinc-900/60"
      >
        <span className="font-medium text-zinc-300 group-hover:text-white">
          {trace.durationFormatted}
        </span>
        {isOpen ? (
          <ChevronDown className="size-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
        ) : (
          <ChevronRight className="size-3.5 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
        )}
      </button>

      {/* Expanded Reasoning & Step Breakdown */}
      {isOpen && (
        <div className="mt-2 flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-xs text-zinc-300 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 text-[11px] font-medium text-zinc-400">
            <span>Execution & Reasoning Trace</span>
            <span className="font-mono text-zinc-500">{trace.durationSeconds}s total</span>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            {trace.steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">{step.title}</span>
                  <span className="text-[11px] text-zinc-400 leading-relaxed">{step.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
