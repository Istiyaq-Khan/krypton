import React from "react"
import { Box, Text } from "ink"
import { TaskNode, TaskStatus } from "@krypton/shared-types"

export interface TaskListViewProps {
  prompt: string
  agentName?: string
  tasks: TaskNode[]
  recentLog?: string
  lastTokenDelta?: string
}

const statusMap: Record<TaskStatus, { icon: string; color: string }> = {
  completed: { icon: "✔", color: "green" },
  in_progress: { icon: "⟳", color: "cyan" },
  failed: { icon: "✖", color: "red" },
  pending: { icon: "○", color: "gray" },
  blocked: { icon: "⊘", color: "yellow" },
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  prompt,
  agentName = "default",
  tasks = [],
  recentLog,
  lastTokenDelta,
}) => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">
          ⚡ Krypton Autonomous Desktop Agent
        </Text>
        <Text color="gray">Agent: [{agentName}]</Text>
      </Box>

      {/* User Objective */}
      <Box marginBottom={1}>
        <Text bold color="white">
          Goal:{" "}
        </Text>
        <Text italic color="yellow">
          "{prompt}"
        </Text>
      </Box>

      {/* Task DAG List */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="magenta">
          Task Execution DAG ({tasks.length} steps):
        </Text>
        {tasks.length === 0 ? (
          <Text color="gray">  Waiting for planner DAG initialization...</Text>
        ) : (
          tasks.map((task, idx) => {
            const style = statusMap[task.status] || { icon: "•", color: "white" }
            return (
              <Box key={task.id || idx} marginLeft={2}>
                <Text color={style.color as any} bold>
                  {style.icon}{" "}
                </Text>
                <Text color={task.status === "in_progress" ? "white" : "gray"}>
                  {task.title}
                </Text>
                <Text color="gray"> [{task.status}]</Text>
              </Box>
            )
          })
        )}
      </Box>

      {/* Live Stream / Token Output */}
      {lastTokenDelta && (
        <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
          <Text color="gray">Thinking: </Text>
          <Text color="white">{lastTokenDelta.slice(-120)}</Text>
        </Box>
      )}

      {/* Recent Log */}
      {recentLog && (
        <Box>
          <Text color="gray">Latest event: {recentLog}</Text>
        </Box>
      )}
    </Box>
  )
}
