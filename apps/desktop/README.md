# Krypton Desktop Shell (`apps/desktop`)

The native desktop workstation shell for **Krypton — Autonomous Desktop AI Agent Runtime**, built using **Tauri v2 (Rust)** and **React 19 / Next.js**.

---

## 🌟 Architectural Features

- **Unified Frameless Window**: Native OS chrome is suppressed across Windows, macOS, and Linux with full window drag support (`data-tauri-drag-region`) and secure Tauri IPC controls.
- **Native Window IPC**: In-app Minimize, Maximize/Restore, and Close controls wired to Rust Tauri commands (`window_minimize`, `window_toggle_maximize`, `window_close`, `window_is_maximized`).
- **First-Run Onboarding Engine**: Automatic host state detection on startup; routes unconfigured systems through `FirstRunSetupWizard` to configure custom agent identities, model routes, encrypted API credentials, workspace paths, and security preferences.
- **Pure Clean State**: Zero mock artifacts. Workspaces boot unpopulated with clean project prompts and functional task templates.
- **Always-on-top Voice Micro-HUD**: Translucent overlay window accessible via global hotkey (`CommandOrControl+Shift+Space`).
- **Interactive Navigation & Menus**: Working File, Edit, View, and Help menus with keyboard shortcuts and chronological back/forward session history.

---

## 🚀 Development & Build

```bash
# Start Next.js development server
pnpm dev

# Run Vitest test suite
pnpm test

# Check native Rust backend
cargo check --manifest-path src-tauri/Cargo.toml

# Build Next.js production bundle
pnpm build

# Build complete Tauri desktop installer
pnpm tauri:build
```

---

## 📂 Architecture References

- [Production Hardening Architecture](../../docs/PRODUCTION_HARDENING.md)
- [Release Architecture & Packaging Guide](../../docs/RELEASE_ARCHITECTURE.md)
- [Agent Operating System Specifications](../../AGENTS.md)
