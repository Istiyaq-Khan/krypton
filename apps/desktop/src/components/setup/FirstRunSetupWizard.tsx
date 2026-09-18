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
} from "lucide-react"

export interface SetupCompletedData {
  agentName: string
  agentRole: string
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

  // Step 2: Credentials & Endpoints
  const [primaryModel, setPrimaryModel] = useState("5.6 Terra High")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [openaiKey, setOpenaiKey] = useState("")
  const [customEndpoint, setCustomEndpoint] = useState("")
  const [customModel, setCustomModel] = useState("")
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)

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

  const handleNext = () => {
    setErrorMsg(null)
    if (currentStep === 1) {
      if (!agentName.trim()) {
        setErrorMsg("Please specify a valid agent identity name.")
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

    const payload = {
      agentName: agentName.trim() || "Orchestrator",
      agentRole: agentRole.trim(),
      primaryModel,
      apiKeys: {
        anthropic: anthropicKey.trim() || undefined,
        openai: openaiKey.trim() || undefined,
        customEndpoint: customEndpoint.trim() || undefined,
        customModel: customModel.trim() || undefined,
      },
      defaultWorkspaceDir: workspaceDir.trim(),
      askForApproval,
      astSafetyEnforced,
      telemetryEnabled,
    }

    try {
      if (isTauri()) {
        await invoke("save_setup_configuration", { payload })
      }

      onComplete({
        agentName: payload.agentName,
        agentRole: payload.agentRole,
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
    <div className={`flex flex-col items-center justify-center p-6 ${isModal ? "w-full max-w-2xl" : "h-screen w-screen bg-zinc-950 text-zinc-100 select-none antialiased"}`}>
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

        {/* STEP 2: Model Endpoints & API Credentials */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Primary Reasoning Model</label>
              <select
                value={primaryModel}
                onChange={(e) => setPrimaryModel(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-medium text-zinc-100 outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="5.6 Terra High">5.6 Terra High (Recommended Local Runtime)</option>
                <option value="Claude 3.7 Sonnet">Claude 3.7 Sonnet (Anthropic API)</option>
                <option value="GPT-4o">GPT-4o (OpenAI API)</option>
                <option value="DeepSeek R1">DeepSeek R1 (High Reasoning)</option>
                <option value="Local Llama 3.3">Local Llama 3.3 (Ollama / Local Server)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Anthropic API Key (Optional)</span>
                <span className="text-[10px] text-zinc-500 font-normal">Encrypted locally in ~/.krypton/</span>
              </label>
              <div className="relative">
                <input
                  type={showAnthropicKey ? "text" : "password"}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 pr-10 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showAnthropicKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>OpenAI API Key (Optional)</span>
                <span className="text-[10px] text-zinc-500 font-normal">Encrypted locally in ~/.krypton/</span>
              </label>
              <div className="relative">
                <input
                  type={showOpenaiKey ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 pr-10 text-xs font-mono text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showOpenaiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 flex items-start gap-2.5 text-xs text-zinc-400">
              <Lock className="size-4 text-violet-400 shrink-0 mt-0.5" />
              <span>
                Krypton operates with <strong>zero server lock-in</strong>. Your API keys are encrypted on your machine using native AES-256-GCM and never leave your hardware.
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
