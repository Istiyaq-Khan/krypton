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
  HardDrive,
  Download,
  AlertTriangle,
  FileArchive,
  CheckCircle2,
  Database,
  X,
} from "lucide-react"
import {
  ModelProviderId,
  DiscoveredModel,
  PROVIDER_METADATA,
  DEFAULT_PROVIDER_URLS,
  testAndFetchModels,
  persistCachedModels,
  isTemperatureSupported,
} from "@/lib/modelDiscovery"
import {
  AgentFleetItem,
  loadWorkstationState,
  saveWorkstationState,
} from "@/lib/persistence"
import {
  listAgentsIpc,
  createAgentIpc,
  updateAgentIpc,
  deleteAgentIpc,
} from "@/lib/agentIpc"
import { CreateAgentModal } from "./CreateAgentModal"
import {
  BackupVaultResult,
  PurgeDataResult,
  UninstallResult,
  StoragePathsInfo,
} from "@krypton/shared-types"
import { listenToNavigation } from "@/lib/navigation"

// type SettingsCategory = "general" | "agents" | "providers" | "appearance"
export type SettingsCategory = "general" | "agents" | "providers" | "appearance" | "data"


export interface KryptonSettingsProps {
  initialCategory?: SettingsCategory
  activeCategory?: SettingsCategory
  onBack: () => void
  onCategoryChange?: (category: SettingsCategory) => void
  onUpdateApproval?: (ask: boolean) => void
  onUpdateModel?: (model: string) => void
  onRefreshFleet?: () => void
}

export function KryptonSettings({
  initialCategory = "general",
  activeCategory: controlledCategory,
  onBack,
  onCategoryChange,
  onUpdateApproval,
  onUpdateModel,
  onRefreshFleet,
}: KryptonSettingsProps) {
  const [internalCategory, setInternalCategory] = useState<SettingsCategory>(
    controlledCategory || initialCategory
  )
  const activeCategory = controlledCategory || internalCategory

  const setActiveCategory = useCallback(
    (cat: SettingsCategory) => {
      setInternalCategory(cat)
      onCategoryChange?.(cat)
      if (typeof window !== "undefined" && window.location.pathname.includes("/settings")) {
        const url = new URL(window.location.href)
        url.searchParams.set("tab", cat)
        window.history.replaceState({}, "", url.toString())
      }
    },
    [onCategoryChange]
  )

  const [saveIndicator, setSaveIndicator] = useState<string | null>(null)

  // Synchronize when initialCategory changes externally
  useEffect(() => {
    if (initialCategory) {
      setInternalCategory(initialCategory)
    }
  }, [initialCategory])

  // Listen to navigation:go-to-route events
  useEffect(() => {
    const unlisten = listenToNavigation((payload) => {
      if (
        payload.tab &&
        ["general", "agents", "providers", "appearance", "data"].includes(payload.tab)
      ) {
        setActiveCategory(payload.tab as SettingsCategory)
      }
    })
    return () => unlisten()
  }, [setActiveCategory])

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

  // ----------------------------------------------------
  // Category 5: Data & Maintenance State
  // ----------------------------------------------------
  const [storagePaths, setStoragePaths] = useState<StoragePathsInfo | null>(null)
  const [isExportingBackup, setIsExportingBackup] = useState(false)
  const [backupResult, setBackupResult] = useState<BackupVaultResult | null>(null)

  // Factory Reset Double-Confirmation Modal State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false)
  const [purgeStep, setPurgeStep] = useState<1 | 2>(1)
  const [purgeConfirmationInput, setPurgeConfirmationInput] = useState("")
  const [isPurging, setIsPurging] = useState(false)
  const [purgeResult, setPurgeResult] = useState<PurgeDataResult | null>(null)

  // In-App Uninstallation Modal State
  const [isUninstallModalOpen, setIsUninstallModalOpen] = useState(false)
  const [uninstallWithPurge, setUninstallWithPurge] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [uninstallResult, setUninstallResult] = useState<UninstallResult | null>(null)

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

      // 1b. Hydrate directly from live filesystem via IPC (~/.krypton/agents/)
      try {
        const liveAgents = await listAgentsIpc()
        if (liveAgents && liveAgents.length > 0) {
          setAgents(liveAgents)
          if (!selectedAgentId || !liveAgents.some((a) => a.id === selectedAgentId)) {
            setSelectedAgentId(liveAgents[0].id)
          }
        }
      } catch (err) {
        console.warn("Could not load live agents from IPC:", err)
      }

      // 2. Hydrate from Host / Tauri IPC
      if (typeof window !== "undefined" && isTauri()) {
        try {
          const paths = await invoke<StoragePathsInfo>("get_storage_paths_info")
          if (paths) setStoragePaths(paths)
        } catch (err) {
          console.warn("Could not invoke get_storage_paths_info:", err)
        }

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
      await updateAgentIpc(targetAgent.name, agentConfigJson)
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

  const handleAgentCreated = useCallback(
    (newAgent: AgentFleetItem) => {
      setAgents((prev) => {
        const updated = [...prev.filter((a) => a.id !== newAgent.id && a.name !== newAgent.name), newAgent]
        const ws = loadWorkstationState()
        ws.fleet = updated
        saveWorkstationState(ws)
        return updated
      })
      setSelectedAgentId(newAgent.id)
      setIsCreatingAgent(false)
      flashSavedNotice(`Created agent ${newAgent.name} with config.json`)
      onRefreshFleet?.()
    },
    [flashSavedNotice, onRefreshFleet]
  )

  const handleCreateNewAgent = useCallback(async () => {
    // Open the creation modal
    setIsCreatingAgent(true)
  }, [])

  const handleDeleteAgent = useCallback(
    async (agentId: string) => {
      const target = agents.find((a) => a.id === agentId)
      if (!target || target.id === "agent-root" || target.name.toLowerCase() === "orchestrator") return

      try {
        await deleteAgentIpc(target.name)
      } catch (err) {
        console.warn("deleteAgentIpc error:", err)
      }

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

  // ----------------------------------------------------
  // Data & Maintenance Action Handlers
  // ----------------------------------------------------
  const handleExportBackup = async (chooseDestination = false) => {
    setIsExportingBackup(true)
    setBackupResult(null)
    try {
      let targetPath: string | null = null
      if (chooseDestination && isTauri()) {
        const dateStr = new Date().toISOString().slice(0, 10)
        const defaultName = `krypton-vault-backup-${dateStr}.zip`
        targetPath = await invoke<string | null>("select_backup_save_dialog", { defaultName })
        if (!targetPath) {
          setIsExportingBackup(false)
          return
        }
      }

      if (isTauri()) {
        const res = await invoke<BackupVaultResult>("create_backup_vault", {
          targetPath: targetPath || null,
        })
        setBackupResult(res)
        flashSavedNotice("Backup vault archive created")
      } else {
        const now = Date.now()
        const res: BackupVaultResult = {
          success: true,
          archivePath: "~/Downloads/krypton-vault-backup-preview.zip",
          archiveName: "krypton-vault-backup-preview.zip",
          fileCount: 8,
          totalBytesUncompressed: 14500,
          totalBytesCompressed: 4200,
          timestamp: now,
          agentsIncluded: agents.map((a) => a.name),
        }
        setBackupResult(res)
        flashSavedNotice("Vault backup created")
      }
    } catch (err: any) {
      console.error("Backup export error:", err)
      setBackupResult({
        success: false,
        archivePath: "",
        archiveName: "",
        fileCount: 0,
        totalBytesUncompressed: 0,
        totalBytesCompressed: 0,
        timestamp: Date.now(),
        agentsIncluded: [],
      })
    } finally {
      setIsExportingBackup(false)
    }
  }

  const handleExecutePurge = async () => {
    setIsPurging(true)
    setPurgeResult(null)
    try {
      if (isTauri()) {
        const res = await invoke<PurgeDataResult>("purge_app_data_and_reset")
        setPurgeResult(res)
      } else {
        const res: PurgeDataResult = {
          success: true,
          daemonsTerminated: true,
          purgedDirectories: ["~/.krypton", "localStorage"],
          failedDirectories: [],
          timestamp: Date.now(),
          message: "All local application data and workspaces purged.",
        }
        setPurgeResult(res)
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem("krypton_general_settings")
        localStorage.removeItem("krypton_provider_keys")
        localStorage.removeItem("krypton_appearance_settings")
        localStorage.removeItem("krypton_vtt_config")
        localStorage.removeItem("krypton_workstation_state")
      }

      flashSavedNotice("Factory reset completed")
    } catch (err: any) {
      console.error("Purge error:", err)
      setPurgeResult({
        success: false,
        daemonsTerminated: false,
        purgedDirectories: [],
        failedDirectories: [err.message || String(err)],
        timestamp: Date.now(),
        message: "Failed to complete data purge.",
      })
    } finally {
      setIsPurging(false)
    }
  }

  const handleExecuteUninstall = async () => {
    setIsUninstalling(true)
    setUninstallResult(null)
    try {
      if (isTauri()) {
        const res = await invoke<UninstallResult>("trigger_app_uninstall", {
          purgeData: uninstallWithPurge,
        })
        setUninstallResult(res)
      } else {
        const res: UninstallResult = {
          success: true,
          platform: "unknown",
          actionTaken: "Uninstallation triggered in web preview mode.",
          dataPurged: uninstallWithPurge,
          uninstallerExecuted: false,
          manualInstructions: "Delete application bundle from your Applications folder.",
        }
        setUninstallResult(res)
      }
    } catch (err: any) {
      console.error("Uninstall error:", err)
      setUninstallResult({
        success: false,
        platform: "unknown",
        actionTaken: err.message || "Failed to trigger uninstaller.",
        dataPurged: false,
        uninstallerExecuted: false,
      })
    } finally {
      setIsUninstalling(false)
    }
  }

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
                : activeCategory === "appearance"
                ? "Appearance"
                : "Data & Maintenance"}
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
              data-settings-tab="general"
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
              data-settings-tab="agents"
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
              data-settings-tab="providers"
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
              data-settings-tab="appearance"
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

            <button
              type="button"
              data-settings-tab="data"
              onClick={() => setActiveCategory("data")}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                activeCategory === "data"
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/30 shadow-xs"
                  : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 border border-transparent"
              }`}
            >
              <HardDrive className="size-4 shrink-0" />
              <div className="flex flex-col">
                <span>Data & Maintenance</span>
                <span className="text-[10px] text-zinc-500 font-normal">Vault backup, reset & uninstall</span>
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
                    onClick={handleCreateNewAgent}
                    className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition-colors cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Create Agent</span>
                  </button>
                </div>

                {/* Create Agent Scaffolding Modal */}
                <CreateAgentModal
                  isOpen={isCreatingAgent}
                  onClose={() => setIsCreatingAgent(false)}
                  onAgentCreated={handleAgentCreated}
                  availableModels={cachedModels}
                />

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

                    {/* AGENTS.md Workspace Conventions & Directives Reference */}
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-3 flex items-start gap-2.5 text-zinc-400">
                      <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-semibold text-zinc-200">Role & Directives: </span>
                        Governed by <code className="text-zinc-300 font-mono">~/.krypton/agents/{selectedAgent.name}/AGENTS.md</code>. Agent role definitions and operational constraints are derived directly from workspace markdown context.
                      </div>
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

                    {/* Dynamically toggle Temperature slider based on model capabilities */}
                    {isTemperatureSupported(selectedAgent.model) ? (
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
                    ) : (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-2.5 text-xs text-amber-300/80 flex items-center justify-between">
                        <span className="text-[11px]">
                          Temperature control disabled for reasoning model <span className="font-mono text-amber-200">{selectedAgent.model}</span>
                        </span>
                        <span className="text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                          Fixed
                        </span>
                      </div>
                    )}

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

            {/* -------------------------------------------------- */}
            {/* 5. DATA & MAINTENANCE SETTINGS                     */}
            {/* -------------------------------------------------- */}
            {activeCategory === "data" && (
              <div className="space-y-6 animate-in fade-in-0 duration-150">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Data & Maintenance</h2>
                  <p className="text-xs text-zinc-400">
                    Export Backup Vault archives, inspect storage paths, perform factory resets, or trigger application uninstallation.
                  </p>
                </div>

                {/* Storage Paths Overview */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                        <HardDrive className="size-4 text-violet-400" />
                        <span>Storage & Runtime Paths</span>
                      </h3>
                      <p className="text-[11px] text-zinc-500">Active filesystem paths for configurations, credentials, and worktrees.</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                      OS: {storagePaths?.osPlatform || (typeof process !== "undefined" ? process.platform : "desktop")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60">
                      <div className="text-[10px] text-zinc-500 font-sans font-medium">Canonical Runtime Root</div>
                      <div className="text-zinc-300 truncate mt-0.5">{storagePaths?.kryptonHome || "~/.krypton"}</div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60">
                      <div className="text-[10px] text-zinc-500 font-sans font-medium">Agent Workspaces Directory</div>
                      <div className="text-zinc-300 truncate mt-0.5">{storagePaths?.agentsDir || "~/.krypton/agents"}</div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60">
                      <div className="text-[10px] text-zinc-500 font-sans font-medium">Cache & Outputs Root</div>
                      <div className="text-zinc-300 truncate mt-0.5">{storagePaths?.cacheDir || "~/.krypton/cache"}</div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60">
                      <div className="text-[10px] text-zinc-500 font-sans font-medium">Git Worktrees Root</div>
                      <div className="text-zinc-300 truncate mt-0.5">{storagePaths?.worktreesDir || "~/.krypton/worktrees"}</div>
                    </div>
                  </div>
                </div>

                {/* Card 1: Backup & Export Vault */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                        <FileArchive className="size-4 text-emerald-400" />
                        <span>Backup & Export Vault</span>
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        Bundle all agent <code className="text-zinc-300 font-mono">config.json</code> files, prompt instructions (<code className="text-zinc-300 font-mono">*.md</code>), active memory, trajectories, and global routing into a portable, compressed <code className="text-zinc-300 font-mono">.zip</code> vault.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 font-mono">
                      {agents.length} Agents Configured
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 font-mono">
                      Format: PKWARE ZIP (RFC 1951 Deflate)
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 font-mono">
                      Self-Contained Manifest
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleExportBackup(true)}
                      disabled={isExportingBackup}
                      className="flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-medium text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isExportingBackup ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Generating Vault...</span>
                        </>
                      ) : (
                        <>
                          <Download className="size-3.5" />
                          <span>Choose Destination & Export Vault (.zip)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportBackup(false)}
                      disabled={isExportingBackup}
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <FileArchive className="size-3.5 text-zinc-400" />
                      <span>Quick Export to Downloads</span>
                    </button>
                  </div>

                  {backupResult && (
                    <div
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs animate-in fade-in-0 duration-150 ${
                        backupResult.success
                          ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                          : "border-rose-500/30 bg-rose-950/20 text-rose-300"
                      }`}
                    >
                      {backupResult.success ? (
                        <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="size-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="font-semibold">
                          {backupResult.success ? "Backup Vault Generated Successfully" : "Backup Vault Generation Failed"}
                        </div>
                        {backupResult.success && (
                          <div className="text-[11px] space-y-0.5 text-zinc-300 font-mono">
                            <div className="truncate">Path: {backupResult.archivePath}</div>
                            <div className="text-zinc-400">
                              Files: {backupResult.fileCount} | Uncompressed: {Math.round(backupResult.totalBytesUncompressed / 1024)} KB | Compressed: {Math.round(backupResult.totalBytesCompressed / 1024)} KB
                            </div>
                            <div className="text-zinc-400">
                              Agents: {backupResult.agentsIncluded.join(", ") || "None"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card 2: Factory Reset & Complete Data Purge */}
                <div className="rounded-2xl border border-rose-900/40 bg-rose-950/10 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-rose-900/30 pb-3">
                    <div>
                      <h3 className="text-xs font-semibold text-rose-300 flex items-center gap-2">
                        <AlertTriangle className="size-4 text-rose-400" />
                        <span>Factory Reset & Complete Data Purge</span>
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        Gracefully terminate background daemons and permanently delete local application data directories across the host operating system.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-rose-900/30 bg-rose-950/20 p-3 text-[11px] text-rose-200/90 leading-relaxed">
                    <p className="font-semibold text-rose-300">Warning: This action is irreversible.</p>
                    <p className="mt-0.5 text-zinc-400">
                      All agent workspaces, short-term trajectories, worktrees, credentials, models cache, and local application states will be purged. Background daemons will be terminated immediately.
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setPurgeStep(1)
                        setPurgeConfirmationInput("")
                        setPurgeResult(null)
                        setIsPurgeModalOpen(true)
                      }}
                      className="flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-medium text-white shadow-md shadow-rose-900/30 hover:bg-rose-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Purge App Data & Reset...</span>
                    </button>
                  </div>
                </div>

                {/* Card 3: In-App Uninstallation */}
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                        <Trash2 className="size-4 text-amber-400" />
                        <span>Uninstall Krypton</span>
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        Remove Krypton from the system, deregister operating system shortcuts, and stop all background services.
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Triggers the native operating system teardown process:
                    spawns uninstaller executable on Windows, unloads LaunchAgents and moves app to Trash on macOS, or unregisters desktop shortcuts and services on Linux.
                  </p>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setUninstallWithPurge(false)
                        setUninstallResult(null)
                        setIsUninstallModalOpen(true)
                      }}
                      className="flex items-center gap-2 rounded-xl border border-amber-600/40 bg-amber-950/20 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-900/40 hover:text-white transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5 text-amber-400" />
                      <span>Uninstall Krypton...</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ---------------------------------------------------- */}
      {/* MODAL 1: Double-Confirmation Factory Reset Modal      */}
      {/* ---------------------------------------------------- */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-md rounded-2xl border border-rose-800/60 bg-zinc-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertTriangle className="size-4.5" />
                <span>Confirm Factory Reset (Step {purgeStep} of 2)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {purgeStep === 1 && (
              <div className="space-y-3 text-xs text-zinc-300">
                <p>
                  You are about to execute a complete factory reset. This will:
                </p>
                <ul className="list-disc list-inside space-y-1 text-zinc-400 pl-1 font-mono text-[11px]">
                  <li>Send termination signals to active background daemons</li>
                  <li>Delete all agent workspaces, prompts (*.md), and memories</li>
                  <li>Delete trajectories, logs, and Git worktrees</li>
                  <li>Clear stored credentials and local browser states</li>
                </ul>
                <p className="text-zinc-400 pt-1">
                  We strongly recommend exporting a <strong>Backup Vault (.zip)</strong> before continuing.
                </p>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setIsPurgeModalOpen(false)}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurgeStep(2)}
                    className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-rose-500 cursor-pointer"
                  >
                    Proceed to Step 2
                  </button>
                </div>
              </div>
            )}

            {purgeStep === 2 && (
              <div className="space-y-3 text-xs text-zinc-300">
                <p className="text-rose-300 font-medium">
                  Final confirmation: Please type <code className="bg-rose-950 px-1.5 py-0.5 rounded font-mono text-white">RESET</code> below to confirm permanent deletion.
                </p>

                <input
                  type="text"
                  value={purgeConfirmationInput}
                  onChange={(e) => setPurgeConfirmationInput(e.target.value)}
                  placeholder="Type RESET to confirm"
                  className="w-full rounded-xl border border-rose-900/60 bg-zinc-900 px-3 py-2 text-xs font-mono text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />

                {purgeResult && (
                  <div
                    className={`rounded-xl border p-2.5 text-[11px] ${
                      purgeResult.success
                        ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                        : "border-rose-500/30 bg-rose-950/20 text-rose-300"
                    }`}
                  >
                    <div className="font-semibold">{purgeResult.message}</div>
                    <div className="text-[10px] font-mono mt-1 text-zinc-400">
                      Purged {purgeResult.purgedDirectories.length} directories.
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setIsPurgeModalOpen(false)}
                    disabled={isPurging}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePurge}
                    disabled={purgeConfirmationInput.trim() !== "RESET" || isPurging}
                    className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-40 cursor-pointer shadow-md shadow-rose-900/40"
                  >
                    {isPurging ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Purging Data...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-3.5" />
                        <span>Confirm Permanent Purge</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: Uninstallation Confirmation Modal           */}
      {/* ---------------------------------------------------- */}
      {isUninstallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
                <Trash2 className="size-4 text-amber-400" />
                <span>Uninstall Krypton Application</span>
              </div>
              <button
                type="button"
                onClick={() => setIsUninstallModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p>
                This will terminate background processes and invoke the native platform uninstallation routine for your operating system.
              </p>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={uninstallWithPurge}
                  onChange={(e) => setUninstallWithPurge(e.target.checked)}
                  className="mt-0.5 accent-violet-500 cursor-pointer"
                />
                <div className="space-y-0.5">
                  <div className="font-semibold text-zinc-200">Also delete user workspaces & runtime data</div>
                  <div className="text-[11px] text-zinc-400">
                    Purges <code className="font-mono text-zinc-300">~/.krypton</code> and application cache directories before uninstalling.
                  </div>
                </div>
              </label>

              {uninstallResult && (
                <div
                  className={`rounded-xl border p-2.5 text-[11px] ${
                    uninstallResult.success
                      ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                      : "border-rose-500/30 bg-rose-950/20 text-rose-300"
                  }`}
                >
                  <div className="font-semibold">{uninstallResult.actionTaken}</div>
                  {uninstallResult.manualInstructions && (
                    <div className="mt-1.5 p-2 rounded bg-black/40 font-mono text-[10px] text-zinc-200 select-all">
                      {uninstallResult.manualInstructions}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsUninstallModalOpen(false)}
                  disabled={isUninstalling}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteUninstall}
                  disabled={isUninstalling}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 cursor-pointer shadow-md shadow-amber-900/30"
                >
                  {isUninstalling ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Uninstalling...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-3.5" />
                      <span>Execute Uninstallation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

