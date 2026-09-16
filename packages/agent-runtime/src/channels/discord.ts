import { ClarificationRequest, ClarificationResponse } from "@krypton/shared-types"
import { ChannelSessionRouter, ChannelIncomingMessage } from "./router.js"

export interface DiscordButtonComponent {
  type: 2 // Button
  style: 1 | 2 | 3 | 4 | 5 // Primary, Secondary, Success, Danger, Link
  label: string
  custom_id: string
  disabled?: boolean
}

export interface DiscordActionRow {
  type: 1 // Action Row
  components: DiscordButtonComponent[]
}

export interface DiscordMessagePayload {
  content: string
  channel_id?: string
  thread_name?: string
  components?: DiscordActionRow[]
}

/**
 * Discord Channel Adapter supporting thread-per-task mapping,
 * ActionRow interactive buttons for HITL clarification requests, and command parsing.
 */
export class DiscordChannelAdapter {
  private router: ChannelSessionRouter
  private botToken?: string
  private activeThreads: Map<string, string> = new Map() // taskId -> threadId

  constructor(router: ChannelSessionRouter, botToken?: string) {
    this.router = router
    this.botToken = botToken
  }

  /**
   * Associates an autonomous task with a Discord thread.
   */
  public bindTaskThread(taskId: string, threadId: string): void {
    this.activeThreads.set(taskId, threadId)
  }

  public getTaskThread(taskId: string): string | undefined {
    return this.activeThreads.get(taskId)
  }

  /**
   * Handles incoming Discord message or button interaction.
   */
  public handleIncomingPayload(payload: {
    type?: number // 0 = message, 3 = message component (button)
    id: string
    channel_id: string
    author?: { id: string; username: string; bot?: boolean }
    content?: string
    data?: { custom_id: string; component_type: number }
  }): ChannelIncomingMessage | ClarificationResponse | null {
    // Check for button interaction (type 3 or presence of data.custom_id)
    if (payload.data?.custom_id) {
      const [requestId, optionId] = payload.data.custom_id.split(":")
      const response: ClarificationResponse = {
        requestId: requestId || "unknown",
        selectedOptionIds: [optionId || "default"],
        respondingChannel: "discord",
        responderId: payload.author?.id || "unknown",
        timestamp: Date.now(),
      }
      return response
    }

    if (payload.content && payload.author && !payload.author.bot) {
      const incoming: ChannelIncomingMessage = {
        id: payload.id,
        channel: "discord",
        senderId: payload.author.id,
        senderName: payload.author.username,
        threadId: payload.channel_id,
        text: payload.content,
        timestamp: Date.now(),
      }
      return incoming
    }

    return null
  }

  /**
   * Formats an outgoing message or HITL clarification request into Discord payload.
   */
  public formatOutgoingMessage(
    text: string,
    clarification?: ClarificationRequest,
    channelId?: string
  ): DiscordMessagePayload {
    const discordText = this.router.toDiscordMarkdown(text)

    const payload: DiscordMessagePayload = {
      content: discordText,
      channel_id: channelId,
    }

    if (clarification?.options && clarification.options.length > 0) {
      // Split options into ActionRows (max 5 buttons per ActionRow in Discord API)
      const rows: DiscordActionRow[] = []
      let currentRow: DiscordButtonComponent[] = []

      for (const opt of clarification.options) {
        if (currentRow.length >= 5) {
          rows.push({ type: 1, components: currentRow })
          currentRow = []
        }

        currentRow.push({
          type: 2,
          style: 1, // Primary blurple
          label: `${opt.hotkey ? `[${opt.hotkey}] ` : ""}${opt.label}`,
          custom_id: `${clarification.requestId}:${opt.id}`,
        })
      }

      if (currentRow.length > 0) {
        rows.push({ type: 1, components: currentRow })
      }

      payload.components = rows
    }

    return payload
  }
}
