export interface TranscriptSegment {
  /** seconds from the start of the recording */
  t: number
  text: string
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
