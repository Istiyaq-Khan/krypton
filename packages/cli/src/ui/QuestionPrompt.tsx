import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { ClarificationRequest, ChoiceOption } from "@krypton/shared-types"

export interface QuestionPromptProps {
  request: ClarificationRequest
  onSubmit: (selectedOptionIds: string[], freeformText?: string) => void
}

export const QuestionPrompt: React.FC<QuestionPromptProps> = ({ request, onSubmit }) => {
  const options = request.options || []
  const defaultIndex = Math.max(
    0,
    options.findIndex((o) => o.isRecommended)
  )
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex >= 0 ? defaultIndex : 0)
  const [freeformInput, setFreeformInput] = useState("")
  const [isFreeformActive, setIsFreeformActive] = useState(false)

  useInput((input, key) => {
    if (isFreeformActive) {
      if (key.return) {
        if (freeformInput.trim()) {
          onSubmit([], freeformInput.trim())
        }
        return
      }
      if (key.backspace || key.delete) {
        setFreeformInput((prev) => prev.slice(0, -1))
        return
      }
      if (key.escape) {
        setIsFreeformActive(false)
        return
      }
      if (input) {
        setFreeformInput((prev) => prev + input)
      }
      return
    }

    // Normal Option Selection Mode
    if (key.upArrow || input === "k") {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
      return
    }

    if (key.downArrow || input === "j") {
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
      return
    }

    if (key.return) {
      if (options.length > 0) {
        const chosen = options[selectedIndex]
        onSubmit([chosen.id])
      }
      return
    }

    // Direct digit hotkeys: '1', '2', etc.
    const digit = parseInt(input, 10)
    if (!isNaN(digit) && digit >= 1 && digit <= options.length) {
      const chosen = options[digit - 1]
      onSubmit([chosen.id])
      return
    }

    // Hotkey matching (e.g. 'y', 'n')
    const match = options.find((opt) => opt.hotkey && opt.hotkey.toLowerCase() === input.toLowerCase())
    if (match) {
      onSubmit([match.id])
      return
    }

    // Toggle freeform if enabled and user presses '/' or 'i'
    if (request.allowFreeform && (input === "/" || input === "i")) {
      setIsFreeformActive(true)
    }
  })

  return (
    <Box flexDirection="column" padding={1} borderStyle="bold" borderColor="yellow">
      {/* Prompt title */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          ⚠️ Human-in-the-Loop Clarification Required
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="white" bold>
          {request.prompt}
        </Text>
      </Box>

      {/* Options list */}
      <Box flexDirection="column" marginBottom={1}>
        {options.map((opt: ChoiceOption, idx: number) => {
          const isSelected = idx === selectedIndex && !isFreeformActive
          return (
            <Box key={opt.id} marginLeft={1}>
              <Text color={isSelected ? "cyan" : "gray"}>
                {isSelected ? "❯ " : "  "}
              </Text>
              <Text bold={isSelected} color={isSelected ? "cyan" : "white"}>
                {opt.hotkey ? `[${opt.hotkey}] ` : `[${idx + 1}] `}
                {opt.label}
              </Text>
              {opt.isRecommended && (
                <Text color="green" bold>
                  {" "}★ Recommended
                </Text>
              )}
              {opt.description && (
                <Text color="gray"> — {opt.description}</Text>
              )}
            </Box>
          )
        })}
      </Box>

      {/* Freeform input box */}
      {request.allowFreeform && (
        <Box flexDirection="column" marginTop={1}>
          {isFreeformActive ? (
            <Box borderStyle="single" borderColor="green" paddingX={1}>
              <Text color="green">Custom Answer: </Text>
              <Text color="white">{freeformInput}</Text>
              <Text color="green">█</Text>
            </Box>
          ) : (
            <Text color="gray">
              Press [/] to type a custom answer
            </Text>
          )}
        </Box>
      )}

      {/* Footer controls hint */}
      <Box marginTop={1}>
        <Text color="gray" italic>
          (Use ↑/↓ or number keys to select, Enter to confirm, Esc to cancel)
        </Text>
      </Box>
    </Box>
  )
}
