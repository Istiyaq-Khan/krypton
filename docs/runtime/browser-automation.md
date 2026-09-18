# Stealth Browser Automation & AXTree Navigation

This document covers the stealth Playwright/CDP browser engine, browser context pool recycling, Chrome DevTools Protocol Accessibility Tree (AXTree) blind navigation, and humanized mouse interaction in **Krypton**.

---

## 1. Browser Context Pool & Memory Management (`browser.ts`)

Iterative web automation and scraping can quickly exhaust host RAM if browser instances are not aggressively governed. Krypton enforces strict pooling:

| Constraint | Value | Enforcement Rule |
| :--- | :--- | :--- |
| **Max Active Contexts** | `2` contexts | At most 2 active browser contexts may run simultaneously across all sub-agents. Subsequent requests wait in queue. |
| **Idle Context Recycling** | `15 minutes` | Browser contexts idle for >15 minutes are automatically closed, and underlying Chromium processes are terminated. |
| **Session Persistence** | `browser_profiles/` | Cookies, storage state, and authentication tokens persist in `~/.krypton/browser_profiles/default/`. |

---

## 2. Anti-Bot Stealth Evasions

When connecting to remote web targets, Krypton applies stealth evasion scripts via Chrome DevTools Protocol (CDP):
- **Webdriver Flag**: Overrides `navigator.webdriver` to `false`.
- **Hardware Fingerprint Spoofing**: Simulates realistic WebGL vendor/renderer strings, audio context signatures, and plugin arrays.
- **Viewport Dimension Jitter**: Randomizes viewport dimensions within standard desktop monitor distributions (1920×1080 ± slight variance).

---

## 3. Accessibility Tree (AXTree) Blind Navigation (`axtree.ts`)

Rather than relying on heavy vision models that consume hundreds of thousands of tokens per screenshot, Krypton prioritizes CDP Accessibility Tree blind navigation:

```
[Raw Web Page DOM (~5MB / 100,000+ Tokens)]
                    │
                    ▼ CDP `Accessibility.getFullAXTree`
[Prune Non-Interactive Nodes (div, span, svg)]
                    │
                    ▼
[Assign Transient Numeric IDs: [id=1], [id=2] ...]
                    │
                    ▼
[Compact Semantic Snapshot (~2KB / 400 Tokens)]
```

### Semantic AXTree Snapshot Example:
```text
[id=1] Button: "Log In"
[id=2] Textbox: "Email Address" (focused)
[id=3] Textbox: "Password" (protected)
[id=4] Link: "Forgot Password?"
```

### High-Level Blind Actions (`actions.ts`)
- `click(id)`: Moves cursor to node bounding box and clicks.
- `type(id, text)`: Focuses input and simulates realistic keystrokes.
- `select(id, value)`: Picks dropdown option.
- `scroll(direction)`: Scrolls page viewport.
*Vision screenshots are used strictly as a fallback when the accessibility tree is unpopulated or obscured.*

---

## 4. Humanized Interaction & Visual Cursor (`humanizer.ts`)

To avoid bot detection and provide visual transparency for the user:
- **Cubic Bézier Mouse Trajectories**: Moves the cursor along natural curved paths with micro-jitter and realistic acceleration/deceleration.
- **Gaussian Keystroke Delays**: Generates typing delays between 60ms and 140ms per stroke.
- **Visual Cursor Injection**: Injects a non-interfering floating cursor onto the DOM displaying the active sub-agent name (e.g. `[ScraperBot]`), allowing users to observe agent actions in real time.
