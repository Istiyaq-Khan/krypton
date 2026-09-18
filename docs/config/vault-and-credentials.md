# Secret Vault & Keyring Encryption

This document describes the native OS credential keyring integration, fallback AES-256-GCM encryption, and secret management in **Krypton**.

---

## 1. Zero Plaintext Credential Policy

Krypton strictly enforces a **Zero Plaintext Credential Policy**:
- API keys, session tokens, and passwords must never be stored in plain text or serialized into git-tracked files.
- All secrets route through the OS Vault bridge (`packages/agent-runtime/src/providers/vault.ts`).

---

## 2. Keyring Architecture & Derivative Encryption

The vault uses a two-tier storage strategy:

```
                  ┌───────────────────────────────┐
                  │      Secret Request Made      │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  Is Native Keyring Available?
                  (Windows Credential Manager /
                   macOS Keychain / Secret Service)
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                YES                              NO
                 │                               │
                 ▼                               ▼
    ┌─────────────────────────┐     ┌─────────────────────────┐
    │ Store in Native Keyring │     │ Fallback: AES-256-GCM   │
    │ Service                 │     │ Encrypted File Storage  │
    └─────────────────────────┘     └────────────┬────────────┘
                                                 │
                                                 ▼
                                    Derive Key from Machine ID
                                    + CPU Serial + Salt (PBKDF2)
                                                 │
                                                 ▼
                                    Write to ~/.krypton/
                                    credentials.enc
```

---

## 3. Vault API Interface

The vault exposes a simple, typed asynchronous API:

```typescript
export class SecretVault {
  // Store an encrypted secret
  async storeSecret(key: string, value: string): Promise<void>;

  // Retrieve and decrypt a secret
  async getSecret(key: string): Promise<string | null>;

  // Delete a secret
  async deleteSecret(key: string): Promise<void>;

  // Check if a secret exists
  async hasSecret(key: string): Promise<boolean>;
}
```

### Standard Secret Keys:
- `anthropic:api_key` / `anthropic_api_key`
- `openai:api_key` / `openai_api_key`
- `openrouter:api_key` / `openrouter_api_key`
- `ollama:base_url` / `ollama_base_url`
- `custom:endpoint` / `custom_endpoint`
- `groq:api_key`
- `telegram:bot_token`
- `discord:bot_token`
- `slack:bot_token`
