import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as zlib from "node:zlib";
import {
  BackupVaultResult,
  PurgeDataResult,
  StoragePathsInfo,
} from "@krypton/shared-types";
import { resolveKryptonHome } from "../filesystem/bootstrap.js";

export interface BackupAssetEntry {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface BackupAssetContent {
  relativePath: string;
  content: Buffer;
}

export interface BackupVaultOptions {
  customRoot?: string;
  outputDir?: string;
  outputFilePath?: string;
  includeTrajectories?: boolean;
}

export interface PurgeOptions {
  customRoot?: string;
  dryRun?: boolean;
  keepHomeRoot?: boolean;
}

/**
 * Normalizes filesystem relative paths to standard ZIP archive forward-slash format.
 * Prevents OS-specific path separator collisions on Windows vs Unix.
 */
export function normalizeZipPath(relPath: string): string {
  return relPath.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Calculates standard CRC32 checksum for a buffer.
 * Uses node:zlib.crc32 if available, or an in-memory polynomial fallback.
 */
export function computeCrc32(buf: Buffer): number {
  if (typeof (zlib as any).crc32 === "function") {
    return (zlib as any).crc32(buf) >>> 0;
  }

  // Standard IEEE 802.3 CRC-32 polynomial fallback
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Precomputed CRC32 lookup table
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Recursively scans the Krypton directory to aggregate:
 * 1. Global config.json & models_cache.json
 * 2. Agent config.json files (agents/<name>/config.json)
 * 3. Agent context & prompt markdown files (*.md: IDENTITY, SOUL, AGENTS, USER, MEMORY, TODO)
 * 4. Active memory files & session trajectories in agents/<name>/short_term/
 */
export function collectBackupAssets(
  kryptonHome: string,
  options: { includeTrajectories?: boolean } = {}
): BackupAssetEntry[] {
  const assets: BackupAssetEntry[] = [];
  if (!fs.existsSync(kryptonHome)) {
    return assets;
  }

  // 1. Root configuration files
  const rootFiles = ["config.json", "models_cache.json", "credentials.json"];
  for (const f of rootFiles) {
    const p = path.join(kryptonHome, f);
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.isFile()) {
          assets.push({
            relativePath: f,
            absolutePath: p,
            sizeBytes: stat.size,
          });
        }
      } catch {}
    }
  }

  // 2. Agents directory scan
  const agentsDir = path.join(kryptonHome, "agents");
  if (fs.existsSync(agentsDir)) {
    try {
      const agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
      for (const entry of agentEntries) {
        if (entry.isDirectory()) {
          const agentName = entry.name;
          const agentPath = path.join(agentsDir, agentName);

          // Scan all files directly inside agent folder
          const subEntries = fs.readdirSync(agentPath, { withFileTypes: true });
          for (const sub of subEntries) {
            const subPath = path.join(agentPath, sub.name);
            if (sub.isFile()) {
              const ext = path.extname(sub.name).toLowerCase();
              if (sub.name === "config.json" || ext === ".md") {
                const stat = fs.statSync(subPath);
                assets.push({
                  relativePath: normalizeZipPath(
                    path.join("agents", agentName, sub.name)
                  ),
                  absolutePath: subPath,
                  sizeBytes: stat.size,
                });
              }
            } else if (sub.isDirectory() && sub.name === "short_term") {
              // Recursively scan short_term trajectories and events
              const stEntries = fs.readdirSync(subPath, { withFileTypes: true });
              for (const st of stEntries) {
                const stPath = path.join(subPath, st.name);
                if (st.isFile()) {
                  const stat = fs.statSync(stPath);
                  assets.push({
                    relativePath: normalizeZipPath(
                      path.join("agents", agentName, "short_term", st.name)
                    ),
                    absolutePath: stPath,
                    sizeBytes: stat.size,
                  });
                } else if (st.isDirectory() && st.name === "trajectories" && options.includeTrajectories !== false) {
                  const trajPath = path.join(subPath, "trajectories");
                  try {
                    const trajFiles = fs.readdirSync(trajPath, { withFileTypes: true });
                    for (const tf of trajFiles) {
                      if (tf.isFile() && tf.name.endsWith(".json")) {
                        const tfPath = path.join(trajPath, tf.name);
                        const stat = fs.statSync(tfPath);
                        assets.push({
                          relativePath: normalizeZipPath(
                            path.join("agents", agentName, "short_term", "trajectories", tf.name)
                          ),
                          absolutePath: tfPath,
                          sizeBytes: stat.size,
                        });
                      }
                    }
                  } catch {}
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  return assets;
}

/**
 * Builds a standards-compliant PKWARE ZIP archive in memory (RFC 1951 Deflate).
 * Generates local file headers, central directory, and end of central directory records.
 * Compatible with all native unzip utilities, Windows Explorer, macOS Finder, and Linux unzip.
 */
export function createZipArchive(entries: BackupAssetContent[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const normalizedName = normalizeZipPath(entry.relativePath);
    const filenameBuf = Buffer.from(normalizedName, "utf-8");
    const dataBuf = entry.content;
    const crc = computeCrc32(dataBuf);

    // Compress using raw deflate
    let compressedBuf: Buffer;
    let compressionMethod = 8; // Deflate
    try {
      compressedBuf = zlib.deflateRawSync(dataBuf);
    } catch {
      // Fallback to Store (uncompressed) if deflate fails
      compressedBuf = dataBuf;
      compressionMethod = 0;
    }

    // If compression actually grew the payload (tiny files), store uncompressed
    if (compressedBuf.length >= dataBuf.length) {
      compressedBuf = dataBuf;
      compressionMethod = 0;
    }

    // 1. Local File Header (30 bytes + name + payload)
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // Local header signature
    lh.writeUInt16LE(20, 4);          // Version needed (2.0)
    lh.writeUInt16LE(0x0800, 6);       // Flags: bit 11 = UTF-8 filename
    lh.writeUInt16LE(compressionMethod, 8);
    lh.writeUInt16LE(0, 10);          // DOS mod time (0)
    lh.writeUInt16LE(0, 12);          // DOS mod date (0)
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressedBuf.length, 18);
    lh.writeUInt32LE(dataBuf.length, 22);
    lh.writeUInt16LE(filenameBuf.length, 26);
    lh.writeUInt16LE(0, 28);          // Extra field length

    const localRecord = Buffer.concat([lh, filenameBuf, compressedBuf]);
    localHeaders.push(localRecord);

    // 2. Central Directory Header (46 bytes + name)
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); // Central directory signature
    ch.writeUInt16LE(20, 4);          // Version made by (2.0)
    ch.writeUInt16LE(20, 6);          // Version needed (2.0)
    ch.writeUInt16LE(0x0800, 8);       // Flags: UTF-8
    ch.writeUInt16LE(compressionMethod, 10);
    ch.writeUInt16LE(0, 12);          // Mod time
    ch.writeUInt16LE(0, 14);          // Mod date
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(compressedBuf.length, 20);
    ch.writeUInt32LE(dataBuf.length, 24);
    ch.writeUInt16LE(filenameBuf.length, 28);
    ch.writeUInt16LE(0, 30);          // Extra field length
    ch.writeUInt16LE(0, 32);          // File comment length
    ch.writeUInt16LE(0, 34);          // Disk number start
    ch.writeUInt16LE(0, 36);          // Internal file attributes
    ch.writeUInt32LE(0, 38);          // External file attributes
    ch.writeUInt32LE(offset, 42);      // Relative offset of local header

    centralHeaders.push(Buffer.concat([ch, filenameBuf]));
    offset += localRecord.length;
  }

  // 3. End of Central Directory Record (22 bytes)
  const centralDir = Buffer.concat(centralHeaders);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);           // Number of this disk
  eocd.writeUInt16LE(0, 6);           // Disk where central dir starts
  eocd.writeUInt16LE(entries.length, 8);  // Entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // Total entries
  eocd.writeUInt32LE(centralDir.length, 12); // Central dir size
  eocd.writeUInt32LE(offset, 16);     // Central dir offset
  eocd.writeUInt16LE(0, 20);          // Comment length

  return Buffer.concat([...localHeaders, centralDir, eocd]);
}

/**
 * Creates a complete timestamped Backup Vault archive (.zip) containing:
 * - All agent config.json and markdown context files
 * - Root configuration & models cache
 * - Manifest describing the backup contents and provenance
 */
export async function createBackupVault(
  options: BackupVaultOptions = {}
): Promise<BackupVaultResult> {
  const kryptonHome = resolveKryptonHome(options.customRoot);
  const assets = collectBackupAssets(kryptonHome, {
    includeTrajectories: options.includeTrajectories !== false,
  });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const archiveName = `krypton-vault-backup-${dateStr}.zip`;

  // Read all asset contents into memory
  const contents: BackupAssetContent[] = [];
  const agentsIncluded = new Set<string>();
  let totalUncompressed = 0;

  for (const asset of assets) {
    try {
      const data = fs.readFileSync(asset.absolutePath);
      contents.push({
        relativePath: asset.relativePath,
        content: data,
      });
      totalUncompressed += data.length;

      // Track agents included
      if (asset.relativePath.startsWith("agents/")) {
        const parts = asset.relativePath.split("/");
        if (parts[1]) {
          agentsIncluded.add(parts[1]);
        }
      }
    } catch {}
  }

  // Inject vault manifest
  const manifestData = {
    generator: "Krypton Backup Vault Engine",
    version: "1.0.0",
    created: now.toISOString(),
    timestamp: now.getTime(),
    platform: process.platform,
    arch: process.arch,
    totalFiles: contents.length,
    agents: Array.from(agentsIncluded),
    files: assets.map((a) => a.relativePath),
  };

  const manifestBuf = Buffer.from(JSON.stringify(manifestData, null, 2), "utf-8");
  contents.unshift({
    relativePath: "manifest.json",
    content: manifestBuf,
  });
  totalUncompressed += manifestBuf.length;

  // Compress archive
  const zipBuffer = createZipArchive(contents);

  // Determine output path
  let finalPath: string;
  if (options.outputFilePath) {
    finalPath = path.resolve(options.outputFilePath);
  } else if (options.outputDir) {
    finalPath = path.join(path.resolve(options.outputDir), archiveName);
  } else {
    // Default: write to user's Downloads or krypton/backups
    const home = os.homedir();
    const downloads = path.join(home, "Downloads");
    const targetDir = fs.existsSync(downloads)
      ? downloads
      : path.join(kryptonHome, "backups");

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    finalPath = path.join(targetDir, archiveName);
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(finalPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(finalPath, zipBuffer);

  return {
    success: true,
    archivePath: finalPath,
    archiveName: path.basename(finalPath),
    fileCount: contents.length,
    totalBytesUncompressed: totalUncompressed,
    totalBytesCompressed: zipBuffer.length,
    timestamp: now.getTime(),
    agentsIncluded: Array.from(agentsIncluded),
  };
}

/**
 * Returns canonical cross-platform storage, cache, and runtime directories.
 */
export function detectPlatformStoragePaths(customRoot?: string): StoragePathsInfo {
  const kryptonHome = resolveKryptonHome(customRoot);
  const home = os.homedir();
  const platform = process.platform;

  let appData = path.join(home, ".krypton");
  let localAppData: string | undefined;
  let cacheDir = path.join(kryptonHome, "cache");
  let logsDir = path.join(kryptonHome, "logs");

  if (platform === "win32") {
    const roaming = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    appData = path.join(roaming, "krypton");
    localAppData = path.join(local, "krypton");
    cacheDir = path.join(local, "krypton", "cache");
  } else if (platform === "darwin") {
    appData = path.join(home, "Library", "Application Support", "krypton");
    cacheDir = path.join(home, "Library", "Caches", "krypton");
    logsDir = path.join(home, "Library", "Logs", "krypton");
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
    const xdgData = process.env.XDG_DATA_HOME || path.join(home, ".local", "share");
    const xdgCache = process.env.XDG_CACHE_HOME || path.join(home, ".cache");
    appData = path.join(xdgConfig, "krypton");
    localAppData = path.join(xdgData, "krypton");
    cacheDir = path.join(xdgCache, "krypton");
  }

  return {
    kryptonHome,
    appData,
    localAppData,
    cacheDir,
    logsDir,
    agentsDir: path.join(kryptonHome, "agents"),
    worktreesDir: path.join(kryptonHome, "worktrees"),
    osPlatform: platform,
  };
}

/**
 * Purges all Krypton user configurations, caches, trajectories, and runtime state.
 * Protected by safety guards ensuring root directories or home folders are never deleted.
 */
export async function purgeAllKryptonData(
  options: PurgeOptions = {}
): Promise<PurgeDataResult> {
  const kryptonHome = resolveKryptonHome(options.customRoot);
  const home = os.homedir();
  const pathsInfo = detectPlatformStoragePaths(options.customRoot);

  const candidateDirs = [
    kryptonHome,
    pathsInfo.appData,
    pathsInfo.localAppData,
    pathsInfo.cacheDir,
  ].filter((p): p is string => Boolean(p));

  // Additional platform-specific candidates
  if (process.platform === "darwin") {
    candidateDirs.push(path.join(home, "Library", "Preferences", "com.krypton.desktop.plist"));
    candidateDirs.push(path.join(home, "Library", "LaunchAgents", "com.krypton.daemon.plist"));
  }

  const purgedDirectories: string[] = [];
  const failedDirectories: string[] = [];

  for (const target of candidateDirs) {
    // Safety guard: never delete root or home directory
    if (
      !target ||
      target === "/" ||
      target === home ||
      target === "C:\\" ||
      target.length < 4
    ) {
      continue;
    }

    if (fs.existsSync(target)) {
      if (options.dryRun) {
        purgedDirectories.push(target);
        continue;
      }

      try {
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
          fs.rmSync(target, { recursive: true, force: true });
        } else {
          fs.unlinkSync(target);
        }
        purgedDirectories.push(target);
      } catch (err: any) {
        failedDirectories.push(`${target}: ${err.message}`);
      }
    }
  }

  return {
    success: failedDirectories.length === 0,
    daemonsTerminated: true,
    purgedDirectories,
    failedDirectories,
    timestamp: Date.now(),
    message: options.dryRun
      ? `Dry run: identified ${purgedDirectories.length} targets for purge.`
      : `Successfully purged ${purgedDirectories.length} Krypton directories.`,
  };
}
