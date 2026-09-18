"use client"

import React, { useState } from "react"
import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  Bot,
  KeyRound,
  FolderCode,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Lock,
  Cpu,
  Eye,
  EyeOff,
  AlertCircle,
  Server,
  Globe,
  Sliders,
  RotateCw,
  Loader2,
  Check,
} from "lucide-react"
import {
  ModelProviderId,
  DiscoveredModel,
  PROVIDER_METADATA,
  DEFAULT_PROVIDER_URLS,
  testAndFetchModels,
  persistCachedModels,
} from "@/lib/modelDiscovery"

export interface SetupCompletedData {
  agentName: string
  agentRole: string
  provider: string
  primaryModel: string
  defaultWorkspaceDir: string
  askForApproval: boolean
  initialProjectName?: string
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
  const [agentRole, setAgentRole] = useState("Autonomous Desktop AI Agent & System Orchestrator")
  const [reasoningTone, setReasoningTone] = useState("strict")

  // Step 2: Sequential Provider Selection & Model Discovery
  const [selectedProvider, setSelectedProvider] = useState<ModelProviderId>("openai")
  const [openaiKey, setOpenaiKey] = useState("")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434")
  const [openrouterKey, setOpenrouterKey] = useState("")
  const [openrouterBaseUrl, setOpenrouterBaseUrl] = useState("https://openrouter.ai/api/v1")
  const [customBaseUrl, setCustomBaseUrl] = useState("")
  const [customApiKey, setCustomApiKey] = useState("")
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

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

  // Submission status
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const toggleShowKey = (field: string) => {
    setShowKey((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const handleProviderSelect = (prov: ModelProviderId) => {
    if (prov !== selectedProvider) {
      setSelectedProvider(prov)
      setDiscoveredModels([])
      setFetchSuccess(false)
      setFetchError(null)
      setPrimaryModel("")
      setIsCustomModelInput(false)
    }
  }

  const handleTestAndFetch = async () => {
    setIsFetchingModels(true)
    setFetchError(null)
    setFetchSuccess(false)

    let apiKey: string | undefined
    let baseUrl: string | undefined

    if (selectedProvider === "openai") {
      apiKey = openaiKey
    } else if (selectedProvider === "anthropic") {
      apiKey = anthropicKey
    } else if (selectedProvider === "ollama") {
      baseUrl = ollamaBaseUrl
    } else if (selectedProvider === "openrouter") {
      apiKey = openrouterKey
      baseUrl = openrouterBaseUrl
    } else if (selectedProvider === "custom") {
      baseUrl = customBaseUrl
      apiKey = customApiKey
    }

    const res = await testAndFetchModels({
      provider: selectedProvider,
      apiKey,
      baseUrl,
    })

    setIsFetchingModels(false)
    if (res.success && res.models.length > 0) {
      setDiscoveredModels(res.models)
      setFetchSuccess(true)

      // Intelligent pre-selection of popular/recommended model
      const preferred =
        res.models.find((m) =>
          m.id.includes("gpt-4o") ||
          m.id.includes("claude-3-7-sonnet") ||
          m.id.includes("claude-3-5-sonnet") ||
          m.id.includes("llama3") ||
          m.id.includes("deepseek")
        )?.id || res.models[0].id

      setPrimaryModel(preferred)
    } else {
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

    const apiKey =
      selectedProvider === "openai"
        ? openaiKey.trim()
        : selectedProvider === "anthropic"
        ? anthropicKey.trim()
        : selectedProvider === "openrouter"
        ? openrouterKey.trim()
        : selectedProvider === "custom"
        ? customApiKey.trim()
        : undefined

    const baseUrl =
      selectedProvider === "ollama"
        ? ollamaBaseUrl.trim()
        : selectedProvider === "openrouter"
        ? openrouterBaseUrl.trim()
        : selectedProvider === "custom"
        ? customBaseUrl.trim()
        : undefined

    const payload = {
      agentName: agentName.trim() || "Orchestrator",
      agentRole: agentRole.trim(),
      provider: selectedProvider,
      primaryModel: primaryModel.trim(),
      apiKeys: {
        provider: selectedProvider,
        anthropic: selectedProvider === "anthropic" ? anthropicKey.trim() : undefined,
        openai: selectedProvider === "openai" ? openaiKey.trim() : undefined,
        openrouter: selectedProvider === "openrouter" ? openrouterKey.trim() : undefined,
        customEndpoint: baseUrl,
        customModel: primaryModel.trim(),
        baseUrl,
        apiKey,
      },
      cachedModels: discoveredModels,
      defaultWorkspaceDir: workspaceDir.trim(),
      askForApproval,
      astSafetyEnforced,
      telemetryEnabled,
    }

    try {
      if (isTauri()) {
        await invoke("save_setup_configuration", { payload })
      }

      // Persist discovered models into local cache
      await persistCachedModels({
        provider: selectedProvider,
        baseUrl,
        models: discoveredModels,
        updatedAt: Date.now(),
      })

      // Store provider metadata in localStorage for web fallback
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "krypton_provider_config",
          JSON.stringify({
            provider: selectedProvider,
            model: primaryModel.trim(),
            baseUrl,
            apiKey,
          })
        )
      }

      onComplete({
        agentName: payload.agentName,
        agentRole: payload.agentRole,
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

  const providerCards: Array<{
    id: ModelProviderId
    name: string
    tagline: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { id: "openai", name: "OpenAI", tagline: "GPT-4o, o3-mini", icon: Sparkles },
    { id: "anthropic", name: "Anthropic", tagline: "Claude 3.7 / 3.5", icon: Cpu },
    { id: "ollama", name: "Ollama / Local", tagline: "Offline runtime", icon: Server },
    { id: "openrouter", name: "OpenRouter", tagline: "Unified multi-gateway", icon: Globe },
    { id: "custom", name: "Custom", tagline: "OpenAI-compatible", icon: Sliders },
  ]

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 ${
        isModal ? "w-full max-w-2xl" : "h-screen w-screen bg-zinc-950 text-zinc-100 select-none antialiased"
      }`}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl">
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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Agent Role & Operating Directive</label>
              <input
                type="text"
                value={agentRole}
                onChange={(e) => setAgentRole(e.target.value)}
                placeholder="e.g. Autonomous Desktop AI Agent & System Orchestrator"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Reasoning Style & Tone</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "strict", title: "Strict & Analytical", desc: "Prioritizes safety and type invariants" },
                  { id: "intuitive", title: "Autonomous Agile", desc: "Balanced speed with verification" },
                  { id: "exploratory", title: "Research & Synthesis", desc: "Exploratory architectural planning" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setReasoningTone(item.id)}
                    className={`flex flex-col rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      reasoningTone === item.id
                        ? "border-violet-500 bg-violet-950/40 text-violet-200"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    <span className="text-xs font-medium text-zinc-200">{item.title}</span>
                    <span className="text-[10px] text-zinc-500 mt-1">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Sequential Provider-First Selection & Dynamic Model Discovery */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
            {/* 2A: Provider Selection Cards */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                1. Select AI Model Provider
              </label>
              <div className="grid grid-cols-5 gap-2">
                {providerCards.map((prov) => {
                  const isSelected = selectedProvider === prov.id
                  const Icon = prov.icon
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleProviderSelect(prov.id)}
                      className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all cursor-pointer ${
                        isSelected
                          ? "border-violet-500 bg-violet-950/40 text-violet-100 shadow-md shadow-violet-900/20 ring-1 ring-violet-500"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-400"
                      }`}
                    >
                      <Icon className={`size-4 mb-1.5 ${isSelected ? "text-violet-400" : "text-zinc-400"}`} />
                      <span className="text-xs font-semibold leading-none">{prov.name}</span>
                      <span className="text-[9px] text-zinc-500 mt-1 truncate max-w-full">{prov.tagline}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2B: Isolated Provider Inputs */}
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-200">
                  2. Configure {PROVIDER_METADATA[selectedProvider].name} Credentials
                </span>
                <span className="text-[10px] text-zinc-500">AES-256 encrypted in ~/.krypton/</span>
              </div>

              {/* OpenAI: API Key */}
              {selectedProvider === "openai" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400">OpenAI API Key</label>
                  <div className="relative">
                    <input
                      type={showKey["openai"] ? "text" : "password"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 pr-10 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("openai")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showKey["openai"] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Anthropic: API Key */}
              {selectedProvider === "anthropic" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400">Anthropic API Key</label>
                  <div className="relative">
                    <input
                      type={showKey["anthropic"] ? "text" : "password"}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-api03-..."
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 pr-10 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey("anthropic")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showKey["anthropic"] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Ollama: Base URL */}
              {selectedProvider === "ollama" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-400">Ollama Local Server URL</label>
                  <input
                    type="text"
                    value={ollamaBaseUrl}
                    onChange={(e) => setOllamaBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                  <span className="text-[10px] text-zinc-500">
                    Connects to local Ollama daemon. No external API key required.
                  </span>
                </div>
              )}

              {/* OpenRouter: API Key + Base URL */}
              {selectedProvider === "openrouter" && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-zinc-400">OpenRouter API Key</label>
                    <div className="relative">
                      <input
                        type={showKey["openrouter"] ? "text" : "password"}
                        value={openrouterKey}
                        onChange={(e) => setOpenrouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 pr-10 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey("openrouter")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showKey["openrouter"] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-zinc-400">Base URL</label>
                    <input
                      type="text"
                      value={openrouterBaseUrl}
                      onChange={(e) => setOpenrouterBaseUrl(e.target.value)}
                      placeholder="https://openrouter.ai/api/v1"
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Custom: Base URL + Optional API Key */}
              {selectedProvider === "custom" && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-zinc-400">OpenAI-Compatible Base URL</label>
                    <input
                      type="text"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder="http://localhost:8000/v1 or https://api.my-llm.com/v1"
                      className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-zinc-400">Optional API Key / Bearer Token</label>
                    <div className="relative">
                      <input
                        type={showKey["custom"] ? "text" : "password"}
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        placeholder="Optional API Key"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 pr-10 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey("custom")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showKey["custom"] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                      <span>Validating & Fetching Models...</span>
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
                    placeholder="e.g. gpt-4o, claude-3-7-sonnet-20250219"
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
                <span className="text-[10px] text-zinc-400">
                  This model will be used by the root supervisor agent. You can switch models anytime in the command bar.
                </span>
              </div>
            )}

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 flex items-start gap-2.5 text-xs text-zinc-400">
              <Lock className="size-4 text-violet-400 shrink-0 mt-0.5" />
              <span>
                Krypton operates with <strong>zero server lock-in</strong>. Your API keys are encrypted on your machine using native AES-256-GCM and cached locally in ~/.krypton/.
              </span>
            </div>
          </div>
        )}

        {/* STEP 3: Workspace Directory */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Default Workspace Root Directory</label>
              <input
                type="text"
                value={workspaceDir}
                onChange={(e) => setWorkspaceDir(e.target.value)}
                placeholder="e.g. C:/Projects or /home/user/projects"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
              <span className="text-[11px] text-zinc-500">
                Krypton will create isolated Git worktrees under ~/.krypton/worktrees/ for each task.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Initial Project Name</label>
              <input
                type="text"
                value={initialProjectName}
                onChange={(e) => setInitialProjectName(e.target.value)}
                placeholder="e.g. my-app, backend-service"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>
          </div>
        )}

        {/* STEP 4: Security & Permissions */}
        {currentStep === 4 && (
          <div className="flex flex-col gap-3.5 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
              <div className="flex flex-col pr-4">
                <span className="text-xs font-semibold text-zinc-200">Human-in-the-Loop (HITL) Approval Gate</span>
                <span className="text-[11px] text-zinc-400 mt-0.5">
                  Require explicit human approval before executing shell commands or writing files.
                </span>
              </div>
              <input
                type="checkbox"
                checked={askForApproval}
                onChange={(e) => setAskForApproval(e.target.checked)}
                className="size-4 rounded accent-violet-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
              <div className="flex flex-col pr-4">
                <span className="text-xs font-semibold text-zinc-200">Enforce Static AST Linter Sandbox</span>
                <span className="text-[11px] text-zinc-400 mt-0.5">
                  Block dangerous OS operations, eval, and unverified subprocess calls.
                </span>
              </div>
              <input
                type="checkbox"
                checked={astSafetyEnforced}
                onChange={(e) => setAstSafetyEnforced(e.target.checked)}
                className="size-4 rounded accent-violet-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
              <div className="flex flex-col pr-4">
                <span className="text-xs font-semibold text-zinc-200">Anonymous Telemetry</span>
                <span className="text-[11px] text-zinc-400 mt-0.5">
                  Opt-in telemetry for debugging and crash logs. Disabled by default.
                </span>
              </div>
              <input
                type="checkbox"
                checked={telemetryEnabled}
                onChange={(e) => setTelemetryEnabled(e.target.checked)}
                className="size-4 rounded accent-violet-600 cursor-pointer"
              />
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
  )
}
