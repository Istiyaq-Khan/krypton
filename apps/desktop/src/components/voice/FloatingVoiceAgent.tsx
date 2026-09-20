"use client"

import { KryptonSynapse, KryptonSynapseProps, SynapseState } from "./KryptonSynapse"

export type VoiceAgentState = SynapseState
export type FloatingVoiceAgentProps = KryptonSynapseProps

/**
 * Legacy compatibility export for FloatingVoiceAgent.
 * Krypton Synapse is the canonical floating interface component.
 */
export const FloatingVoiceAgent = KryptonSynapse
export default KryptonSynapse
