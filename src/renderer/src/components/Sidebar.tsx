import type { MeetingSummary } from '../env'
import Logo from './Logo'

interface Props {
  meetings: MeetingSummary[]
  selectedId: string | null
  recordingId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })
}

function formatDuration(seconds: number): string {
  if (!seconds) return ''
  const m = Math.round(seconds / 60)
  return m < 1 ? '<1 min' : `${m} min`
}

export default function Sidebar(props: Props): React.JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="wordmark">
          <Logo size={20} className="wordmark-logo" /> Muesli
        </span>
      </div>
      <button className="primary new-meeting" onClick={props.onCreate}>
        + New meeting
      </button>
      <nav className="meeting-list">
        {props.meetings.map((meeting) => (
          <div
            key={meeting.id}
            className={`meeting-item ${meeting.id === props.selectedId ? 'selected' : ''}`}
            onClick={() => props.onSelect(meeting.id)}
          >
            <div className="meeting-item-title">
              {meeting.id === props.recordingId && <span className="rec-dot" />}
              {meeting.title || 'Untitled'}
            </div>
            <div className="meeting-item-meta">
              {formatDate(meeting.createdAt)}
              {meeting.durationSec > 0 && ` · ${formatDuration(meeting.durationSec)}`}
            </div>
            <button
              className="meeting-item-delete"
              title="Delete meeting"
              onClick={(event) => {
                event.stopPropagation()
                if (confirm('Delete this meeting and its recording?')) props.onDelete(meeting.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {props.meetings.length === 0 && <div className="meeting-list-empty">No meetings yet</div>}
      </nav>
      <button className="settings-button" onClick={props.onOpenSettings}>
        ⚙ Settings
      </button>
    </aside>
  )
}
