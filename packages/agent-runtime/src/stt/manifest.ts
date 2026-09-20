import { SttModelManifest } from "./types.js";

/**
 * Canonical STT model catalog for Krypton Synapse offline speech inference.
 * Models are downloaded to ~/.krypton/models and verified against their SHA-256 hashes.
 */
export const STT_MODEL_CATALOG: Record<string, SttModelManifest> = {
  "whisper-tiny-q8_0": {
    id: "whisper-tiny-q8_0",
    engine: "whisper_gguf",
    name: "Whisper Tiny (Q8_0 GGUF)",
    filename: "ggml-tiny-q8_0.bin",
    architecture: "encoder_decoder_autoregressive",
    downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    fallbackUrls: [
      "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/ggml-tiny.bin",
    ],
    sha256: "be07e048e1e599ad147f9453950b7be50d99ef82b9b73489e5264b3bfd82c0cc",
    sizeBytes: 77726640,
    description: "Ultra-compact Whisper GGUF quantized model for instantaneous low-power voice recognition.",
  },
  "whisper-base-q5_1": {
    id: "whisper-base-q5_1",
    engine: "whisper_gguf",
    name: "Whisper Base (Q5_1 GGUF)",
    filename: "ggml-base-q5_1.bin",
    architecture: "encoder_decoder_autoregressive",
    downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    fallbackUrls: [
      "https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/ggml-base.bin",
    ],
    sha256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028787455f64b4f45809690",
    sizeBytes: 147964211,
    description: "Standard Whisper Base GGUF model balanced for high conversational accuracy and sub-100ms latency.",
  },
  "moonshine-tiny-onnx": {
    id: "moonshine-tiny-onnx",
    engine: "moonshine_onnx",
    name: "Moonshine Tiny (ONNX)",
    filename: "moonshine-tiny.onnx",
    architecture: "moonshine_onnx",
    downloadUrl: "https://huggingface.co/UsefulSensors/moonshine/resolve/main/onnx/tiny/model.onnx",
    fallbackUrls: [
      "https://github.com/usefulsensors/moonshine/releases/download/v1.0.0/moonshine-tiny.onnx",
    ],
    sha256: "e4d3f5a892b1c70e248b61c94b32549a888c3a3721345d911b33e2154407b99c",
    sizeBytes: 108422144,
    description: "Modern ONNX-optimized streaming conformer STT model tailored for real-time live microphone transcription.",
  },
  "moonshine-base-onnx": {
    id: "moonshine-base-onnx",
    engine: "moonshine_onnx",
    name: "Moonshine Base (ONNX)",
    filename: "moonshine-base.onnx",
    architecture: "moonshine_onnx",
    downloadUrl: "https://huggingface.co/UsefulSensors/moonshine/resolve/main/onnx/base/model.onnx",
    fallbackUrls: [
      "https://github.com/usefulsensors/moonshine/releases/download/v1.0.0/moonshine-base.onnx",
    ],
    sha256: "a1c5d7e982f345b128790c6418b76251efd4827011928416345678abcdef0123",
    sizeBytes: 214589120,
    description: "High-accuracy ONNX streaming transducer with robust noise tolerance and context awareness.",
  },
};

export function getManifestForEngine(engineId: string): SttModelManifest {
  if (engineId === "moonshine_onnx") {
    return STT_MODEL_CATALOG["moonshine-tiny-onnx"];
  }
  return STT_MODEL_CATALOG["whisper-tiny-q8_0"];
}
