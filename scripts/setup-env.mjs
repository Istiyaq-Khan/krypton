#!/usr/bin/env node

/**
 * Krypton Environment Setup & Prerequisites Validator
 */

import { execSync } from "node:child_process"
import * as os from "node:os"

const CHECKS = [
  {
    name: "Node.js",
    check: () => {
      const version = process.versions.node
      const major = parseInt(version.split(".")[0], 10)
      if (major < 20) {
        throw new Error(`Node.js version must be >= 20. Current: v${version}`)
      }
      return `v${version}`
    },
  },
  {
    name: "pnpm",
    check: () => {
      const output = execSync("pnpm --version", { encoding: "utf-8" }).trim()
      return `v${output}`
    },
  },
  {
    name: "Git",
    check: () => {
      const output = execSync("git --version", { encoding: "utf-8" }).trim()
      return output
    },
  },
  {
    name: "Rust & Cargo",
    check: () => {
      const cargoVer = execSync("cargo --version", { encoding: "utf-8" }).trim()
      const rustcVer = execSync("rustc --version", { encoding: "utf-8" }).trim()
      return `${rustcVer} (${cargoVer})`
    },
  },
]

console.log("\n⚡ Validating Krypton Build & Runtime Prerequisites...\n")
console.log(`OS: ${os.type()} ${os.release()} (${os.arch()})\n`)

let hasErrors = false

for (const item of CHECKS) {
  try {
    const result = item.check()
    console.log(`  \x1b[32m✔\x1b[0m ${item.name.padEnd(16)}: ${result}`)
  } catch (err) {
    hasErrors = true
    console.error(`  \x1b[31m✖\x1b[0m ${item.name.padEnd(16)}: ${err.message}`)
  }
}

console.log("")
if (hasErrors) {
  console.error("\x1b[31mPrerequisites check failed! Please install missing dependencies before building.\x1b[0m\n")
  process.exit(1)
} else {
  console.log("\x1b[32mAll prerequisites met! Krypton environment is ready to build.\x1b[0m\n")
}
