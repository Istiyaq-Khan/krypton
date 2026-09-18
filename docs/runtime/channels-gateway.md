# Omni-Channel Gateway & Messaging Adapters

This document specifies the multi-platform messaging gateway, thread routing, and chat platform adapters (Telegram, Discord, WhatsApp, Slack, Signal) in **Krypton**.

---

## 1. Gateway Routing Architecture (`channels/router.ts`)

Krypton enables users to interact with their autonomous desktop agent fleet remotely from their favorite messaging apps:

```
┌─────────────────────────────────────────────────────────────┐
│                 External Messaging Channels                 │
│   Telegram  │  Discord  │  WhatsApp  │  Slack  │  Signal    │
└───────┬─────┴─────┬─────┴──────┬─────┴────┬────┴─────┬──────┘
        │           │            │          │          │
        ▼           ▼            ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│                 Omni-Channel Router                         │
│  - Maps remote thread/user IDs to agent instances           │
│  - Ingests text, images, voice notes, documents             │
│  - Normalizes payloads into universal Message schemas       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Krypton Actor Engine                     │
│  Executes tasks, generates responses, requests HITL input   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Platform Adapter Specifications

| Platform | Underlying Driver | Supported Features |
| :--- | :--- | :--- |
| **Telegram** | `grammY` | Command routing, thread-locking, inline keyboard buttons for HITL choices, voice note ingestion. |
| **Discord** | `discord.js` | Dedicated task threads per goal, rich embeds, action row button components. |
| **WhatsApp** | `Baileys` | Mobile direct messaging, session credential storage in `~/.krypton/browser_profiles/whatsapp/`, numbered HITL choice replies. |
| **Slack** | `@slack/bolt` | Interactive Block Kit modals, dynamic task DAG checklists, organization workspace routing. |
| **Signal** | `signal-cli` JSON-RPC | End-to-end encrypted autonomous agent messaging over local stdio pipe. |

---

## 3. Formatting & Markdown Normalization

Each chat platform has different markdown specifications. The gateway dynamically formats outgoing responses:
- **Telegram**: HTML mode (`<b>`, `<code>`, `<pre>`).
- **WhatsApp**: Single asterisk bold (`*bold*`), tildes for strike (`~strike~`), backtick code blocks.
- **Discord / Slack**: Native Markdown with block quote syntax and syntax-highlighted code fences.
