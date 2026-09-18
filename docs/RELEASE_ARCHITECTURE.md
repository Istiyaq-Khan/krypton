# Krypton Release Architecture & Packaging Guide

This document defines the release architecture, bundling mechanics, and CI/CD automation rules for **Krypton**.

---

## 1. Single-Artifact Distribution Philosophy

Krypton strictly enforces a **Single-Artifact Packaging Standard**:
- For every supported operating system (Windows, macOS, Linux), the build and release pipeline produces **EXACTLY ONE** user-ready distribution file.
- End users must never be forced to choose between confusing multi-file clusters (such as WiX MSI vs NSIS EXE, raw portable `.exe` files, target-triple intermediate CLIs, or loose daemon binaries).
- All internal runtimes, background daemons, and command-line companion tools are embedded directly inside the single application installer or image.

### Release Package Matrix

| Platform | Primary Target Artifact | Packaging Engine | Internal Sidecars Included |
| :--- | :--- | :--- | :--- |
| **Windows** | `krypton-windows-x64-setup.exe` | Tauri v2 NSIS | `krypton-daemon.exe`, `krypton-cli.exe` |
| **macOS** | `krypton-macos-universal.dmg` | Tauri v2 DMG | `krypton-daemon`, `krypton-cli` |
| **Linux** | `krypton-linux-x86_64.AppImage` | Tauri v2 AppImage | `krypton-daemon`, `krypton-cli` |

---

## 2. Embedded Sidecar Architecture & Tauri Integration

Krypton's native desktop shell is powered by Tauri v2 with a Rust native core. The application delegates autonomous agent execution and task DAG scheduling to background daemon sidecars.

### Bundling Configuration (`tauri.conf.json`)

In `apps/desktop/src-tauri/tauri.conf.json`, `bundle.targets` is explicitly restricted to single-package formats:
```json
{
  "bundle": {
    "active": true,
    "targets": [
      "nsis",
      "dmg",
      "appimage"
    ],
    "externalBin": [
      "binaries/krypton-daemon",
      "binaries/krypton-cli"
    ]
  }
}
```

- **Dual-Installer Elimination**: By omitting `"msi"`, Windows builds exclusively generate the NSIS setup installer, suppressing redundant WiX MSI packages.
- **Sidecar Embedding**: Both `krypton-daemon` and `krypton-cli` are declared as `externalBin`. When Tauri bundles the application, it packages these binaries inside the installer:
  - **Windows**: Extracted into `$INSTDIR` alongside `krypton.exe`.
  - **macOS**: Embedded in `Krypton.app/Contents/MacOS` and `Krypton.app/Contents/Resources`.
  - **Linux**: Bundled within the AppImage file tree under `usr/bin/`.

---

## 3. Runtime Path Resolution (`sidecar.rs`)

When Krypton runs on a clean user machine, it must locate and spawn its internal background daemon without looking for external repo paths or relying on user environment variables.

The supervisor (`apps/desktop/src-tauri/src/commands/sidecar.rs`) implements prioritized candidate discovery:
1. **Application Directory**: Checks `std::env::current_exe().parent()` for `krypton-daemon.exe` (or `krypton-daemon` on Unix).
2. **App Bundle Resources**: Checks relative `../Resources/` directories for macOS `.app` bundles.
3. **AppImage Environment**: Reads the `$APPDIR` mount point for Linux AppImage executions.
4. **User Configuration**: Checks `%USERPROFILE%\.krypton\bin` / `$HOME/.krypton/bin`.
5. **Development Fallbacks**: Checks `binaries/` and local Node.js runtime entry points during local engineering.

---

## 4. Local Build & Packaging Workflow

Developers and release engineers can reproduce the complete build locally:

### 1. Prerequisites Validation
```bash
node scripts/setup-env.mjs
```

### 2. Compile Monorepo & TypeScript Dist
```bash
pnpm install
pnpm build
```

### 3. Compile Internal Sidecars
Compiles the daemon and CLI into standalone native binaries and copies them into `apps/desktop/src-tauri/binaries/`:
```bash
pnpm build:binaries
```

To cross-compile sidecars for a specific target:
```bash
node scripts/build-sidecar.mjs --target x86_64-pc-windows-msvc
node scripts/build-cli.mjs --target x86_64-pc-windows-msvc
```

### 4. Build Desktop Application & Harvest Unified Package
Runs the Tauri bundler and triggers `scripts/collect-output.mjs`:
```bash
pnpm build:desktop
```

The resulting single application package is placed in `output/`:
- `output/krypton-windows-x64-setup.exe` (on Windows)
- `output/SHA256SUMS.txt`
- `output/README.md`

---

## 5. GitHub Actions Release Pipeline (`.github/workflows/release.yml`)

Krypton's CI/CD release workflow cross-compiles across all platforms using a GitHub Actions matrix:
- `windows-latest` (`x86_64-pc-windows-msvc`)
- `macos-13` (`x86_64-apple-darwin`)
- `macos-latest` (`aarch64-apple-darwin`)
- `ubuntu-22.04` (`x86_64-unknown-linux-gnu`)

### Asset Staging & Sanitization
1. **Tauri Action with `includeRelease: false`**: Builds the bundle without publishing unstandardized files.
2. **Deterministic Renaming**: Re-stages the single bundle into `release-assets/` with clean names (`krypton-windows-x64-setup.exe`, `krypton-macos-*.dmg`, `krypton-linux-x86_64.AppImage`).
3. **Cryptographic Checksums**: Automatically calculates SHA-256 hashes (`<package>.sha256`).
4. **Clean Release Publishing**: Uses `softprops/action-gh-release@v2` to upload **only** the designated single package and its hash per platform. Loose daemon binaries and target-triple CLIs are completely omitted.

---

## 6. Verification & Self-Healing

Verify releases using SHA-256 hashes:

### PowerShell (Windows)
```powershell
Get-FileHash .\krypton-windows-x64-setup.exe -Algorithm SHA256
```

### Unix (macOS / Linux)
```bash
sha256sum -c SHA256SUMS.txt
```
