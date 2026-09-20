"use client"

import React, { useState } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import { KryptonSynapse } from "@/components/voice/KryptonSynapse"

export default function SynapsePage() {
  const [activeAgent, setActiveAgent] = useState("Orchestrator")

  const handleClose = async () => {
    if (typeof window !== "undefined" && isTauri()) {
      await invoke("hide_synapse").catch(() => invoke("hide_overlay").catch(() => {}))
    }
  }

  const handleDispatch = (prompt: string) => {
    console.log(`[Krypton Synapse] Dispatched prompt for [${activeAgent}]:`, prompt)
  }

  return (
    <div
      data-synapse-window="true"
      className="flex h-screen w-screen items-center justify-center bg-transparent select-none p-2 overflow-hidden"
    >
      <KryptonSynapse
        activeAgentName={activeAgent}
        onSelectAgent={setActiveAgent}
        onSubmitPrompt={handleDispatch}
        onClose={handleClose}
        isStandaloneWindow={true}
      />
    </div>
  )
}
