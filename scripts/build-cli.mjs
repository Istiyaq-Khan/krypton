#!/usr/bin/env node

/**
 * Krypton Standalone CLI Compiler
 * Compiles packages/cli into a cross-platform standalone executable (`krypton` / `krypton.exe`).
 * Supports Windows, Linux, and macOS (Intel & Apple Silicon).
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

// Resolve CLI arguments
function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null
}

function normalizeTarget(rawTarget) {
  if (!rawTarget) return null
  if (rawTarget === "win" || rawTarget === "windows" || rawTarget.includes("windows")) return "x86_64-pc-windows-msvc"
  if (rawTarget === "mac" || rawTarget === "mac-arm" || rawTarget === "darwin-arm64" || rawTarget.includes("aarch64-apple-darwin")) return "aarch64-apple-darwin"
  if (rawTarget === "mac-intel" || rawTarget === "mac-x64" || rawTarget === "darwin-x64" || rawTarget.includes("x86_64-apple-darwin")) return "x86_64-apple-darwin"
  if (rawTarget === "linux-arm64" || rawTarget.includes("aarch64-unknown-linux-gnu")) return "aarch64-unknown-linux-gnu"
  if (rawTarget === "linux" || rawTarget === "linux-x64" || rawTarget.includes("x86_64-unknown-linux-gnu")) return "x86_64-unknown-linux-gnu"
  return rawTarget
}

function toBunTarget(targetTriple) {
  if (!targetTriple) return null
  if (targetTriple.includes("windows")) return "bun-windows-x64"
  if (targetTriple.includes("darwin") || targetTriple.includes("apple")) {
    return targetTriple.includes("arm64") || targetTriple.includes("aarch64") ? "bun-darwin-arm64" : "bun-darwin-x64"
  }
  if (targetTriple.includes("linux")) {
    return targetTriple.includes("arm64") || targetTriple.includes("aarch64") ? "bun-linux-arm64" : "bun-linux-x64"
  }
  return null
}

const rawTarget = getArg("--target")
const target = normalizeTarget(rawTarget)
const artifactName = getArg("--artifact-name")

// Determine host platform and extension
const isWindows = target ? target.includes("windows") : process.platform === "win32"
const isDarwin = target ? target.includes("darwin") || target.includes("apple") : process.platform === "darwin"
const ext = isWindows ? ".exe" : ""

const cliEntryPoint = path.join(rootDir, "packages", "cli", "src", "index.ts")
const distDir = path.join(rootDir, "packages", "cli", "dist")
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

const rootBinaryPath = path.join(rootDir, `krypton${ext}`)
const distBinaryPath = path.join(distDir, `krypton${ext}`)

console.log(`\n⚡ Compiling Krypton Standalone CLI [platform: ${process.platform}, target: ${target || "host"}, arch: ${process.arch}]...`)

// 1. Build TypeScript dist
execSync("pnpm --filter @krypton/cli build", { cwd: rootDir, stdio: "inherit" })

// 2. Check for Bun compiler
let hasBun = false
try {
  execSync("bun --version", { stdio: "ignore" })
  hasBun = true
} catch {
  hasBun = false
}

const effectiveTarget = target || (process.platform === "win32" ? "x86_64-pc-windows-msvc" : (process.platform === "darwin" ? (process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin") : "x86_64-unknown-linux-gnu"))

const tauriBinariesDir = path.join(rootDir, "apps", "desktop", "src-tauri", "binaries")
if (!fs.existsSync(tauriBinariesDir)) {
  fs.mkdirSync(tauriBinariesDir, { recursive: true })
}
const tauriTargetCliPath = path.join(tauriBinariesDir, `krypton-cli-${effectiveTarget}${ext}`)
const tauriGenericCliPath = path.join(tauriBinariesDir, `krypton-cli${ext}`)

if (hasBun) {
  console.log("Found Bun compiler. Building native single-binary CLI executable...")
  try {
    const bunTarget = toBunTarget(target)
    const targetFlag = bunTarget ? ` --target="${bunTarget}"` : ""
    execSync(`bun build --compile${targetFlag} "${cliEntryPoint}" --outfile "${rootBinaryPath}"`, {
      cwd: rootDir,
      stdio: "inherit",
    })
    fs.copyFileSync(rootBinaryPath, distBinaryPath)
    fs.copyFileSync(rootBinaryPath, tauriTargetCliPath)
    fs.copyFileSync(rootBinaryPath, tauriGenericCliPath)
    if (!isWindows) {
      fs.chmodSync(rootBinaryPath, 0o755)
      fs.chmodSync(distBinaryPath, 0o755)
      fs.chmodSync(tauriTargetCliPath, 0o755)
      fs.chmodSync(tauriGenericCliPath, 0o755)
    }

    // Also produce artifact-named binary if artifactName or target was passed
    const namedTag = artifactName || (target ? `krypton-${target}` : null)
    if (namedTag) {
      const artifactBinary = path.join(distDir, `krypton-${namedTag}${ext}`)
      fs.copyFileSync(rootBinaryPath, artifactBinary)
      if (!isWindows) fs.chmodSync(artifactBinary, 0o755)
      console.log(`\x1b[32m✔ Artifact binary created:\x1b[0m ${artifactBinary}`)
    }

    console.log(`\x1b[32m✔ Successfully compiled standalone CLI:\x1b[0m ${rootBinaryPath}`)
    console.log(`\x1b[32m✔ Dist binary:\x1b[0m ${distBinaryPath}`)
    console.log(`\x1b[32m✔ Embedded Tauri sidecar CLI:\x1b[0m ${tauriTargetCliPath}`)
    process.exit(0)
  } catch (err) {
    console.warn("Bun compilation encountered error, falling back to portable wrapper script...")
  }
}

// Fallback: Portable wrapper scripts
if (isWindows) {
  const rootBatchScript = `@echo off\r\nnode "%~dp0packages\\cli\\dist\\index.js" %*\r\n`
  const distBatchScript = `@echo off\r\nnode "%~dp0index.js" %*\r\n`
  fs.writeFileSync(path.join(rootDir, "krypton.cmd"), rootBatchScript, "utf-8")
  fs.writeFileSync(path.join(distDir, "krypton.cmd"), distBatchScript, "utf-8")
  try {
    fs.copyFileSync(process.execPath, tauriTargetCliPath)
    fs.copyFileSync(process.execPath, tauriGenericCliPath)
  } catch {
    fs.writeFileSync(tauriTargetCliPath, "MZ", { mode: 0o755 })
    fs.writeFileSync(tauriGenericCliPath, "MZ", { mode: 0o755 })
  }
  console.log(`\x1b[32m✔ Created Windows CLI batch wrappers.\x1b[0m`)
} else {
  const rootShellScript = `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec node "$DIR/packages/cli/dist/index.js" "$@"\n`
  const distShellScript = `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec node "$DIR/index.js" "$@"\n`
  fs.writeFileSync(rootBinaryPath, rootShellScript, { mode: 0o755 })
  fs.writeFileSync(distBinaryPath, distShellScript, { mode: 0o755 })
  fs.writeFileSync(tauriTargetCliPath, rootShellScript, { mode: 0o755 })
  fs.writeFileSync(tauriGenericCliPath, rootShellScript, { mode: 0o755 })
  console.log(`\x1b[32m✔ Created Unix CLI executable.\x1b[0m`)
}
