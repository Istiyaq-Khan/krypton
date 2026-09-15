import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SecretVault, KeyringProvider } from "../src/index.js";

describe("Phase 2 Verification Gate: Native Secret Vault & AES-256-GCM Encryption", () => {
  let tempRoot: string;
  let credentialsPath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-vault-test-"));
    credentialsPath = path.join(tempRoot, "credentials.enc");
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    } catch {
      // Ignore
    }
  });

  it("stores and retrieves secrets with AES-256-GCM fallback encryption", async () => {
    const vault = new SecretVault({ credentialsPath, customKey: "test-secret-key-12345" });

    const secretKey = "anthropic_api_key";
    const secretVal = "sk-ant-secret-1234567890-test-token";

    await vault.storeSecret(secretKey, secretVal);
    expect(await vault.hasSecret(secretKey)).toBe(true);

    const retrieved = await vault.getSecret(secretKey);
    expect(retrieved).toBe(secretVal);

    // Verify raw file is encrypted and does not contain the plaintext token
    const rawEncrypted = fs.readFileSync(credentialsPath, "utf-8");
    expect(rawEncrypted).not.toContain(secretVal);
    const parsedPayload = JSON.parse(rawEncrypted);
    expect(parsedPayload.ciphertext).toBeDefined();
    expect(parsedPayload.iv).toBeDefined();
    expect(parsedPayload.tag).toBeDefined();
    expect(parsedPayload.salt).toBeDefined();
  });

  it("deletes secrets cleanly and updates encrypted store", async () => {
    const vault = new SecretVault({ credentialsPath, customKey: "test-secret-key-12345" });

    await vault.storeSecret("key_one", "val_one");
    await vault.storeSecret("key_two", "val_two");

    expect(await vault.listSecretKeys()).toContain("key_one");
    expect(await vault.listSecretKeys()).toContain("key_two");

    const deleted = await vault.deleteSecret("key_one");
    expect(deleted).toBe(true);

    expect(await vault.getSecret("key_one")).toBeNull();
    expect(await vault.getSecret("key_two")).toBe("val_two");
  });

  it("integrates with native Keyring provider when available", async () => {
    const mockStorage = new Map<string, string>();
    const mockKeyring: KeyringProvider = {
      async setPassword(service, account, password) {
        mockStorage.set(`${service}:${account}`, password);
      },
      async getPassword(service, account) {
        return mockStorage.get(`${service}:${account}`) ?? null;
      },
      async deletePassword(service, account) {
        return mockStorage.delete(`${service}:${account}`);
      },
    };

    const vault = new SecretVault({
      credentialsPath,
      keyring: mockKeyring,
    });

    await vault.storeSecret("openai_api_key", "sk-proj-native-key");
    const retrieved = await vault.getSecret("openai_api_key");
    expect(retrieved).toBe("sk-proj-native-key");

    // Native keyring should contain the value
    expect(mockStorage.get("krypton-agent-runtime:openai_api_key")).toBe("sk-proj-native-key");
  });
});
