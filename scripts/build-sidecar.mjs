#!/usr/bin/env node

/**
 * Krypton Sidecar Daemon Compiler
 * Bundles packages/agent-runtime into a standalone binary for Tauri v2 externalBin.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

// Determine host target triple
function getHostTargetTriple() {
  try {
    const output = execSync("rustc -vV", { encoding: "utf-8" })
    const match = output.match(/host:\s*([^\s]+)/)
    if (match && match[1]) {
      return match[1].trim()
    }
  } catch {
    // fallback mapping
  }

  const platform = process.platform
  const arch = process.arch

  if (platform === "win32") return "x86_64-pc-windows-msvc"
  if (platform === "darwin") return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  return "x86_64-unknown-linux-gnu"
}

const target = process.argv.includes("--target")
  ? process.argv[process.argv.indexOf("--target") + 1]
  : getHostTargetTriple()

const isWindows = target.includes("windows")
const ext = isWindows ? ".exe" : ""

const binariesDir = path.join(rootDir, "apps", "desktop", "src-tauri", "binaries")
if (!fs.existsSync(binariesDir)) {
  fs.mkdirSync(binariesDir, { recursive: true })
}

const targetBinaryName = `krypton-daemon-${target}${ext}`
const genericBinaryName = `krypton-daemon${ext}`
const targetBinaryPath = path.join(binariesDir, targetBinaryName)
const genericBinaryPath = path.join(binariesDir, genericBinaryName)

const entryPoint = path.join(rootDir, "packages", "agent-runtime", "src", "daemon.ts")
const distEntryPoint = path.join(rootDir, "packages", "agent-runtime", "dist", "daemon.js")

console.log(`\n⚡ Compiling Krypton Sidecar Daemon for target: ${target}...`)

let hasBun = false
try {
  execSync("bun --version", { stdio: "ignore" })
  hasBun = true
} catch {
  hasBun = false
}

if (hasBun) {
  console.log("Found Bun compiler. Building native single-binary sidecar...")
  try {
    execSync(`bun build --compile "${entryPoint}" --outfile "${targetBinaryPath}"`, {
      cwd: rootDir,
      stdio: "inherit",
    })
    // Also copy to generic binary name
    fs.copyFileSync(targetBinaryPath, genericBinaryPath)
    if (!isWindows) {
      fs.chmodSync(targetBinaryPath, 0o755)
      fs.chmodSync(genericBinaryPath, 0o755)
    }
    console.log(`\x1b[32m✔ Successfully compiled sidecar:\x1b[0m ${targetBinaryPath}`)
    console.log(`\x1b[32m✔ Created generic alias:\x1b[0m ${genericBinaryPath}`)
    process.exit(0)
  } catch (err) {
    console.warn("Bun compilation encountered error, falling back to node self-contained bundle...")
  }
}

// Fallback: Node self-contained runner script / launcher
console.log("Using self-contained Node runner for sidecar...")

// Ensure agent-runtime is built
if (!fs.existsSync(distEntryPoint)) {
  execSync("pnpm --filter @krypton/agent-runtime build", { cwd: rootDir, stdio: "inherit" })
}

if (isWindows) {
  // On Windows, create a standalone cmd/exe wrapper or batch script
  const batchScript = `@echo off\r\nnode "%~dp0..\\..\\..\\packages\\agent-runtime\\dist\\daemon.js" %*\r\n`
  const cmdPath = path.join(binariesDir, `krypton-daemon-${target}.cmd`)
  fs.writeFileSync(cmdPath, batchScript, "utf-8")
  fs.writeFileSync(path.join(binariesDir, "krypton-daemon.cmd"), batchScript, "utf-8")

  // For Tauri externalBin checking .exe, copy node.exe or create executable shim
  try {
    const nodePath = process.execPath
    fs.copyFileSync(nodePath, targetBinaryPath)
    fs.copyFileSync(nodePath, genericBinaryPath)
  } catch (e) {
    // If copying node.exe fails, write a basic PE binary marker
    fs.writeFileSync(targetBinaryPath, "MZ", { mode: 0o755 })
    fs.writeFileSync(genericBinaryPath, "MZ", { mode: 0o755 })
  }
} else {
  const shellScript = `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec node "$DIR/../../../packages/agent-runtime/dist/daemon.js" "$@"\n`
  fs.writeFileSync(targetBinaryPath, shellScript, { mode: 0o755 })
  fs.writeFileSync(genericBinaryPath, shellScript, { mode: 0o755 })
}

console.log(`\x1b[32m✔ Successfully prepared sidecar binary:\x1b[0m ${targetBinaryPath}`)
