import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execFileSync } from 'child_process'
import { join } from 'path'
import type { Settings, WhisperStatus } from '@shared/types'

const DEFAULTS: Settings = {
  concentrateApiKey: '',
  model: 'claude-opus-4.8',
  whisperBinaryPath: '',
  whisperModelPath: '',
  language: 'en',
  onboardingComplete: false,
  userName: '',
  autoEnhance: true,
  theme: 'dark',
  accent: '#5ee0c4',
  fontPack: 'system'
}

const WHISPER_CANDIDATES = [
  '/opt/homebrew/bin/whisper-cli',
  '/usr/local/bin/whisper-cli',
  '/opt/homebrew/bin/whisper-cpp',
  '/usr/local/bin/whisper-cpp'
]

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  try {
    if (existsSync(settingsPath())) {
      const stored = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<Settings> & {
        model?: string
      }
      // pre-Concentrate settings used Anthropic's dash-style IDs (claude-opus-4-8);
      // the Concentrate fortress uses dots (claude-opus-4.8)
      if (stored.model) {
        stored.model = stored.model.replace(
          /^claude-(opus|sonnet|haiku)-(\d)-(\d)$/,
          'claude-$1-$2.$3'
        )
      }
      return { ...DEFAULTS, ...stored }
    }
  } catch {
    // corrupt settings file — fall back to defaults
  }
  return { ...DEFAULTS }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch }
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  return next
}

export function defaultModelPath(): string {
  return join(app.getPath('userData'), 'models', 'ggml-base.en.bin')
}

export function resolveWhisperBinary(settings: Settings): string {
  if (settings.whisperBinaryPath && existsSync(settings.whisperBinaryPath)) {
    return settings.whisperBinaryPath
  }
  for (const candidate of WHISPER_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }
  try {
    const found = execFileSync('/usr/bin/which', ['whisper-cli'], { encoding: 'utf8' }).trim()
    if (found) return found
  } catch {
    // not on PATH
  }
  return ''
}

export function resolveWhisperModel(settings: Settings): string {
  if (settings.whisperModelPath && existsSync(settings.whisperModelPath)) {
    return settings.whisperModelPath
  }
  if (existsSync(defaultModelPath())) return defaultModelPath()
  return ''
}

export function whisperStatus(): WhisperStatus {
  const settings = loadSettings()
  const binaryPath = resolveWhisperBinary(settings)
  const modelPath = resolveWhisperModel(settings)
  return {
    binaryFound: binaryPath !== '',
    binaryPath,
    modelFound: modelPath !== '',
    modelPath: modelPath || defaultModelPath()
  }
}
