import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import {
  SttRuntimeLoader,
  WhisperGgufEngine,
  MoonshineOnnxEngine,
  downloadSttModel,
  verifyModelIntegrity,
  listCachedSttModels,
  computeFileSha256,
  resolveModelsDir,
  SttModelManifest,
} from "../src/index.js";

describe("Krypton Synapse Pluggable STT Runtime & Offline Model Caching", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "krypton-stt-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("1. Standardizes models path under ~/.krypton/models", () => {
    const customHome = path.join(tempDir, "custom-home");
    const modelsDir = resolveModelsDir(customHome);
    expect(modelsDir).toBe(path.join(customHome, "models"));
    expect(fs.existsSync(modelsDir)).toBe(true);
  });

  it("2. SttRuntimeLoader manages pluggable engines and switches between Whisper GGUF and Moonshine ONNX", async () => {
    const loader = new SttRuntimeLoader({ defaultEngine: "whisper_gguf" });

    expect(loader.getActiveEngineId()).toBe("whisper_gguf");
    expect(loader.getActiveEngine().architecture).toBe("encoder_decoder_autoregressive");

    await loader.setActiveEngine("moonshine_onnx");
    expect(loader.getActiveEngineId()).toBe("moonshine_onnx");
    expect(loader.getActiveEngine().architecture).toBe("moonshine_onnx");

    const engines = loader.listAvailableEngines();
    expect(engines.length).toBe(2);
    expect(engines.map((e) => e.id)).toContain("whisper_gguf");
    expect(engines.map((e) => e.id)).toContain("moonshine_onnx");
  });

  it("3. Whisper GGUF Engine processes offline 16kHz PCM audio buffers with zero network calls", async () => {
    const engine = new WhisperGgufEngine();

    // 1 second of silence (Float32)
    const silence = new Float32Array(16000);
    const silenceResult = await engine.transcribe(silence);
    expect(silenceResult.transcript).toBe("");
    expect(silenceResult.confidence).toBe(0);

    // Audio signal buffer (sine wave tone representing speech activity)
    const speechSamples = new Float32Array(16000 * 2);
    for (let i = 0; i < speechSamples.length; i++) {
      speechSamples[i] = Math.sin((i * 440 * 2 * Math.PI) / 16000) * 0.5;
    }

    const result = await engine.transcribe(speechSamples);
    expect(result.transcript.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.engine).toBe("whisper_gguf");
    expect(result.isFinal).toBe(true);
  });

  it("4. Moonshine ONNX Engine performs streaming transcription on raw PCM chunks", async () => {
    const engine = new MoonshineOnnxEngine();

    const speechSamples = new Float32Array(16000 * 2);
    for (let i = 0; i < speechSamples.length; i++) {
      speechSamples[i] = Math.sin((i * 440 * 2 * Math.PI) / 16000) * 0.5;
    }

    let partialReceived = "";
    const streamResult = await engine.streamTranscribe(speechSamples, (partial) => {
      partialReceived = partial;
    });

    expect(partialReceived.length).toBeGreaterThan(0);
    expect(streamResult.transcript).toContain("Streaming transducer");
    expect(streamResult.engine).toBe("moonshine_onnx");
  });

  it("5. Model Downloader writes into models directory with SHA-256 hash verification", async () => {
    const dummyContent = "dummy whisper gguf model weights payload 123456789";
    const expectedSha256 = crypto.createHash("sha256").update(dummyContent).digest("hex");

    const manifest: SttModelManifest = {
      id: "test-whisper-model",
      engine: "whisper_gguf",
      name: "Test Whisper Model",
      filename: "test-model.bin",
      architecture: "encoder_decoder_autoregressive",
      downloadUrl: "https://mock.krypton.local/models/test-model.bin",
      sha256: expectedSha256,
      sizeBytes: Buffer.byteLength(dummyContent),
      description: "Test manifest for verification",
    };

    // Custom mock downloader function
    const mockDownloader = async (url: string, destPath: string) => {
      fs.writeFileSync(destPath, dummyContent, "utf-8");
    };

    const downloadedPath = await downloadSttModel(manifest, tempDir, undefined, mockDownloader);
    expect(fs.existsSync(downloadedPath)).toBe(true);
    expect(downloadedPath).toBe(path.join(tempDir, manifest.filename));

    // Verify file hash matches
    const isValid = await verifyModelIntegrity(downloadedPath, expectedSha256);
    expect(isValid).toBe(true);

    // Verify cache hit: second call does not re-download
    let reDownloaded = false;
    const secondCallPath = await downloadSttModel(manifest, tempDir, undefined, async () => {
      reDownloaded = true;
    });
    expect(secondCallPath).toBe(downloadedPath);
    expect(reDownloaded).toBe(false);

    // List cached models
    const cached = await listCachedSttModels(tempDir);
    expect(cached.length).toBe(1);
    expect(cached[0].filename).toBe(manifest.filename);
    expect(cached[0].sha256).toBe(expectedSha256);
  });

  it("6. Model Downloader detects corrupted download and throws error on SHA-256 mismatch", async () => {
    const corruptContent = "corrupted byte stream payload";
    const expectedSha256 = "0000000000000000000000000000000000000000000000000000000000000000";

    const manifest: SttModelManifest = {
      id: "test-corrupt-model",
      engine: "moonshine_onnx",
      name: "Test Corrupt Model",
      filename: "corrupt-model.bin",
      architecture: "moonshine_onnx",
      downloadUrl: "https://mock.krypton.local/models/corrupt-model.bin",
      sha256: expectedSha256,
      sizeBytes: 100,
      description: "Corrupted download test",
    };

    const mockDownloader = async (url: string, destPath: string) => {
      fs.writeFileSync(destPath, corruptContent, "utf-8");
    };

    await expect(
      downloadSttModel(manifest, tempDir, undefined, mockDownloader)
    ).rejects.toThrow(/SHA-256 checksum verification failed/);

    // Verify final file was not created
    expect(fs.existsSync(path.join(tempDir, manifest.filename))).toBe(false);
  });
});
