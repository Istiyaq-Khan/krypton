import { isTauri, invoke } from "@tauri-apps/api/core"
import { AgentFleetItem } from "./persistence"

export interface CreateAgentIpcPayload {
  name: string
  model: string
  provider?: string
  temperature?: number
  permissions: {
    terminal: boolean
    filesystem: boolean
    web: boolean
    astLinter: boolean
  }
  identityPrompt?: string
}

/**
 * Converts a machine config.json schema structure to an AgentFleetItem.
 */
export function configToFleetItem(cfg: any): AgentFleetItem {
  const name = cfg.name || "Agent"
  const permissions = cfg.permissions || {}
  const tools = Array.isArray(cfg.tools) ? cfg.tools : []

  return {
    id: cfg.id || `agent-${name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`,
    name,
    role: cfg.role || "Autonomous Assistant",
    state: "idle",
    depth: typeof permissions.maxDepth === "number" ? permissions.maxDepth : 1,
    budgetUsed: cfg.budget?.used ?? 0,
    budgetTotal: cfg.budget?.total ?? 50000,
    parentAgentId: cfg.parentAgentId || "agent-root",
    model: cfg.model || "5.6 Terra High",
    temperature: typeof cfg.temperature === "number" ? cfg.temperature : 0.2,
    systemPrompt: cfg.systemPrompt || "",
    permissions: {
      terminal: Boolean(permissions.terminal ?? tools.includes("terminal")),
      filesystem: Boolean(permissions.filesystem ?? tools.includes("filesystem")),
      web: Boolean(permissions.web ?? tools.includes("web")),
      astLinter: Boolean(permissions.astLinter ?? tools.includes("astLinter")),
    },
  }
}

/**
 * Lists all configured agents directly from ~/.krypton/agents/ via IPC.
 */
export async function listAgentsIpc(): Promise<AgentFleetItem[]> {
  if (typeof window !== "undefined" && isTauri()) {
    try {
      const rawList = await invoke<any[]>("list_agents_config")
      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map(configToFleetItem)
      }
    } catch (err) {
      console.warn("list_agents_config invocation failed:", err)
    }
  }

  // WebSocket or fallback daemon RPC
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket("ws://127.0.0.1:19840")
      const timeout = setTimeout(() => {
        try { ws.close() } catch {}
        resolve([])
      }, 1500)

      ws.onopen = () => {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "agents:list", params: {} }))
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.result && Array.isArray(data.result)) {
            clearTimeout(timeout)
            ws.close()
            resolve(data.result.map(configToFleetItem))
          }
        } catch {
          // ignore
        }
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        resolve([])
      }
    } catch {
      resolve([])
    }
  })
}

/**
 * Creates and scaffolds a new agent workspace with config.json and template IDENTITY.md.
 */
export async function createAgentIpc(payload: CreateAgentIpcPayload): Promise<AgentFleetItem> {
  const sanitizedName = payload.name.trim()
  const agentId = `agent-${Date.now()}`
  const tools = [
    ...(payload.permissions.terminal ? ["terminal"] : []),
    ...(payload.permissions.filesystem ? ["filesystem"] : []),
    ...(payload.permissions.astLinter ? ["astLinter"] : []),
    ...(payload.permissions.web ? ["web"] : []),
  ]

  const configJson = {
    id: agentId,
    name: sanitizedName,
    role: "Autonomous Assistant",
    model: payload.model.trim() || "5.6 Terra High",
    provider: payload.provider || "anthropic",
    temperature: payload.temperature ?? 0.2,
    contextWindowLimit: 128_000,
    tools,
    permissions: {
      allowedSubAgents: [],
      allowedTools: tools,
      maxDepth: 3,
      maxConcurrentChildren: 5,
      budgetShare: 0.5,
      canSynthesizeTools: true,
      canAccessNetwork: payload.permissions.web,
      canModifyWorkspace: payload.permissions.filesystem,
      terminal: payload.permissions.terminal,
      filesystem: payload.permissions.filesystem,
      web: payload.permissions.web,
      astLinter: payload.permissions.astLinter,
    },
    budget: {
      total: 50000,
      used: 0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const templateIdentity = payload.identityPrompt?.trim()
    ? `# IDENTITY.md - ${sanitizedName}\n\n${payload.identityPrompt.trim()}\n`
    : `# IDENTITY.md - ${sanitizedName}\n\n_Fill this in during your first conversation. Make it yours._\n\n- **Name:** ${sanitizedName}\n- **Creature:** Autonomous Assistant\n- **Vibe:** Focused, analytical, autonomous\n- **Emoji:** ⚡\n`

  if (typeof window !== "undefined" && isTauri()) {
    try {
      await invoke("create_agent_workspace", {
        agentName: sanitizedName,
        config: configJson,
        templateIdentity,
      })
    } catch {
      // Fallback to save_agent_config if create_agent_workspace fails
      await invoke("save_agent_config", {
        agentName: sanitizedName,
        config: configJson,
      })
    }
  }

  // Also notify daemon via WebSocket if active
  try {
    const ws = new WebSocket("ws://127.0.0.1:19840")
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "agents:create",
          params: {
            name: sanitizedName,
            model: configJson.model,
            provider: configJson.provider,
            temperature: configJson.temperature,
            tools: configJson.tools,
            permissions: configJson.permissions,
            systemPrompt: payload.identityPrompt,
          },
        })
      )
      setTimeout(() => {
        try { ws.close() } catch {}
      }, 500)
    }
  } catch {
    // ignore
  }

  return configToFleetItem(configJson)
}

/**
 * Updates agent configuration and persists directly to ~/.krypton/agents/<name>/config.json.
 */
export async function updateAgentIpc(agentName: string, config: any): Promise<boolean> {
  const sanitizedName = agentName.trim()

  if (typeof window !== "undefined" && isTauri()) {
    try {
      await invoke("save_agent_config", {
        agentName: sanitizedName,
        config,
      })
      return true
    } catch (err) {
      console.warn("save_agent_config error:", err)
    }
  }

  // Send updateAgent / agents:update to daemon WebSocket
  try {
    const ws = new WebSocket("ws://127.0.0.1:19840")
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "agents:update",
          params: {
            name: sanitizedName,
            patch: config,
          },
        })
      )
      setTimeout(() => {
        try { ws.close() } catch {}
      }, 500)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Deletes an agent workspace from ~/.krypton/agents/<name> via IPC.
 */
export async function deleteAgentIpc(agentName: string): Promise<boolean> {
  const sanitizedName = agentName.trim()
  let deleted = false

  if (typeof window !== "undefined" && isTauri()) {
    try {
      deleted = await invoke<boolean>("delete_agent_config", {
        agentName: sanitizedName,
      })
    } catch (err) {
      console.warn("delete_agent_config error:", err)
    }
  }

  // Also send agents:delete to daemon WebSocket
  try {
    const ws = new WebSocket("ws://127.0.0.1:19840")
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "agents:delete",
          params: { name: sanitizedName },
        })
      )
      setTimeout(() => {
        try { ws.close() } catch {}
      }, 500)
    }
  } catch {
    // ignore
  }

  return deleted
}
