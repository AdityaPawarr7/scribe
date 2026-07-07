import { useEffect, useState } from 'react'
import type { ModelDownloadProgress, Settings, WhisperStatus } from '../env'

interface Props {
  onClose: () => void
}

const MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (recommended)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (faster/cheaper)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest)' }
]

export default function SettingsModal(props: Props): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<WhisperStatus | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)

  useEffect(() => {
    void window.muesli.settings.get().then(setSettings)
    void window.muesli.whisper.status().then(setStatus)
    return window.muesli.on('whisper:downloadProgress', (p: ModelDownloadProgress) => {
      setProgress(p)
      if (p.done) setDownloading(false)
    })
  }, [])

  const save = (patch: Partial<Settings>): void => {
    setSettings((current) => (current ? { ...current, ...patch } : current))
    void window.muesli.settings.set(patch).then(() => window.muesli.whisper.status().then(setStatus))
  }

  const downloadModel = async (): Promise<void> => {
    setDownloading(true)
    setProgress(null)
    try {
      setStatus(await window.muesli.whisper.downloadModel())
    } catch {
      // error surfaced via progress event
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

        <h3>Claude (note enhancement)</h3>
        <label>
          Anthropic API key
          <input
            type="password"
            placeholder="sk-ant-… (leave empty to use ANTHROPIC_API_KEY or `ant auth login`)"
            value={settings.anthropicApiKey}
            onChange={(event) => save({ anthropicApiKey: event.target.value })}
          />
        </label>
        <label>
          Model
          <select value={settings.model} onChange={(event) => save({ model: event.target.value })}>
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        <h3>Transcription (local, whisper.cpp)</h3>
        <div className={`status-row ${status?.binaryFound ? 'ok' : 'missing'}`}>
          {status?.binaryFound ? `✓ whisper-cli found: ${status.binaryPath}` : '✕ whisper-cli not found — brew install whisper-cpp'}
        </div>
        <div className={`status-row ${status?.modelFound ? 'ok' : 'missing'}`}>
          {status?.modelFound ? `✓ Model: ${status.modelPath}` : '✕ Whisper model not downloaded yet'}
        </div>
        {!status?.modelFound && (
          <button className="primary" disabled={downloading} onClick={() => void downloadModel()}>
            {downloading
              ? pct !== null
                ? `Downloading… ${pct}%`
                : 'Downloading…'
              : 'Download base.en model (~150MB)'}
          </button>
        )}
        {progress?.error && <div className="status-row missing">Download failed: {progress.error}</div>}

        <label>
          Custom whisper-cli path (optional)
          <input
            type="text"
            placeholder="/opt/homebrew/bin/whisper-cli"
            value={settings.whisperBinaryPath}
            onChange={(event) => save({ whisperBinaryPath: event.target.value })}
          />
        </label>
        <label>
          Custom model path (optional)
          <input
            type="text"
            placeholder="/path/to/ggml-base.en.bin"
            value={settings.whisperModelPath}
            onChange={(event) => save({ whisperModelPath: event.target.value })}
          />
        </label>
        <label>
          Spoken language (ISO code, or "auto" with a multilingual model)
          <input
            type="text"
            value={settings.language}
            onChange={(event) => save({ language: event.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
