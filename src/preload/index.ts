import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConnectionTestResult,
  Meeting,
  MeetingSummary,
  ModelDownloadProgress,
  ModelListResult,
  Settings,
  TranscriptSegment,
  WhisperStatus
} from '../shared/types'

const EVENT_CHANNELS = [
  'transcript:segment',
  'transcript:error',
  'recording:finalized',
  'enhance:delta',
  'enhance:done',
  'enhance:error',
  'whisper:downloadProgress'
] as const

export type EventChannel = (typeof EVENT_CHANNELS)[number]

const api = {
  meetings: {
    list: (): Promise<MeetingSummary[]> => ipcRenderer.invoke('meetings:list'),
    get: (id: string): Promise<Meeting | null> => ipcRenderer.invoke('meetings:get', id),
    create: (): Promise<Meeting> => ipcRenderer.invoke('meetings:create'),
    update: (id: string, patch: Partial<Meeting>): Promise<Meeting | null> =>
      ipcRenderer.invoke('meetings:update', id, patch),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('meetings:delete', id)
  },
  recording: {
    start: (meetingId: string): Promise<WhisperStatus> =>
      ipcRenderer.invoke('recording:start', meetingId),
    sendAudio: (chunk: ArrayBuffer): void => ipcRenderer.send('recording:audio', chunk),
    stop: (): Promise<Meeting | null> => ipcRenderer.invoke('recording:stop')
  },
  enhance: {
    run: (meetingId: string): Promise<void> => ipcRenderer.invoke('enhance:run', meetingId),
    cancel: (meetingId: string): Promise<void> => ipcRenderer.invoke('enhance:cancel', meetingId)
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:set', patch)
  },
  concentrate: {
    models: (): Promise<ModelListResult> => ipcRenderer.invoke('concentrate:models'),
    test: (model: string): Promise<ConnectionTestResult> => ipcRenderer.invoke('concentrate:test', model)
  },
  whisper: {
    status: (): Promise<WhisperStatus> => ipcRenderer.invoke('whisper:status'),
    downloadModel: (): Promise<WhisperStatus> => ipcRenderer.invoke('whisper:downloadModel')
  },
  on: (channel: EventChannel, listener: (...args: unknown[]) => void): (() => void) => {
    if (!EVENT_CHANNELS.includes(channel)) {
      throw new Error(`Unknown event channel: ${channel}`)
    }
    const wrapped = (_event: unknown, ...args: unknown[]): void => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  }
}

export type MuesliApi = typeof api
export type { Meeting, MeetingSummary, ModelDownloadProgress, Settings, TranscriptSegment, WhisperStatus }

contextBridge.exposeInMainWorld('muesli', api)
