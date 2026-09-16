import { ClarificationRequest, ClarificationResponse } from "@krypton/shared-types"
import { ChannelSessionRouter, ChannelIncomingMessage } from "./router.js"

export interface TelegramInlineButton {
  text: string
  callback_data: string
}

export interface TelegramMessagePayload {
  chat_id: string | number
  text: string
  parse_mode?: "HTML" | "MarkdownV2"
  reply_markup?: {
    inline_keyboard: TelegramInlineButton[][]
  }
}

/**
 * Telegram Bot channel adapter supporting commands, thread-locking,
 * and inline keyboard buttons for HITL clarification prompts.
 */
export class TelegramChannelAdapter {
  private router: ChannelSessionRouter
  private botToken?: string
  private isInitialized = false

  constructor(router: ChannelSessionRouter, botToken?: string) {
    this.router = router
    this.botToken = botToken
  }

  public initialize(): void {
    this.isInitialized = true
  }

  /**
   * Dispatches and formats incoming Telegram update.
   */
  public handleIncomingUpdate(update: {
    message?: {
      message_id: number
      from: { id: number; first_name?: string; username?: string }
      chat: { id: number; type: string }
      text?: string
    }
    callback_query?: {
      id: string
      from: { id: number; first_name?: string }
      message?: { message_id: number; chat: { id: number } }
      data?: string
    }
  }): ChannelIncomingMessage | ClarificationResponse | null {
    if (update.callback_query && update.callback_query.data) {
      // Inline button callback from HITL clarification
      const [requestId, optionId] = update.callback_query.data.split(":")
      const response: ClarificationResponse = {
        requestId: requestId || "unknown",
        selectedOptionIds: [optionId || "default"],
        respondingChannel: "telegram",
        responderId: update.callback_query.from.id.toString(),
        timestamp: Date.now(),
      }
      return response
    }

    const msg = update.message
    if (msg && msg.text) {
      const incoming: ChannelIncomingMessage = {
        id: msg.message_id.toString(),
        channel: "telegram",
        senderId: msg.from.id.toString(),
        senderName: msg.from.username || msg.from.first_name || "Telegram User",
        threadId: msg.chat.id.toString(),
        text: msg.text,
        timestamp: Date.now(),
      }
      return incoming
    }

    return null
  }

  /**
   * Formats an outgoing message or HITL clarification request into Telegram API payload.
   */
  public formatOutgoingMessage(
    chatId: string | number,
    text: string,
    clarification?: ClarificationRequest
  ): TelegramMessagePayload {
    const htmlText = this.router.toTelegramHtml(text)

    const payload: TelegramMessagePayload = {
      chat_id: chatId,
      text: htmlText,
      parse_mode: "HTML",
    }

    if (clarification?.options && clarification.options.length > 0) {
      const keyboard: TelegramInlineButton[][] = clarification.options.map((opt) => [
        {
          text: `${opt.hotkey ? `[${opt.hotkey}] ` : ""}${opt.label}`,
          callback_data: `${clarification.requestId}:${opt.id}`,
        },
      ])

      payload.reply_markup = {
        inline_keyboard: keyboard,
      }
    }

    return payload
  }
}
