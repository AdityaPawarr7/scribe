export interface TranscriptSegment {
  /** seconds from the start of the recording */
  t: number
  text: string
}

export interface PulseNote {
  /** seconds into the call when this pulse was taken */
  t: number
  summary: string
  actions: string[]
  questions: string[]
}

export interface Meeting {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  notes: string
  transcript: TranscriptSegment[]
  enhancedNotes: string
  durationSec: number
  hasAudio: boolean
  pulses: PulseNote[]
}

export interface MeetingSummary {
  id: string
  title: string
  createdAt: number
  durationSec: number
}

export interface Settings {
  /** Concentrate AI API key (sk-cn…); when empty, falls back to CONCENTRATE_API_KEY */
  concentrateApiKey: string
  /** any model ID from the Concentrate model fortress (https://concentrate.ai/models) */
  model: string
  whisperBinaryPath: string
  whisperModelPath: string
  language: string
  onboardingComplete: boolean
  /** how the note-taker should be referred to in enhanced notes */
  userName: string
  /** run enhancement automatically when a recording stops */
  autoEnhance: boolean
  /** also capture system audio (the other side of Meet/Zoom/FaceTime) */
  captureSystemAudio: boolean
  /** surface actions + questions every few minutes while recording */
  livePulse: boolean
  /** maintain a local profile.md of how the user speaks */
  voiceProfile: boolean
  theme: 'dark' | 'light'
  /** accent color hex */
  accent: string
  fontPack: 'system' | 'typewriter' | 'mono' | 'serif'
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface ConcentrateModel {
  id: string
  displayName: string
  provider: string
}

export interface ModelListResult {
  ok: boolean
  models: ConcentrateModel[]
  error?: string
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
}

export interface WhisperStatus {
  binaryFound: boolean
  binaryPath: string
  modelFound: boolean
  modelPath: string
}

export interface ModelDownloadProgress {
  receivedBytes: number
  totalBytes: number
  done: boolean
  error?: string
}

export interface VoiceProfileStatus {
  exists: boolean
  meetingsAnalyzed: number
  path: string
}
