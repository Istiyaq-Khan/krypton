import { ClarificationRequest, ClarificationResponse } from "@krypton/shared-types"

export type SupportedChannel = "telegram" | "discord" | "whatsapp" | "slack" | "signal"

export interface ChannelIncomingMessage {
  id: string
  channel: SupportedChannel
  senderId: string
  senderName?: string
  threadId?: string
  text: string
  media?: Array<{
    type: "image" | "voice_note" | "document"
    url?: string
    buffer?: Buffer
    mimeType?: string
  }>
  rawPayload?: unknown
  timestamp: number
}

export interface ChannelOutgoingResponse {
  channel: SupportedChannel
  recipientId: string
  threadId?: string
  text: string
  formattedContent?: unknown
  clarificationRequest?: ClarificationRequest
}

export interface RouteSession {
  channel: SupportedChannel
  threadId: string
  userId: string
  targetAgentId: string
  activeTaskId?: string
  createdAt: number
  lastActiveAt: number
}

/**
 * Universal Session Router and Format Normalizer for external chat channels.
 */
export class ChannelSessionRouter {
  private sessions: Map<string, RouteSession> = new Map()

  /**
   * Generates a composite session key for thread-locking.
   */
  private getSessionKey(channel: SupportedChannel, threadOrUserId: string): string {
    return `${channel}:${threadOrUserId}`
  }

  /**
   * Binds or updates a channel thread/user to an autonomous agent instance.
   */
  public registerSession(
    channel: SupportedChannel,
    threadId: string,
    userId: string,
    targetAgentId: string,
    activeTaskId?: string
  ): RouteSession {
    const key = this.getSessionKey(channel, threadId || userId)
    const session: RouteSession = {
      channel,
      threadId,
      userId,
      targetAgentId,
      activeTaskId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    }
    this.sessions.set(key, session)
    return session
  }

  /**
   * Resolves target agent ID for incoming channel message.
   */
  public resolveSession(channel: SupportedChannel, threadOrUserId: string): RouteSession | undefined {
    const key = this.getSessionKey(channel, threadOrUserId)
    const session = this.sessions.get(key)
    if (session) {
      session.lastActiveAt = Date.now()
    }
    return session
  }

  /**
   * Removes a thread session binding.
   */
  public removeSession(channel: SupportedChannel, threadOrUserId: string): boolean {
    const key = this.getSessionKey(channel, threadOrUserId)
    return this.sessions.delete(key)
  }

  /**
   * Lists all active channel sessions.
   */
  public listSessions(): RouteSession[] {
    return Array.from(this.sessions.values())
  }

  // --- Format Adapters / Markdown Normalizers ---

  /**
   * Normalizes standard Markdown to Telegram HTML (<b>, <i>, <code>, <pre>).
   */
  public toTelegramHtml(markdown: string): string {
    return markdown
      // Bold: **text** or __text__ -> <b>text</b>
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/__(.*?)__/g, "<b>$1</b>")
      // Italic: *text* or _text_ -> <i>$1</i>
      .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<i>$1</i>")
      .replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, "<i>$1</i>")
      // Pre code blocks: ```lang ... ``` -> <pre>...</pre>
      .replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, "<pre>$1</pre>")
      // Inline code: `text` -> <code>text</code>
      .replace(/`([^`]+)`/g, "<code>$1</code>")
  }

  /**
   * Normalizes standard Markdown to WhatsApp formatting (*bold*, _italic_, ~strike~, ```code```).
   */
  public toWhatsAppMarkdown(markdown: string): string {
    return markdown
      // Convert **bold** to *bold*
      .replace(/\*\*(.*?)\*\*/g, "*$1*")
      // Convert strikethrough ~~text~~ to ~text~
      .replace(/~~(.*?)~~/g, "~$1~")
  }

  /**
   * Normalizes standard Markdown for Discord (handles multiline blocks, spoiler tags).
   */
  public toDiscordMarkdown(markdown: string): string {
    // Discord natively supports standard markdown with double asterisks
    return markdown
  }

  /**
   * Normalizes standard Markdown to Slack Block Kit payload.
   */
  public toSlackBlockKit(markdown: string): {
    blocks: Array<{ type: string; text?: { type: string; text: string } }>
  } {
    // Convert **bold** to *bold* for mrkdwn in Slack
    const slackMrkdwn = markdown.replace(/\*\*(.*?)\*\*/g, "*$1*")

    return {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: slackMrkdwn,
          },
        },
      ],
    }
  }

  /**
   * Normalizes standard Markdown to plain text with bullet points for Signal.
   */
  public toSignalText(markdown: string): string {
    return markdown
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, "$1")
  }
}
