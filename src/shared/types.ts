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
  /** Anthropic API key; when empty the SDK falls back to ANTHROPIC_API_KEY / `ant auth login` profile */
  anthropicApiKey: string
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
