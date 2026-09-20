import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as https from "node:https";
import * as http from "node:http";
import { SttModelManifest, SttDownloadProgress } from "./types.js";
import { resolveModelsDir } from "../filesystem/bootstrap.js";

/**
 * Computes the hexadecimal SHA-256 hash of a file on disk.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found for hash calculation: ${filePath}`));
    }
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

/**
 * Verifies that a model file exists and matches its expected cryptographic SHA-256 hash.
 */
export async function verifyModelIntegrity(
  filePath: string,
  expectedSha256: string
): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    const actualSha256 = await computeFileSha256(filePath);
    return actualSha256.toLowerCase() === expectedSha256.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Downloads an STT model into ~/.krypton/models with strict SHA-256 verification.
 * If the model already exists and its hash is verified, returns immediately without re-downloading.
 */
export async function downloadSttModel(
  manifest: SttModelManifest,
  targetDirectory?: string,
  onProgress?: (progress: SttDownloadProgress) => void,
  downloaderFn?: (url: string, destPath: string, onProgress?: (bytes: number, total: number) => void) => Promise<void>
): Promise<string> {
  const modelsDir = targetDirectory ? path.resolve(targetDirectory) : resolveModelsDir();
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  const finalPath = path.join(modelsDir, manifest.filename);
  const tempPath = path.join(modelsDir, `${manifest.filename}.tmp.${Date.now()}`);

  // 1. Cache hit check: If file exists and matches hash, return immediately
  if (fs.existsSync(finalPath)) {
    onProgress?.({
      bytesDownloaded: manifest.sizeBytes,
      totalBytes: manifest.sizeBytes,
      percent: 100,
      stage: "verifying",
    });

    const isValid = await verifyModelIntegrity(finalPath, manifest.sha256);
    if (isValid) {
      onProgress?.({
        bytesDownloaded: manifest.sizeBytes,
        totalBytes: manifest.sizeBytes,
        percent: 100,
        stage: "ready",
      });
      return finalPath;
    }

    // Corrupt file detected, purge before re-downloading
    try {
      fs.unlinkSync(finalPath);
    } catch {
      // ignore
    }
  }

  // 2. Download into temporary file
  onProgress?.({
    bytesDownloaded: 0,
    totalBytes: manifest.sizeBytes,
    percent: 0,
    stage: "downloading",
  });

  try {
    if (downloaderFn) {
      // Use custom downloader function if provided (e.g. in tests)
      await downloaderFn(manifest.downloadUrl, tempPath, (bytes, total) => {
        const pct = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : 50;
        onProgress?.({
          bytesDownloaded: bytes,
          totalBytes: total || manifest.sizeBytes,
          percent: pct,
          stage: "downloading",
        });
      });
    } else {
      await fetchToFile(manifest.downloadUrl, tempPath, manifest.sizeBytes, onProgress);
    }

    // 3. Verify downloaded temp file integrity
    onProgress?.({
      bytesDownloaded: manifest.sizeBytes,
      totalBytes: manifest.sizeBytes,
      percent: 100,
      stage: "verifying",
    });

    const downloadedHash = await computeFileSha256(tempPath);
    if (downloadedHash.toLowerCase() !== manifest.sha256.toLowerCase()) {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      const err = new Error(
        `SHA-256 checksum verification failed for ${manifest.filename}. Expected ${manifest.sha256}, got ${downloadedHash}`
      );
      onProgress?.({
        bytesDownloaded: 0,
        totalBytes: manifest.sizeBytes,
        percent: 0,
        stage: "failed",
        error: err.message,
      });
      throw err;
    }

    // 4. Atomically swap temp file to final location
    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    fs.renameSync(tempPath, finalPath);

    onProgress?.({
      bytesDownloaded: manifest.sizeBytes,
      totalBytes: manifest.sizeBytes,
      percent: 100,
      stage: "ready",
    });

    return finalPath;
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
    onProgress?.({
      bytesDownloaded: 0,
      totalBytes: manifest.sizeBytes,
      percent: 0,
      stage: "failed",
      error: err.message || String(err),
    });
    throw err;
  }
}

/**
 * Lists all cached model binaries in ~/.krypton/models.
 */
export async function listCachedSttModels(
  targetDirectory?: string
): Promise<Array<{ filename: string; path: string; sizeBytes: number; sha256: string }>> {
  const modelsDir = targetDirectory ? path.resolve(targetDirectory) : resolveModelsDir();
  if (!fs.existsSync(modelsDir)) {
    return [];
  }

  const entries = fs.readdirSync(modelsDir);
  const results: Array<{ filename: string; path: string; sizeBytes: number; sha256: string }> = [];

  for (const entry of entries) {
    if (entry.endsWith(".tmp") || entry.includes(".tmp.")) continue;
    const fullPath = path.join(modelsDir, entry);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isFile()) {
        const hash = await computeFileSha256(fullPath);
        results.push({
          filename: entry,
          path: fullPath,
          sizeBytes: stats.size,
          sha256: hash,
        });
      }
    } catch {
      // ignore
    }
  }

  return results;
}

/**
 * Helper to download from an HTTP/HTTPS stream to disk with redirect following.
 */
function fetchToFile(
  url: string,
  destPath: string,
  expectedSize: number,
  onProgress?: (progress: SttDownloadProgress) => void,
  redirectCount = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      return reject(new Error("Too many HTTP redirects following download URL"));
    }

    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Krypton-Synapse/1.0" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchToFile(res.headers.location, destPath, expectedSize, onProgress, redirectCount + 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download model: HTTP status ${res.statusCode}`));
      }

      const total = parseInt(res.headers["content-length"] || String(expectedSize), 10);
      let downloaded = 0;
      const fileStream = fs.createWriteStream(destPath);

      res.on("data", (chunk) => {
        downloaded += chunk.length;
        const pct = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 50;
        onProgress?.({
          bytesDownloaded: downloaded,
          totalBytes: total,
          percent: pct,
          stage: "downloading",
        });
      });

      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close(() => resolve());
      });

      fileStream.on("error", (err) => {
        fs.unlink(destPath, () => reject(err));
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Network download connection timed out"));
    });
  });
}
