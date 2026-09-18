#!/usr/bin/env node

/**
 * Krypton Universal Build Output Collector
 * Automatically gathers built desktop binaries, installers, CLI executables,
 * and sidecar daemons from all platforms (Windows, macOS, Linux) into the root `output/` folder.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
const outputDir = path.join(rootDir, "output")

// Helper: Format bytes to human readable string
function formatBytes(bytes) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Helper: Safe copy with directory creation and optional chmod
function copyFileSafe(src, dest, makeExecutable = false) {
  try {
    const parentDir = path.dirname(dest)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }
    fs.copyFileSync(src, dest)
    if (makeExecutable && process.platform !== "win32") {
      try {
        fs.chmodSync(dest, 0o755)
      } catch {}
    }
    return true
  } catch (err) {
    console.error(`  ✖ Failed to copy ${src} -> ${dest}:`, err.message)
    return false
  }
}

// Helper: Safe directory copy (for macOS .app bundles)
function copyDirSafe(src, dest) {
  try {
    const parentDir = path.dirname(dest)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }
    fs.cpSync(src, dest, { recursive: true, force: true })
    return true
  } catch (err) {
    console.error(`  ✖ Failed to copy dir ${src} -> ${dest}:`, err.message)
    return false
  }
}

// Recursively find files matching extensions
function findFiles(dir, matchExts = [], maxDepth = 4, currentDepth = 0) {
  const results = []
  if (!fs.existsSync(dir) || currentDepth > maxDepth) return results

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Special check for macOS .app directory bundles
        if (entry.name.endsWith(".app")) {
          results.push({ path: fullPath, isDir: true, name: entry.name })
        } else {
          results.push(...findFiles(fullPath, matchExts, maxDepth, currentDepth + 1))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (matchExts.length === 0 || matchExts.includes(ext) || matchExts.some((m) => entry.name.endsWith(m))) {
          results.push({ path: fullPath, isDir: false, name: entry.name })
        }
      }
    }
  } catch {}
  return results
}

console.log("\n" + "=".repeat(72))
console.log(" 📦 Krypton Build Output Collector")
console.log("=".repeat(72))
console.log(` Target Directory: ${outputDir}\n`)

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

const collectedItems = []

// -----------------------------------------------------------------------------
// 1. Collect Tauri Desktop Bundle Installers (NSIS, MSI, DMG, AppImage, DEB, RPM)
// -----------------------------------------------------------------------------
const bundleDir = path.join(rootDir, "apps", "desktop", "src-tauri", "target", "release", "bundle")
if (fs.existsSync(bundleDir)) {
  const bundleFiles = findFiles(bundleDir, [".exe", ".msi", ".dmg", ".pkg", ".deb", ".appimage", ".rpm", ".app"])
  for (const item of bundleFiles) {
    const dest = path.join(outputDir, item.name)
    let size = 0
    let success = false

    if (item.isDir) {
      success = copyDirSafe(item.path, dest)
      // Estimate directory size
      try {
        const files = findFiles(item.path, [])
        for (const f of files) {
          if (!f.isDir) size += fs.statSync(f.path).size
        }
      } catch {}
    } else {
      success = copyFileSafe(item.path, dest, true)
      try {
        size = fs.statSync(item.path).size
      } catch {}
    }

    if (success) {
      let desc = "Desktop Bundle Installer"
      if (item.name.endsWith(".exe")) desc = "Windows NSIS Setup Installer"
      else if (item.name.endsWith(".msi")) desc = "Windows WiX MSI Installer"
      else if (item.name.endsWith(".dmg")) desc = "macOS Apple Disk Image (DMG)"
      else if (item.name.endsWith(".app")) desc = "macOS Application Bundle (.app)"
      else if (item.name.endsWith(".AppImage") || item.name.endsWith(".appimage")) desc = "Linux Universal AppImage"
      else if (item.name.endsWith(".deb")) desc = "Linux Debian / Ubuntu Package"
      else if (item.name.endsWith(".rpm")) desc = "Linux Fedora / RedHat Package"

      collectedItems.push({
        name: item.name,
        dest,
        size,
        desc,
        category: "Desktop Installer",
      })
    }
  }
}

// -----------------------------------------------------------------------------
// 2. Collect Standalone Desktop Executable
// -----------------------------------------------------------------------------
const releaseDir = path.join(rootDir, "apps", "desktop", "src-tauri", "target", "release")
const desktopBinaries = [
  { raw: "app.exe", destName: "krypton-desktop.exe", ext: ".exe" },
  { raw: "krypton.exe", destName: "krypton-desktop.exe", ext: ".exe" },
  { raw: "app", destName: "krypton-desktop", ext: "" },
  { raw: "krypton", destName: "krypton-desktop", ext: "" },
]

for (const bin of desktopBinaries) {
  const srcPath = path.join(releaseDir, bin.raw)
  if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
    const destPath = path.join(outputDir, bin.destName)
    if (copyFileSafe(srcPath, destPath, true)) {
      const size = fs.statSync(destPath).size
      collectedItems.push({
        name: bin.destName,
        dest: destPath,
        size,
        desc: "Standalone Desktop Executable (Portable)",
        category: "Desktop Application",
      })
      break
    }
  }
}

// -----------------------------------------------------------------------------
// 3. Collect Standalone CLI Executable
// -----------------------------------------------------------------------------
const cliDistDir = path.join(rootDir, "packages", "cli", "dist")
const cliCandidates = [
  { path: path.join(rootDir, "krypton.exe"), name: "krypton.exe", desc: "Krypton Standalone CLI (Windows x64)" },
  { path: path.join(rootDir, "krypton"), name: "krypton", desc: "Krypton Standalone CLI (Unix)" },
  { path: path.join(cliDistDir, "krypton.exe"), name: "krypton.exe", desc: "Krypton Standalone CLI (Windows x64)" },
  { path: path.join(cliDistDir, "krypton"), name: "krypton", desc: "Krypton Standalone CLI (Unix)" },
]

for (const cli of cliCandidates) {
  if (fs.existsSync(cli.path) && fs.statSync(cli.path).isFile()) {
    const dest = path.join(outputDir, cli.name)
    // Avoid re-copying if already collected
    if (!collectedItems.some((item) => item.name === cli.name)) {
      if (copyFileSafe(cli.path, dest, true)) {
        collectedItems.push({
          name: cli.name,
          dest,
          size: fs.statSync(dest).size,
          desc: cli.desc,
          category: "CLI Client",
        })
      }
    }
  }
}

// Also collect any cross-compiled CLI binaries in cli/dist
if (fs.existsSync(cliDistDir)) {
  const crossCliFiles = findFiles(cliDistDir, []).filter((f) => f.name.startsWith("krypton-krypton-") || f.name.startsWith("krypton-x86") || f.name.startsWith("krypton-aarch64"))
  for (const f of crossCliFiles) {
    const cleanName = f.name.replace(/^krypton-krypton-/, "krypton-")
    const dest = path.join(outputDir, cleanName)
    if (!collectedItems.some((item) => item.name === cleanName)) {
      if (copyFileSafe(f.path, dest, true)) {
        collectedItems.push({
          name: cleanName,
          dest,
          size: fs.statSync(dest).size,
          desc: "Krypton CLI Cross-Compiled Binary",
          category: "CLI Client",
        })
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 4. Collect Sidecar Daemon Binaries
// -----------------------------------------------------------------------------
const sidecarDir = path.join(rootDir, "apps", "desktop", "src-tauri", "binaries")
if (fs.existsSync(sidecarDir)) {
  const sidecarFiles = findFiles(sidecarDir, []).filter(
    (f) => (f.name.startsWith("krypton-daemon") || f.name.startsWith("krypton-daemon.exe")) && !f.name.endsWith(".pdb") && !f.name.endsWith(".cmd") && !f.name.endsWith(".gitkeep")
  )
  for (const f of sidecarFiles) {
    const dest = path.join(outputDir, f.name)
    if (!collectedItems.some((item) => item.name === f.name)) {
      if (copyFileSafe(f.path, dest, true)) {
        collectedItems.push({
          name: f.name,
          dest,
          size: fs.statSync(dest).size,
          desc: "Krypton Sidecar Daemon",
          category: "Agent Daemon",
        })
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 5. Generate output/README.md Manifest
// -----------------------------------------------------------------------------
if (collectedItems.length > 0) {
  let manifestContent = `# Krypton Release Binaries\n\n`
  manifestContent += `Generated on: \`${new Date().toISOString()}\`  \n`
  manifestContent += `Operating System: \`${process.platform} (${process.arch})\`\n\n`
  manifestContent += `All standalone executables, desktop bundles, and installers are consolidated here for distribution.\n\n`
  manifestContent += `| File Name | Category | Description | Size |\n`
  manifestContent += `| :--- | :--- | :--- | :--- |\n`

  for (const item of collectedItems) {
    manifestContent += `| \`${item.name}\` | ${item.category} | ${item.desc} | **${formatBytes(item.size)}** |\n`
  }

  manifestContent += `\n## How to Run\n\n`
  manifestContent += `### Windows\n`
  manifestContent += `- **Setup Installer**: Run \`krypton_0.1.0_x64-setup.exe\` to install desktop application.\n`
  manifestContent += `- **MSI Installer**: Run \`krypton_0.1.0_x64_en-US.msi\` for enterprise/managed deployment.\n`
  manifestContent += `- **Portable Desktop**: Double-click \`krypton-desktop.exe\`.\n`
  manifestContent += `- **CLI Client**: Run \`.\\krypton.exe\` from PowerShell or Command Prompt.\n\n`
  manifestContent += `### macOS\n`
  manifestContent += `- Open the \`.dmg\` installer and drag Krypton into Applications, or run \`krypton-desktop\`.\n`
  manifestContent += `- For CLI: \`./krypton\`.\n\n`
  manifestContent += `### Linux\n`
  manifestContent += `- **AppImage**: \`chmod +x krypton_*.AppImage && ./krypton_*.AppImage\`\n`
  manifestContent += `- **Debian/Ubuntu**: \`sudo dpkg -i krypton_*.deb\`\n`
  manifestContent += `- **CLI**: \`chmod +x krypton && ./krypton\`\n`

  fs.writeFileSync(path.join(outputDir, "README.md"), manifestContent, "utf-8")

  // Log summary to console
  console.log(" Collected Release Artifacts:")
  for (const item of collectedItems) {
    console.log(`  \x1b[32m✔\x1b[0m \x1b[1m${item.name.padEnd(36)}\x1b[0m [${formatBytes(item.size).padStart(9)}]  \x1b[90m${item.desc}\x1b[0m`)
  }
  console.log(`\n\x1b[32m✔ Success: All binaries collected into:\x1b[0m ${outputDir}\n`)
} else {
  console.warn("  ⚠ No build artifacts found in target directories. Run a build first.")
}

console.log("=".repeat(72) + "\n")
