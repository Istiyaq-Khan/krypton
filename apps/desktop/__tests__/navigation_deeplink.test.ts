import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import fs from "fs"
import path from "path"
import {
  parseDeepLink,
  navigateToRoute,
  listenToNavigation,
  SETTINGS_DEEP_LINKS,
  DEEP_LINK_SETTINGS_GENERAL,
  DEEP_LINK_SETTINGS_AGENTS,
  DEEP_LINK_SETTINGS_PROVIDERS,
  DEEP_LINK_SETTINGS_APPEARANCE,
  DEEP_LINK_SETTINGS_DATA,
  DEEP_LINK_SETTINGS_SETUP,
  NAVIGATION_GO_TO_ROUTE_CHANNEL,
  NavigationRoutePayload,
} from "../src/lib/navigation"
import {
  NavigationRoutePayloadSchema,
  NavigationSettingsTabSchema,
} from "@krypton/shared-types"

describe("Navigation & Settings Deep-Link Routing System", () => {
  const windowHeaderPath = path.resolve(__dirname, "../src/components/layout/WindowHeader.tsx")
  const kryptonSettingsPath = path.resolve(__dirname, "../src/components/settings/KryptonSettings.tsx")
  const settingsPagePath = path.resolve(__dirname, "../src/app/settings/page.tsx")
  const dashboardPagePath = path.resolve(__dirname, "../src/app/dashboard/page.tsx")
  const rustNavCmdPath = path.resolve(__dirname, "../src-tauri/src/commands/navigation.rs")
  const rustLibPath = path.resolve(__dirname, "../src-tauri/src/lib.rs")

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("1. Deep-Link Schema & Route Parser", () => {
    it("validates NavigationRoutePayloadSchema and tab enumerations", () => {
      expect(NAVIGATION_GO_TO_ROUTE_CHANNEL).toBe("navigation:go-to-route")

      const validTabs = ["general", "agents", "providers", "appearance", "data"]
      for (const tab of validTabs) {
        expect(NavigationSettingsTabSchema.safeParse(tab).success).toBe(true)
      }
      expect(NavigationSettingsTabSchema.safeParse("unknown").success).toBe(false)

      const samplePayload: NavigationRoutePayload = {
        route: "/settings",
        tab: "providers",
        timestamp: Date.now(),
      }
      const parsed = NavigationRoutePayloadSchema.safeParse(samplePayload)
      expect(parsed.success).toBe(true)
    })

    it("parses explicit deep-link identifiers into standardized payloads", () => {
      expect(parseDeepLink(DEEP_LINK_SETTINGS_GENERAL)).toMatchObject({
        route: "/settings",
        tab: "general",
      })
      expect(parseDeepLink(DEEP_LINK_SETTINGS_AGENTS)).toMatchObject({
        route: "/settings",
        tab: "agents",
      })
      expect(parseDeepLink(DEEP_LINK_SETTINGS_PROVIDERS)).toMatchObject({
        route: "/settings",
        tab: "providers",
      })
      expect(parseDeepLink(DEEP_LINK_SETTINGS_APPEARANCE)).toMatchObject({
        route: "/settings",
        tab: "appearance",
      })
      expect(parseDeepLink(DEEP_LINK_SETTINGS_DATA)).toMatchObject({
        route: "/settings",
        tab: "data",
      })
      expect(parseDeepLink(DEEP_LINK_SETTINGS_SETUP)).toMatchObject({
        route: "/settings/setup",
      })
    })

    it("parses URL paths with query parameters and hash anchors", () => {
      expect(parseDeepLink("/settings?tab=agents")).toMatchObject({
        route: "/settings",
        tab: "agents",
      })
      expect(parseDeepLink("/settings?tab=providers&theme=dark")).toMatchObject({
        route: "/settings",
        tab: "providers",
      })
      expect(parseDeepLink("/settings#appearance")).toMatchObject({
        route: "/settings",
        tab: "appearance",
      })
      expect(parseDeepLink("/dashboard")).toMatchObject({
        route: "/dashboard",
      })
      expect(parseDeepLink("/synapse")).toMatchObject({
        route: "/synapse",
      })
    })

    it("maps all valid settings categories in SETTINGS_DEEP_LINKS dictionary", () => {
      expect(SETTINGS_DEEP_LINKS.general).toBe("settings:general")
      expect(SETTINGS_DEEP_LINKS.agents).toBe("settings:agents")
      expect(SETTINGS_DEEP_LINKS.providers).toBe("settings:providers")
      expect(SETTINGS_DEEP_LINKS.appearance).toBe("settings:appearance")
      expect(SETTINGS_DEEP_LINKS.data).toBe("settings:data")
    })
  })

  describe("2. IPC Channel & Event Bus Integration", () => {
    it("dispatches and receives events over the navigation:go-to-route event bus", async () => {
      const received: NavigationRoutePayload[] = []
      const unlisten = listenToNavigation((payload) => {
        received.push(payload)
      })

      await navigateToRoute({
        route: "/settings",
        tab: "providers",
        timestamp: Date.now(),
      })

      await navigateToRoute("settings:agents")

      expect(received.length).toBe(2)
      expect(received[0].tab).toBe("providers")
      expect(received[1].tab).toBe("agents")
      expect(received[1].route).toBe("/settings")

      unlisten()

      // Confirm unlisten detaches listener
      await navigateToRoute("settings:appearance")
      expect(received.length).toBe(2)
    })
  })

  describe("3. WindowHeader Dropdown Wiring & Popover Auto-Closure", () => {
    it("contains explicit deep-link identifiers and test ids on all Settings menu items", () => {
      expect(fs.existsSync(windowHeaderPath)).toBe(true)
      const source = fs.readFileSync(windowHeaderPath, "utf-8")

      // Deep link attributes
      expect(source).toContain('data-deep-link={DEEP_LINK_SETTINGS_GENERAL}')
      expect(source).toContain('data-deep-link={DEEP_LINK_SETTINGS_AGENTS}')
      expect(source).toContain('data-deep-link={DEEP_LINK_SETTINGS_PROVIDERS}')
      expect(source).toContain('data-deep-link={DEEP_LINK_SETTINGS_APPEARANCE}')
      expect(source).toContain('data-deep-link={DEEP_LINK_SETTINGS_DATA}')
      expect(source).toContain('data-deep-link={DEEP_LINK_SETTINGS_SETUP}')

      // Test IDs for UI automation
      expect(source).toContain('data-testid="menu-settings-preferences"')
      expect(source).toContain('data-testid="menu-settings-general"')
      expect(source).toContain('data-testid="menu-settings-agents"')
      expect(source).toContain('data-testid="menu-settings-providers"')
      expect(source).toContain('data-testid="menu-settings-appearance"')
      expect(source).toContain('data-testid="menu-settings-data"')
      expect(source).toContain('data-testid="menu-settings-setup"')
    })

    it("verifies that each menu item click emits navigation events and closes the dropdown", () => {
      const source = fs.readFileSync(windowHeaderPath, "utf-8")

      // Verify each submenu handler calls navigateToRoute, onOpenSettings, and closes menu
      const generalBlock = source.slice(source.indexOf('data-testid="menu-settings-general"'), source.indexOf('data-testid="menu-settings-agents"'))
      expect(generalBlock).toContain('navigateToRoute(payload)')
      expect(generalBlock).toContain('tab: "general"')
      expect(generalBlock).toContain('onOpenSettings?.("general")')
      expect(generalBlock).toContain('setActiveMenu(null)')

      const agentsBlock = source.slice(source.indexOf('data-testid="menu-settings-agents"'), source.indexOf('data-testid="menu-settings-providers"'))
      expect(agentsBlock).toContain('navigateToRoute(payload)')
      expect(agentsBlock).toContain('tab: "agents"')
      expect(agentsBlock).toContain('onOpenSettings?.("agents")')
      expect(agentsBlock).toContain('setActiveMenu(null)')

      const providersBlock = source.slice(source.indexOf('data-testid="menu-settings-providers"'), source.indexOf('data-testid="menu-settings-appearance"'))
      expect(providersBlock).toContain('navigateToRoute(payload)')
      expect(providersBlock).toContain('tab: "providers"')
      expect(providersBlock).toContain('onOpenSettings?.("providers")')
      expect(providersBlock).toContain('setActiveMenu(null)')

      const appearanceBlock = source.slice(source.indexOf('data-testid="menu-settings-appearance"'), source.indexOf('data-testid="menu-settings-data"'))
      expect(appearanceBlock).toContain('navigateToRoute(payload)')
      expect(appearanceBlock).toContain('tab: "appearance"')
      expect(appearanceBlock).toContain('onOpenSettings?.("appearance")')
      expect(appearanceBlock).toContain('setActiveMenu(null)')

      const dataBlock = source.slice(source.indexOf('data-testid="menu-settings-data"'), source.indexOf('data-testid="menu-settings-setup"'))
      expect(dataBlock).toContain('navigateToRoute(payload)')
      expect(dataBlock).toContain('tab: "data"')
      expect(dataBlock).toContain('onOpenSettings?.("data")')
      expect(dataBlock).toContain('setActiveMenu(null)')
    })
  })

  describe("4. KryptonSettings Container Tab Switching", () => {
    it("subscribes to navigation events and synchronizes activeCategory", () => {
      expect(fs.existsSync(kryptonSettingsPath)).toBe(true)
      const source = fs.readFileSync(kryptonSettingsPath, "utf-8")

      expect(source).toContain("listenToNavigation")
      expect(source).toContain("onCategoryChange?: (category: SettingsCategory) => void")
      expect(source).toContain("activeCategory?: SettingsCategory")
      expect(source).toContain("initialCategory")
      expect(source).toContain('data-settings-tab="general"')
      expect(source).toContain('data-settings-tab="agents"')
      expect(source).toContain('data-settings-tab="providers"')
      expect(source).toContain('data-settings-tab="appearance"')
      expect(source).toContain('data-settings-tab="data"')
    })
  })

  describe("5. Route Consumers (SettingsPage & DashboardPage)", () => {
    it("SettingsPage parses initial URL search parameters / hash and handles IPC navigation", () => {
      expect(fs.existsSync(settingsPagePath)).toBe(true)
      const source = fs.readFileSync(settingsPagePath, "utf-8")

      expect(source).toContain("listenToNavigation")
      expect(source).toContain("URLSearchParams")
      expect(source).toContain('searchParams.get("tab")')
      expect(source).toContain("window.location.hash")
      expect(source).toContain("activeCategory={activeCategory}")
      expect(source).toContain("onCategoryChange={setActiveCategory}")
    })

    it("DashboardPage listens to navigation events to switch in-shell view to settings with correct tab", () => {
      expect(fs.existsSync(dashboardPagePath)).toBe(true)
      const source = fs.readFileSync(dashboardPagePath, "utf-8")

      expect(source).toContain("listenToNavigation")
      expect(source).toContain('setActiveView("settings")')
      expect(source).toContain("setActiveSettingsCategory")
      expect(source).toContain("activeCategory={activeSettingsCategory}")
      expect(source).toContain("onCategoryChange={setActiveSettingsCategory}")
    })
  })

  describe("6. Rust Tauri Native IPC Handler Registration", () => {
    it("Rust navigation command and generate_handler registration are intact", () => {
      expect(fs.existsSync(rustNavCmdPath)).toBe(true)
      const cmdSource = fs.readFileSync(rustNavCmdPath, "utf-8")
      expect(cmdSource).toContain("pub async fn navigate_to_route")
      expect(cmdSource).toContain('app.emit("navigation:go-to-route", payload)')

      expect(fs.existsSync(rustLibPath)).toBe(true)
      const libSource = fs.readFileSync(rustLibPath, "utf-8")
      expect(libSource).toContain("navigate_to_route,")
    })
  })
})
