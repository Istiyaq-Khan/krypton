import { ClarificationRequest, ClarificationResponse } from "@krypton/shared-types"
import { ChannelSessionRouter, ChannelIncomingMessage } from "./router.js"

export interface SignalMessagePayload {
  recipient: string
  message: string
  clarification?: ClarificationRequest
}

export interface SignalRpcMessage {
  envelope?: {
    source?: string
    sourceNumber?: string
    sourceUuid?: string
    sourceName?: string
    timestamp?: number
    dataMessage?: {
      timestamp?: number
      message?: string
      expiresInSeconds?: number
    }
  }
}

/**
 * Signal Channel Adapter supporting signal-cli JSON-RPC format,
 * plain text formatting, and numbered mobile HITL responses.
 */
export class SignalChannelAdapter {
  private router: ChannelSessionRouter
  private cliBinaryPath: string
  private pendingClarifications: Map<string, ClarificationRequest> = new Map()

  constructor(router: ChannelSessionRouter, cliBinaryPath = "signal-cli") {
    this.router = router
    this.cliBinaryPath = cliBinaryPath
  }

  /**
   * Handles incoming signal-cli JSON-RPC envelope or direct text.
   */
  public handleIncomingPayload(
    payload: SignalRpcMessage | { sender: string; text: string; id?: string }
  ): ChannelIncomingMessage | ClarificationResponse | null {
    let sender = ""
    let text = ""
    let id = `${Date.now()}`
    let senderName = "Signal User"

    if ("envelope" in payload && payload.envelope?.dataMessage) {
      sender = payload.envelope.sourceNumber || payload.envelope.sourceUuid || payload.envelope.source || "unknown"
      senderName = payload.envelope.sourceName || sender
      text = payload.envelope.dataMessage.message || ""
      id = `${payload.envelope.timestamp || Date.now()}`
    } else if ("sender" in payload) {
      sender = payload.sender
      text = payload.text
      id = payload.id || id
    }

    const trimmed = text.trim()
    if (!trimmed || !sender) {
      return null
    }

    // Check for pending HITL clarification
    const pending = this.pendingClarifications.get(sender)
    if (pending && pending.options && pending.options.length > 0) {
      const choiceIndex = parseInt(trimmed, 10) - 1
      if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < pending.options.length) {
        const chosen = pending.options[choiceIndex]
        this.pendingClarifications.delete(sender)
        const response: ClarificationResponse = {
          requestId: pending.requestId,
          selectedOptionIds: [chosen.id],
          respondingChannel: "signal",
          responderId: sender,
          timestamp: Date.now(),
        }
        return response
      }

      const match = pending.options.find(
        (opt) => opt.label.toLowerCase() === trimmed.toLowerCase() || opt.id.toLowerCase() === trimmed.toLowerCase()
      )
      if (match) {
        this.pendingClarifications.delete(sender)
        const response: ClarificationResponse = {
          requestId: pending.requestId,
          selectedOptionIds: [match.id],
          respondingChannel: "signal",
          responderId: sender,
          timestamp: Date.now(),
        }
        return response
      }
    }

    const incoming: ChannelIncomingMessage = {
      id,
      channel: "signal",
      senderId: sender,
      senderName,
      threadId: sender,
      text: trimmed,
      timestamp: Date.now(),
    }
    return incoming
  }

  /**
   * Formats an outgoing message or HITL clarification for Signal.
   */
  public formatOutgoingMessage(
    recipient: string,
    text: string,
    clarification?: ClarificationRequest
  ): SignalMessagePayload {
    let plainText = this.router.toSignalText(text)

    if (clarification) {
      this.pendingClarifications.set(recipient, clarification)
      plainText += `\n\n[Clarification Required]\n${clarification.prompt}`

      if (clarification.options && clarification.options.length > 0) {
        plainText += "\n"
        clarification.options.forEach((opt, index) => {
          plainText += `\n[${index + 1}] ${opt.label}${opt.description ? ` (${opt.description})` : ""}`
        })
        plainText += `\n\nReply with the option number (e.g. 1)`
      }
    }

    return {
      recipient,
      message: plainText,
      clarification,
    }
  }

  /**
   * Formats a JSON-RPC send command payload for signal-cli.
   */
  public createJsonRpcSend(recipient: string, message: string): string {
    return JSON.stringify({
      jsonrpc: "2.0",
      method: "send",
      params: {
        recipient: [recipient],
        message,
      },
      id: Date.now(),
    })
  }
}
