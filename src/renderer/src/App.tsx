import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatTurn, Meeting, MeetingSummary, PulseNote, TranscriptSegment } from './env'
import { MicRecorder } from './recorder'
import Sidebar from './components/Sidebar'
import MeetingView from './components/MeetingView'
import SettingsView from './components/SettingsView'
import Onboarding from './components/Onboarding'
import ChatView from './components/ChatView'
import Logo from './components/Logo'
import { applyAppearance } from './appearance'

export default function App(): React.JSX.Element {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([])
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [hearingSystem, setHearingSystem] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceBuffer, setEnhanceBuffer] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatLog, setChatLog] = useState<ChatTurn[]>([])
  const [chatStreaming, setChatStreaming] = useState(false)
  const [chatBuffer, setChatBuffer] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const recorderRef = useRef<MicRecorder | null>(null)
  const meetingRef = useRef<Meeting | null>(null)
  meetingRef.current = meeting

  const refreshList = useCallback(async () => {
    setMeetings(await window.scribe.meetings.list())
  }, [])

  useEffect(() => {
    void refreshList()
    void window.scribe.settings.get().then((settings) => {
      applyAppearance(settings)
      if (!settings.onboardingComplete) setShowOnboarding(true)
    })
  }, [refreshList])

  // event subscriptions
  useEffect(() => {
    const offSegment = window.scribe.on(
      'transcript:segment',
      (meetingId: string, segment: TranscriptSegment) => {
        setMeeting((current) =>
          current && current.id === meetingId
            ? { ...current, transcript: [...current.transcript, segment] }
            : current
        )
      }
    )
    const offTranscriptError = window.scribe.on('transcript:error', (_id: string, message: string) => {
      setBanner(`Transcription: ${message}`)
    })
    const offDelta = window.scribe.on('enhance:delta', (meetingId: string, delta: string) => {
      if (meetingRef.current?.id === meetingId) {
        setEnhanceBuffer((text) => text + delta)
      }
    })
    const offDone = window.scribe.on('enhance:done', (meetingId: string, fullText: string) => {
      if (meetingRef.current?.id === meetingId) {
        setEnhancing(false)
        setEnhanceBuffer('')
        setMeeting((current) => (current ? { ...current, enhancedNotes: fullText } : current))
      }
    })
    const offPulse = window.scribe.on('pulse:new', (meetingId: string, pulse: PulseNote) => {
      setMeeting((current) =>
        current && current.id === meetingId
          ? { ...current, pulses: [...current.pulses, pulse] }
          : current
      )
    })
    const offTitled = window.scribe.on('meeting:titled', (meetingId: string, title: string) => {
      setMeeting((current) => (current && current.id === meetingId ? { ...current, title } : current))
      void refreshList()
    })
    const offChatDelta = window.scribe.on('chat:delta', (delta: string) => {
      setChatBuffer((text) => text + delta)
    })
    const offChatDone = window.scribe.on('chat:done', (fullText: string) => {
      setChatStreaming(false)
      setChatBuffer('')
      setChatLog((log) => [...log, { role: 'assistant', text: fullText }])
    })
    const offChatError = window.scribe.on('chat:error', (message: string) => {
      setChatStreaming(false)
      setChatBuffer('')
      setChatLog((log) => [...log, { role: 'assistant', text: `⚠️ ${message}` }])
    })
    const offEnhanceError = window.scribe.on('enhance:error', (meetingId: string, message: string) => {
      if (meetingRef.current?.id === meetingId) {
        setEnhancing(false)
        setEnhanceBuffer('')
        setBanner(`Enhance failed: ${message}`)
      }
    })
    return () => {
      offPulse()
      offTitled()
      offChatDelta()
      offChatDone()
      offChatError()
      offSegment()
      offTranscriptError()
      offDelta()
      offDone()
      offEnhanceError()
    }
  }, [refreshList])

  // recording timer
  useEffect(() => {
    if (!recordingId) return
    setRecordSeconds(0)
    const interval = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [recordingId])

  const selectMeeting = useCallback(async (id: string) => {
    setShowSettings(false)
    setShowChat(false)
    setEnhanceBuffer('')
    setEnhancing(false)
    setMeeting(await window.scribe.meetings.get(id))
  }, [])

  const createMeeting = useCallback(async () => {
    setShowSettings(false)
    setShowChat(false)
    const created = await window.scribe.meetings.create()
    await refreshList()
    setEnhanceBuffer('')
    setEnhancing(false)
    setMeeting(created)
  }, [refreshList])

  const deleteMeeting = useCallback(
    async (id: string) => {
      await window.scribe.meetings.delete(id)
      if (meetingRef.current?.id === id) setMeeting(null)
      await refreshList()
    },
    [refreshList]
  )

  const updateMeeting = useCallback(
    async (patch: Partial<Meeting>) => {
      const current = meetingRef.current
      if (!current) return
      setMeeting({ ...current, ...patch })
      await window.scribe.meetings.update(current.id, patch)
      if (patch.title !== undefined) await refreshList()
    },
    [refreshList]
  )

  const startRecording = useCallback(async () => {
    const current = meetingRef.current
    if (!current || recorderRef.current) return
    try {
      const status = await window.scribe.recording.start(current.id)
      if (!status.binaryFound || !status.modelFound) {
        await window.scribe.recording.stop()
        setBanner(
          !status.binaryFound
            ? 'whisper-cli not found — install it with `brew install whisper-cpp` or set its path in Settings'
            : 'No Whisper model yet — download it from Settings (one-time, ~150MB)'
        )
        setShowSettings(true)
        return
      }
      const settings = await window.scribe.settings.get()
      const recorder = new MicRecorder((chunk) => window.scribe.recording.sendAudio(chunk))
      const capture = await recorder.start(settings.captureSystemAudio)
      recorderRef.current = recorder
      setRecordingId(current.id)
      setHearingSystem(capture.systemAudio)
      if (settings.captureSystemAudio && !capture.systemAudio) {
        setBanner(
          'Recording mic only — to hear the other side of calls, allow Screen & System Audio Recording for Scribe in System Settings → Privacy & Security'
        )
      } else {
        setBanner(null)
      }
    } catch (error) {
      await window.scribe.recording.stop().catch(() => null)
      setBanner(error instanceof Error ? error.message : String(error))
    }
  }, [])

  const runEnhance = useCallback(async () => {
    const current = meetingRef.current
    if (!current) return
    // persist latest notes before enhancing
    await window.scribe.meetings.update(current.id, { notes: current.notes })
    setEnhanceBuffer('')
    setEnhancing(true)
    await window.scribe.enhance.run(current.id)
  }, [])

  const stopRecording = useCallback(async () => {
    await recorderRef.current?.stop()
    recorderRef.current = null
    setRecordingId(null)
    setHearingSystem(false)
    const finalized = await window.scribe.recording.stop()
    if (finalized && meetingRef.current?.id === finalized.id) {
      setMeeting(finalized)
    }
    await refreshList()
    // notes appear on their own the moment the recording ends
    const settings = await window.scribe.settings.get()
    if (
      settings.autoEnhance &&
      finalized &&
      meetingRef.current?.id === finalized.id &&
      (finalized.transcript.length > 0 || finalized.notes.trim() !== '')
    ) {
      void runEnhance()
    }
  }, [refreshList, runEnhance])

  const askChat = useCallback((question: string) => {
    setChatLog((log) => {
      void window.scribe.chat.ask(question, log)
      return [...log, { role: 'user', text: question }]
    })
    setChatStreaming(true)
    setChatBuffer('')
  }, [])

  const cancelChat = useCallback(() => {
    void window.scribe.chat.cancel()
    setChatStreaming(false)
    setChatBuffer('')
  }, [])

  const cancelEnhance = useCallback(async () => {
    const current = meetingRef.current
    if (!current) return
    await window.scribe.enhance.cancel(current.id)
    setEnhancing(false)
    setEnhanceBuffer('')
  }, [])

  return (
    <div className="app">
      <Sidebar
        meetings={meetings}
        selectedId={meeting?.id ?? null}
        recordingId={recordingId}
        onSelect={(id) => void selectMeeting(id)}
        onCreate={() => void createMeeting()}
        onDelete={(id) => void deleteMeeting(id)}
        onOpenSettings={() => {
          setShowSettings(true)
          setShowChat(false)
        }}
        onOpenChat={() => {
          setShowChat(true)
          setShowSettings(false)
        }}
        chatActive={showChat}
      />
      <main className="content">
        {banner && (
          <div className="banner">
            <span>{banner}</span>
            <button className="banner-close" onClick={() => setBanner(null)}>
              ✕
            </button>
          </div>
        )}
        {showSettings ? (
          <SettingsView onClose={() => setShowSettings(false)} />
        ) : showChat ? (
          <ChatView
            log={chatLog}
            streaming={chatStreaming}
            streamBuffer={chatBuffer}
            onAsk={askChat}
            onCancel={cancelChat}
          />
        ) : meeting ? (
          <MeetingView
            meeting={meeting}
            isRecording={recordingId === meeting.id}
            hearingSystem={hearingSystem}
            recordSeconds={recordSeconds}
            enhancing={enhancing}
            enhanceBuffer={enhanceBuffer}
            onUpdate={(patch) => void updateMeeting(patch)}
            onStartRecording={() => void startRecording()}
            onStopRecording={() => void stopRecording()}
            onEnhance={() => void runEnhance()}
            onCancelEnhance={() => void cancelEnhance()}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-logo">
              <Logo size={72} />
            </div>
            <h1>Scribe</h1>
            <p>Open-source meeting notes. Recorded, transcribed, and written on your Mac.</p>
            <button className="primary" onClick={() => void createMeeting()}>
              New meeting
            </button>
          </div>
        )}
      </main>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    </div>
  )
}
