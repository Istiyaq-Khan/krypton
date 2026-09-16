import { KryptonIpcClient } from "../ipc-client.js"

export async function toolsListCommand(options: { json?: boolean } = {}): Promise<void> {
  const client = new KryptonIpcClient()
  await client.connect()

  const tools = await client.listTools()

  if (options.json) {
    console.log(JSON.stringify(tools, null, 2))
    return
  }

  console.log("\n⚡ Available Krypton Dynamic Tools & MCP Servers:")
  if (tools.length === 0) {
    console.log("No dynamic tools discovered.")
    return
  }

  for (const tool of tools) {
    console.log(`\n• \x1b[36m${tool.name}\x1b[0m [${tool.type}]`)
    console.log(`  Description: ${tool.description}`)
  }
}

export async function toolsInstallCommand(name: string, options: { json?: boolean } = {}): Promise<void> {
  const client = new KryptonIpcClient()
  await client.connect()

  const result = await client.installTool(name)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (result.success) {
    console.log(`\x1b[32m✔ Successfully installed dynamic tool [${name}].\x1b[0m`)
  } else {
    console.error(`\x1b[31m✖ Failed to install tool [${name}].\x1b[0m`)
  }
}
