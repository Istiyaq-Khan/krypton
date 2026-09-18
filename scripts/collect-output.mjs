#!/usr/bin/env node

/**
 * Krypton Single-Artifact Output Collector & Release Bundler
 * 
 * Enforces the Single-Artifact Distribution Rule:
 * Produces EXACTLY ONE self-contained, user-ready application package per supported OS:
 *   - Windows: krypton-windows-x64-setup.exe (NSIS Setup Installer)
 *   - macOS:   krypton-macos-universal.dmg   (Apple Disk Image DMG)
 *   - Linux:   krypton-linux-x86_64.AppImage  (Universal Linux AppImage)
 *
 * All background daemons (krypton-daemon), internal CLIs (krypton-cli),
 * and runtime dependencies are strictly bundled INSIDE these packages.
 * Loose daemon sidecars, intermediate target-triple binaries, and duplicate
 * installer formats (e.g. WiX MSI, DEB, RPM) are strictly suppressed and purged.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
const outputDir = path.join(rootDir, "output")

// Helper: Format bytes to human-readable string
function formatBytes(bytes) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Helper: Calculate SHA-256 checksum of a file
function computeSha256(filePath) {
  const hash = crypto.createHash("sha256")
  const data = fs.readFileSync(filePath)
  hash.update(data)
  return hash.digest("hex")
}

// Helper: Recursively find files matching criteria
function findFiles(dir, matchPredicate, maxDepth = 5, currentDepth = 0) {
  const results = []
  if (!fs.existsSync(dir) || currentDepth > maxDepth) return results

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findFiles(fullPath, matchPredicate, maxDepth, currentDepth + 1))
      } else if (entry.isFile()) {
        if (matchPredicate(entry.name, fullPath)) {
          results.push({ path: fullPath, name: entry.name })
        }
      }
    }
  } catch {}
  return results
}

console.log("\n" + "=".repeat(76))
console.log(" 📦 Krypton Single-Artifact Output Collector & Release Bundler")
console.log("=".repeat(76))
console.log(` Target Output Directory: ${outputDir}\n`)

// Ensure clean output directory: purge stale intermediate cluster artifacts
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
} else {
  // Purge any loose daemons, MSI installers, or intermediate CLI binaries
  const existingFiles = fs.readdirSync(outputDir)
  for (const file of existingFiles) {
    const filePath = path.join(outputDir, file)
    try {
      const stat = fs.statSync(filePath)
      if (stat.isFile()) {
        fs.unlinkSync(filePath)
      } else if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true })
      }
    } catch {}
  }
}

// Search locations for Tauri bundles across host and target-triple output folders
const targetBaseDir = path.join(rootDir, "apps", "desktop", "src-tauri", "target")
const bundleDirs = []

// Check standard release/bundle
const defaultBundleDir = path.join(targetBaseDir, "release", "bundle")
if (fs.existsSync(defaultBundleDir)) {
  bundleDirs.push(defaultBundleDir)
}

// Check target-triple specific directories (e.g. target/x86_64-pc-windows-msvc/release/bundle)
if (fs.existsSync(targetBaseDir)) {
  try {
    const entries = fs.readdirSync(targetBaseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== "release" && entry.name !== "debug") {
        const tripleBundle = path.join(targetBaseDir, entry.name, "release", "bundle")
        if (fs.existsSync(tripleBundle) && !bundleDirs.includes(tripleBundle)) {
          bundleDirs.push(tripleBundle)
        }
      }
    }
  } catch {}
}

const collectedPackages = []

// -----------------------------------------------------------------------------
// 1. Windows: Harvest EXACTLY ONE NSIS Setup Installer (Exclude WiX MSI & loose EXEs)
// -----------------------------------------------------------------------------
for (const bDir of bundleDirs) {
  const nsisDir = path.join(bDir, "nsis")
  if (fs.existsSync(nsisDir)) {
    const nsisFiles = findFiles(nsisDir, (name) => name.endsWith(".exe"))
    for (const file of nsisFiles) {
      const targetName = "krypton-windows-x64-setup.exe"
      const destPath = path.join(outputDir, targetName)

      // Copy file with overwrite
      fs.copyFileSync(file.path, destPath)
      const stat = fs.statSync(destPath)
      const sha256 = computeSha256(destPath)

      collectedPackages.push({
        platform: "Windows",
        name: targetName,
        source: file.path,
        dest: destPath,
        size: stat.size,
        sha256,
        format: "Self-Contained NSIS Setup Installer",
        desc: "Windows installer bundling desktop UI, background daemon & CLI engine",
      })
      break // Collect at most one primary Windows installer
    }
  }
  if (collectedPackages.some((p) => p.platform === "Windows")) break
}

// -----------------------------------------------------------------------------
// 2. macOS: Harvest EXACTLY ONE Apple Disk Image (.dmg) (Exclude loose .app)
// -----------------------------------------------------------------------------
for (const bDir of bundleDirs) {
  const dmgDir = path.join(bDir, "dmg")
  if (fs.existsSync(dmgDir)) {
    const dmgFiles = findFiles(dmgDir, (name) => name.endsWith(".dmg"))
    for (const file of dmgFiles) {
      let targetName = "krypton-macos-universal.dmg"
      if (file.name.includes("aarch64") || file.name.includes("arm64")) {
        targetName = "krypton-macos-arm64.dmg"
      } else if (file.name.includes("x86_64") || file.name.includes("x64")) {
        targetName = "krypton-macos-x64.dmg"
      }

      const destPath = path.join(outputDir, targetName)
      fs.copyFileSync(file.path, destPath)
      const stat = fs.statSync(destPath)
      const sha256 = computeSha256(destPath)

      collectedPackages.push({
        platform: "macOS",
        name: targetName,
        source: file.path,
        dest: destPath,
        size: stat.size,
        sha256,
        format: "Apple Disk Image (DMG)",
        desc: "macOS drag-and-drop bundle with internal daemon & CLI",
      })
      break
    }
  }
  if (collectedPackages.some((p) => p.platform === "macOS")) break
}

// -----------------------------------------------------------------------------
// 3. Linux: Harvest EXACTLY ONE Universal AppImage (Exclude DEB and RPM)
// -----------------------------------------------------------------------------
for (const bDir of bundleDirs) {
  const appimageDir = path.join(bDir, "appimage")
  if (fs.existsSync(appimageDir)) {
    const appimageFiles = findFiles(appimageDir, (name) => name.endsWith(".AppImage") || name.endsWith(".appimage"))
    for (const file of appimageFiles) {
      let targetName = "krypton-linux-x86_64.AppImage"
      if (file.name.includes("aarch64") || file.name.includes("arm64")) {
        targetName = "krypton-linux-aarch64.AppImage"
      }

      const destPath = path.join(outputDir, targetName)
      fs.copyFileSync(file.path, destPath)
      try {
        fs.chmodSync(destPath, 0o755)
      } catch {}
      const stat = fs.statSync(destPath)
      const sha256 = computeSha256(destPath)

      collectedPackages.push({
        platform: "Linux",
        name: targetName,
        source: file.path,
        dest: destPath,
        size: stat.size,
        sha256,
        format: "Universal Linux AppImage",
        desc: "Self-contained portable Linux executable with embedded agent runtime",
      })
      break
    }
  }
  if (collectedPackages.some((p) => p.platform === "Linux")) break
}

// -----------------------------------------------------------------------------
// 4. Generate SHA256SUMS.txt & README.md Manifest
// -----------------------------------------------------------------------------
if (collectedPackages.length > 0) {
  // Generate SHA256SUMS.txt
  const checksumLines = collectedPackages.map((pkg) => `${pkg.sha256}  ${pkg.name}`).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "SHA256SUMS.txt"), checksumLines, "utf-8")

  // Generate output/README.md
  let manifest = `# Krypton Unified Release Packages\n\n`
  manifest += `Generated on: \`${new Date().toISOString()}\`  \n`
  manifest += `Build Environment: \`${process.platform} (${process.arch})\`\n\n`
  manifest += `Krypton provides **exactly one self-contained, user-ready package per supported operating system**.\n`
  manifest += `All background daemons (\`krypton-daemon\`), internal CLI tools (\`krypton-cli\`), and runtime dependencies are fully embedded inside each application package.\n\n`

  manifest += `## 🚀 Downloads & Packages\n\n`
  manifest += `| Operating System | Package File | Format | Size | SHA-256 Checksum |\n`
  manifest += `| :--- | :--- | :--- | :--- | :--- |\n`

  for (const pkg of collectedPackages) {
    manifest += `| **${pkg.platform}** | \`${pkg.name}\` | ${pkg.format} | **${formatBytes(pkg.size)}** | \`${pkg.sha256.slice(0, 16)}...\` |\n`
  }

  manifest += `\n> Full cryptographic checksums are available in [\`SHA256SUMS.txt\`](./SHA256SUMS.txt).\n\n`

  manifest += `## 💿 Installation & Quickstart\n\n`
  manifest += `### Windows\n`
  manifest += `1. Download and run \`krypton-windows-x64-setup.exe\`.\n`
  manifest += `2. Follow the setup wizard. Krypton automatically configures background daemons and runtime paths.\n`
  manifest += `3. Launch **Krypton** from the Start Menu or Desktop.\n\n`

  manifest += `### macOS\n`
  manifest += `1. Download the \`.dmg\` disk image (\`krypton-macos-universal.dmg\` or architecture-specific package).\n`
  manifest += `2. Open the image and drag **Krypton.app** into your \`Applications\` folder.\n`
  manifest += `3. Launch Krypton from Launchpad or Spotlight.\n\n`

  manifest += `### Linux\n`
  manifest += `1. Download \`krypton-linux-x86_64.AppImage\`.\n`
  manifest += `2. Grant execute permissions and run:\n`
  manifest += `   \`\`\`bash\n`
  manifest += `   chmod +x krypton-linux-x86_64.AppImage\n`
  manifest += `   ./krypton-linux-x86_64.AppImage\n`
  manifest += `   \`\`\`\n\n`

  manifest += `## 🔒 Integrity Verification\n\n`
  manifest += `Verify downloaded packages against \`SHA256SUMS.txt\`:\n`
  manifest += `\`\`\`bash\n`
  manifest += `# Windows (PowerShell)\n`
  manifest += `Get-FileHash .\\krypton-windows-x64-setup.exe -Algorithm SHA256\n\n`
  manifest += `# Linux / macOS\n`
  manifest += `sha256sum -c SHA256SUMS.txt\n`
  manifest += `\`\`\`\n`

  fs.writeFileSync(path.join(outputDir, "README.md"), manifest, "utf-8")

  console.log(" Collected Release Packages:")
  for (const pkg of collectedPackages) {
    console.log(`  \x1b[32m✔\x1b[0m \x1b[1m${pkg.name.padEnd(34)}\x1b[0m [${formatBytes(pkg.size).padStart(9)}]  \x1b[90m${pkg.desc}\x1b[0m`)
    console.log(`    \x1b[36mSHA-256:\x1b[0m ${pkg.sha256}`)
  }
  console.log(`\n  \x1b[32m✔ Checksums saved to:\x1b[0m ${path.join(outputDir, "SHA256SUMS.txt")}`)
  console.log(`  \x1b[32m✔ Release manifest saved to:\x1b[0m ${path.join(outputDir, "README.md")}`)
  console.log(`\n\x1b[32m✔ Success: Clean single-artifact release generated in:\x1b[0m ${outputDir}\n`)
} else {
  console.warn("  ⚠ No release bundles found in target directories. Run `pnpm build:desktop` first.")
}

console.log("=".repeat(76) + "\n")
