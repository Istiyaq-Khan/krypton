import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

export interface KeyringProvider {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

export interface EncryptedPayload {
  version: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

const SERVICE_NAME = "krypton-agent-runtime";

/**
 * Native OS secret vault with AES-256-GCM machine-fingerprint fallback encryption.
 */
export class SecretVault {
  private readonly credentialsPath: string;
  private readonly keyring: KeyringProvider | null;
  private customKey: string | null;

  constructor(options?: {
    customRoot?: string;
    credentialsPath?: string;
    keyring?: KeyringProvider;
    customKey?: string;
  }) {
    if (options?.credentialsPath) {
      this.credentialsPath = options.credentialsPath;
    } else {
      const home = resolveKryptonHome(options?.customRoot);
      this.credentialsPath = path.join(home, "credentials.enc");
    }

    this.keyring = options?.keyring ?? null;
    this.customKey = options?.customKey ?? null;
  }

  /**
   * Generates a deterministic machine fingerprint string.
   */
  private getMachineFingerprint(): string {
    if (this.customKey) {
      return this.customKey;
    }
    const host = os.hostname();
    const user = os.userInfo().username;
    const platform = os.platform();
    const cpus = os.cpus().length;
    return `krypton:${host}:${user}:${platform}:${cpus}`;
  }

  /**
   * Derives a 32-byte cryptographic key using PBKDF2.
   */
  private deriveKey(salt: Buffer): Buffer {
    const fingerprint = this.getMachineFingerprint();
    return crypto.pbkdf2Sync(fingerprint, salt, 100_000, 32, "sha256");
  }

  /**
   * Reads and decrypts all secrets from credentials.enc.
   */
  private readEncryptedStore(): Record<string, string> {
    if (!fs.existsSync(this.credentialsPath)) {
      return {};
    }

    const content = fs.readFileSync(this.credentialsPath, "utf-8").trim();
    if (!content) {
      return {};
    }

    try {
      const payload: EncryptedPayload = JSON.parse(content);
      const salt = Buffer.from(payload.salt, "hex");
      const iv = Buffer.from(payload.iv, "hex");
      const tag = Buffer.from(payload.tag, "hex");
      const key = this.deriveKey(salt);

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(payload.ciphertext, "hex", "utf-8");
      decrypted += decipher.final("utf-8");

      return JSON.parse(decrypted);
    } catch {
      // In case of corrupt file or key mismatch, return empty
      return {};
    }
  }

  /**
   * Encrypts and writes all secrets to credentials.enc.
   */
  private writeEncryptedStore(secrets: Record<string, string>): void {
    const dir = path.dirname(this.credentialsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = this.deriveKey(salt);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const plaintext = JSON.stringify(secrets);

    let ciphertext = cipher.update(plaintext, "utf-8", "hex");
    ciphertext += cipher.final("hex");
    const tag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      version: 1,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      ciphertext,
    };

    fs.writeFileSync(this.credentialsPath, JSON.stringify(payload, null, 2), "utf-8");
  }

  /**
   * Stores a secret. Tries native OS Keyring first, falls back to AES-256-GCM.
   */
  public async storeSecret(key: string, value: string): Promise<void> {
    if (!key) {
      throw new Error("Secret key must not be empty");
    }

    if (this.keyring) {
      try {
        await this.keyring.setPassword(SERVICE_NAME, key, value);
        return;
      } catch {
        // Fall back to encrypted file
      }
    }

    const secrets = this.readEncryptedStore();
    secrets[key] = value;
    this.writeEncryptedStore(secrets);
  }

  /**
   * Retrieves a secret by key.
   */
  public async getSecret(key: string): Promise<string | null> {
    if (!key) return null;

    if (this.keyring) {
      try {
        const val = await this.keyring.getPassword(SERVICE_NAME, key);
        if (val !== null) return val;
      } catch {
        // Fall back to encrypted file
      }
    }

    const secrets = this.readEncryptedStore();
    return secrets[key] ?? null;
  }

  /**
   * Deletes a secret by key.
   */
  public async deleteSecret(key: string): Promise<boolean> {
    if (!key) return false;

    let removed = false;

    if (this.keyring) {
      try {
        removed = await this.keyring.deletePassword(SERVICE_NAME, key);
      } catch {
        // Fall through
      }
    }

    const secrets = this.readEncryptedStore();
    if (key in secrets) {
      delete secrets[key];
      this.writeEncryptedStore(secrets);
      removed = true;
    }

    return removed;
  }

  /**
   * Checks whether a secret exists.
   */
  public async hasSecret(key: string): Promise<boolean> {
    const val = await this.getSecret(key);
    return val !== null;
  }

  /**
   * Lists all stored secret keys.
   */
  public async listSecretKeys(): Promise<string[]> {
    const secrets = this.readEncryptedStore();
    return Object.keys(secrets);
  }
}
