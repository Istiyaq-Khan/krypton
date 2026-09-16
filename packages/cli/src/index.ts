#!/usr/bin/env node

import { Command } from "commander"
import { runCommand } from "./commands/run.js"
import { vcsDiffCommand, vcsMergeCommand } from "./commands/vcs.js"
import { agentsListCommand, agentsCreateCommand } from "./commands/agents.js"
import { toolsListCommand, toolsInstallCommand } from "./commands/tools.js"

const program = new Command()

program
  .name("krypton")
  .description("⚡ Krypton Autonomous Desktop Agent Terminal Companion")
  .version("0.1.0")

// krypton run <prompt>
program
  .command("run <prompt>")
  .description("Start an autonomous task DAG with live interactive TUI")
  .option("-a, --agent <name>", "Target agent workspace name", "default")
  .action(async (prompt, options) => {
    try {
      await runCommand(prompt, options)
    } catch (err: any) {
      console.error(`\x1b[31mError running task:\x1b[0m ${err.message}`)
      process.exit(1)
    }
  })

// krypton vcs ...
const vcs = program.command("vcs").description("Inspect and manage agent Git worktrees")

vcs
  .command("diff [worktreeId]")
  .description("Review uncommitted worktree changes")
  .option("--json", "Output diff as JSON payload")
  .action(async (worktreeId, options) => {
    try {
      await vcsDiffCommand(worktreeId, options)
    } catch (err: any) {
      console.error(`\x1b[31mError retrieving diff:\x1b[0m ${err.message}`)
      process.exit(1)
    }
  })

vcs
  .command("merge <worktreeId>")
  .description("Approve and merge agent worktree into active branch")
  .option("--json", "Output result as JSON payload")
  .action(async (worktreeId, options) => {
    try {
      await vcsMergeCommand(worktreeId, options)
    } catch (err: any) {
      console.error(`\x1b[31mError merging worktree:\x1b[0m ${err.message}`)
      process.exit(1)
    }
  })

// krypton agents ...
const agents = program.command("agents").description("Manage local agent workspaces")

agents
  .command("list")
  .description("List all configured agent instances")
  .option("--json", "Output list as JSON payload")
  .action(async (options) => {
    try {
      await agentsListCommand(options)
    } catch (err: any) {
      console.error(`\x1b[31mError listing agents:\x1b[0m ${err.message}`)
      process.exit(1)
    }
  })

agents
  .command("create <name>")
  .description("Provision a new agent workspace")
  .option("-m, --model <model>", "Assigned LLM model identifier")
  .option("--json", "Output result as JSON payload")
  .action(async (name, options) => {
    try {
      await agentsCreateCommand(name, options)
    } catch (err: any) {
      console.error(`\x1b[31mError creating agent:\x1b[0m ${err.message}`)
      process.exit(1)
    }
  })

// krypton tools ...
const tools = program.command("tools").description("Discover and install MCP tools")

tools
  .command("list")
  .description("List available dynamic and MCP tools")
  .option("--json", "Output list as JSON payload")
  .action(async (options) => {
    try {
      await toolsListCommand(options)
    } catch (err: any) {
      console.error(`\x1b[31mError listing tools:\x1b[0m ${err.message}`)
      process.exit(1)
    }
  })

tools
  .command("install <name>")
  .description("Install an MCP tool or dynamic extension")
  .option("--json", "Output result as JSON payload")
  .action(async (name, options) => {
    try {
      await toolsInstallCommand(name, options)
    } catch (err: any) {
      console.error(`\x1b[31mError installing tool:\x1b[0m ${err.message}`)
      process.exit(1)
    }
  })

// Re-export core modules for programmatic usage
export * from "./ipc-client.js"
export * from "./ui/TaskListView.js"
export * from "./ui/QuestionPrompt.js"

if (!process.env.VITEST) {
  program.parse(process.argv)
}
