import { KryptonIpcClient } from "../ipc-client.js"

export async function agentsListCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = new KryptonIpcClient()
  await client.connect()

  const agents = await client.listAgents()

  if (options.json) {
    console.log(JSON.stringify(agents, null, 2))
    return
  }

  console.log("\n⚡ Configured Krypton Agents:")
  if (agents.length === 0) {
    console.log("No agent instances found.")
    return
  }

  for (const agent of agents) {
    console.log(`\n• \x1b[36m${agent.name}\x1b[0m`)
    console.log(`  Model: ${agent.model}`)
    console.log(`  Tools: ${agent.tools ? agent.tools.join(", ") : "none"}`)
  }
}

export async function agentsCreateCommand(
  name: string,
  options: { model?: string; json?: boolean } = {}
): Promise<void> {
  const client = new KryptonIpcClient()
  await client.connect()

  const result = await client.createAgent(name, options.model)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(`\x1b[32m✔ Successfully created agent workspace for [${name}].\x1b[0m`)
  console.log(`  Path: ${result.agentDir}`)
}
