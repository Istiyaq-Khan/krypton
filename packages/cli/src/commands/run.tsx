import React, { useState, useEffect } from "react"
import { render, Box, Text } from "ink"
import { KryptonIpcClient } from "../ipc-client.js"
import { TaskListView } from "../ui/TaskListView.js"
import { QuestionPrompt } from "../ui/QuestionPrompt.js"
import { TaskNode, ClarificationRequest } from "@krypton/shared-types"

interface RunAppProps {
  prompt: string
  agentName?: string
  client: KryptonIpcClient
}

const RunApp: React.FC<RunAppProps> = ({ prompt, agentName, client }) => {
  const [tasks, setTasks] = useState<TaskNode[]>([])
  const [activeClarification, setActiveClarification] = useState<ClarificationRequest | null>(null)
  const [recentLog, setRecentLog] = useState<string>()
  const [lastToken, setLastToken] = useState<string>()
  const [isDone, setIsDone] = useState(false)

  useEffect(() => {
    let mounted = true

    const run = async () => {
      await client.connect()

      const res = await client.startTask(prompt, agentName)
      if (res.initialDag && mounted) {
        setTasks(res.initialDag)
      }
    }

    run()

    return () => {
      mounted = false
    }
  }, [prompt, agentName, client])

  const handleClarificationSubmit = async (selectedOptionIds: string[], freeformText?: string) => {
    if (!activeClarification) return
    const reqId = activeClarification.requestId
    setActiveClarification(null)
    await client.resolveClarification(reqId, selectedOptionIds, freeformText)
  }

  return (
    <Box flexDirection="column">
      <TaskListView
        prompt={prompt}
        agentName={agentName}
        tasks={tasks}
        recentLog={recentLog}
        lastTokenDelta={lastToken}
      />

      {activeClarification && (
        <QuestionPrompt
          request={activeClarification}
          onSubmit={handleClarificationSubmit}
        />
      )}

      {isDone && (
        <Box marginTop={1}>
          <Text color="green" bold>
            ✔ Task execution completed successfully.
          </Text>
        </Box>
      )}
    </Box>
  )
}

export async function runCommand(prompt: string, options: { agent?: string }): Promise<void> {
  const client = new KryptonIpcClient()
  const instance = render(
    <RunApp prompt={prompt} agentName={options.agent} client={client} />
  )

  await instance.waitUntilExit()
}
