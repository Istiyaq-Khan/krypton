# Single-Artifact Distribution Standard

This document defines the single-package distribution philosophy, embedded sidecar bundling, and artifact harvesting rules in **Krypton**.

---

## 1. Single-Artifact Packaging Philosophy

Krypton strictly enforces the **Single-Artifact Packaging Standard**:
- For every supported operating system, the build pipeline produces **EXACTLY ONE** user-ready distribution file.
- End users must never be forced to choose between confusing multi-file clusters (e.g. WiX MSI vs NSIS EXE, raw portable binaries, target-triple intermediate CLIs, or loose daemon binaries).
- All internal runtimes, background daemons (`krypton-daemon`), and CLI companion tools (`krypton-cli`) are embedded directly inside the single installer or application image.

---

## 2. Release Package Matrix

| Platform | Target Artifact | Packaging Engine | Embedded Sidecars |
| :--- | :--- | :--- | :--- |
| **Windows** | `krypton-windows-x64-setup.exe` | Tauri v2 NSIS | `krypton-daemon.exe`, `krypton-cli.exe` |
| **macOS** | `krypton-macos-universal.dmg` | Tauri v2 DMG | `krypton-daemon`, `krypton-cli` |
| **Linux** | `krypton-linux-x86_64.AppImage` | Tauri v2 AppImage | `krypton-daemon`, `krypton-cli` |

---

## 3. Sidecar Declaration (`tauri.conf.json`)

To embed the daemon and CLI inside the desktop installer, both binaries are declared as `externalBin`:

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis", "dmg", "appimage"],
    "externalBin": [
      "binaries/krypton-daemon",
      "binaries/krypton-cli"
    ]
  }
}
```

- **Dual-Installer Elimination**: Notice that `"msi"` is omitted from targets, ensuring Windows builds exclusively generate the NSIS installer.
- **Installer Extraction**:
  - Windows: Extracted into `$INSTDIR` alongside `krypton.exe`.
  - macOS: Embedded into `Krypton.app/Contents/MacOS/`.
  - Linux: Embedded inside the AppImage file tree under `usr/bin/`.

---

## 4. Artifact Harvesting (`scripts/collect-output.mjs`)

After building with Tauri, `collect-output.mjs` executes:
1. Purges loose, stale intermediate binaries and WiX MSI installers from `output/`.
2. Renames the generated bundle into the canonical name (e.g. `krypton-windows-x64-setup.exe`).
3. Computes the SHA-256 hash and updates `output/SHA256SUMS.txt`.
4. Generates an `output/README.md` download manifest with file size and verification commands.
