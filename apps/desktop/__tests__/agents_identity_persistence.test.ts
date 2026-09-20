import { describe, it, expect } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import { isTemperatureSupported } from "../src/lib/modelDiscovery"
import { configToFleetItem } from "../src/lib/agentIpc"

describe("Phase 4: Agents & Identity Live IPC & Capability-Driven UI Verification", () => {
  const kryptonSettingsPath = path.resolve(__dirname, "../src/components/settings/KryptonSettings.tsx")
  const createAgentModalPath = path.resolve(__dirname, "../src/components/settings/CreateAgentModal.tsx")
  const agentIpcPath = path.resolve(__dirname, "../src/lib/agentIpc.ts")

  describe("1. Model Capability & Temperature Flag Manifest", () => {
    it("identifies standard chat models as supporting temperature parameterization", () => {
      expect(isTemperatureSupported("gpt-4o")).toBe(true)
      expect(isTemperatureSupported("claude-3-7-sonnet-20250219")).toBe(true)
      expect(isTemperatureSupported("llama3.3:70b")).toBe(true)
      expect(isTemperatureSupported("deepseek-chat")).toBe(true)
      expect(isTemperatureSupported("5.6 Terra High")).toBe(true)
    })

    it("identifies reasoning models (o1, o3, o4) as not supporting temperature tuning", () => {
      expect(isTemperatureSupported("o1")).toBe(false)
      expect(isTemperatureSupported("o1-mini")).toBe(false)
      expect(isTemperatureSupported("o1-preview")).toBe(false)
      expect(isTemperatureSupported("o3")).toBe(false)
      expect(isTemperatureSupported("o3-mini")).toBe(false)
      expect(isTemperatureSupported("o4-preview")).toBe(false)
      expect(isTemperatureSupported("custom-reasoning-model")).toBe(false)
    })

    it("respects explicit supportsTemperature flag from DiscoveredModel metadata", () => {
      expect(isTemperatureSupported("custom-model", { id: "custom-model", supportsTemperature: false })).toBe(false)
      expect(isTemperatureSupported("custom-model", { id: "custom-model", supportsTemperature: true })).toBe(true)
    })
  })

  describe("2. Create Agent Modal Architecture", () => {
    it("exists and contains scaffolding modal markup", () => {
      expect(fs.existsSync(createAgentModalPath)).toBe(true)
      const source = fs.readFileSync(createAgentModalPath, "utf-8")

      expect(source).toContain("CreateAgentModal")
      expect(source).toContain("createAgentIpc")
      expect(source).toContain("isTemperatureSupported")
      expect(source).toContain("IDENTITY.md")
    })

    it("enforces AGENTS.md role referencing with zero manual Agent Role textarea", () => {
      const source = fs.readFileSync(createAgentModalPath, "utf-8")

      // Must not have an "Agent Role" input
      expect(source).not.toContain("label className=\"text-xs font-medium text-zinc-300\">Agent Role")
      expect(source).not.toContain("placeholder=\"e.g. Web Intelligence & Scraping\"")

      // Must reference AGENTS.md
      expect(source).toContain("AGENTS.md")
      expect(source).toContain("Role & Workspace Conventions")
    })

    it("dynamically toggles temperature controls based on model capabilities", () => {
      const source = fs.readFileSync(createAgentModalPath, "utf-8")

      expect(source).toContain("supportsTemp ?")
      expect(source).toContain("Disabled (Reasoning)")
      expect(source).toContain("type=\"range\"")
    })
  })

  describe("3. KryptonSettings Component Integration", () => {
    it("binds to live IPC hydration and CreateAgentModal", () => {
      expect(fs.existsSync(kryptonSettingsPath)).toBe(true)
      const source = fs.readFileSync(kryptonSettingsPath, "utf-8")

      expect(source).toContain("listAgentsIpc")
      expect(source).toContain("updateAgentIpc")
      expect(source).toContain("deleteAgentIpc")
      expect(source).toContain("<CreateAgentModal")
    })

    it("removes the manual Agent Role input field and references AGENTS.md", () => {
      const source = fs.readFileSync(kryptonSettingsPath, "utf-8")

      // Manual role input field should be completely removed from Selected Agent Editor
      expect(source).not.toContain("<label className=\"text-[11px] font-medium text-zinc-400\">Agent Role</label>")

      // Must reference AGENTS.md
      expect(source).toContain("AGENTS.md")
      expect(source).toContain("Role & Directives")
    })

    it("conditionally toggles the Temperature slider based on isTemperatureSupported", () => {
      const source = fs.readFileSync(kryptonSettingsPath, "utf-8")

      expect(source).toContain("isTemperatureSupported(selectedAgent.model)")
      expect(source).toContain("Temperature control disabled for reasoning model")
    })
  })

  describe("4. Unified Agent IPC Layer", () => {
    it("properly converts machine config to AgentFleetItem", () => {
      const sampleConfig = {
        id: "agent-tester-1",
        name: "TesterBot",
        role: "Quality Assurance",
        model: "o3-mini",
        temperature: 1.0,
        tools: ["terminal", "astLinter"],
        permissions: {
          terminal: true,
          filesystem: false,
          web: false,
          astLinter: true,
          maxDepth: 2,
        },
        budget: {
          total: 80000,
          used: 1200,
        },
      }

      const item = configToFleetItem(sampleConfig)
      expect(item.id).toBe("agent-tester-1")
      expect(item.name).toBe("TesterBot")
      expect(item.model).toBe("o3-mini")
      expect(item.depth).toBe(2)
      expect(item.budgetTotal).toBe(80000)
      expect(item.budgetUsed).toBe(1200)
      expect(item.permissions.terminal).toBe(true)
      expect(item.permissions.filesystem).toBe(false)
      expect(item.permissions.web).toBe(false)
      expect(item.permissions.astLinter).toBe(true)
    })
  })
})
