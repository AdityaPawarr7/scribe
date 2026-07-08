import { useCallback, useEffect, useRef, useState } from 'react'
import type { Meeting, MeetingSummary, TranscriptSegment } from './env'
import { MicRecorder } from './recorder'
import Sidebar from './components/Sidebar'
import MeetingView from './components/MeetingView'
import SettingsModal from './components/SettingsModal'
import Onboarding from './components/Onboarding'
import Logo from './components/Logo'

export default function App(): React.JSX.Element {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([])
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceBuffer, setEnhanceBuffer] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
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
    const offEnhanceError = window.scribe.on('enhance:error', (meetingId: string, message: string) => {
      if (meetingRef.current?.id === meetingId) {
        setEnhancing(false)
        setEnhanceBuffer('')
        setBanner(`Enhance failed: ${message}`)
      }
    })
    return () => {
      offSegment()
      offTranscriptError()
      offDelta()
      offDone()
      offEnhanceError()
    }
  }, [])

  // recording timer
  useEffect(() => {
    if (!recordingId) return
    setRecordSeconds(0)
    const interval = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [recordingId])

  const selectMeeting = useCallback(async (id: string) => {
    setEnhanceBuffer('')
    setEnhancing(false)
    setMeeting(await window.scribe.meetings.get(id))
  }, [])

  const createMeeting = useCallback(async () => {
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
        setSettingsOpen(true)
        return
      }
      const recorder = new MicRecorder((chunk) => window.scribe.recording.sendAudio(chunk))
      await recorder.start()
      recorderRef.current = recorder
      setRecordingId(current.id)
      setBanner(null)
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
        onOpenSettings={() => setSettingsOpen(true)}
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
        {meeting ? (
          <MeetingView
            meeting={meeting}
            isRecording={recordingId === meeting.id}
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
            <p>Open-source meeting notes. Record, transcribe locally, enhance with the model of your choice.</p>
            <button className="primary" onClick={() => void createMeeting()}>
              New meeting
            </button>
          </div>
        )}
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
    </div>
  )
}
