"use client"

import React from "react"
import { Gauge, Sparkles } from "lucide-react"

interface QuotaBannerProps {
  usagePercent?: number
  tokensUsed?: number
  tokensLimit?: number
  planName?: string
}

export function QuotaBanner({
  usagePercent = 61,
  tokensUsed = 91500,
  tokensLimit = 150000,
  planName = "Pro Tier",
}: QuotaBannerProps) {
  return (
    <div className="mx-auto my-3 flex w-full max-w-2xl items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-300 shadow-sm backdrop-blur-md select-none">
      <div className="flex items-center gap-3">
        <div className="flex size-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
          <Gauge className="size-3.5" />
        </div>

        <div className="flex flex-col">
          <span className="font-medium text-zinc-200">
            {usagePercent}% Context & Quota Used
          </span>
          <span className="text-[11px] text-zinc-400">
            {(tokensUsed / 1000).toFixed(1)}k / {(tokensLimit / 1000).toFixed(0)}k tokens consumed · resets weekly
          </span>
        </div>
      </div>

      <button
        type="button"
        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer shrink-0"
      >
        Upgrade
      </button>
    </div>
  )
}
