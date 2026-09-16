import { describe, it, expect, beforeEach } from "vitest"
import * as path from "node:path"
import * as fs from "node:fs"
import {
  ChannelSessionRouter,
  TelegramChannelAdapter,
  DiscordChannelAdapter,
  WhatsAppChannelAdapter,
  SlackChannelAdapter,
  SignalChannelAdapter,
  ensureBrowserBinaries,
  BrowserDownloadProgress,
} from "../src/index.js"
import { ClarificationRequest } from "@krypton/shared-types"

describe("Phase 6: Omni-Channel Gateway & Native Distribution", () => {
  let router: ChannelSessionRouter

  beforeEach(() => {
    router = new ChannelSessionRouter()
  })

  describe("ChannelSessionRouter & Markdown Normalizers", () => {
    it("registers, resolves, and manages channel sessions with thread-locking", () => {
      const session = router.registerSession(
        "telegram",
        "chat_12345",
        "user_999",
        "agent_prime",
        "task_abc"
      )

      expect(session.channel).toBe("telegram")
      expect(session.threadId).toBe("chat_12345")
      expect(session.targetAgentId).toBe("agent_prime")

      const resolved = router.resolveSession("telegram", "chat_12345")
      expect(resolved?.targetAgentId).toBe("agent_prime")
      expect(resolved?.activeTaskId).toBe("task_abc")

      expect(router.listSessions().length).toBe(1)
      expect(router.removeSession("telegram", "chat_12345")).toBe(true)
      expect(router.resolveSession("telegram", "chat_12345")).toBeUndefined()
    })

    it("normalizes markdown to Telegram HTML", () => {
      const md = "Run **npm test** and check `result`. ```bash\nexit 0\n```"
      const html = router.toTelegramHtml(md)
      expect(html).toContain("<b>npm test</b>")
      expect(html).toContain("<code>result</code>")
      expect(html).toContain("<pre>exit 0\n</pre>")
    })

    it("normalizes markdown to WhatsApp formatting", () => {
      const md = "Status is **complete** and ~~pending~~"
      const wa = router.toWhatsAppMarkdown(md)
      expect(wa).toContain("*complete*")
      expect(wa).toContain("~pending~")
    })

    it("normalizes markdown to Slack Block Kit", () => {
      const md = "Task **deploy** finished"
      const blockKit = router.toSlackBlockKit(md)
      expect(blockKit.blocks[0].type).toBe("section")
      expect(blockKit.blocks[0].text?.text).toContain("*deploy*")
    })

    it("normalizes markdown to Signal plain text", () => {
      const md = "Check **status** with `code`"
      const plain = router.toSignalText(md)
      expect(plain).toBe("Check status with code")
    })
  })

  describe("TelegramChannelAdapter", () => {
    it("formats outgoing message with inline keyboard buttons for HITL", () => {
      const adapter = new TelegramChannelAdapter(router)
      const clarification: ClarificationRequest = {
        requestId: "req-123",
        agentId: "agent-1",
        prompt: "Merge to main branch?",
        options: [
          { id: "opt_yes", label: "Yes, merge", hotkey: "y", isRecommended: true },
          { id: "opt_no", label: "No, abort", hotkey: "n", isRecommended: false },
        ],
        allowFreeform: true,
        timeoutMs: 60000,
        status: "pending",
        createdAt: Date.now(),
      }

      const payload = adapter.formatOutgoingMessage(12345, "Action required", clarification)
      expect(payload.chat_id).toBe(12345)
      expect(payload.parse_mode).toBe("HTML")
      expect(payload.reply_markup?.inline_keyboard.length).toBe(2)
      expect(payload.reply_markup?.inline_keyboard[0][0].callback_data).toBe("req-123:opt_yes")
      expect(payload.reply_markup?.inline_keyboard[0][0].text).toContain("[y] Yes, merge")
    })

    it("resolves callback queries into ClarificationResponse", () => {
      const adapter = new TelegramChannelAdapter(router)
      const response = adapter.handleIncomingUpdate({
        callback_query: {
          id: "cb_1",
          from: { id: 777, username: "dev" },
          data: "req-123:opt_yes",
        },
      })

      expect(response).toBeDefined()
      if (response && "respondingChannel" in response) {
        expect(response.respondingChannel).toBe("telegram")
        expect(response.requestId).toBe("req-123")
        expect(response.selectedOptionIds).toEqual(["opt_yes"])
      }
    })
  })

  describe("DiscordChannelAdapter", () => {
    it("formats outgoing payload with ActionRow buttons", () => {
      const adapter = new DiscordChannelAdapter(router)
      const clarification: ClarificationRequest = {
        requestId: "req-456",
        agentId: "agent-1",
        prompt: "Delete database?",
        options: [
          { id: "opt_abort", label: "Abort", hotkey: "a", isRecommended: true },
          { id: "opt_proceed", label: "Proceed", hotkey: "p", isRecommended: false },
        ],
        allowFreeform: false,
        timeoutMs: 60000,
        status: "pending",
        createdAt: Date.now(),
      }

      const payload = adapter.formatOutgoingMessage("Please confirm", clarification, "chan_1")
      expect(payload.channel_id).toBe("chan_1")
      expect(payload.components?.length).toBe(1)
      expect(payload.components?.[0].components.length).toBe(2)
      expect(payload.components?.[0].components[0].custom_id).toBe("req-456:opt_abort")
    })

    it("handles button interaction component payload", () => {
      const adapter = new DiscordChannelAdapter(router)
      const res = adapter.handleIncomingPayload({
        type: 3,
        id: "int_1",
        channel_id: "chan_1",
        author: { id: "user_discord_1", username: "discord_dev" },
        data: { custom_id: "req-456:opt_abort", component_type: 2 },
      })

      expect(res).toBeDefined()
      if (res && "respondingChannel" in res) {
        expect(res.respondingChannel).toBe("discord")
        expect(res.requestId).toBe("req-456")
        expect(res.selectedOptionIds).toEqual(["opt_abort"])
      }
    })
  })

  describe("WhatsAppChannelAdapter", () => {
    it("formats numbered mobile menus and resolves numeric replies", () => {
      const testDir = path.join(process.cwd(), "scratch", "test-whatsapp-auth")
      const adapter = new WhatsAppChannelAdapter(router, { sessionDir: testDir })

      const clarification: ClarificationRequest = {
        requestId: "req-789",
        agentId: "agent-1",
        prompt: "Select deployment target",
        options: [
          { id: "opt_staging", label: "Staging", isRecommended: true },
          { id: "opt_prod", label: "Production", isRecommended: false },
        ],
        allowFreeform: true,
        timeoutMs: 60000,
        status: "pending",
        createdAt: Date.now(),
      }

      const out = adapter.formatOutgoingMessage("1234567890@s.whatsapp.net", "Deploy question", clarification)
      expect(out.text).toContain("1. *Staging*")
      expect(out.text).toContain("2. *Production*")
      expect(out.text).toContain("Reply with the number of your choice")

      // Simulate user texting back "1"
      const res = adapter.handleIncomingMessage("1234567890@s.whatsapp.net", "msg_1", "1")
      expect(res).toBeDefined()
      if ("respondingChannel" in res) {
        expect(res.respondingChannel).toBe("whatsapp")
        expect(res.requestId).toBe("req-789")
        expect(res.selectedOptionIds).toEqual(["opt_staging"])
      }

      // After resolution, pending clarification is cleared
      expect(adapter.getPendingClarification("1234567890@s.whatsapp.net")).toBeUndefined()

      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    })
  })

  describe("SlackChannelAdapter", () => {
    it("renders Task DAG checklists and formats Block Kit buttons", () => {
      const adapter = new SlackChannelAdapter(router)
      const blocks = adapter.renderTaskDagBlocks("Build Pipeline", [
        { id: "t1", title: "Compile code", status: "completed", dependencies: [] } as any,
        { id: "t2", title: "Run tests", status: "running", dependencies: ["t1"] } as any,
      ])

      expect(blocks.length).toBe(2)
      expect(blocks[0].text?.text).toContain("Krypton Task DAG: Build Pipeline")
      expect(blocks[1].text?.text).toContain(":white_check_mark: *Compile code*")
      expect(blocks[1].text?.text).toContain(":hourglass_flowing_sand: *Run tests*")
    })

    it("resolves Block Kit interactive button actions", () => {
      const adapter = new SlackChannelAdapter(router)
      const res = adapter.handleIncomingPayload({
        type: "block_actions",
        user: { id: "slack_u1", username: "alice" },
        actions: [{ action_id: "clarify_opt_deploy", value: "req-999:opt_deploy" }],
      })

      expect(res).toBeDefined()
      if (res && "respondingChannel" in res) {
        expect(res.respondingChannel).toBe("slack")
        expect(res.requestId).toBe("req-999")
        expect(res.selectedOptionIds).toEqual(["opt_deploy"])
      }
    })
  })

  describe("SignalChannelAdapter", () => {
    it("formats plain text numbered menus and resolves replies", () => {
      const adapter = new SignalChannelAdapter(router)
      const clarification: ClarificationRequest = {
        requestId: "req-111",
        agentId: "agent-1",
        prompt: "Reboot daemon?",
        options: [
          { id: "opt_reboot", label: "Reboot Now", isRecommended: true },
          { id: "opt_cancel", label: "Cancel", isRecommended: false },
        ],
        allowFreeform: false,
        timeoutMs: 60000,
        status: "pending",
        createdAt: Date.now(),
      }

      const out = adapter.formatOutgoingMessage("+1234567890", "System Notice", clarification)
      expect(out.message).toContain("[1] Reboot Now")
      expect(out.message).toContain("[2] Cancel")

      const res = adapter.handleIncomingPayload({
        sender: "+1234567890",
        text: "2",
      })

      expect(res).toBeDefined()
      if (res && "respondingChannel" in res) {
        expect(res.respondingChannel).toBe("signal")
        expect(res.requestId).toBe("req-111")
        expect(res.selectedOptionIds).toEqual(["opt_cancel"])
      }
    })
  })

  describe("First-Boot Browser Binary Downloader", () => {
    it("provisions browser binaries and reports progress", async () => {
      const scratchDir = path.join(process.cwd(), "scratch", "test-krypton-home")
      if (fs.existsSync(scratchDir)) {
        fs.rmSync(scratchDir, { recursive: true, force: true })
      }

      const progressLog: BrowserDownloadProgress[] = []
      const binPath = await ensureBrowserBinaries((progress) => {
        progressLog.push({ ...progress })
      }, scratchDir)

      expect(binPath).toBeDefined()
      expect(fs.existsSync(binPath)).toBe(true)
      expect(progressLog.length).toBeGreaterThan(0)
      expect(progressLog[progressLog.length - 1].percent).toBe(100)
      expect(progressLog[progressLog.length - 1].stage).toBe("ready")

      // Subsequent call should immediately return ready
      const secondLog: BrowserDownloadProgress[] = []
      await ensureBrowserBinaries((progress) => {
        secondLog.push({ ...progress })
      }, scratchDir)
      expect(secondLog[0].stage).toBe("ready")

      fs.rmSync(scratchDir, { recursive: true, force: true })
    })
  })
})
