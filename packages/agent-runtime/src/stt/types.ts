import { z } from "zod";

export const SttEngineIdSchema = z.enum([
  "whisper_gguf",
  "moonshine_onnx",
  "whisper_local",
  "whisper_api",
  "nvidia/parakeet-tdt-0.6b-v3",
  "custom",
]);
export type SttEngineId = z.infer<typeof SttEngineIdSchema>;

export interface SttTranscriptionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
  engine: SttEngineId | string;
  durationMs: number;
  timestamp: number;
}

export interface SttModelManifest {
  id: string;
  engine: SttEngineId;
  name: string;
  filename: string;
  architecture: string;
  downloadUrl: string;
  fallbackUrls?: string[];
  sha256: string;
  sizeBytes: number;
  description: string;
}

export interface SttDownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
  stage: "idle" | "verifying" | "downloading" | "extracting" | "ready" | "failed";
  error?: string;
}

export interface ISttEngine {
  readonly id: SttEngineId;
  readonly architecture: string;
  isModelLoaded(): boolean;
  loadModel(modelPath: string): Promise<void>;
  transcribe(
    audioPcm: Float32Array | Buffer,
    sampleRate?: number
  ): Promise<SttTranscriptionResult>;
  streamTranscribe?(
    chunk: Float32Array | Buffer,
    onPartial: (text: string) => void
  ): Promise<SttTranscriptionResult>;
  dispose(): Promise<void>;
}
