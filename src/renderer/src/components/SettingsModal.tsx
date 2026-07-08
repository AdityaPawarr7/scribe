import { useEffect, useState } from 'react'
import type { ModelDownloadProgress, Settings, WhisperStatus } from '../env'
import ModelSelect from './ModelSelect'

interface Props {
  onClose: () => void
}

function Toggle(props: { on: boolean; onChange: (on: boolean) => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      className={`toggle ${props.on ? 'on' : ''}`}
      onClick={() => props.onChange(!props.on)}
    >
      <span className="toggle-thumb" />
    </button>
  )
}

export default function SettingsModal(props: Props): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<WhisperStatus | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)

  useEffect(() => {
    void window.scribe.settings.get().then(setSettings)
    void window.scribe.whisper.status().then(setStatus)
    return window.scribe.on('whisper:downloadProgress', (p: ModelDownloadProgress) => {
      setProgress(p)
      if (p.done) setDownloading(false)
    })
  }, [])

  const save = (patch: Partial<Settings>): void => {
    setSettings((current) => (current ? { ...current, ...patch } : current))
    void window.scribe.settings.set(patch).then(() => window.scribe.whisper.status().then(setStatus))
  }

  const downloadModel = async (): Promise<void> => {
    setDownloading(true)
    setProgress(null)
    try {
      setStatus(await window.scribe.whisper.downloadModel())
    } catch {
      // surfaced via the progress event
    } finally {
      setDownloading(false)
    }
  }

  if (!settings) return <div className="modal-backdrop" />

  const pct =
    progress && progress.totalBytes > 0
      ? Math.round((progress.receivedBytes / progress.totalBytes) * 100)
      : null

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="banner-close" onClick={props.onClose}>
            ✕
          </button>
        </div>

        <h3>You</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Name</strong>
            <span>Notes say “{settings.userName.trim() || 'you'} agreed to…”</span>
          </div>
          <input
            className="setting-input"
            type="text"
            placeholder="First name"
            value={settings.userName}
            onChange={(event) => save({ userName: event.target.value })}
          />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Auto-notes</strong>
            <span>Enhance the moment a recording stops</span>
          </div>
          <Toggle on={settings.autoEnhance} onChange={(on) => save({ autoEnhance: on })} />
        </div>

        <h3>AI</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>API key</strong>
            <span>
              <a href="https://concentrate.ai" target="_blank" rel="noreferrer">
                Get one from Concentrate →
              </a>
            </span>
          </div>
          <input
            className="setting-input"
            type="password"
            placeholder="sk-cn-…"
            value={settings.concentrateApiKey}
            onChange={(event) => save({ concentrateApiKey: event.target.value })}
          />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Model</strong>
            <span>
              <a href="https://concentrate.ai/models" target="_blank" rel="noreferrer">
                Browse the fortress →
              </a>
            </span>
          </div>
          <div className="setting-control">
            <ModelSelect compact value={settings.model} onChange={(model) => save({ model })} />
          </div>
        </div>

        <h3>Transcription</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Engine</strong>
            <span>whisper.cpp, fully on-device</span>
          </div>
          <span className={`pill ${status?.binaryFound ? 'ok' : 'missing'}`}>
            {status?.binaryFound ? '✓ Ready' : '✕ Missing'}
          </span>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Speech model</strong>
            <span>~150MB, downloaded once</span>
          </div>
          {status?.modelFound ? (
            <span className="pill ok">✓ Ready</span>
          ) : (
            <button className="primary" disabled={downloading} onClick={() => void downloadModel()}>
              {downloading ? (pct !== null ? `${pct}%` : '…') : 'Download'}
            </button>
          )}
        </div>
        {!status?.binaryFound && (
          <div className="status-row missing">Install with: brew install whisper-cpp</div>
        )}
        {progress?.error && <div className="status-row missing">Download failed: {progress.error}</div>}

        <details className="advanced">
          <summary>Advanced</summary>
          <label>
            whisper-cli path
            <input
              type="text"
              placeholder="auto-detected"
              value={settings.whisperBinaryPath}
              onChange={(event) => save({ whisperBinaryPath: event.target.value })}
            />
          </label>
          <label>
            Speech model path
            <input
              type="text"
              placeholder="auto-detected"
              value={settings.whisperModelPath}
              onChange={(event) => save({ whisperModelPath: event.target.value })}
            />
          </label>
          <label>
            Spoken language
            <input
              type="text"
              value={settings.language}
              onChange={(event) => save({ language: event.target.value })}
            />
          </label>
        </details>
      </div>
    </div>
  )
}
