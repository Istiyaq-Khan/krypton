import { isTauri, invoke } from "@tauri-apps/api/core"
import {
  NAVIGATION_GO_TO_ROUTE_CHANNEL,
  NavigationRoutePayload,
  NavigationSettingsTab,
} from "@krypton/shared-types"

export { NAVIGATION_GO_TO_ROUTE_CHANNEL, type NavigationRoutePayload, type NavigationSettingsTab }

export const DEEP_LINK_SETTINGS_GENERAL = "settings:general"
export const DEEP_LINK_SETTINGS_AGENTS = "settings:agents"
export const DEEP_LINK_SETTINGS_PROVIDERS = "settings:providers"
export const DEEP_LINK_SETTINGS_APPEARANCE = "settings:appearance"
export const DEEP_LINK_SETTINGS_DATA = "settings:data"
export const DEEP_LINK_SETTINGS_SETUP = "settings:setup"

export const SETTINGS_DEEP_LINKS: Record<NavigationSettingsTab, string> = {
  general: DEEP_LINK_SETTINGS_GENERAL,
  agents: DEEP_LINK_SETTINGS_AGENTS,
  providers: DEEP_LINK_SETTINGS_PROVIDERS,
  appearance: DEEP_LINK_SETTINGS_APPEARANCE,
  data: DEEP_LINK_SETTINGS_DATA,
}

const VALID_TABS = new Set<string>(["general", "agents", "providers", "appearance", "data"])

/**
 * Parses deep-link identifiers or URL paths into a standardized NavigationRoutePayload.
 */
export function parseDeepLink(input: string): NavigationRoutePayload {
  const now = Date.now()
  const trimmed = input.trim()

  if (trimmed.startsWith("settings:")) {
    const sub = trimmed.slice("settings:".length).toLowerCase()
    if (sub === "setup") {
      return { route: "/settings/setup", timestamp: now }
    }
    if (VALID_TABS.has(sub)) {
      return {
        route: "/settings",
        tab: sub as NavigationSettingsTab,
        timestamp: now,
      }
    }
    return { route: "/settings", timestamp: now }
  }

  if (trimmed.startsWith("/settings")) {
    const urlParts = trimmed.split(/[?#]/)
    let detectedTab: NavigationSettingsTab | undefined

    // Check search params (?tab=...)
    if (trimmed.includes("?")) {
      const searchPart = trimmed.slice(trimmed.indexOf("?") + 1).split("#")[0]
      const params = new URLSearchParams(searchPart)
      const tabParam = params.get("tab")?.toLowerCase()
      if (tabParam && VALID_TABS.has(tabParam)) {
        detectedTab = tabParam as NavigationSettingsTab
      }
    }

    // Check hash anchor (#agents)
    if (!detectedTab && trimmed.includes("#")) {
      const hashPart = trimmed.slice(trimmed.indexOf("#") + 1).toLowerCase()
      if (VALID_TABS.has(hashPart)) {
        detectedTab = hashPart as NavigationSettingsTab
      }
    }

    return {
      route: urlParts[0] || "/settings",
      tab: detectedTab,
      timestamp: now,
    }
  }

  if (trimmed === "/dashboard" || trimmed === "dashboard" || trimmed === "workspace") {
    return { route: "/dashboard", timestamp: now }
  }

  if (trimmed === "/synapse" || trimmed === "synapse") {
    return { route: "/synapse", timestamp: now }
  }

  return { route: trimmed, timestamp: now }
}

// Unified client event bus for DOM and Node.js/Vitest test environments
const clientBus: {
  addEventListener: (type: string, listener: (event: any) => void) => void
  removeEventListener: (type: string, listener: (event: any) => void) => void
  dispatchEvent: (event: any) => boolean
} = typeof window !== "undefined" ? window : new EventTarget()

/**
 * Emits a navigation event across the main process (Tauri IPC) and client event bus.
 */
export async function navigateToRoute(
  target: NavigationRoutePayload | string
): Promise<NavigationRoutePayload> {
  const payload: NavigationRoutePayload =
    typeof target === "string" ? parseDeepLink(target) : target

  // 1. Dispatch DOM/EventTarget event for renderer and test environments
  const event =
    typeof CustomEvent !== "undefined"
      ? new CustomEvent<NavigationRoutePayload>(NAVIGATION_GO_TO_ROUTE_CHANNEL, {
          detail: payload,
        })
      : ({ type: NAVIGATION_GO_TO_ROUTE_CHANNEL, detail: payload } as any)

  clientBus.dispatchEvent(event)

  // 2. Invoke native Tauri command if available to broadcast across all windows
  if (typeof window !== "undefined" && isTauri()) {
    try {
      await invoke("navigate_to_route", {
        route: payload.route,
        tab: payload.tab || null,
        params: payload.params || null,
      })
    } catch (err) {
      console.warn("Could not broadcast navigate_to_route via Tauri IPC:", err)
    }
  }

  return payload
}

/**
 * Subscribes to navigation events from both Tauri IPC and client-side dispatchers.
 */
export function listenToNavigation(
  callback: (payload: NavigationRoutePayload) => void
): () => void {
  let isCleanedUp = false
  let unlistenTauri: (() => void) | undefined

  const handleCustomEvent = (event: any) => {
    if (isCleanedUp) return
    const detail = event?.detail as NavigationRoutePayload | undefined
    if (detail) {
      callback(detail)
    }
  }

  clientBus.addEventListener(NAVIGATION_GO_TO_ROUTE_CHANNEL, handleCustomEvent)

  if (typeof window !== "undefined" && isTauri()) {
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        if (isCleanedUp) return
        listen<NavigationRoutePayload>(NAVIGATION_GO_TO_ROUTE_CHANNEL, (event) => {
          if (!isCleanedUp && event.payload) {
            callback(event.payload)
          }
        })
          .then((fn) => {
            if (isCleanedUp) {
              fn()
            } else {
              unlistenTauri = fn
            }
          })
          .catch(() => {})
      })
      .catch(() => {})
  }

  return () => {
    isCleanedUp = true
    clientBus.removeEventListener(NAVIGATION_GO_TO_ROUTE_CHANNEL, handleCustomEvent)
    unlistenTauri?.()
  }
}
