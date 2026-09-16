import * as path from "node:path"
import * as fs from "node:fs"
import { ClarificationRequest, ClarificationResponse } from "@krypton/shared-types"
import { ChannelSessionRouter, ChannelIncomingMessage } from "./router.js"
import { resolveKryptonHome } from "../filesystem/bootstrap.js"

export interface WhatsAppMessagePayload {
  jid: string
  text: string
  clarification?: ClarificationRequest
}

export interface WhatsAppAdapterOptions {
  sessionDir?: string
  authDir?: string
}

/**
 * WhatsApp Channel Adapter powered by @whiskeysockets/baileys.
 * Stores session tokens under ~/.krypton/browser_profiles/whatsapp/
 * Formats HITL options as numbered mobile quick-reply menus.
 */
export class WhatsAppChannelAdapter {
  private router: ChannelSessionRouter
  private sessionDir: string
  private pendingClarifications: Map<string, ClarificationRequest> = new Map()
  private sock: any = null
  private isConnected = false

  constructor(router: ChannelSessionRouter, options: WhatsAppAdapterOptions = {}) {
    this.router = router
    this.sessionDir =
      options.sessionDir ||
      options.authDir ||
      path.join(resolveKryptonHome(), "browser_profiles", "whatsapp")

    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true })
    }
  }

  public getSessionDir(): string {
    return this.sessionDir
  }

  public getPendingClarification(jid: string): ClarificationRequest | undefined {
    return this.pendingClarifications.get(jid)
  }

  /**
   * Dispatches and formats incoming WhatsApp message.
   * If there is an active HITL prompt for this JID and user enters a number or option label,
   * resolves it into a ClarificationResponse.
   */
  public handleIncomingMessage(
    senderJid: string,
    messageId: string,
    text: string,
    senderName?: string
  ): ChannelIncomingMessage | ClarificationResponse {
    const trimmed = text.trim()
    const pending = this.pendingClarifications.get(senderJid)

    if (pending && pending.options && pending.options.length > 0) {
      // Check if text is a number corresponding to an option
      const choiceIndex = parseInt(trimmed, 10) - 1
      if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < pending.options.length) {
        const chosen = pending.options[choiceIndex]
        this.pendingClarifications.delete(senderJid)
        const response: ClarificationResponse = {
          requestId: pending.requestId,
          selectedOptionIds: [chosen.id],
          respondingChannel: "whatsapp",
          responderId: senderJid,
          timestamp: Date.now(),
        }
        return response
      }

      // Check if user replied with option label or id directly
      const match = pending.options.find(
        (opt) => opt.label.toLowerCase() === trimmed.toLowerCase() || opt.id.toLowerCase() === trimmed.toLowerCase()
      )
      if (match) {
        this.pendingClarifications.delete(senderJid)
        const response: ClarificationResponse = {
          requestId: pending.requestId,
          selectedOptionIds: [match.id],
          respondingChannel: "whatsapp",
          responderId: senderJid,
          timestamp: Date.now(),
        }
        return response
      }
    }

    const incoming: ChannelIncomingMessage = {
      id: messageId,
      channel: "whatsapp",
      senderId: senderJid,
      senderName: senderName || "WhatsApp User",
      threadId: senderJid,
      text: trimmed,
      timestamp: Date.now(),
    }
    return incoming
  }

  /**
   * Formats an outgoing message or HITL clarification request into WhatsApp-friendly text.
   */
  public formatOutgoingMessage(
    jid: string,
    text: string,
    clarification?: ClarificationRequest
  ): WhatsAppMessagePayload {
    let formattedText = this.router.toWhatsAppMarkdown(text)

    if (clarification) {
      this.pendingClarifications.set(jid, clarification)

      formattedText += `\n\n*Clarification Required:*`
      if (clarification.prompt && clarification.prompt !== text) {
        formattedText += `\n${clarification.prompt}\n`
      }

      if (clarification.options && clarification.options.length > 0) {
        formattedText += `\n`
        clarification.options.forEach((opt, index) => {
          formattedText += `\n${index + 1}. *${opt.label}*${opt.description ? ` - ${opt.description}` : ""}`
        })
        formattedText += `\n\n_Reply with the number of your choice (e.g., 1)_`
      }
    }

    return {
      jid,
      text: formattedText,
      clarification,
    }
  }

  /**
   * Connects to WhatsApp Web Multi-Device via Baileys.
   */
  public async initializeSocket(
    onQRCode?: (qr: string) => void,
    onStatusChange?: (status: string) => void
  ): Promise<any> {
    try {
      const baileys = await import("@whiskeysockets/baileys")
      const makeWASocket = (baileys.default || baileys.makeWASocket || baileys) as any
      const { useMultiFileAuthState, DisconnectReason } = baileys

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir)

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
      })

      this.sock.ev.on("creds.update", saveCreds)

      this.sock.ev.on("connection.update", (update: any) => {
        const { connection, lastDisconnect, qr } = update
        if (qr && onQRCode) {
          onQRCode(qr)
        }
        if (connection === "close") {
          this.isConnected = false
          const shouldReconnect =
            (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut
          onStatusChange?.(`closed: ${shouldReconnect ? "reconnecting" : "logged_out"}`)
        } else if (connection === "open") {
          this.isConnected = true
          onStatusChange?.("open")
        }
      })

      return this.sock
    } catch (err: any) {
      // In non-interactive or offline environments, graceful fallback
      return null
    }
  }

  public async disconnect(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.end(undefined)
      } catch {
        // ignore
      }
      this.sock = null
      this.isConnected = false
    }
  }
}
