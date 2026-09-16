import { ClarificationRequest, ClarificationResponse, TaskNode } from "@krypton/shared-types"
import { ChannelSessionRouter, ChannelIncomingMessage } from "./router.js"

export interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
  elements?: Array<{
    type: string
    text?: { type: string; text: string; emoji?: boolean }
    action_id: string
    value: string
    style?: "primary" | "danger"
  }>
}

export interface SlackMessagePayload {
  channel: string
  text: string
  blocks?: SlackBlock[]
  thread_ts?: string
}

/**
 * Slack Channel Adapter supporting Block Kit rendering for task DAGs,
 * interactive button blocks for HITL options, and slash commands.
 */
export class SlackChannelAdapter {
  private router: ChannelSessionRouter
  private botToken?: string
  private signingSecret?: string

  constructor(router: ChannelSessionRouter, botToken?: string, signingSecret?: string) {
    this.router = router
    this.botToken = botToken
    this.signingSecret = signingSecret
  }

  /**
   * Handles incoming interactive block action (button click) or message event.
   */
  public handleIncomingPayload(payload: {
    type?: string // "block_actions", "message", "event_callback"
    user?: { id: string; username?: string; name?: string }
    channel?: { id: string }
    actions?: Array<{ action_id: string; value: string }>
    event?: {
      type: string
      user: string
      text: string
      ts: string
      thread_ts?: string
      channel: string
      bot_id?: string
    }
  }): ChannelIncomingMessage | ClarificationResponse | null {
    // 1. Interactive Button Click from HITL
    if (payload.actions && payload.actions.length > 0) {
      const action = payload.actions[0]
      const [requestId, optionId] = (action.value || action.action_id).split(":")
      const response: ClarificationResponse = {
        requestId: requestId || "unknown",
        selectedOptionIds: [optionId || "default"],
        respondingChannel: "slack",
        responderId: payload.user?.id || "unknown",
        timestamp: Date.now(),
      }
      return response
    }

    // 2. Incoming Chat Message
    if (payload.event && payload.event.type === "message" && !payload.event.bot_id) {
      const ev = payload.event
      const incoming: ChannelIncomingMessage = {
        id: ev.ts,
        channel: "slack",
        senderId: ev.user,
        threadId: ev.thread_ts || ev.channel,
        text: ev.text,
        timestamp: Date.now(),
      }
      return incoming
    }

    return null
  }

  /**
   * Formats an outgoing message or HITL clarification request into a Slack Block Kit payload.
   */
  public formatOutgoingMessage(
    channelId: string,
    text: string,
    clarification?: ClarificationRequest,
    threadTs?: string
  ): SlackMessagePayload {
    const slackMrkdwn = this.router.toSlackBlockKit(text)
    const blocks: SlackBlock[] = [...slackMrkdwn.blocks]

    if (clarification) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Clarification Required:*\n${clarification.prompt}`,
        },
      })

      if (clarification.options && clarification.options.length > 0) {
        const actionElements = clarification.options.map((opt) => ({
          type: "button",
          text: {
            type: "plain_text",
            text: `${opt.hotkey ? `[${opt.hotkey}] ` : ""}${opt.label}`,
            emoji: true,
          },
          action_id: `clarify_${opt.id}`,
          value: `${clarification.requestId}:${opt.id}`,
          style: "primary" as "primary" | "danger",
        }))

        blocks.push({
          type: "actions",
          elements: actionElements,
        })
      }
    }

    return {
      channel: channelId,
      text,
      blocks,
      thread_ts: threadTs,
    }
  }

  /**
   * Renders a live Task DAG checklist in Slack Block Kit format.
   */
  public renderTaskDagBlocks(dagTitle: string, tasks: TaskNode[]): SlackBlock[] {
    const blocks: SlackBlock[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `⚡ Krypton Task DAG: ${dagTitle}`,
          emoji: true,
        },
      },
    ]

    const statusIcons: Record<string, string> = {
      completed: ":white_check_mark:",
      running: ":hourglass_flowing_sand:",
      failed: ":x:",
      queued: ":white_circle:",
      blocked: ":no_entry_sign:",
    }

    const checklistText = tasks
      .map((t) => {
        const icon = statusIcons[t.status] || ":white_circle:"
        return `${icon} *${t.title}* (${t.status})`
      })
      .join("\n")

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: checklistText || "_No active tasks in DAG_",
      },
    })

    return blocks
  }
}
