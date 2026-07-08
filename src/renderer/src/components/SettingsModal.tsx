import { useEffect, useState } from 'react'
import type { ModelDownloadProgress, Settings, WhisperStatus } from '../env'
import ModelSelect from './ModelSelect'

interface Props {
  onClose: () => void
}

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

        <h3>Concentrate AI (note enhancement)</h3>
        <label>
          Concentrate API key
          <input
            type="password"
            placeholder="sk-cn-… (leave empty to use CONCENTRATE_API_KEY)"
            value={settings.concentrateApiKey}
            onChange={(event) => save({ concentrateApiKey: event.target.value })}
          />
        </label>
        <label>
          Model — anything in the{' '}
          <a href="https://concentrate.ai/models" target="_blank" rel="noreferrer">
            model fortress
          </a>{' '}
          works, including the free <code>gpt-oss-120b</code>
          <ModelSelect value={settings.model} onChange={(model) => save({ model })} />
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
