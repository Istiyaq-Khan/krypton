import { KryptonIpcClient } from "../ipc-client.js"

export async function vcsDiffCommand(worktreeId?: string, options: { json?: boolean } = {}): Promise<void> {
  const client = new KryptonIpcClient()
  await client.connect()

  const diff = await client.getVcsDiff(worktreeId)

  if (options.json) {
    console.log(JSON.stringify({ worktreeId, diff }, null, 2))
    return
  }

  console.log("\n⚡ Krypton-VCS Worktree Diff:")
  if (!diff || diff.trim() === "") {
    console.log("No uncommitted or modified changes in worktree.")
  } else {
    // Format git diff lines with color
    const lines = diff.split("\n")
    for (const line of lines) {
      if (line.startsWith("+")) {
        console.log(`\x1b[32m${line}\x1b[0m`) // Green
      } else if (line.startsWith("-")) {
        console.log(`\x1b[31m${line}\x1b[0m`) // Red
      } else if (line.startsWith("@@") || line.startsWith("diff")) {
        console.log(`\x1b[36m${line}\x1b[0m`) // Cyan
      } else {
        console.log(line)
      }
    }
  }
}

export async function vcsMergeCommand(worktreeId: string, options: { json?: boolean } = {}): Promise<void> {
  const client = new KryptonIpcClient()
  await client.connect()

  const result = await client.mergeVcs(worktreeId)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (result.success) {
    console.log(`\x1b[32m✔ Successfully merged worktree [${worktreeId}] into active branch.\x1b[0m`)
    if (result.commitHash) {
      console.log(`  Commit: ${result.commitHash}`)
    }
  } else {
    console.error(`\x1b[31m✖ Failed to merge worktree [${worktreeId}].\x1b[0m`)
  }
}
