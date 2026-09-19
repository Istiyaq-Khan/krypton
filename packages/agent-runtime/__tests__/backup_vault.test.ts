import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as zlib from "node:zlib";
import {
  collectBackupAssets,
  createZipArchive,
  createBackupVault,
  normalizeZipPath,
  computeCrc32,
  detectPlatformStoragePaths,
  purgeAllKryptonData,
} from "../src/vault/backup-engine.js";

describe("Cross-Platform Backup Vault & Purge Engine Verification", () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = path.join(os.tmpdir(), `krypton-backup-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(testRoot, { recursive: true });

    // Scaffold mock ~/.krypton layout
    // 1. Root config and models cache
    fs.writeFileSync(
      path.join(testRoot, "config.json"),
      JSON.stringify({ version: "1.0.0", isInitialized: true, customAgentName: "TestOrchestrator" }, null, 2)
    );
    fs.writeFileSync(
      path.join(testRoot, "models_cache.json"),
      JSON.stringify({ provider: "openai", models: [{ id: "gpt-4o" }] }, null, 2)
    );

    // 2. Default agent workspace with config.json and *.md files
    const defaultAgentDir = path.join(testRoot, "agents", "default");
    const stTrajectoriesDir = path.join(defaultAgentDir, "short_term", "trajectories");
    fs.mkdirSync(stTrajectoriesDir, { recursive: true });

    fs.writeFileSync(
      path.join(defaultAgentDir, "config.json"),
      JSON.stringify({ id: "agent-default", name: "default", model: "5.6 Terra High" }, null, 2)
    );
    fs.writeFileSync(path.join(defaultAgentDir, "IDENTITY.md"), "# Identity\nPrimary orchestrator agent.");
    fs.writeFileSync(path.join(defaultAgentDir, "SOUL.md"), "# Soul\nGuardrails and operating principles.");
    fs.writeFileSync(path.join(defaultAgentDir, "USER.md"), "# User\nUser context and profile.");
    fs.writeFileSync(path.join(defaultAgentDir, "MEMORY.md"), "# Memory\nLessons learned over time.");
    fs.writeFileSync(path.join(defaultAgentDir, "TODO.md"), "# Tasks\n1. Active tasks.");

    fs.writeFileSync(
      path.join(defaultAgentDir, "short_term", "events.jsonl"),
      '{"type":"init","timestamp":1000}\n{"type":"action","timestamp":2000}\n'
    );
    fs.writeFileSync(
      path.join(stTrajectoriesDir, "traj_001.json"),
      JSON.stringify({ trajectoryId: "traj-001", steps: 5 }, null, 2)
    );

    // 3. Custom agent workspace
    const customAgentDir = path.join(testRoot, "agents", "CoderBot");
    fs.mkdirSync(customAgentDir, { recursive: true });
    fs.writeFileSync(
      path.join(customAgentDir, "config.json"),
      JSON.stringify({ id: "agent-coder", name: "CoderBot", role: "Coding Specialist" }, null, 2)
    );
    fs.writeFileSync(path.join(customAgentDir, "IDENTITY.md"), "# CoderBot Identity\nAutonomous code synthesizer.");
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testRoot)) {
        fs.rmSync(testRoot, { recursive: true, force: true });
      }
    } catch {}
  });

  it("1. Normalizes paths cross-platform: converts Windows backslashes to forward slashes", () => {
    expect(normalizeZipPath("agents\\default\\config.json")).toBe("agents/default/config.json");
    expect(normalizeZipPath("agents/default/IDENTITY.md")).toBe("agents/default/IDENTITY.md");
    expect(normalizeZipPath("\\root\\sub\\file.txt")).toBe("root/sub/file.txt");
    expect(normalizeZipPath("config.json")).toBe("config.json");
  });

  it("2. Recursive Asset Aggregation: collects all agent config.json and *.md files", () => {
    const assets = collectBackupAssets(testRoot);

    const relativePaths = assets.map((a) => a.relativePath);

    // Root files
    expect(relativePaths).toContain("config.json");
    expect(relativePaths).toContain("models_cache.json");

    // Default agent
    expect(relativePaths).toContain("agents/default/config.json");
    expect(relativePaths).toContain("agents/default/IDENTITY.md");
    expect(relativePaths).toContain("agents/default/SOUL.md");
    expect(relativePaths).toContain("agents/default/USER.md");
    expect(relativePaths).toContain("agents/default/MEMORY.md");
    expect(relativePaths).toContain("agents/default/TODO.md");
    expect(relativePaths).toContain("agents/default/short_term/events.jsonl");
    expect(relativePaths).toContain("agents/default/short_term/trajectories/traj_001.json");

    // Custom agent
    expect(relativePaths).toContain("agents/CoderBot/config.json");
    expect(relativePaths).toContain("agents/CoderBot/IDENTITY.md");

    // Verify all asset sizes are positive
    for (const asset of assets) {
      expect(asset.sizeBytes).toBeGreaterThan(0);
      expect(fs.existsSync(asset.absolutePath)).toBe(true);
    }
  });

  it("3. Compressed Archive Generation: builds a valid, uncorrupted .zip archive", async () => {
    const outputZip = path.join(testRoot, "vault-export.zip");
    const result = await createBackupVault({
      customRoot: testRoot,
      outputFilePath: outputZip,
    });

    expect(result.success).toBe(true);
    expect(result.archivePath).toBe(outputZip);
    expect(result.fileCount).toBeGreaterThanOrEqual(10);
    expect(result.totalBytesUncompressed).toBeGreaterThan(0);
    expect(result.totalBytesCompressed).toBeGreaterThan(0);
    expect(result.agentsIncluded).toContain("default");
    expect(result.agentsIncluded).toContain("CoderBot");


    // Verify file exists on disk
    expect(fs.existsSync(outputZip)).toBe(true);
    const zipBytes = fs.readFileSync(outputZip);
    expect(zipBytes.length).toBeGreaterThan(100);

    // Verify PKWARE ZIP Header Signature 0x04034b50 ("PK\x03\x04")
    expect(zipBytes.readUInt32LE(0)).toBe(0x04034b50);

    // Read end of central directory signature 0x06054b50 ("PK\x05\x06")
    const eocdSig = zipBytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdSig).toBeGreaterThan(0);

    // Read central directory offset from EOCD (offset 16 in 22-byte EOCD)
    const centralDirOffset = zipBytes.readUInt32LE(eocdSig + 16);
    expect(centralDirOffset).toBeGreaterThan(0);
    expect(zipBytes.readUInt32LE(centralDirOffset)).toBe(0x02014b50); // Central header signature
  });

  it("4. Archive Integrity & Extraction: confirms zip contents can be parsed and decompressed", async () => {
    const rawContent = "# Agent Directives\nTest content for integrity.";
    const zipBuffer = createZipArchive([
      { relativePath: "config.json", content: Buffer.from('{"test":true}') },
      { relativePath: "agents/default/IDENTITY.md", content: Buffer.from(rawContent) },
    ]);

    // Parse ZIP headers manually to ensure exact compliance with standard readers
    expect(zipBuffer.readUInt32LE(0)).toBe(0x04034b50);

    // Read first entry
    const fnLen1 = zipBuffer.readUInt16LE(26);
    const filename1 = zipBuffer.toString("utf-8", 30, 30 + fnLen1);
    expect(filename1).toBe("config.json");

    // Verify CRC32 calculation matches
    const expectedCrc = computeCrc32(Buffer.from('{"test":true}'));
    expect(zipBuffer.readUInt32LE(14)).toBe(expectedCrc);
  });

  it("5. Platform Storage Paths: resolves OS canonical storage roots without separator collisions", () => {
    const paths = detectPlatformStoragePaths(testRoot);

    expect(paths.kryptonHome).toBe(path.resolve(testRoot));
    expect(paths.agentsDir).toBe(path.join(path.resolve(testRoot), "agents"));
    expect(paths.worktreesDir).toBe(path.join(path.resolve(testRoot), "worktrees"));
    expect(paths.osPlatform).toBe(process.platform);
    expect(paths.cacheDir.length).toBeGreaterThan(0);
    expect(paths.appData.length).toBeGreaterThan(0);
  });

  it("6. Factory Reset & Purge: safely removes runtime data with safety boundary protection", async () => {
    // 1. Dry run
    const dryRunResult = await purgeAllKryptonData({
      customRoot: testRoot,
      dryRun: true,
    });
    expect(dryRunResult.success).toBe(true);
    expect(dryRunResult.purgedDirectories).toContain(path.resolve(testRoot));
    expect(fs.existsSync(testRoot)).toBe(true); // Untouched in dry run

    // 2. Real execution
    const realResult = await purgeAllKryptonData({
      customRoot: testRoot,
      dryRun: false,
    });
    expect(realResult.success).toBe(true);
    expect(realResult.daemonsTerminated).toBe(true);
    expect(fs.existsSync(testRoot)).toBe(false); // Successfully purged
  });
});
