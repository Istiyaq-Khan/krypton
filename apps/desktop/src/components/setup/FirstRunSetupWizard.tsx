"use client"

import React, { useState, useMemo } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  Bot,
  KeyRound,
  FolderCode,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Sparkles,
  Lock,
  Cpu,
  Eye,
  EyeOff,
  AlertCircle,
  Server,
  RotateCw,
  Loader2,
  Check,
  Minus,
  Square,
  ExternalLink,
  Search,
} from "lucide-react"
import {
  ModelProviderId,
  DiscoveredModel,
  PROVIDER_METADATA,
  PROVIDER_CATALOG,
  CatalogProvider,
  findCatalogProvider,
  parseNamespacedModel,
  formatNamespacedModel,
  getProviderMetadata,
  testAndFetchModels,
  persistCachedModels,
  sanitizeBaseUrl,
} from "@/lib/modelDiscovery"

export interface SetupCompletedData {
  agentName: string
  agentRole?: string
  provider: string
  primaryModel: string
  defaultWorkspaceDir: string
  askForApproval: boolean
  initialProjectName?: string
  vttEngine?: string
}

interface FirstRunSetupWizardProps {
  initialDefaultDir?: string
  onComplete: (data: SetupCompletedData) => void
  onCancel?: () => void
  isModal?: boolean
}

export function FirstRunSetupWizard({
  initialDefaultDir = "",
  onComplete,
  onCancel,
  isModal = false,
}: FirstRunSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4

  // Step 1: Agent Identity
  const [agentName, setAgentName] = useState("Orchestrator")

  // Step 2: Provider Selection & Model Discovery
  const [selectedProtocol, setSelectedProtocol] = useState<"openai" | "anthropic" | "local">("openai")
  const [selectedProviderId, setSelectedProviderId] = useState<string>("openai")
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState("")
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)

  // Dynamic Model Discovery State
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchSuccess, setFetchSuccess] = useState(false)
  const [primaryModel, setPrimaryModel] = useState("")
  const [isCustomModelInput, setIsCustomModelInput] = useState(false)

  // Step 3: Workspace Directory
  const [workspaceDir, setWorkspaceDir] = useState(initialDefaultDir || "projects")
  const [initialProjectName, setInitialProjectName] = useState("my-first-workspace")

  // Step 4: Security & Permissions
  const [askForApproval, setAskForApproval] = useState(true)
  const [astSafetyEnforced, setAstSafetyEnforced] = useState(true)
  const [telemetryEnabled, setTelemetryEnabled] = useState(false)

  // VTT Configuration State
  const [vttEngine, setVttEngine] = useState("whisper_local")
  const [vttCustomEndpoint, setVttCustomEndpoint] = useState("")
  const [vttApiKey, setVttApiKey] = useState("")

  // Submission status
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Window management handlers for dragging and window controls
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isTauri()) {
      await invoke("window_minimize").catch(console.error)
    }
  }

  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (isTauri()) {
      await invoke("window_toggle_maximize").catch(console.error)
    }
  }

  const handleHeaderDoubleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const isDragRegion =
      target.getAttribute("data-tauri-drag-region") !== null &&
      target.getAttribute("data-tauri-drag-region") !== "false"
    if (isDragRegion) {
      await handleToggleMaximize(e)
    }
  }

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest("[data-tauri-drag-region='false']") ||
      target.closest("button") ||
      target.closest("input")
    ) {
      return
    }
    if (e.button === 0 && isTauri()) {
      invoke("window_start_dragging").catch(() => {})
    }
  }

  // Active provider metadata
  const currentMeta = useMemo(() => {
    return getProviderMetadata(selectedProviderId)
  }, [selectedProviderId])

  // Filtered catalog presets
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return PROVIDER_CATALOG.slice(0, 15)
    const q = catalogSearch.toLowerCase().trim()
    return PROVIDER_CATALOG.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.apiUrl.toLowerCase().includes(q)
    )
  }, [catalogSearch])

  const handleSelectPreset = (preset: CatalogProvider) => {
    setSelectedProviderId(preset.id)
    setSelectedProtocol(preset.protocol === "anthropic" ? "anthropic" : preset.isLocal ? "local" : "openai")
    setBaseUrl(preset.apiUrl)
    setIsCatalogOpen(false)
    setCatalogSearch("")
    setDiscoveredModels([])
    setFetchSuccess(false)
    setFetchError(null)
    setPrimaryModel("")
    setIsCustomModelInput(false)
  }

  const handleProtocolSelect = (protocol: "openai" | "anthropic" | "local") => {
    setSelectedProtocol(protocol)
    setDiscoveredModels([])
    setFetchSuccess(false)
    setFetchError(null)
    setPrimaryModel("")
    setIsCustomModelInput(false)

    if (protocol === "openai") {
      setSelectedProviderId("openai")
      setBaseUrl("https://api.openai.com/v1")
    } else if (protocol === "anthropic") {
      setSelectedProviderId("anthropic")
      setBaseUrl("https://api.anthropic.com/v1")
    } else {
      setSelectedProviderId("ollama")
      setBaseUrl("http://localhost:11434")
    }
  }

  const handleTestAndFetch = async () => {
    setIsFetchingModels(true)
    setFetchError(null)
    setFetchSuccess(false)

    const trimmedKey = apiKey.trim()
    const rawBaseUrl = baseUrl.trim()
    const cleanBaseUrl = sanitizeBaseUrl(rawBaseUrl)

    if (cleanBaseUrl && cleanBaseUrl !== rawBaseUrl) {
      setBaseUrl(cleanBaseUrl)
    }

    if (isTauri()) {
      await invoke("spawn_daemon").catch(() => {})
    }

    const res = await testAndFetchModels({
      provider: selectedProviderId,
      apiKey: trimmedKey || undefined,
      baseUrl: cleanBaseUrl || undefined,
      useProxy: true,
    })

    setIsFetchingModels(false)
    if (res.success && res.models.length > 0) {
      setDiscoveredModels(res.models)
      setFetchSuccess(true)

      // Intelligent pre-selection of popular/recommended model
      const preferred =
        res.models.find(
          (m) =>
            m.id.includes("gpt-4o") ||
            m.id.includes("claude-3-7-sonnet") ||
            m.id.includes("claude-3-5-sonnet") ||
            m.id.includes("llama-3.3") ||
            m.id.includes("llama-3.1") ||
            m.id.includes("deepseek") ||
            m.id.includes("meta/")
        )?.id || res.models[0].id

      setPrimaryModel(preferred)
    } else {
      setDiscoveredModels([])
      setFetchSuccess(false)
      setFetchError(res.error || "Failed to discover models from provider.")
    }
  }

  const handleNext = () => {
    setErrorMsg(null)
    if (currentStep === 1) {
      if (!agentName.trim()) {
        setErrorMsg("Please specify a valid agent identity name.")
        return
      }
    } else if (currentStep === 2) {
      if (!fetchSuccess || discoveredModels.length === 0 || !primaryModel.trim()) {
        setErrorMsg(
          "Please test and fetch models from your selected provider and choose a Primary Reasoning Model before continuing."
        )
        return
      }
    } else if (currentStep === 3) {
      if (!workspaceDir.trim()) {
        setErrorMsg("Please specify a valid workspace root directory.")
        return
      }
    }
    setCurrentStep((prev) => Math.min(totalSteps, prev + 1))
  }

  const handleBack = () => {
    setErrorMsg(null)
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const handleFinish = async () => {
    setIsSaving(true)
    setErrorMsg(null)

    const trimmedKey = apiKey.trim()
    const cleanBaseUrl = sanitizeBaseUrl(baseUrl.trim())
    const namespacedModel = primaryModel.includes("/")
      ? primaryModel
      : formatNamespacedModel(selectedProviderId, primaryModel.trim())

    const payload = {
      agentName: agentName.trim() || "Orchestrator",
      provider: selectedProviderId,
      primaryModel: namespacedModel,
      apiKeys: {
        provider: selectedProviderId,
        anthropic: selectedProtocol === "anthropic" ? trimmedKey : undefined,
        openai: selectedProtocol !== "anthropic" ? trimmedKey : undefined,
        customEndpoint: cleanBaseUrl,
        customModel: namespacedModel,
        baseUrl: cleanBaseUrl,
        apiKey: trimmedKey,
      },
      cachedModels: discoveredModels,
      defaultWorkspaceDir: workspaceDir.trim(),
      askForApproval,
      astSafetyEnforced,
      telemetryEnabled,
      vttEngine,
      vttCustomEndpoint: vttCustomEndpoint.trim() || undefined,
      vttApiKey: vttApiKey.trim() || undefined,
    }

    try {
      if (isTauri()) {
        await invoke("save_setup_configuration", { payload })
      }

      await persistCachedModels({
        provider: selectedProviderId,
        baseUrl: cleanBaseUrl,
        models: discoveredModels,
        updatedAt: Date.now(),
      })

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "krypton_provider_config",
          JSON.stringify({
            provider: selectedProviderId,
            model: namespacedModel,
            baseUrl: cleanBaseUrl,
            apiKey: trimmedKey,
          })
        )
        localStorage.setItem(
          "krypton_vtt_config",
          JSON.stringify({
            engine: vttEngine,
            customEndpoint: vttCustomEndpoint.trim() || undefined,
            apiKey: vttApiKey.trim() || undefined,
          })
        )
      }

      onComplete({
        agentName: payload.agentName,
        provider: payload.provider,
        primaryModel: payload.primaryModel,
        defaultWorkspaceDir: payload.defaultWorkspaceDir,
        askForApproval: payload.askForApproval,
        initialProjectName: initialProjectName.trim() || "my-first-workspace",
      })
    } catch (err: any) {
      console.error("Failed to save setup configuration:", err)
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to persist configuration.")
      setIsSaving(false)
    }
  }

  const stepLabels = [
    { title: "Agent Identity", icon: Bot },
    { title: "Model Endpoints", icon: KeyRound },
    { title: "Workspace Storage", icon: FolderCode },
    { title: "Security Guardrails", icon: ShieldCheck },
  ]

  return (
    <div
      className={`flex flex-col ${
        isModal
          ? "w-full max-w-2xl"
          : "h-screen w-screen bg-zinc-950 text-zinc-100 select-none antialiased overflow-hidden"
      }`}
    >
      {/* Native Desktop Window Drag Region & Header Bar (Mandatory Non-Dismissible Onboarding Window) */}
      {!isModal && (
        <header
          data-tauri-drag-region
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          onMouseDown={handleHeaderMouseDown}
          onDoubleClick={handleHeaderDoubleClick}
          className="flex h-10 w-full shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-3 text-xs text-zinc-400 select-none z-30 relative app-region-drag"
        >
          {/* Left Segment: Logo & Title */}
          <div data-tauri-drag-region className="flex items-center gap-2 select-none">
            <div className="size-5 rounded bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xs">
              <Sparkles className="size-3 text-white" />
            </div>
            <span className="font-semibold text-xs tracking-tight text-zinc-200">Krypton</span>
            <span className="text-[11px] text-zinc-500 font-mono">| Setup & Host Initialization</span>
          </div>

          {/* Center Draggable Spacer */}
          <div
            data-tauri-drag-region
            className="flex-1 h-full mx-4 cursor-default select-none"
          />

          {/* Right Segment: Window controls (Minimize, Maximize - STRICTLY NO CLOSE BUTTON) */}
          <div
            data-tauri-drag-region="false"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="flex items-center gap-1 app-region-no-drag z-10"
          >
            <button
              type="button"
              onClick={handleMinimize}
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex h-7 w-8 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors pointer-events-auto cursor-pointer"
              title="Minimize"
              aria-label="Minimize"
            >
              <Minus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximize}
              data-tauri-drag-region="false"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
              className="flex h-7 w-8 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors pointer-events-auto cursor-pointer"
              title="Maximize"
              aria-label="Maximize"
            >
              <Square className="size-3" />
            </button>
          </div>
        </header>
      )}

      {/* Main Wizard Content Area */}
      <div
        data-tauri-drag-region
        className="flex-1 overflow-y-auto flex items-center justify-center p-6"
      >
        <div
          data-tauri-drag-region="false"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl app-region-no-drag"
        >
          {/* Header Branding */}
          <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-lg shadow-violet-900/40">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">Krypton Runtime Setup</h2>
                <p className="text-xs text-zinc-400">First-run host configuration & autonomous engine initialization</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-mono font-medium text-zinc-400">
                Step {currentStep} of {totalSteps}
              </span>
              {isModal && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Close
                </button>
              )}
            </div>
          </div>

          {/* Step Progress Pills */}
          <div className="grid grid-cols-4 gap-2 my-6">
            {stepLabels.map((step, idx) => {
              const stepNum = idx + 1
              const isCompleted = stepNum < currentStep
              const isActive = stepNum === currentStep
              const StepIcon = step.icon

              return (
                <div
                  key={stepNum}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                    isActive
                      ? "border-violet-500/80 bg-violet-950/30 text-violet-200 shadow-sm"
                      : isCompleted
                      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isCompleted ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <StepIcon className="size-4" />
                    )}
                    <span className="text-[11px] font-medium truncate">{step.title}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-800/80 bg-rose-950/30 p-3 text-xs text-rose-300">
              <AlertCircle className="size-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Agent Identity */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. Orchestrator, Jarvis, Athena"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
                <span className="text-[11px] text-zinc-500">
                  This name serves as the root supervisor identity in ~/.krypton/agents/
                </span>
              </div>

              {/* File-Driven System Prompt Engine Indicator */}
              <div className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-4 text-xs">
                <div className="flex items-center gap-2 font-medium text-violet-300 mb-1.5">
                  <Sparkles className="size-4 text-violet-400 shrink-0" />
                  <span>File-Driven System Prompt Architecture</span>
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Operating directives, persona details, and reasoning behaviors are dynamically loaded from Markdown templates in{" "}
                  <code className="rounded bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[11px] text-violet-200">~/.krypton/system.md</code> and{" "}
                  <code className="rounded bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[11px] text-violet-200">~/.krypton/agents/root.md</code>.
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-400 border-t border-violet-950/60 pt-2.5">
                  <Check className="size-3.5 text-emerald-400 shrink-0" />
                  <span>Fully customizable anytime via local markdown files or self-updating agent tools.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Decoupled Provider-First Selection & Dynamic Backend Model Discovery */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
              {/* 2A: Protocol Selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">
                    1. Select AI Model Protocol
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCatalogOpen(!isCatalogOpen)}
                    className="text-[11px] text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <span>Browse 60+ Providers Catalog</span>
                    <ChevronDown className="size-3" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleProtocolSelect("openai")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all cursor-pointer ${
                      selectedProtocol === "openai"
                        ? "border-violet-500 bg-violet-950/40 text-violet-100 ring-1 ring-violet-500"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <Sparkles className={`size-4 mb-1.5 ${selectedProtocol === "openai" ? "text-violet-400" : "text-zinc-400"}`} />
                    <span className="text-xs font-semibold">OpenAI-Compatible</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-full">NVIDIA NIM, Groq, OpenAI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProtocolSelect("anthropic")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all cursor-pointer ${
                      selectedProtocol === "anthropic"
                        ? "border-violet-500 bg-violet-950/40 text-violet-100 ring-1 ring-violet-500"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <Cpu className={`size-4 mb-1.5 ${selectedProtocol === "anthropic" ? "text-violet-400" : "text-zinc-400"}`} />
                    <span className="text-xs font-semibold">Anthropic-Compatible</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-full">Claude 3.7 / 3.5 Sonnet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProtocolSelect("local")}
                    className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all cursor-pointer ${
                      selectedProtocol === "local"
                        ? "border-violet-500 bg-violet-950/40 text-violet-100 ring-1 ring-violet-500"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <Server className={`size-4 mb-1.5 ${selectedProtocol === "local" ? "text-violet-400" : "text-zinc-400"}`} />
                    <span className="text-xs font-semibold">Local / Ollama</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-full">Offline Llama, DeepSeek</span>
                  </button>
                </div>
              </div>

              {/* Quick Presets / Catalog Dropdown */}
              {isCatalogOpen && (
                <div className="rounded-xl border border-violet-800/60 bg-zinc-950 p-3 shadow-xl flex flex-col gap-2">
                  <div className="relative">
                    <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search providers (e.g. nvidia, groq, deepseek, together, mistral)..."
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-100 outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto grid grid-cols-2 gap-1.5 pt-1">
                    {filteredCatalog.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`flex flex-col text-left p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                          selectedProviderId === preset.id
                            ? "border-violet-500 bg-violet-950/40 text-violet-200"
                            : "border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        <span className="font-semibold text-[11px] truncate">{preset.name}</span>
                        <span className="text-[10px] text-zinc-500 truncate">{preset.apiUrl}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 2B: Provider Configuration Inputs */}
              <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200">
                      2. Configure {currentMeta.name} Endpoint & Credentials
                    </span>
                    {currentMeta.docsUrl && (
                      <a
                        href={currentMeta.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                      >
                        <span>Docs</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">Proxied via native backend</span>
                </div>

                {/* Base URL input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">Endpoint Base URL</label>
                    <span className="text-[10px] text-zinc-500 truncate max-w-[280px]">
                      {currentMeta.urlPlaceholder}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    onBlur={() => setBaseUrl(sanitizeBaseUrl(baseUrl))}
                    placeholder={currentMeta.urlPlaceholder}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>

                {/* API Key input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">
                      {selectedProtocol === "local" ? "API Key / Token (Optional)" : "API Key / Bearer Token"}
                    </label>
                    {currentMeta.apiKeyUrl && (
                      <a
                        href={currentMeta.apiKeyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-0.5"
                      >
                        <span>Get API Key</span>
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={currentMeta.keyPlaceholder}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 pr-10 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 2C: Test & Fetch Models Action */}
                <div className="pt-1 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestAndFetch}
                    disabled={isFetchingModels}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
                  >
                    {isFetchingModels ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin text-violet-400" />
                        <span>Connecting & Discovering Models...</span>
                      </>
                    ) : (
                      <>
                        <RotateCw className="size-3.5 text-violet-400" />
                        <span>Test & Fetch Models</span>
                      </>
                    )}
                  </button>

                  {fetchSuccess && (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                      <Check className="size-3.5" />
                      <span>{discoveredModels.length} models discovered</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Banner */}
              {fetchError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-800/80 bg-rose-950/40 p-3 text-xs text-rose-300 animate-in fade-in-50">
                  <AlertCircle className="size-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="font-semibold">Endpoint Discovery Failed</span>
                    <span className="mt-0.5 text-rose-300/90">{fetchError}</span>
                  </div>
                </div>
              )}

              {/* Success Banner & 2D: Primary Reasoning Model Selector */}
              {fetchSuccess && discoveredModels.length > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 animate-in fade-in-50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-400" />
                      <span>3. Primary Reasoning Model</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsCustomModelInput(!isCustomModelInput)}
                      className="text-[10px] text-zinc-400 hover:text-zinc-200 underline"
                    >
                      {isCustomModelInput ? "Select from discovered list" : "Enter unlisted model ID"}
                    </button>
                  </div>

                  {isCustomModelInput ? (
                    <input
                      type="text"
                      value={primaryModel}
                      onChange={(e) => setPrimaryModel(e.target.value)}
                      placeholder="e.g. meta/llama-3.1-70b-instruct or gpt-4o"
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  ) : (
                    <select
                      value={primaryModel}
                      onChange={(e) => setPrimaryModel(e.target.value)}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-medium text-zinc-100 outline-none focus:border-emerald-500 cursor-pointer max-h-48"
                    >
                      {discoveredModels.map((m) => (
                        <option key={m.id} value={m.id} className="bg-zinc-900 text-zinc-200">
                          {m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="text-[11px] text-emerald-300/80 font-mono">
                    Namespaced Identifier:{" "}
                    <span className="text-emerald-200 font-semibold">
                      {primaryModel.includes("/") ? primaryModel : `${selectedProviderId}/${primaryModel}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Zero Lock-in Notice */}
              <div className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                <Lock className="size-4 text-zinc-500 shrink-0" />
                <span className="text-[11px] leading-relaxed">
                  Krypton operates with <strong className="text-zinc-300">zero server lock-in</strong>. All discovery and inference network calls execute exclusively via the local backend bridge.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Workspace Directory */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">Workspace Root Directory</label>
                <input
                  type="text"
                  value={workspaceDir}
                  onChange={(e) => setWorkspaceDir(e.target.value)}
                  placeholder="e.g. E:\all my code\Projects or ~/projects"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
                <span className="text-[11px] text-zinc-500">
                  Autonomous agents will mount isolated worktrees and sandboxes under this directory.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">Initial Project Name</label>
                <input
                  type="text"
                  value={initialProjectName}
                  onChange={(e) => setInitialProjectName(e.target.value)}
                  placeholder="e.g. my-first-workspace"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
                <span className="text-[11px] text-zinc-500">
                  Initial workspace directory to bootstrap inside the project explorer.
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: Security Guardrails & Speech Audio Engine */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs">
                <span className="font-semibold text-zinc-200">Autonomous Execution Guardrails</span>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={askForApproval}
                    onChange={(e) => setAskForApproval(e.target.checked)}
                    className="size-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-zinc-300">Require human visual diff approval before committing changes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={astSafetyEnforced}
                    onChange={(e) => setAstSafetyEnforced(e.target.checked)}
                    className="size-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-zinc-300">Enforce AST syntax tree verification before executing code</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telemetryEnabled}
                    onChange={(e) => setTelemetryEnabled(e.target.checked)}
                    className="size-4 rounded border-zinc-700 bg-zinc-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-zinc-300">Share anonymous diagnostic telemetry to improve Krypton</span>
                </label>
              </div>

              {/* Voice-To-Text (VTT) Transcription Engine */}
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs">
                <span className="font-semibold text-zinc-200">Voice-To-Text (VTT) Transcription Engine</span>
                <select
                  value={vttEngine}
                  onChange={(e) => setVttEngine(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-violet-500"
                >
                  <option value="whisper_local">Whisper Local — Encoder-Decoder Autoregressive (Whisper.cpp / ONNX)</option>
                  <option value="nvidia/parakeet-tdt-0.6b-v3">NVIDIA Parakeet TDT 0.6B v3 — Fast Conformer RNN-T / TDT Streaming Transducer</option>
                  <option value="whisper_api">OpenAI Whisper Cloud API</option>
                  <option value="custom">Custom Audio Endpoint</option>
                </select>
                {vttEngine === "custom" && (
                  <div className="flex flex-col gap-2 mt-2">
                    <input
                      type="text"
                      value={vttCustomEndpoint}
                      onChange={(e) => setVttCustomEndpoint(e.target.value)}
                      placeholder="e.g. http://localhost:8000/v1/audio/transcriptions"
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200"
                    />
                    <input
                      type="password"
                      value={vttApiKey}
                      onChange={(e) => setVttApiKey(e.target.value)}
                      placeholder="Optional STT Bearer Token"
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-zinc-800">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="size-4" />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            <div>
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2 text-xs font-medium text-white shadow-lg shadow-violet-900/40 transition-all cursor-pointer"
                >
                  <span>Continue</span>
                  <ChevronRight className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-900/50 transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <span>Initializing Krypton...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      <span>Launch Krypton</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
