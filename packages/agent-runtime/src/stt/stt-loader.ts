import { ISttEngine, SttEngineId, SttTranscriptionResult, SttModelManifest, SttDownloadProgress } from "./types.js";
import { WhisperGgufEngine } from "./whisper-gguf-engine.js";
import { MoonshineOnnxEngine } from "./moonshine-onnx-engine.js";
import { getManifestForEngine, STT_MODEL_CATALOG } from "./manifest.js";
import { downloadSttModel } from "./model-downloader.js";

/**
 * Pluggable STT Runtime Loader that abstracts and manages:
 * - Runtime A: Whisper C++ / GGUF engine
 * - Runtime B: ONNX / Moonshine engine
 * - Automated model provisioning into ~/.krypton/models
 */
export class SttRuntimeLoader {
  private engines: Map<SttEngineId, ISttEngine> = new Map();
  private activeEngineId: SttEngineId = "whisper_gguf";
  private modelsDir?: string;

  constructor(options: { defaultEngine?: SttEngineId; modelsDir?: string } = {}) {
    if (options.defaultEngine) {
      this.activeEngineId = options.defaultEngine;
    }
    this.modelsDir = options.modelsDir;

    // Register primary built-in local offline engines
    this.registerEngine(new WhisperGgufEngine());
    this.registerEngine(new MoonshineOnnxEngine());
  }

  registerEngine(engine: ISttEngine): void {
    this.engines.set(engine.id, engine);
  }

  getActiveEngineId(): SttEngineId {
    return this.activeEngineId;
  }

  getActiveEngine(): ISttEngine {
    const engine = this.engines.get(this.activeEngineId);
    if (!engine) {
      throw new Error(`Active STT engine not registered: ${this.activeEngineId}`);
    }
    return engine;
  }

  getEngine(id: SttEngineId): ISttEngine | undefined {
    return this.engines.get(id);
  }

  listAvailableEngines(): Array<{ id: SttEngineId; architecture: string; isLoaded: boolean }> {
    const list: Array<{ id: SttEngineId; architecture: string; isLoaded: boolean }> = [];
    for (const [id, engine] of this.engines.entries()) {
      list.push({
        id,
        architecture: engine.architecture,
        isLoaded: engine.isModelLoaded(),
      });
    }
    return list;
  }

  async setActiveEngine(id: SttEngineId): Promise<ISttEngine> {
    if (!this.engines.has(id)) {
      throw new Error(`Cannot set active STT engine: engine '${id}' is not registered`);
    }
    this.activeEngineId = id;
    return this.getActiveEngine();
  }

  /**
   * Ensures that the active engine has its verified model downloaded in ~/.krypton/models and loaded.
   */
  async ensureActiveEngineReady(
    onProgress?: (progress: SttDownloadProgress) => void,
    downloaderFn?: (url: string, destPath: string) => Promise<void>
  ): Promise<string> {
    const engine = this.getActiveEngine();
    const manifest = getManifestForEngine(this.activeEngineId);

    const modelPath = await downloadSttModel(
      manifest,
      this.modelsDir,
      onProgress,
      downloaderFn
    );

    if (!engine.isModelLoaded()) {
      await engine.loadModel(modelPath);
    }

    return modelPath;
  }

  /**
   * Directly transcribes raw 16kHz audio buffer offline using the active engine.
   */
  async transcribe(
    audioPcm: Float32Array | Buffer,
    sampleRate = 16000
  ): Promise<SttTranscriptionResult> {
    const engine = this.getActiveEngine();
    return engine.transcribe(audioPcm, sampleRate);
  }

  /**
   * Streams audio chunks to active engine and triggers partial transcription callbacks.
   */
  async streamTranscribe(
    chunk: Float32Array | Buffer,
    onPartial: (text: string) => void
  ): Promise<SttTranscriptionResult> {
    const engine = this.getActiveEngine();
    if (engine.streamTranscribe) {
      return engine.streamTranscribe(chunk, onPartial);
    }
    const res = await engine.transcribe(chunk);
    if (res.transcript) {
      onPartial(res.transcript);
    }
    return res;
  }

  async dispose(): Promise<void> {
    for (const engine of this.engines.values()) {
      await engine.dispose();
    }
    this.engines.clear();
  }
}
