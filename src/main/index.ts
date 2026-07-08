import { app, BrowserWindow, ipcMain, nativeTheme, shell, systemPreferences } from 'electron'
import { cpSync, existsSync } from 'fs'
import { join } from 'path'
import { loadSettings, saveSettings, whisperStatus } from './settings'
import * as store from './store'
import { RecordingSession } from './transcriber'
import { enhanceMeeting, generateTitle } from './enhancer'
import { askChat } from './chat'
import { downloadModel } from './modelDownload'
import { listModels, testConnection } from './concentrate'
import type { ChatTurn, Meeting, Settings } from '@shared/types'

// Earlier builds stored data under 'muesli' (pre-rename) or 'scribe'
// (dev, lowercase package name) — carry meetings, settings, and the
// whisper model over to this build's data dir.
function migrateOldData(): void {
  const newDir = app.getPath('userData')
  if (existsSync(join(newDir, 'settings.json'))) return
  for (const oldName of ['scribe', 'muesli']) {
    const oldDir = join(app.getPath('appData'), oldName)
    if (oldDir !== newDir && existsSync(join(oldDir, 'settings.json'))) {
      try {
        cpSync(oldDir, newDir, { recursive: true })
      } catch {
        // fall back to a fresh profile rather than failing startup
      }
      return
    }
  }
}

let mainWindow: BrowserWindow | null = null
let activeRecording: RecordingSession | null = null
const activeEnhancements = new Map<string, { cancel: () => void }>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    title: 'Scribe',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    // Liquid-glass look: let macOS vibrancy shine through a transparent window
    ...(process.platform === 'darwin'
      ? {
          vibrancy: 'under-window' as const,
          visualEffectState: 'followWindow' as const,
          backgroundColor: '#00000000'
        }
      : { backgroundColor: '#191817' }),
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
      // name the meeting from its content once notes exist
      const current = store.getMeeting(meetingId)
      if (current && (current.title.trim() === '' || current.title.trim() === 'Untitled')) {
        void generateTitle(current).then((title) => {
          if (title && store.getMeeting(meetingId)) {
            store.updateMeeting(meetingId, { title })
            send('meeting:titled', meetingId, title)
          }
        })
      }
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

// ---- chat ----
let activeChat: { cancel: () => void } | null = null
ipcMain.handle('chat:ask', (_e, question: string, history: ChatTurn[]) => {
  activeChat?.cancel()
  activeChat = askChat(question, history, {
    onDelta: (delta) => send('chat:delta', delta),
    onDone: (fullText) => {
      activeChat = null
      send('chat:done', fullText)
    },
    onError: (message) => {
      activeChat = null
      send('chat:error', message)
    }
  })
})
ipcMain.handle('chat:cancel', () => {
  activeChat?.cancel()
  activeChat = null
})

// ---- concentrate ----
ipcMain.handle('concentrate:models', () => listModels())
ipcMain.handle('concentrate:test', (_e, model: string) => testConnection(model))

// ---- settings / whisper ----
ipcMain.handle('settings:get', () => loadSettings())
ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
  const next = saveSettings(patch)
  if (patch.theme) nativeTheme.themeSource = next.theme
  return next
})
ipcMain.handle('whisper:status', () => whisperStatus())
ipcMain.handle('whisper:downloadModel', async () => {
  await downloadModel((progress) => send('whisper:downloadProgress', progress))
  return whisperStatus()
})

app.whenReady().then(() => {
  migrateOldData()
  nativeTheme.themeSource = loadSettings().theme
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
