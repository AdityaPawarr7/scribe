import { useEffect, useState } from 'react'
import type { ModelDownloadProgress, Settings, VoiceProfileStatus, WhisperStatus } from '../env'
import ModelSelect from './ModelSelect'
import { ACCENTS, FONT_PACKS, applyAppearance } from '../appearance'

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

export default function SettingsView(props: Props): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<WhisperStatus | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)
  const [profile, setProfile] = useState<VoiceProfileStatus | null>(null)

  useEffect(() => {
    void window.scribe.settings.get().then(setSettings)
    void window.scribe.whisper.status().then(setStatus)
    void window.scribe.profile.status().then(setProfile)
    const offProgress = window.scribe.on('whisper:downloadProgress', (p: ModelDownloadProgress) => {
      setProgress(p)
      if (p.done) setDownloading(false)
    })
    const offProfile = window.scribe.on('profile:updated', (status: VoiceProfileStatus) => {
      setProfile(status)
    })
    return () => {
      offProgress()
      offProfile()
    }
  }, [])

  const save = (patch: Partial<Settings>): void => {
    setSettings((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      applyAppearance(next)
      return next
    })
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

  if (!settings) return <div className="settings-page" />

  const pct =
    progress && progress.totalBytes > 0
      ? Math.round((progress.receivedBytes / progress.totalBytes) * 100)
      : null

  return (
    <div className="settings-page">
      <div className="settings-col">
        <header className="settings-header">
          <h1>Settings</h1>
          <button className="secondary" onClick={props.onClose}>
            Done
          </button>
        </header>

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

        <h3>Calls</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Hear the whole call</strong>
            <span>Capture system audio — Meet, Zoom, FaceTime, any app</span>
          </div>
          <Toggle
            on={settings.captureSystemAudio}
            onChange={(on) => save({ captureSystemAudio: on })}
          />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Pulse</strong>
            <span>Actions &amp; questions surfaced every 5 minutes, live</span>
          </div>
          <Toggle on={settings.livePulse} onChange={(on) => save({ livePulse: on })} />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Voice profile</strong>
            <span>
              {profile?.exists
                ? `Learned from ${profile.meetingsAnalyzed} meeting${profile.meetingsAnalyzed === 1 ? '' : 's'} — powers upcoming dictation`
                : 'Learns how you speak into a local profile.md — powers upcoming dictation'}
            </span>
          </div>
          <div className="row-controls">
            {profile?.exists && (
              <button className="secondary" onClick={() => void window.scribe.profile.open()}>
                View
              </button>
            )}
            <Toggle on={settings.voiceProfile} onChange={(on) => save({ voiceProfile: on })} />
          </div>
        </div>

        <h3>Appearance</h3>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Theme</strong>
            <span>Glass, two ways</span>
          </div>
          <div className="segmented">
            {(['dark', 'light'] as const).map((theme) => (
              <button
                key={theme}
                className={settings.theme === theme ? 'seg active' : 'seg'}
                onClick={() => save({ theme })}
              >
                {theme === 'dark' ? '☾ Dark' : '☀ Light'}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Accent</strong>
            <span>Buttons, glows, the logo</span>
          </div>
          <div className="swatches">
            {ACCENTS.map((accent) => (
              <button
                key={accent.hex}
                title={accent.name}
                className={`swatch ${settings.accent === accent.hex ? 'selected' : ''}`}
                style={{ background: accent.hex }}
                onClick={() => save({ accent: accent.hex })}
              />
            ))}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <strong>Font</strong>
            <span>Applies everywhere</span>
          </div>
          <div className="setting-control">
            <select
              className="model-select"
              style={{ marginTop: 0 }}
              value={settings.fontPack}
              onChange={(event) => save({ fontPack: event.target.value as Settings['fontPack'] })}
            >
              {FONT_PACKS.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.label}
                </option>
              ))}
            </select>
          </div>
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
            <ModelSelect value={settings.model} onChange={(model) => save({ model })} />
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
          <div className="setting-row">
            <div className="setting-info">
              <strong>whisper-cli path</strong>
            </div>
            <input
              className="setting-input"
              type="text"
              placeholder="auto-detected"
              value={settings.whisperBinaryPath}
              onChange={(event) => save({ whisperBinaryPath: event.target.value })}
            />
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <strong>Speech model path</strong>
            </div>
            <input
              className="setting-input"
              type="text"
              placeholder="auto-detected"
              value={settings.whisperModelPath}
              onChange={(event) => save({ whisperModelPath: event.target.value })}
            />
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <strong>Spoken language</strong>
            </div>
            <input
              className="setting-input"
              type="text"
              value={settings.language}
              onChange={(event) => save({ language: event.target.value })}
            />
          </div>
        </details>
      </div>
    </div>
  )
}
