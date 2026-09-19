"use client"

import React, { useState, useEffect, useCallback } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  ArrowLeft,
  Sliders,
  Bot,
  KeyRound,
  Palette,
  Check,
  RotateCw,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  FolderCode,
  Sparkles,
  Zap,
  Globe,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Info,
  Layers,
  Cpu,
  Mic,
} from "lucide-react"
import {
  ModelProviderId,
  DiscoveredModel,
  PROVIDER_METADATA,
  DEFAULT_PROVIDER_URLS,
  testAndFetchModels,
  persistCachedModels,
} from "@/lib/modelDiscovery"
import {
  AgentFleetItem,
  loadWorkstationState,
  saveWorkstationState,
} from "@/lib/persistence"

export type SettingsCategory = "general" | "agents" | "providers" | "appearance"

export interface CodexSettingsProps {
  initialCategory?: SettingsCategory
  onBack: () => void
  onUpdateApproval?: (ask: boolean) => void
  onUpdateModel?: (model: string) => void
  onRefreshFleet?: () => void
}

export function CodexSettings({
  initialCategory = "general",
  onBack,
  onUpdateApproval,
  onUpdateModel,
  onRefreshFleet,
}: CodexSettingsProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory)
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null)

  // ----------------------------------------------------
  // Category 1: General Settings State
  // ----------------------------------------------------
  const [workspaceDir, setWorkspaceDir] = useState("projects")
  const [terminalShell, setTerminalShell] = useState("system")
  const [askForApproval, setAskForApproval] = useState(true)
  const [astSafetyEnforced, setAstSafetyEnforced] = useState(true)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)
  const [vttEngine, setVttEngine] = useState("whisper_local")
  const [vttCustomEndpoint, setVttCustomEndpoint] = useState("")
  const [vttApiKey, setVttApiKey] = useState("")

  // ----------------------------------------------------
  // Category 2: Agents & Identity State
  // ----------------------------------------------------
  const [agents, setAgents] = useState<AgentFleetItem[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)

  // Create Agent Form State
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentRole, setNewAgentRole] = useState("Autonomous Assistant")
  const [newAgentModel, setNewAgentModel] = useState("5.6 Terra High")
  const [newAgentProvider, setNewAgentProvider] = useState("openai")
  const [newAgentTemp, setNewAgentTemp] = useState(0.2)
  const [newAgentPrompt, setNewAgentPrompt] = useState("")
  const [newAgentTools, setNewAgentTools] = useState({
    terminal: true,
    filesystem: true,
    astLinter: true,
    web: false,
  })

  // ----------------------------------------------------
  // Category 3: Model Providers State
  // ----------------------------------------------------
  const [selectedProvider, setSelectedProvider] = useState<ModelProviderId>("openai")
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({
    openai: "",
    anthropic: "",
    openrouter: "",
    ollama: "",
    custom: "",
  })
  const [providerUrls, setProviderUrls] = useState<Record<string, string>>({
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    ollama: "http://localhost:11434",
    custom: "http://localhost:8000/v1",
  })
  const [customModelId, setCustomModelId] = useState("")
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({})

  // Provider Connection Test State
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{
    provider: string
    success: boolean
    message: string
    modelCount?: number
  } | null>(null)

  // ----------------------------------------------------
  // Category 4: Appearance State
  // ----------------------------------------------------
  const [theme, setTheme] = useState<"dark" | "midnight" | "cyber" | "oled">("dark")
  const [fontSize, setFontSize] = useState<"compact" | "standard" | "comfortable">("standard")
  const [uiDensity, setUiDensity] = useState<"compact" | "comfortable">("comfortable")

  const flashSavedNotice = useCallback((msg = "Saved") => {
    setSaveIndicator(msg)
    setTimeout(() => {
      setSaveIndicator(null)
    }, 2400)
  }, [])

  // ----------------------------------------------------
  // Initial Hydration from Tauri IPC and localStorage
  // ----------------------------------------------------
  useEffect(() => {
    async function loadSettings() {
      // 1. Hydrate from Workstation persistent state
      const wsState = loadWorkstationState()
      if (wsState.fleet && wsState.fleet.length > 0) {
        setAgents(wsState.fleet)
        if (!selectedAgentId) setSelectedAgentId(wsState.fleet[0].id)
      }
      setAskForApproval(wsState.askForApproval ?? true)

      // 2. Hydrate from Host / Tauri IPC
      if (typeof window !== "undefined" && isTauri()) {
        try {
          const settings = await invoke<any>("get_app_settings")
          if (settings) {
            setWorkspaceDir(settings.defaultWorkspaceDir || "projects")
            setTerminalShell(settings.defaultTerminalShell || "system")
            setAskForApproval(settings.askForApproval ?? true)
            setAstSafetyEnforced(settings.astSafetyEnforced ?? true)
            setTelemetryEnabled(settings.telemetryEnabled ?? false)
            if (settings.theme) setTheme(settings.theme)
            if (settings.fontSize) setFontSize(settings.fontSize)
            if (settings.uiDensity) setUiDensity(settings.uiDensity)
            if (settings.vttEngine) setVttEngine(settings.vttEngine)
            if (settings.vttCustomEndpoint) setVttCustomEndpoint(settings.vttCustomEndpoint)
            if (settings.vttApiKey) setVttApiKey(settings.vttApiKey)

            // Providers
            if (Array.isArray(settings.providers)) {
              const keys: Record<string, string> = {}
              const urls: Record<string, string> = {}
              settings.providers.forEach((p: any) => {
                if (p.provider) {
                  if (p.apiKey) keys[p.provider] = p.apiKey
                  if (p.baseUrl) urls[p.provider] = p.baseUrl
                  if (p.provider === "custom" && p.customModel) {
                    setCustomModelId(p.customModel)
                  }
                }
              })
              setProviderKeys((prev) => ({ ...prev, ...keys }))
              setProviderUrls((prev) => ({ ...prev, ...urls }))
            }
          }
        } catch (err) {
          console.warn("Could not invoke get_app_settings:", err)
        }
      } else {
        // Fallback localStorage hydration
        try {
          const rawGeneral = localStorage.getItem("krypton_general_settings")
          if (rawGeneral) {
            const parsed = JSON.parse(rawGeneral)
            if (parsed.workspaceDir) setWorkspaceDir(parsed.workspaceDir)
            if (parsed.terminalShell) setTerminalShell(parsed.terminalShell)
            if (typeof parsed.astSafetyEnforced === "boolean") setAstSafetyEnforced(parsed.astSafetyEnforced)
            if (typeof parsed.telemetryEnabled === "boolean") setTelemetryEnabled(parsed.telemetryEnabled)
          }

          const rawAppearance = localStorage.getItem("krypton_appearance_settings")
          if (rawAppearance) {
            const parsed = JSON.parse(rawAppearance)
            if (parsed.theme) setTheme(parsed.theme)
            if (parsed.fontSize) setFontSize(parsed.fontSize)
            if (parsed.uiDensity) setUiDensity(parsed.uiDensity)
          }

          const rawKeys = localStorage.getItem("krypton_provider_keys")
          if (rawKeys) {
            const parsed = JSON.parse(rawKeys)
            setProviderKeys((prev) => ({ ...prev, ...parsed }))
          }

          const rawVtt = localStorage.getItem("krypton_vtt_config")
          if (rawVtt) {
            const parsed = JSON.parse(rawVtt)
            if (parsed.engine) setVttEngine(parsed.engine)
            if (parsed.customEndpoint) setVttCustomEndpoint(parsed.customEndpoint)
            if (parsed.apiKey) setVttApiKey(parsed.apiKey)
          }
        } catch {
          // ignore
        }
      }
    }

    loadSettings()
  }, [])

  // ----------------------------------------------------
  // Immediate Save Handlers
  // ----------------------------------------------------
  const persistGeneralSettings = useCallback(
    async (newDir: string, newShell: string, newApproval: boolean, newAst: boolean, newTelemetry: boolean) => {
      // 1. Update Workstation state
      const ws = loadWorkstationState()
      ws.askForApproval = newApproval
      saveWorkstationState(ws)
      onUpdateApproval?.(newApproval)

      // 2. Persist to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "krypton_general_settings",
          JSON.stringify({
            workspaceDir: newDir,
            terminalShell: newShell,
            astSafetyEnforced: newAst,
            telemetryEnabled: newTelemetry,
          })
        )
      }

      // 3. Persist to host ~/.krypton/config.json via Tauri IPC
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("save_app_settings", {
            payload: {
              defaultWorkspaceDir: newDir,
              defaultTerminalShell: newShell,
              askForApproval: newApproval,
              astSafetyEnforced: newAst,
              telemetryEnabled: newTelemetry,
            },
          })
        } catch (err) {
          console.warn("save_app_settings error:", err)
        }
      }

      flashSavedNotice("General settings saved")
    },
    [onUpdateApproval, flashSavedNotice]
  )

  const persistVttSettings = useCallback(
    async (newEngine: string, newEndpoint?: string, newApiKey?: string) => {
      setVttEngine(newEngine)
      const finalEndpoint = newEndpoint !== undefined ? newEndpoint : vttCustomEndpoint
      const finalKey = newApiKey !== undefined ? newApiKey : vttApiKey

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "krypton_vtt_config",
          JSON.stringify({
            engine: newEngine,
            customEndpoint: finalEndpoint,
            apiKey: finalKey,
          })
        )
      }

      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("save_app_settings", {
            payload: {
              vttEngine: newEngine,
              vttCustomEndpoint: finalEndpoint,
              vttApiKey: finalKey,
            },
          })
          await invoke("set_stt_provider", { provider: newEngine }).catch(() => {})
        } catch (err) {
          console.warn("save_app_settings vtt error:", err)
        }
      }

      flashSavedNotice("Voice-To-Text configuration saved")
    },
    [flashSavedNotice, vttCustomEndpoint, vttApiKey]
  )

  const persistAppearanceSettings = useCallback(
    async (newTheme: "dark" | "midnight" | "cyber" | "oled", newFont: "compact" | "standard" | "comfortable", newDensity: "compact" | "comfortable") => {
      // 1. Immediate DOM styles application
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", newTheme)
        document.documentElement.setAttribute("data-font-size", newFont)
        document.documentElement.setAttribute("data-density", newDensity)

        // Adjust document root font size directly
        if (newFont === "compact") {
          document.documentElement.style.fontSize = "13px"
        } else if (newFont === "comfortable") {
          document.documentElement.style.fontSize = "15px"
        } else {
          document.documentElement.style.fontSize = "14px"
        }
      }

      // 2. Persist to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "krypton_appearance_settings",
          JSON.stringify({ theme: newTheme, fontSize: newFont, uiDensity: newDensity })
        )
      }

      // 3. Persist to ~/.krypton/config.json
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("save_app_settings", {
            payload: {
              theme: newTheme,
              fontSize: newFont,
              uiDensity: newDensity,
            },
          })
        } catch (err) {
          console.warn("save_app_settings appearance error:", err)
        }
      }

      flashSavedNotice("Appearance updated")
    },
    [flashSavedNotice]
  )

  const persistProviderCredentials = useCallback(
    async (prov: string, key: string, url: string, customModel?: string) => {
      // 1. Update localStorage
      if (typeof window !== "undefined") {
        const storedKeys = JSON.parse(localStorage.getItem("krypton_provider_keys") || "{}")
        storedKeys[prov] = key
        localStorage.setItem("krypton_provider_keys", JSON.stringify(storedKeys))
      }

      // 2. Persist to ~/.krypton/credentials.json
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("save_app_settings", {
            payload: {
              providers: [
                {
                  provider: prov,
                  apiKey: key,
                  baseUrl: url,
                  customModel: customModel || null,
                },
              ],
            },
          })
        } catch (err) {
          console.warn("save_app_settings credentials error:", err)
        }
      }

      flashSavedNotice(`Saved ${prov.toUpperCase()} credentials`)
    },
    [flashSavedNotice]
  )

  // ----------------------------------------------------
  // Test Connection for Model Providers
  // ----------------------------------------------------
  const handleTestProviderConnection = async (prov: ModelProviderId) => {
    setIsTestingConnection(true)
    setTestResult(null)

    const key = providerKeys[prov] || ""
    const url = providerUrls[prov] || DEFAULT_PROVIDER_URLS[prov]

    try {
      const result = await testAndFetchModels({
        provider: prov,
        apiKey: key,
        baseUrl: url,
      })

      if (result.success) {
        setTestResult({
          provider: prov,
          success: true,
          message: `Connected successfully! Found ${result.models.length} available models.`,
          modelCount: result.models.length,
        })
        // Cache discovered models
        persistCachedModels({
          provider: prov,
          baseUrl: url,
          models: result.models,
          updatedAt: Date.now(),
        })
        // Also persist credentials on successful test
        await persistProviderCredentials(prov, key, url, prov === "custom" ? customModelId : undefined)
      } else {
        setTestResult({
          provider: prov,
          success: false,
          message: result.error || "Connection test failed. Verify your key and base URL.",
        })
      }
    } catch (err: any) {
      setTestResult({
        provider: prov,
        success: false,
        message: err.message || "An unexpected error occurred during connection test.",
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  // ----------------------------------------------------
  // Agent Edit & Creation Logic (Strictly to config.json)
  // ----------------------------------------------------
  const handleUpdateAgentField = useCallback(
    async (agentId: string, patch: Partial<AgentFleetItem>) => {
      const updatedList = agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a))
      setAgents(updatedList)

      // Save to workstation state
      const ws = loadWorkstationState()
      ws.fleet = updatedList
      saveWorkstationState(ws)

      const targetAgent = updatedList.find((a) => a.id === agentId)
      if (!targetAgent) return

      // Build strictly compliant AgentConfigFile schema JSON
      const agentConfigJson = {
        id: targetAgent.id,
        name: targetAgent.name,
        role: targetAgent.role,
        model: targetAgent.model,
        temperature: targetAgent.temperature,
        contextWindowLimit: 128_000,
        tools: [
          ...(targetAgent.permissions.terminal ? ["terminal"] : []),
          ...(targetAgent.permissions.filesystem ? ["filesystem"] : []),
          ...(targetAgent.permissions.astLinter ? ["astLinter"] : []),
          ...(targetAgent.permissions.web ? ["web"] : []),
        ],
        permissions: {
          allowedSubAgents: ["CoderBot", "TesterBot"],
          allowedTools: [
            ...(targetAgent.permissions.terminal ? ["terminal"] : []),
            ...(targetAgent.permissions.filesystem ? ["filesystem"] : []),
            ...(targetAgent.permissions.astLinter ? ["astLinter"] : []),
            ...(targetAgent.permissions.web ? ["web"] : []),
          ],
          maxDepth: 3,
          maxConcurrentChildren: 5,
          budgetShare: 0.5,
          canSynthesizeTools: true,
          canAccessNetwork: targetAgent.permissions.web,
          canModifyWorkspace: targetAgent.permissions.filesystem,
          terminal: targetAgent.permissions.terminal,
          filesystem: targetAgent.permissions.filesystem,
          web: targetAgent.permissions.web,
          astLinter: targetAgent.permissions.astLinter,
        },
        budget: {
          total: targetAgent.budgetTotal,
          used: targetAgent.budgetUsed,
        },
        updatedAt: Date.now(),
      }

      // Persist strictly to ~/.krypton/agents/<agent_name>/config.json
      if (typeof window !== "undefined" && isTauri()) {
        try {
          await invoke("save_agent_config", {
            agentName: targetAgent.name,
            config: agentConfigJson,
          })
        } catch (err) {
          console.warn("save_agent_config error:", err)
        }
      }

      flashSavedNotice(`Updated ${targetAgent.name} config.json`)
      onRefreshFleet?.()
    },
    [agents, flashSavedNotice, onRefreshFleet]
  )

  const handleCreateNewAgent = useCallback(async () => {
    const trimmedName = newAgentName.trim()
    if (!trimmedName) return

    const newAgent: AgentFleetItem = {
      id: `agent-${Date.now()}`,
      name: trimmedName,
      role: newAgentRole.trim() || "Autonomous Assistant",
      state: "idle",
      depth: 1,
      budgetUsed: 0,
      budgetTotal: 50000,
      parentAgentId: "agent-root",
      model: newAgentModel,
      temperature: newAgentTemp,
      systemPrompt: newAgentPrompt,
      permissions: {
        terminal: newAgentTools.terminal,
        filesystem: newAgentTools.filesystem,
        astLinter: newAgentTools.astLinter,
        web: newAgentTools.web,
      },
    }

    const updated = [...agents, newAgent]
    setAgents(updated)
    setSelectedAgentId(newAgent.id)
    setIsCreatingAgent(false)

    // Save to Workstation persistence
    const ws = loadWorkstationState()
    ws.fleet = updated
    saveWorkstationState(ws)

    // Construct machine config.json
    const configJson = {
      id: newAgent.id,
      name: newAgent.name,
      role: newAgent.role,
      model: newAgent.model,
      provider: newAgentProvider,
      temperature: newAgent.temperature,
      contextWindowLimit: 128_000,
      tools: [
        ...(newAgent.permissions.terminal ? ["terminal"] : []),
        ...(newAgent.permissions.filesystem ? ["filesystem"] : []),
        ...(newAgent.permissions.astLinter ? ["astLinter"] : []),
        ...(newAgent.permissions.web ? ["web"] : []),
      ],
      permissions: {
        allowedSubAgents: [],
        allowedTools: [
          ...(newAgent.permissions.terminal ? ["terminal"] : []),
          ...(newAgent.permissions.filesystem ? ["filesystem"] : []),
          ...(newAgent.permissions.astLinter ? ["astLinter"] : []),
          ...(newAgent.permissions.web ? ["web"] : []),
        ],
        maxDepth: 3,
        maxConcurrentChildren: 5,
        budgetShare: 0.5,
        canSynthesizeTools: true,
        canAccessNetwork: newAgent.permissions.web,
        canModifyWorkspace: newAgent.permissions.filesystem,
        terminal: newAgent.permissions.terminal,
        filesystem: newAgent.permissions.filesystem,
        web: newAgent.permissions.web,
        astLinter: newAgent.permissions.astLinter,
      },
      budget: {
        total: 50000,
        used: 0,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Persist to host ~/.krypton/agents/<name>/config.json
    if (typeof window !== "undefined" && isTauri()) {
      try {
        await invoke("save_agent_config", {
          agentName: newAgent.name,
          config: configJson,
        })
      } catch (err) {
        console.warn("save_agent_config create error:", err)
      }
    }

    // Reset create form
    setNewAgentName("")
    setNewAgentRole("Autonomous Assistant")
    setNewAgentPrompt("")

    flashSavedNotice(`Created agent ${trimmedName} with config.json`)
    onRefreshFleet?.()
  }, [
    newAgentName,
    newAgentRole,
    newAgentModel,
    newAgentProvider,
    newAgentTemp,
    newAgentPrompt,
    newAgentTools,
    agents,
    flashSavedNotice,
    onRefreshFleet,
  ])

  const handleDeleteAgent = useCallback(
    (agentId: string) => {
      const target = agents.find((a) => a.id === agentId)
      if (!target || target.id === "agent-root") return

      const updated = agents.filter((a) => a.id !== agentId)
      setAgents(updated)
      if (selectedAgentId === agentId) {
        setSelectedAgentId(updated[0]?.id || null)
      }

      const ws = loadWorkstationState()
      ws.fleet = updated
      saveWorkstationState(ws)

      flashSavedNotice(`Removed ${target.name}`)
      onRefreshFleet?.()
    },
    [agents, selectedAgentId, flashSavedNotice, onRefreshFleet]
  )

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0]

  return (
    <div className="flex h-full w-full flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden antialiased">
      {/* ---------------------------------------------------- */}
      {/* TOP NAVIGATION BAR: "Back to app" Header              */}
      {/* ---------------------------------------------------- */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white cursor-pointer group shadow-xs"
            title="Return to Active Workspace"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 text-zinc-400 group-hover:text-white" />
            <span>Back to app</span>
          </button>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <span className="text-zinc-500">Settings</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 capitalize">
              {activeCategory === "general"
                ? "General"
                : activeCategory === "agents"
                ? "Agents & Identity"
                : activeCategory === "providers"
                ? "Model Providers"
                : "Appearance"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {saveIndicator && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-mono text-emerald-300 animate-in fade-in-0 duration-150">
              <Check className="size-3 text-emerald-400" />
              <span>{saveIndicator}</span>
            </div>
          )}
          <span className="text-[11px] text-zinc-500 font-mono">Krypton v0.1.0</span>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* MAIN TWO-COLUMN BODY: Left Sidebar + Right Content   */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/60 p-3">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setActiveCategory("general")}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                activeCategory === "general"
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/30 shadow-xs"
                  : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Sliders className="size-4 shrink-0" />
              <div className="flex flex-col">
                <span>General</span>
                <span className="text-[10px] text-zinc-500 font-normal">Workspace, shell & safety</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("agents")}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                activeCategory === "agents"
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/30 shadow-xs"
                  : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Bot className="size-4 shrink-0" />
              <div className="flex flex-col">
                <span>Agents & Identity</span>
                <span className="text-[10px] text-zinc-500 font-normal">Fleet roster & config.json</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("providers")}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                activeCategory === "providers"
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/30 shadow-xs"
                  : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <KeyRound className="size-4 shrink-0" />
              <div className="flex flex-col">
                <span>Model Providers</span>
                <span className="text-[10px] text-zinc-500 font-normal">API keys & test discovery</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory("appearance")}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                activeCategory === "appearance"
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/30 shadow-xs"
                  : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <Palette className="size-4 shrink-0" />
              <div className="flex flex-col">
                <span>Appearance</span>
                <span className="text-[10px] text-zinc-500 font-normal">Theme, font & UI density</span>
              </div>
            </button>
          </div>

          <div className="mt-auto rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3 text-[11px] text-zinc-500">
            <div className="font-semibold text-zinc-400 pb-1 flex items-center gap-1.5">
              <Sparkles className="size-3 text-violet-400" />
              <span>Local-First Core</span>
            </div>
            <p className="leading-relaxed">
              All configurations save directly to <code className="text-zinc-400 font-mono">~/.krypton</code> with zero remote server lock-in.
            </p>
          </div>
        </aside>

        {/* Right Content Panel */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* -------------------------------------------------- */}
            {/* 1. GENERAL SETTINGS                                */}
            {/* -------------------------------------------------- */}
            {activeCategory === "general" && (
              <div className="space-y-6 animate-in fade-in-0 duration-150">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">General Preferences</h2>
                  <p className="text-xs text-zinc-400">Configure host workspace locations, default terminal shell, and autonomy boundaries.</p>
                </div>

                {/* Default Workspace Directory */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium text-zinc-200">Default Workspace Directory</label>
                      <p className="text-[11px] text-zinc-500">New projects and repositories will be created in this host path.</p>
                    </div>
                    <FolderCode className="size-4 text-zinc-500" />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={workspaceDir}
                      onChange={(e) => {
                        setWorkspaceDir(e.target.value)
                        persistGeneralSettings(e.target.value, terminalShell, askForApproval, astSafetyEnforced, telemetryEnabled)
                      }}
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200 outline-none focus:border-violet-500 transition-colors"
                      placeholder="e.g. C:\Users\User\Projects or /home/user/projects"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const reset = "projects"
                        setWorkspaceDir(reset)
                        persistGeneralSettings(reset, terminalShell, askForApproval, astSafetyEnforced, telemetryEnabled)
                      }}
                      className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Default Terminal Shell */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium text-zinc-200">Default Terminal Shell</label>
                      <p className="text-[11px] text-zinc-500">PTY subprocess executor for autonomous code runs and terminal tools.</p>
                    </div>
                    <Terminal className="size-4 text-zinc-500" />
                  </div>
                  <select
                    value={terminalShell}
                    onChange={(e) => {
                      const next = e.target.value
                      setTerminalShell(next)
                      persistGeneralSettings(workspaceDir, next, askForApproval, astSafetyEnforced, telemetryEnabled)
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 outline-none focus:border-violet-500 transition-colors cursor-pointer"
                  >
                    <option value="system">System Default (Auto-detect OS shell)</option>
                    <option value="powershell">PowerShell (pwsh.exe / powershell.exe)</option>
                    <option value="cmd">Command Prompt (cmd.exe)</option>
                    <option value="bash">Git Bash / Linux Bash (bash.exe / /bin/bash)</option>
                    <option value="wsl">WSL (wsl.exe bash)</option>
                    <option value="zsh">Zsh (/bin/zsh)</option>
                  </select>
                </div>

                {/* Execution Permissions & Safety */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
                  <div>
                    <h3 className="text-xs font-medium text-zinc-200">Execution Permissions & Safety</h3>
                    <p className="text-[11px] text-zinc-500">Human-in-the-loop gates and AST security boundaries.</p>
                  </div>

                  {/* Ask For Approval Switch */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                        {askForApproval ? (
                          <ShieldCheck className="size-3.5 text-emerald-400" />
                        ) : (
                          <Zap className="size-3.5 text-amber-400" />
                        )}
                        <span>{askForApproval ? "Ask for Approval (Safe Mode)" : "Autonomous Execution (Fast Mode)"}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 max-w-lg">
                        {askForApproval
                          ? "Explicit confirmation required for terminal commands, file modifications, and git branch merges."
                          : "Agents execute actions autonomously within local sandboxing boundaries without interrupting you."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !askForApproval
                        setAskForApproval(next)
                        persistGeneralSettings(workspaceDir, terminalShell, next, astSafetyEnforced, telemetryEnabled)
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        askForApproval ? "bg-emerald-600" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          askForApproval ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* AST Safety Linter Switch */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-zinc-200">Static AST Security Linter</div>
                      <p className="text-[11px] text-zinc-500 max-w-lg">
                        Pre-screens all synthesized TypeScript, JavaScript, and Python scripts for hazardous operations (e.g. raw root deletions, dynamic eval).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !astSafetyEnforced
                        setAstSafetyEnforced(next)
                        persistGeneralSettings(workspaceDir, terminalShell, askForApproval, next, telemetryEnabled)
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        astSafetyEnforced ? "bg-violet-600" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          astSafetyEnforced ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Telemetry Switch */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-zinc-200">Anonymous Crash Reporting</div>
                      <p className="text-[11px] text-zinc-500 max-w-lg">
                        Send local diagnostic stack traces to help improve Krypton runtime stability. Zero prompt or code contents are ever shared.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !telemetryEnabled
                        setTelemetryEnabled(next)
                        persistGeneralSettings(workspaceDir, terminalShell, askForApproval, astSafetyEnforced, next)
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        telemetryEnabled ? "bg-violet-600" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          telemetryEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Voice-To-Text (VTT) Engine Configuration */}
                  <div className="pt-4 border-t border-zinc-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mic className="size-4 text-violet-400" />
                        <span className="text-xs font-semibold text-zinc-200">Voice-To-Text (VTT) Configuration</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-950/60 border border-violet-800/50 text-violet-300">
                        Active: {vttEngine}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Configure your primary speech transcription engine. Architectures differ: Whisper utilizes an autoregressive encoder-decoder, whereas NVIDIA Parakeet TDT executes a high-speed streaming conformer transducer.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {[
                        {
                          id: "whisper_local",
                          title: "Whisper Local",
                          badge: "Local",
                          arch: "Encoder-Decoder Autoregressive (Whisper.cpp / ONNX)",
                          desc: "Zero-latency local audio decoding on host CPU/GPU.",
                        },
                        {
                          id: "nvidia/parakeet-tdt-0.6b-v3",
                          title: "nvidia/parakeet-tdt-0.6b-v3",
                          badge: "Fast RNN-T",
                          arch: "Fast Conformer RNN-T / TDT Streaming Transducer",
                          desc: "0.6B parameter model with streaming joint network decoding.",
                        },
                        {
                          id: "whisper_api",
                          title: "Whisper API",
                          badge: "Cloud",
                          arch: "OpenAI Audio Transcriptions REST API",
                          desc: "High-accuracy cloud API for low-power host machines.",
                        },
                        {
                          id: "custom",
                          title: "Custom STT Endpoint",
                          badge: "Custom",
                          arch: "Self-Hosted / Remote Endpoint",
                          desc: "Connect to your custom speech recognition server.",
                        },
                      ].map((item) => (
                        <div
                          key={item.id}
                          onClick={() => persistVttSettings(item.id)}
                          className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                            vttEngine === item.id
                              ? "border-violet-500 bg-violet-950/20 text-zinc-100 shadow-sm"
                              : "border-zinc-800/80 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-zinc-200">{item.title}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                              {item.badge}
                            </span>
                          </div>
                          <span className="text-[10px] text-violet-400/90 font-mono mt-1">{item.arch}</span>
                          <span className="text-[11px] text-zinc-400 mt-1">{item.desc}</span>
                        </div>
                      ))}
                    </div>

                    {vttEngine === "custom" && (
                      <div className="flex flex-col gap-1.5 pt-2">
                        <label className="text-xs text-zinc-300">Custom STT Endpoint URL</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={vttCustomEndpoint}
                            onChange={(e) => setVttCustomEndpoint(e.target.value)}
                            placeholder="e.g. http://localhost:8080/v1/audio/transcriptions"
                            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            type="button"
                            onClick={() => persistVttSettings(vttEngine, vttCustomEndpoint)}
                            className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}

                    {(vttEngine === "whisper_api" || vttEngine === "custom") && (
                      <div className="flex flex-col gap-1.5 pt-2">
                        <label className="text-xs text-zinc-300">Optional VTT API Key / Token</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={vttApiKey}
                            onChange={(e) => setVttApiKey(e.target.value)}
                            placeholder="API Key for STT provider"
                            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          />
                          <button
                            type="button"
                            onClick={() => persistVttSettings(vttEngine, vttCustomEndpoint, vttApiKey)}
                            className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
                          >
                            Save Key
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* 2. AGENTS & IDENTITY SETTINGS                      */}
            {/* -------------------------------------------------- */}
            {activeCategory === "agents" && (
              <div className="space-y-6 animate-in fade-in-0 duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100">Agents & Identity</h2>
                    <p className="text-xs text-zinc-400">
                      Manage agent personas, models, and boundaries. All changes save strictly to each agent's dedicated <code className="text-zinc-300 font-mono">config.json</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreatingAgent(!isCreatingAgent)}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition-colors cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>{isCreatingAgent ? "Cancel" : "Create Agent"}</span>
                  </button>
                </div>

                {/* Create Agent Inline Form */}
                {isCreatingAgent && (
                  <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-4 animate-in fade-in-0 duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-violet-200 flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-violet-400" />
                        Scaffold New Autonomous Agent
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400">Agent Name *</label>
                        <input
                          type="text"
                          value={newAgentName}
                          onChange={(e) => setNewAgentName(e.target.value)}
                          placeholder="e.g. ScraperBot, DocsWriter"
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400">Role / Designation</label>
                        <input
                          type="text"
                          value={newAgentRole}
                          onChange={(e) => setNewAgentRole(e.target.value)}
                          placeholder="e.g. Web Intelligence & Scraping"
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400">Target Model</label>
                        <input
                          type="text"
                          value={newAgentModel}
                          onChange={(e) => setNewAgentModel(e.target.value)}
                          placeholder="e.g. 5.6 Terra High, Claude 3.7 Sonnet"
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400">Temperature ({newAgentTemp})</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={newAgentTemp}
                          onChange={(e) => setNewAgentTemp(parseFloat(e.target.value))}
                          className="mt-2 w-full accent-violet-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Tools Selection */}
                    <div>
                      <label className="text-[11px] font-medium text-zinc-400">Allowed Tool Manifest</label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {[
                          { id: "terminal", label: "Terminal Execution" },
                          { id: "filesystem", label: "Filesystem Edits" },
                          { id: "astLinter", label: "AST Safety Linter" },
                          { id: "web", label: "Stealth Web Browser" },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              setNewAgentTools((prev) => ({
                                ...prev,
                                [t.id]: !(prev as any)[t.id],
                              }))
                            }
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                              (newAgentTools as any)[t.id]
                                ? "bg-violet-600/20 text-violet-300 border-violet-500/40"
                                : "bg-zinc-900 text-zinc-500 border-zinc-800"
                            }`}
                          >
                            {(newAgentTools as any)[t.id] ? "✓ " : "+ "}
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingAgent(false)}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateNewAgent}
                        disabled={!newAgentName.trim()}
                        className="rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-medium text-white shadow-md hover:bg-violet-500 disabled:opacity-50 cursor-pointer"
                      >
                        Initialize Agent Workspace
                      </button>
                    </div>
                  </div>
                )}

                {/* Agents Roster Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {agents.map((ag) => (
                    <div
                      key={ag.id}
                      onClick={() => setSelectedAgentId(ag.id)}
                      className={`flex flex-col justify-between rounded-2xl border p-3.5 cursor-pointer transition-all ${
                        selectedAgent?.id === ag.id
                          ? "border-violet-500/60 bg-violet-950/20 shadow-md shadow-violet-900/10"
                          : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-zinc-200 truncate">{ag.name}</span>
                          <span className="size-2 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-1">{ag.role}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span className="truncate max-w-[90px]">{ag.model}</span>
                        <span>T: {ag.temperature}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Agent Editor (Saves strictly to config.json) */}
                {selectedAgent && (
                  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                          <span>Configure [{selectedAgent.name}]</span>
                          <span className="text-[10px] font-mono text-zinc-500 font-normal">
                            (~/.krypton/agents/{selectedAgent.name}/config.json)
                          </span>
                        </h3>
                      </div>
                      {selectedAgent.id !== "agent-root" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAgent(selectedAgent.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Delete Agent Workspace"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400">Agent Role</label>
                        <input
                          type="text"
                          value={selectedAgent.role}
                          onChange={(e) => handleUpdateAgentField(selectedAgent.id, { role: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-zinc-400">Primary Model</label>
                        <input
                          type="text"
                          value={selectedAgent.model}
                          onChange={(e) => handleUpdateAgentField(selectedAgent.id, { model: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                        <span>Temperature</span>
                        <span className="font-mono text-zinc-300">{selectedAgent.temperature}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedAgent.temperature}
                        onChange={(e) =>
                          handleUpdateAgentField(selectedAgent.id, { temperature: parseFloat(e.target.value) })
                        }
                        className="mt-2 w-full accent-violet-500 cursor-pointer"
                      />
                    </div>

                    {/* Permissions & Tool Boundaries */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800/60">
                      <span className="text-[11px] font-medium text-zinc-400">Tool Permissions</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: "terminal", label: "Terminal Execution", desc: "Execute local CLI commands & tests" },
                          { key: "filesystem", label: "Filesystem Edits", desc: "Read and write project files" },
                          { key: "astLinter", label: "AST Safety Check", desc: "Enforce static syntax safety checks" },
                          { key: "web", label: "Stealth Web Access", desc: "Browse URLs with AXTree navigation" },
                        ].map((p) => (
                          <div
                            key={p.key}
                            onClick={() => {
                              const curr = selectedAgent.permissions[p.key as keyof typeof selectedAgent.permissions]
                              handleUpdateAgentField(selectedAgent.id, {
                                permissions: {
                                  ...selectedAgent.permissions,
                                  [p.key]: !curr,
                                },
                              })
                            }}
                            className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-colors ${
                              (selectedAgent.permissions as any)[p.key]
                                ? "border-violet-500/30 bg-violet-950/10 text-zinc-200"
                                : "border-zinc-800/60 bg-zinc-900/20 text-zinc-500"
                            }`}
                          >
                            <input
                              type="checkbox"
                              readOnly
                              checked={(selectedAgent.permissions as any)[p.key]}
                              className="mt-0.5 accent-violet-500 cursor-pointer"
                            />
                            <div>
                              <div className="text-xs font-medium">{p.label}</div>
                              <div className="text-[10px] text-zinc-500">{p.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* 3. MODEL PROVIDERS SETTINGS                        */}
            {/* -------------------------------------------------- */}
            {activeCategory === "providers" && (
              <div className="space-y-6 animate-in fade-in-0 duration-150">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Model Providers</h2>
                  <p className="text-xs text-zinc-400">Configure API keys, custom endpoints, and dynamically verify connectivity.</p>
                </div>

                {/* Provider Selector Tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(["openai", "anthropic", "openrouter", "ollama", "custom"] as ModelProviderId[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(p)
                        setTestResult(null)
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer ${
                        selectedProvider === p
                          ? "bg-violet-600/20 text-violet-300 border-violet-500/40 shadow-xs"
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                      }`}
                    >
                      {PROVIDER_METADATA[p].name}
                    </button>
                  ))}
                </div>

                {/* Active Provider Configuration Card */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200">{PROVIDER_METADATA[selectedProvider].name}</h3>
                      <p className="text-[11px] text-zinc-500">{PROVIDER_METADATA[selectedProvider].tagline}</p>
                    </div>
                    <KeyRound className="size-4 text-zinc-500" />
                  </div>

                  {/* API Key Input */}
                  {PROVIDER_METADATA[selectedProvider].requiresApiKey && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-300">API Key *</label>
                      <div className="relative">
                        <input
                          type={showKeyMap[selectedProvider] ? "text" : "password"}
                          value={providerKeys[selectedProvider] || ""}
                          onChange={(e) => {
                            const val = e.target.value
                            setProviderKeys((prev) => ({ ...prev, [selectedProvider]: val }))
                          }}
                          placeholder={PROVIDER_METADATA[selectedProvider].keyPlaceholder}
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 pr-10 text-xs font-mono text-zinc-200 outline-none focus:border-violet-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowKeyMap((prev) => ({
                              ...prev,
                              [selectedProvider]: !prev[selectedProvider],
                            }))
                          }
                          className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                        >
                          {showKeyMap[selectedProvider] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Base URL Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-zinc-300">Base URL</label>
                    <input
                      type="text"
                      value={providerUrls[selectedProvider] || ""}
                      onChange={(e) => {
                        const val = e.target.value
                        setProviderUrls((prev) => ({ ...prev, [selectedProvider]: val }))
                      }}
                      placeholder={PROVIDER_METADATA[selectedProvider].urlPlaceholder}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Custom Model ID (for Custom provider) */}
                  {selectedProvider === "custom" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-300">Custom Model Name</label>
                      <input
                        type="text"
                        value={customModelId}
                        onChange={(e) => setCustomModelId(e.target.value)}
                        placeholder="e.g. meta-llama/Llama-3.3-70B-Instruct"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-violet-500"
                      />
                    </div>
                  )}

                  {/* Test Connection & Save Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => handleTestProviderConnection(selectedProvider)}
                      disabled={isTestingConnection}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-medium text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isTestingConnection ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Testing Endpoint...</span>
                        </>
                      ) : (
                        <>
                          <RotateCw className="size-3.5" />
                          <span>Test Connection & Discover Models</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        persistProviderCredentials(
                          selectedProvider,
                          providerKeys[selectedProvider] || "",
                          providerUrls[selectedProvider] || DEFAULT_PROVIDER_URLS[selectedProvider],
                          selectedProvider === "custom" ? customModelId : undefined
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Save className="size-3.5" />
                      <span>Save Key</span>
                    </button>
                  </div>

                  {/* Test Results Output */}
                  {testResult && testResult.provider === selectedProvider && (
                    <div
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs animate-in fade-in-0 duration-150 ${
                        testResult.success
                          ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                          : "border-rose-500/30 bg-rose-950/20 text-rose-300"
                      }`}
                    >
                      {testResult.success ? (
                        <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="size-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-0.5">
                        <div className="font-semibold">{testResult.success ? "Connection Verified" : "Verification Notice"}</div>
                        <div className="text-[11px] leading-relaxed opacity-90">{testResult.message}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* 4. APPEARANCE SETTINGS                             */}
            {/* -------------------------------------------------- */}
            {activeCategory === "appearance" && (
              <div className="space-y-6 animate-in fade-in-0 duration-150">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Appearance & Theme</h2>
                  <p className="text-xs text-zinc-400">Customise the desktop application theme, font scaling, and viewport density.</p>
                </div>

                {/* Theme Selector */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-200">Color Palette Theme</label>
                    <p className="text-[11px] text-zinc-500">Curated dark palettes designed for prolonged focus.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "dark", label: "Dark Obsidian", desc: "Default sleek Krypton dark", border: "#27272a" },
                      { id: "midnight", label: "Midnight Violet", desc: "Deep indigo & violet glow", border: "#6366f1" },
                      { id: "cyber", label: "Cyber Slate", desc: "Cool steel zinc tones", border: "#0ea5e9" },
                      { id: "oled", label: "OLED Black", desc: "Pure #000000 true black", border: "#52525b" },
                    ].map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          const next = t.id as any
                          setTheme(next)
                          persistAppearanceSettings(next, fontSize, uiDensity)
                        }}
                        className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                          theme === t.id
                            ? "border-violet-500 bg-violet-950/20 shadow-sm"
                            : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700"
                        }`}
                      >
                        <div
                          className="size-4 rounded-full mt-0.5 border"
                          style={{ borderColor: t.border, backgroundColor: theme === t.id ? t.border : "transparent" }}
                        />
                        <div>
                          <div className="text-xs font-semibold text-zinc-200">{t.label}</div>
                          <div className="text-[11px] text-zinc-500">{t.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Font Sizing */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-200">Font Sizing</label>
                    <p className="text-[11px] text-zinc-500">Adjust text scaling across cards, streams, and dialogs.</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { id: "compact", label: "Compact", scale: "13px" },
                      { id: "standard", label: "Standard", scale: "14px" },
                      { id: "comfortable", label: "Comfortable", scale: "15px" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          const next = f.id as any
                          setFontSize(next)
                          persistAppearanceSettings(theme, next, uiDensity)
                        }}
                        className={`rounded-xl border p-3 text-center transition-all cursor-pointer ${
                          fontSize === f.id
                            ? "border-violet-500 bg-violet-950/20 text-violet-300 font-semibold"
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        }`}
                      >
                        <div className="text-xs">{f.label}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Base {f.scale}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* UI Density */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-200">UI Density</label>
                    <p className="text-[11px] text-zinc-500">Control spacing between sidebar lists and drawer outputs.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "compact", label: "Compact Density", desc: "Tighter margins for high-resolution displays" },
                      { id: "comfortable", label: "Comfortable Density", desc: "Relaxed spacing and touch targets" },
                    ].map((d) => (
                      <div
                        key={d.id}
                        onClick={() => {
                          const next = d.id as any
                          setUiDensity(next)
                          persistAppearanceSettings(theme, fontSize, next)
                        }}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-all ${
                          uiDensity === d.id
                            ? "border-violet-500 bg-violet-950/20"
                            : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700"
                        }`}
                      >
                        <div
                          className={`size-3.5 rounded-full mt-0.5 border ${
                            uiDensity === d.id ? "border-violet-400 bg-violet-400" : "border-zinc-600"
                          }`}
                        />
                        <div>
                          <div className="text-xs font-semibold text-zinc-200">{d.label}</div>
                          <div className="text-[11px] text-zinc-500">{d.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
