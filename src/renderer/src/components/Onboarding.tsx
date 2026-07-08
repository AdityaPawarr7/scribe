import { useEffect, useState } from 'react'
import type { ConnectionTestResult, ModelDownloadProgress, WhisperStatus } from '../env'
import Logo from './Logo'
import ModelSelect from './ModelSelect'

interface Props {
  onDone: () => void
}

const STEPS = ['Welcome', 'Transcription', 'Your key'] as const

export default function Onboarding(props: Props): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<WhisperStatus | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-opus-4.8')
  const [userName, setUserName] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)

  useEffect(() => {
    void window.scribe.whisper.status().then(setStatus)
    void window.scribe.settings.get().then((settings) => {
      if (settings.concentrateApiKey) setApiKey(settings.concentrateApiKey)
      if (settings.model) setModel(settings.model)
      if (settings.userName) setUserName(settings.userName)
    })
    return window.scribe.on('whisper:downloadProgress', (p: ModelDownloadProgress) => {
      setProgress(p)
      if (p.done) setDownloading(false)
    })
  }, [])

  const downloadWhisperModel = async (): Promise<void> => {
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

  const saveKey = (value: string): void => {
    setApiKey(value)
    setTestResult(null)
    void window.scribe.settings.set({ concentrateApiKey: value })
  }

  const saveName = (value: string): void => {
    setUserName(value)
    void window.scribe.settings.set({ userName: value })
  }

  const saveModel = (value: string): void => {
    setModel(value)
    setTestResult(null)
    void window.scribe.settings.set({ model: value })
  }

  const runTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await window.scribe.concentrate.test(model))
    } finally {
      setTesting(false)
    }
  }

  const finish = (): void => {
    void window.scribe.settings.set({ onboardingComplete: true })
    props.onDone()
  }

  const useFreeModel = (): void => {
    saveModel('gpt-oss-120b')
  }

  const whisperReady = Boolean(status?.binaryFound && status?.modelFound)
  const pct =
    progress && progress.totalBytes > 0
      ? Math.round((progress.receivedBytes / progress.totalBytes) * 100)
      : null

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-dots">
          {STEPS.map((label, index) => (
            <button
              key={label}
              className={`dot ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}
              title={label}
              onClick={() => setStep(index)}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="onboarding-step">
            <div className="grain-hero">
              <Logo size={96} />
            </div>
            <h1>Welcome to Scribe</h1>
            <p className="onboarding-tagline">
              Open-source meeting notes. Like the grains in the logo — your rough notes and the
              transcript are stronger together.
            </p>
            <div className="onboarding-features">
              <div className="feature">
                <span className="feature-emoji">🎙️</span>
                <strong>Private by default</strong>
                <span>Audio is transcribed on your Mac with whisper.cpp — recordings never leave it.</span>
              </div>
              <div className="feature">
                <span className="feature-emoji">🔑</span>
                <strong>Bring your own key</strong>
                <span>No accounts, no subscription, no middleman markup. Your key, your models, your data.</span>
              </div>
              <div className="feature">
                <span className="feature-emoji">📝</span>
                <strong>Notes, enhanced</strong>
                <span>Type fragments during the meeting; AI merges them with the transcript into polished notes.</span>
              </div>
            </div>
            <label className="name-field">
              What's your name? Your notes will say “{userName.trim() || 'you'} agreed to…” instead
              of “the speaker”.
              <input
                type="text"
                placeholder="Your first name"
                value={userName}
                onChange={(event) => saveName(event.target.value)}
              />
            </label>
            <button className="primary onboarding-next" onClick={() => setStep(1)}>
              Set me up →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <h1>Local transcription</h1>
            <p className="onboarding-tagline">
              Scribe uses <strong>whisper.cpp</strong> to turn speech into text entirely on this
              machine.
            </p>
            <div className={`status-row ${status?.binaryFound ? 'ok' : 'missing'}`}>
              {status?.binaryFound
                ? `✓ whisper-cli found at ${status.binaryPath}`
                : '✕ whisper-cli not found — run: brew install whisper-cpp'}
            </div>
            <div className={`status-row ${status?.modelFound ? 'ok' : 'missing'}`}>
              {status?.modelFound
                ? `✓ Speech model ready`
                : '✕ Speech model not downloaded yet (one-time, ~150MB)'}
            </div>
            {!status?.modelFound && status?.binaryFound && (
              <button
                className="primary"
                disabled={downloading}
                onClick={() => void downloadWhisperModel()}
              >
                {downloading ? (pct !== null ? `Downloading… ${pct}%` : 'Downloading…') : 'Download speech model'}
              </button>
            )}
            {progress?.error && (
              <div className="status-row missing">Download failed: {progress.error}</div>
            )}
            <button className="primary onboarding-next" onClick={() => setStep(2)}>
              {whisperReady ? 'Next →' : 'I’ll do this later →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <h1>Bring your own key</h1>
            <p className="onboarding-tagline">
              Scribe is BYOK: you plug in one API key from{' '}
              <a href="https://concentrate.ai" target="_blank" rel="noreferrer">
                Concentrate AI
              </a>{' '}
              and get every major model through a single door — Claude, GPT, Gemini and 150 more in
              their{' '}
              <a href="https://concentrate.ai/models" target="_blank" rel="noreferrer">
                model fortress
              </a>
              . Switch anytime; pay only for what you use.
            </p>
            <label>
              Concentrate API key
              <input
                type="password"
                placeholder="sk-cn-…"
                value={apiKey}
                onChange={(event) => saveKey(event.target.value)}
              />
            </label>
            <label>
              Model for enhancing notes
              <ModelSelect value={model} onChange={saveModel} />
            </label>
            <div className="free-callout">
              💸 No budget today? Concentrate serves <code>gpt-oss-120b</code> for{' '}
              <strong>free</strong> —{' '}
              <button type="button" className="link-button" onClick={useFreeModel}>
                use the free model
              </button>{' '}
              and upgrade whenever.
            </div>
            <div className="test-row">
              <button
                className="secondary"
                disabled={!apiKey || testing}
                onClick={() => void runTest()}
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {testResult && (
                <span className={`status-row ${testResult.ok ? 'ok' : 'missing'}`}>
                  {testResult.ok ? '✓' : '✕'} {testResult.message}
                </span>
              )}
            </div>
            <button className="primary onboarding-next" onClick={finish}>
              Start taking notes →
            </button>
          </div>
        )}

        <button className="onboarding-skip" onClick={finish}>
          Skip setup
        </button>
      </div>
    </div>
  )
}
