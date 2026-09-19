"use client"

import React, { useState } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import { FloatingVoiceAgent } from "@/components/voice/FloatingVoiceAgent"

export default function VoiceOverlayPage() {
  const [activeAgent, setActiveAgent] = useState("Orchestrator")

  const handleClose = async () => {
    if (typeof window !== "undefined" && isTauri()) {
      await invoke("hide_overlay").catch(console.error)
    }
  }

  const handleDispatch = (prompt: string) => {
    console.log(`[Voice HUD Overlay] Dispatched prompt for [${activeAgent}]:`, prompt)
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent select-none p-4">
      <FloatingVoiceAgent
        activeAgentName={activeAgent}
        onSelectAgent={setActiveAgent}
        onSubmitPrompt={handleDispatch}
        onClose={handleClose}
      />
    </div>
  )
}
