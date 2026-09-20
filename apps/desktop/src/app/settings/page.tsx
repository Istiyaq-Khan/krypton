"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { WindowHeader } from "@/components/layout/WindowHeader"
import { KryptonSettings, SettingsCategory } from "@/components/settings/KryptonSettings"
import { FloatingVoiceAgent } from "@/components/voice/FloatingVoiceAgent"
import { useAgentSession } from "@/hooks/useAgentSession"
import { listenToNavigation } from "@/lib/navigation"

const VALID_CATEGORIES: SettingsCategory[] = [
  "general",
  "agents",
  "providers",
  "appearance",
  "data",
]

export default function SettingsPage() {
  const router = useRouter()
  const session = useAgentSession()
  const [isVoiceAgentVisible, setIsVoiceAgentVisible] = useState(false)
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general")

  // Hydrate active tab from URL search parameters or hash on initial mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search)
      const tabParam = searchParams.get("tab")?.toLowerCase() as SettingsCategory | null
      const hash = window.location.hash.replace(/^#/, "").toLowerCase() as SettingsCategory

      if (tabParam && VALID_CATEGORIES.includes(tabParam)) {
        setActiveCategory(tabParam)
      } else if (hash && VALID_CATEGORIES.includes(hash)) {
        setActiveCategory(hash)
      }
    }
  }, [])

  // Listen to navigation:go-to-route IPC events
  useEffect(() => {
    const unlisten = listenToNavigation((payload) => {
      if (payload.route === "/dashboard" || payload.route === "dashboard") {
        router.push("/dashboard")
        return
      }

      if (payload.tab && VALID_CATEGORIES.includes(payload.tab as SettingsCategory)) {
        setActiveCategory(payload.tab as SettingsCategory)
      }
    })
    return () => unlisten()
  }, [router])

  // Keyboard shortcut listener: Ctrl+, or Cmd+, toggles back to dashboard
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault()
        router.push("/dashboard")
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === " " || e.code === "Space")) {
        e.preventDefault()
        setIsVoiceAgentVisible((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none antialiased">
      {/* Unified Frameless Window Header */}
      <WindowHeader
        projectName={session.activeProject?.name}
        threadTitle={`Settings / ${activeCategory}`}
        projects={session.projects}
        activeProjectId={session.activeProjectId}
        onSelectProject={(id) => {
          session.selectProject(id)
          router.push("/dashboard")
        }}
        isLeftSidebarOpen={false}
        isRightDrawerOpen={false}
        onToggleLeftSidebar={() => {}}
        onToggleRightDrawer={() => {}}
        onNewChat={() => router.push("/dashboard")}
        onCreateProject={() => router.push("/dashboard")}
        onOpenSettings={(cat) => {
          if (cat) setActiveCategory(cat as SettingsCategory)
        }}
        onToggleVoiceHud={() => setIsVoiceAgentVisible((v) => !v)}
        canGoBack={true}
        canGoForward={false}
        onGoBack={() => router.push("/dashboard")}
      />

      {/* Main Krypton Settings Interface */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        <KryptonSettings
          initialCategory={activeCategory}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onBack={() => router.push("/dashboard")}
          onUpdateApproval={session.setAskForApproval}
          onUpdateModel={session.setSelectedModel}
        />
      </div>

      {/* Floating Voice HUD (Elevated top-level overlay with highest z-index) */}
      {isVoiceAgentVisible && (
        <FloatingVoiceAgent
          activeAgentName={session.activeAgentName || session.activeProject?.name || "Orchestrator"}
          onSelectAgent={(agent) => {
            session.setActiveAgentName(agent)
          }}
          onSubmitPrompt={(prompt) => {
            session.submitPrompt(prompt)
            router.push("/dashboard")
          }}
          isAssistantThinking={session.isStreaming}
          latestAssistantText={session.latestAssistantText}
          onClose={() => setIsVoiceAgentVisible(false)}
        />
      )}
    </div>
  )
}
