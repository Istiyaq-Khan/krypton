import { useSynapse, SynapseState } from "./useSynapse"

export type VoiceHudState = SynapseState

/**
 * Legacy compatibility hook for useVoiceHud.
 * Directly routes to the offline-first Krypton Synapse audio pipeline.
 */
export function useVoiceHud(onDispatchPrompt?: (text: string, targetAgent: string) => void) {
  return useSynapse(onDispatchPrompt)
}
