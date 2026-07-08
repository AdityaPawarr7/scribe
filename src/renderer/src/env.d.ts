/// <reference types="vite/client" />
import type {
  ConcentrateModel,
  ConnectionTestResult,
  Meeting,
  MeetingSummary,
  ModelDownloadProgress,
  ModelListResult,
  Settings,
  TranscriptSegment,
  WhisperStatus
} from '@shared/types'

export type EventChannel =
  | 'transcript:segment'
  | 'transcript:error'
  | 'recording:finalized'
  | 'enhance:delta'
  | 'enhance:done'
  | 'enhance:error'
  | 'whisper:downloadProgress'

export interface ScribeApi {
  meetings: {
    list: () => Promise<MeetingSummary[]>
    get: (id: string) => Promise<Meeting | null>
    create: () => Promise<Meeting>
    update: (id: string, patch: Partial<Meeting>) => Promise<Meeting | null>
    delete: (id: string) => Promise<void>
  }
  recording: {
    start: (meetingId: string) => Promise<WhisperStatus>
    sendAudio: (chunk: ArrayBuffer) => void
    stop: () => Promise<Meeting | null>
  }
  enhance: {
    run: (meetingId: string) => Promise<void>
    cancel: (meetingId: string) => Promise<void>
  }
  settings: {
    get: () => Promise<Settings>
    set: (patch: Partial<Settings>) => Promise<Settings>
  }
  whisper: {
    status: () => Promise<WhisperStatus>
    downloadModel: () => Promise<WhisperStatus>
  }
  concentrate: {
    models: () => Promise<ModelListResult>
    test: (model: string) => Promise<ConnectionTestResult>
  }
  on: (channel: EventChannel, listener: (...args: never[]) => void) => () => void
}

declare global {
  interface Window {
    scribe: ScribeApi
  }
}

export type {
  ConcentrateModel,
  ConnectionTestResult,
  Meeting,
  MeetingSummary,
  ModelDownloadProgress,
  ModelListResult,
  Settings,
  TranscriptSegment,
  WhisperStatus
}
