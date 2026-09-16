#!/usr/bin/env node

/**
 * Krypton Standalone CLI Compiler
 * Compiles packages/cli into a standalone executable (`krypton` / `krypton.exe`).
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")

const isWindows = process.platform === "win32"
const ext = isWindows ? ".exe" : ""
const cliEntryPoint = path.join(rootDir, "packages", "cli", "src", "index.ts")
const distDir = path.join(rootDir, "packages", "cli", "dist")
const distIndex = path.join(distDir, "index.js")
const rootBinaryPath = path.join(rootDir, `krypton${ext}`)
const distBinaryPath = path.join(distDir, `krypton${ext}`)

console.log(`\n⚡ Compiling Krypton Standalone CLI for ${process.platform} (${process.arch})...`)

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

if (hasBun) {
  console.log("Found Bun compiler. Building native single-binary CLI executable...")
  try {
    execSync(`bun build --compile "${cliEntryPoint}" --outfile "${rootBinaryPath}"`, {
      cwd: rootDir,
      stdio: "inherit",
    })
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true })
    }
    fs.copyFileSync(rootBinaryPath, distBinaryPath)
    console.log(`\x1b[32m✔ Successfully compiled standalone CLI:\x1b[0m ${rootBinaryPath}`)
    console.log(`\x1b[32m✔ Dist binary:\x1b[0m ${distBinaryPath}`)
    process.exit(0)
  } catch (err) {
    console.warn("Bun compilation encountered error, creating wrapper script...")
  }
}

// Fallback wrapper script
if (isWindows) {
  const rootBatchScript = `@echo off\r\nnode "%~dp0packages\\cli\\dist\\index.js" %*\r\n`
  const distBatchScript = `@echo off\r\nnode "%~dp0index.js" %*\r\n`
  fs.writeFileSync(path.join(rootDir, "krypton.cmd"), rootBatchScript, "utf-8")
  fs.writeFileSync(path.join(distDir, "krypton.cmd"), distBatchScript, "utf-8")
  console.log(`\x1b[32m✔ Created Windows CLI batch wrappers.\x1b[0m`)
} else {
  const rootShellScript = `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec node "$DIR/packages/cli/dist/index.js" "$@"\n`
  const distShellScript = `#!/bin/sh\nDIR="$(cd "$(dirname "$0")" && pwd)"\nexec node "$DIR/index.js" "$@"\n`
  fs.writeFileSync(rootBinaryPath, rootShellScript, { mode: 0o755 })
  fs.writeFileSync(distBinaryPath, distShellScript, { mode: 0o755 })
  console.log(`\x1b[32m✔ Created Unix CLI executable.\x1b[0m`)
}

