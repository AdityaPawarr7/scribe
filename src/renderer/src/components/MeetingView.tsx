import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import type { Meeting } from '../env'

interface Props {
  meeting: Meeting
  isRecording: boolean
  recordSeconds: number
  enhancing: boolean
  enhanceBuffer: string
  onUpdate: (patch: Partial<Meeting>) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onEnhance: () => void
  onCancelEnhance: () => void
}

type Tab = 'notes' | 'enhanced'

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function MeetingView(props: Props): React.JSX.Element {
  const { meeting } = props
  const [tab, setTab] = useState<Tab>('notes')
  const [notes, setNotes] = useState(meeting.notes)
  const [showTranscript, setShowTranscript] = useState(true)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // reset local state when switching meetings
  useEffect(() => {
    setNotes(meeting.notes)
    setTab('notes')
  }, [meeting.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // switch to the enhanced tab while streaming
  useEffect(() => {
    if (props.enhancing) setTab('enhanced')
  }, [props.enhancing])

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [meeting.transcript.length])

  const handleNotesChange = (value: string): void => {
    setNotes(value)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => props.onUpdate({ notes: value }), 600)
  }

  const enhancedMarkdown = props.enhancing ? props.enhanceBuffer : meeting.enhancedNotes
  const canEnhance = !props.isRecording && (meeting.transcript.length > 0 || notes.trim() !== '')

  return (
    <div className="meeting-view">
      <header className="meeting-header">
        <input
          className="title-input"
          value={meeting.title}
          placeholder="Untitled meeting"
          onChange={(event) => props.onUpdate({ title: event.target.value })}
        />
        <div className="header-actions">
          {props.isRecording ? (
            <button className="record recording" onClick={props.onStopRecording}>
              <span className="rec-dot" /> Stop · {formatClock(props.recordSeconds)}
            </button>
          ) : (
            <button className="record" onClick={props.onStartRecording}>
              ● Record
            </button>
          )}
          {props.enhancing ? (
            <button className="secondary" onClick={props.onCancelEnhance}>
              Cancel
            </button>
          ) : (
            <button className="primary" disabled={!canEnhance} onClick={props.onEnhance}>
              ✦ Enhance notes
            </button>
          )}
          <button
            className={`secondary transcript-toggle ${showTranscript ? 'active' : ''}`}
            onClick={() => setShowTranscript((v) => !v)}
          >
            Transcript
          </button>
        </div>
      </header>

      <div className="meeting-body">
        <section className="editor-pane">
          <div className="tabs">
            <button className={tab === 'notes' ? 'tab active' : 'tab'} onClick={() => setTab('notes')}>
              My notes
            </button>
            <button
              className={tab === 'enhanced' ? 'tab active' : 'tab'}
              onClick={() => setTab('enhanced')}
              disabled={!enhancedMarkdown && !props.enhancing}
            >
              ✦ Enhanced {props.enhancing && <span className="spinner" />}
            </button>
          </div>
          {tab === 'notes' ? (
            <textarea
              className="notes-editor"
              placeholder="Type rough notes here during the meeting — fragments are fine. AI will merge them with the transcript when you hit Enhance."
              value={notes}
              onChange={(event) => handleNotesChange(event.target.value)}
            />
          ) : (
            <div
              className="enhanced-notes"
              dangerouslySetInnerHTML={{ __html: marked.parse(enhancedMarkdown || '') as string }}
            />
          )}
        </section>

        {showTranscript && (
          <aside className="transcript-pane">
            <div className="transcript-title">
              Transcript
              {props.isRecording && <span className="live-pill">LIVE</span>}
            </div>
            <div className="transcript-scroll">
              {meeting.transcript.length === 0 && (
                <div className="transcript-empty">
                  {props.isRecording
                    ? 'Listening… first text appears after ~15s.'
                    : 'No transcript yet. Hit Record to capture this meeting.'}
                </div>
              )}
              {meeting.transcript.map((segment, index) => (
                <div className="transcript-segment" key={index}>
                  <span className="transcript-time">{formatClock(segment.t)}</span>
                  <span>{segment.text}</span>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
