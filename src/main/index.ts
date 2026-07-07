import { app, BrowserWindow, ipcMain, shell, systemPreferences } from 'electron'
import { join } from 'path'
import { loadSettings, saveSettings, whisperStatus } from './settings'
import * as store from './store'
import { RecordingSession } from './transcriber'
import { enhanceMeeting } from './enhancer'
import { downloadModel } from './modelDownload'
import type { Meeting, Settings } from '@shared/types'

let mainWindow: BrowserWindow | null = null
let activeRecording: RecordingSession | null = null
const activeEnhancements = new Map<string, { cancel: () => void }>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    title: 'Muesli',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#191817',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function send(channel: string, ...args: unknown[]): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
}

// ---- meetings ----
ipcMain.handle('meetings:list', () => store.listMeetings())
ipcMain.handle('meetings:get', (_e, id: string) => store.getMeeting(id))
ipcMain.handle('meetings:create', () => store.createMeeting())
ipcMain.handle('meetings:update', (_e, id: string, patch: Partial<Meeting>) =>
  store.updateMeeting(id, patch)
)
ipcMain.handle('meetings:delete', (_e, id: string) => {
  store.deleteMeeting(id)
})

// ---- recording ----
ipcMain.handle('recording:start', async (_e, meetingId: string) => {
  if (activeRecording) throw new Error('A recording is already in progress')
  if (process.platform === 'darwin') {
    const granted = await systemPreferences.askForMediaAccess('microphone')
    if (!granted) throw new Error('Microphone access was denied')
  }
  activeRecording = new RecordingSession(
    meetingId,
    (segment) => {
      const meeting = store.getMeeting(meetingId)
      if (meeting) {
        meeting.transcript.push(segment)
        store.saveMeeting(meeting)
      }
      send('transcript:segment', meetingId, segment)
    },
    (message) => send('transcript:error', meetingId, message)
  )
  return whisperStatus()
})

ipcMain.on('recording:audio', (_e, chunk: ArrayBuffer) => {
  activeRecording?.addChunk(new Int16Array(chunk))
})

ipcMain.handle('recording:stop', async () => {
  const session = activeRecording
  if (!session) return null
  activeRecording = null
  const durationSec = Math.round(await session.stop(store.audioPath(session.meetingId)))
  const meeting = store.updateMeeting(session.meetingId, { durationSec, hasAudio: true })
  send('recording:finalized', session.meetingId)
  return meeting
})

// ---- enhancement ----
ipcMain.handle('enhance:run', (_e, meetingId: string) => {
  const meeting = store.getMeeting(meetingId)
  if (!meeting) throw new Error('Meeting not found')
  if (activeEnhancements.has(meetingId)) return

  const handle = enhanceMeeting(meeting, {
    onDelta: (delta) => send('enhance:delta', meetingId, delta),
    onDone: (fullText) => {
      activeEnhancements.delete(meetingId)
      store.updateMeeting(meetingId, { enhancedNotes: fullText })
      send('enhance:done', meetingId, fullText)
    },
    onError: (message) => {
      activeEnhancements.delete(meetingId)
      send('enhance:error', meetingId, message)
    }
  })
  activeEnhancements.set(meetingId, handle)
})

ipcMain.handle('enhance:cancel', (_e, meetingId: string) => {
  activeEnhancements.get(meetingId)?.cancel()
  activeEnhancements.delete(meetingId)
})

// ---- settings / whisper ----
ipcMain.handle('settings:get', () => loadSettings())
ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => saveSettings(patch))
ipcMain.handle('whisper:status', () => whisperStatus())
ipcMain.handle('whisper:downloadModel', async () => {
  await downloadModel((progress) => send('whisper:downloadProgress', progress))
  return whisperStatus()
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
