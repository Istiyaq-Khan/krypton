# CI/CD Workflows & GitHub Actions

This document covers the Continuous Integration and Release automation pipelines configured in `.github/workflows/` for **Krypton**.

---

## 1. Cross-Platform CI Pipeline (`.github/workflows/ci.yml`)

The CI workflow triggers on every push and pull request to `main` and `master`:

```
┌─────────────────────────────────────────────────────────────┐
│                 GitHub Actions CI Matrix                    │
│   Windows (windows-latest) │ Linux (ubuntu-22.04) │ macOS   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Toolchain Setup: pnpm, Node 20, Rust stable, Bun latest │
│ 2. Install Linux GTK/WebKit dev dependencies (Ubuntu)       │
│ 3. Validate environment (node scripts/setup-env.mjs)        │
│ 4. Build Monorepo packages (pnpm run build)                 │
│ 5. Test standalone CLI compilation (build-cli.mjs)          │
│ 6. Test standalone Daemon compilation (build-sidecar.mjs)   │
│ 7. Run monorepo test suites & cargo check (pnpm test:all)   │
└─────────────────────────────────────────────────────────────┘
```

All jobs must pass with zero compiler warnings, lint diagnostics, or failing tests.

---

## 2. Release & Packaging Pipeline (`.github/workflows/release.yml`)

The release pipeline executes when a release tag matching `v*` is pushed or when triggered manually via `workflow_dispatch`:

### Cross-Compilation Matrix

| Matrix Runner | Target Triple | Target Package Name | Output Subdir |
| :--- | :--- | :--- | :--- |
| `windows-latest` | `x86_64-pc-windows-msvc` | `krypton-windows-x64-setup.exe` | `nsis` |
| `macos-13` | `x86_64-apple-darwin` | `krypton-macos-x64.dmg` | `dmg` |
| `macos-latest` | `aarch64-apple-darwin` | `krypton-macos-arm64.dmg` | `dmg` |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | `krypton-linux-x86_64.AppImage` | `appimage` |

### Key Automation Steps:
1. **Sidecar Compilation**: Cross-compiles `krypton-daemon` and `krypton-cli` into standalone executables matching the target architecture.
2. **Next.js Export**: Builds production web assets (`apps/desktop/out`).
3. **Tauri Packaging**: Runs `tauri-apps/tauri-action` with `--target ${{ matrix.target }}` and `includeRelease: false`.
4. **Single-Package Staging**: Locates the generated bundle, standardizes its filename, and generates a cryptographic SHA-256 checksum file (`<pkg>.sha256`).
5. **Clean GitHub Release**: Uploads **only** the single platform installer and its checksum to the GitHub Release. Loose daemons, MSI files, and intermediate CLIs are excluded.
