import { useState, useRef, useEffect, useCallback } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SynapseAudioPipeline } from "@/lib/synapse/audioPipeline";

export interface SynapseState {
  isRecording: boolean;
  amplitude: number;
  targetAgent: string;
  transcription: string;
  isFinal: boolean;
  statusPill: string;
  engine: string;
}

export function useSynapse(onDispatchPrompt?: (text: string, targetAgent: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const [targetAgent, setTargetAgent] = useState("Orchestrator");
  const [transcription, setTranscription] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [statusPill, setStatusPill] = useState("Ready");
  const [engine, setEngine] = useState("whisper_gguf");

  const pipelineRef = useRef<SynapseAudioPipeline | null>(null);

  // Initialize offline audio pipeline
  useEffect(() => {
    const pipeline = new SynapseAudioPipeline({
      engine,
      onAmplitude: (amp) => setAmplitude(amp),
      onTranscription: (text, final) => {
        setTranscription(text);
        if (final) {
          setIsFinal(true);
          setStatusPill("Dispatched");
        } else {
          setIsFinal(false);
          setStatusPill("Listening...");
        }
      },
      onError: (err) => {
        console.warn("[Synapse Hook] Audio error:", err);
        setStatusPill("Error");
      },
    });

    pipelineRef.current = pipeline;

    return () => {
      pipeline.stop().catch(() => {});
      pipelineRef.current = null;
    };
  }, [engine]);

  // Listen to cross-window Tauri IPC events
  useEffect(() => {
    let unlistenTranscription: (() => void) | undefined;

    if (typeof window !== "undefined" && isTauri()) {
      listen<{ transcript: string; isFinal: boolean; engine?: string }>(
        "synapse:transcription",
        (event) => {
          if (event.payload?.transcript) {
            setTranscription(event.payload.transcript);
            if (event.payload.isFinal) {
              setIsFinal(true);
              setStatusPill("Dispatched");
              if (onDispatchPrompt) {
                onDispatchPrompt(event.payload.transcript, targetAgent);
              }
            }
          }
        }
      ).then((unlisten) => {
        unlistenTranscription = unlisten;
      });
    }

    return () => {
      unlistenTranscription?.();
    };
  }, [onDispatchPrompt, targetAgent]);

  const startRecording = useCallback(async () => {
    setIsRecording(true);
    setIsFinal(false);
    setStatusPill("Listening...");
    setTranscription("");

    if (pipelineRef.current) {
      try {
        await pipelineRef.current.start();
      } catch {
        setIsRecording(false);
        setStatusPill("Hardware Error");
      }
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setStatusPill("Transcribing...");

    if (pipelineRef.current) {
      const finalTranscript = await pipelineRef.current.stop();
      if (finalTranscript) {
        setTranscription(finalTranscript);
        setIsFinal(true);
        setStatusPill("Dispatched");

        if (onDispatchPrompt && finalTranscript.trim()) {
          onDispatchPrompt(finalTranscript.trim(), targetAgent);
        }
      } else {
        setStatusPill("Ready");
      }
    }
  }, [onDispatchPrompt, targetAgent]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    amplitude,
    targetAgent,
    setTargetAgent,
    transcription,
    setTranscription,
    isFinal,
    statusPill,
    engine,
    setEngine,
    toggleRecording,
    startRecording,
    stopRecording,
  };
}
