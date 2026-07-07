import { app } from 'electron'
import { execFile } from 'child_process'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { loadSettings, resolveWhisperBinary, resolveWhisperModel } from './settings'
import type { TranscriptSegment } from '@shared/types'

export const SAMPLE_RATE = 16000
/** transcribe in ~15s chunks so the transcript feels live */
const CHUNK_SECONDS = 15
const MIN_CHUNK_SAMPLES = SAMPLE_RATE // ignore chunks under 1s

export function writeWav(samples: Int16Array, path: string): void {
  const dataBytes = samples.length * 2
  const buffer = Buffer.alloc(44 + dataBytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBytes, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // fmt chunk size
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28) // byte rate
  buffer.writeUInt16LE(2, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBytes, 40)
  Buffer.from(samples.buffer, samples.byteOffset, dataBytes).copy(buffer, 44)
  writeFileSync(path, buffer)
}

function runWhisper(wavPath: string): Promise<string> {
  const settings = loadSettings()
  const binary = resolveWhisperBinary(settings)
  const model = resolveWhisperModel(settings)
  if (!binary) return Promise.reject(new Error('whisper-cli not found — set its path in Settings or `brew install whisper-cpp`'))
  if (!model) return Promise.reject(new Error('Whisper model not found — download it from Settings'))

  return new Promise((resolve, reject) => {
    execFile(
      binary,
      ['-m', model, '-f', wavPath, '-np', '-nt', '-l', settings.language || 'en'],
      { maxBuffer: 16 * 1024 * 1024, timeout: 120_000 },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout)
      }
    )
  })
}

function cleanTranscription(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\[?[_A-Z ]*BLANK[_A-Z ]*AUDIO\]?$/i.test(line))
    .map((line) => line.replace(/\[BLANK_AUDIO\]|\[MUSIC\]|\[SILENCE\]|\(.*?applause.*?\)/gi, '').trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}

/**
 * Accumulates 16kHz mono PCM for one recording session, transcribing in
 * rolling chunks and keeping the full take for the final audio file.
 */
export class RecordingSession {
  private chunks: Int16Array[] = []
  private totalSamples = 0
  private transcribedSamples = 0
  private busy = false
  private stopped = false
  readonly startedAt = Date.now()

  constructor(
    readonly meetingId: string,
    private onSegment: (segment: TranscriptSegment) => void,
    private onError: (message: string) => void
  ) {}

  addChunk(chunk: Int16Array): void {
    if (this.stopped) return
    this.chunks.push(chunk)
    this.totalSamples += chunk.length
    if (this.totalSamples - this.transcribedSamples >= CHUNK_SECONDS * SAMPLE_RATE) {
      void this.flush()
    }
  }

  get durationSec(): number {
    return this.totalSamples / SAMPLE_RATE
  }

  private takeSamples(start: number, end: number): Int16Array {
    const out = new Int16Array(end - start)
    let cursor = 0
    let copied = 0
    for (const chunk of this.chunks) {
      const chunkStart = cursor
      const chunkEnd = cursor + chunk.length
      if (chunkEnd > start && chunkStart < end) {
        const from = Math.max(start, chunkStart) - chunkStart
        const to = Math.min(end, chunkEnd) - chunkStart
        out.set(chunk.subarray(from, to), copied)
        copied += to - from
      }
      cursor = chunkEnd
      if (cursor >= end) break
    }
    return out
  }

  private async flush(): Promise<void> {
    if (this.busy) return
    const start = this.transcribedSamples
    const end = this.totalSamples
    if (end - start < MIN_CHUNK_SAMPLES) return

    this.busy = true
    this.transcribedSamples = end
    const wavPath = join(app.getPath('temp'), `muesli-chunk-${this.meetingId}-${start}.wav`)
    try {
      writeWav(this.takeSamples(start, end), wavPath)
      const text = cleanTranscription(await runWhisper(wavPath))
      if (text) {
        this.onSegment({ t: Math.round(start / SAMPLE_RATE), text })
      }
    } catch (error) {
      this.onError(error instanceof Error ? error.message : String(error))
    } finally {
      rmSync(wavPath, { force: true })
      this.busy = false
      // more audio may have arrived while whisper was running
      if (!this.stopped && this.totalSamples - this.transcribedSamples >= CHUNK_SECONDS * SAMPLE_RATE) {
        void this.flush()
      }
    }
  }

  /** Transcribe the tail, then write the full recording to `audioOutPath`. */
  async stop(audioOutPath: string): Promise<number> {
    this.stopped = true
    // wait for any in-flight chunk
    while (this.busy) {
      await new Promise((r) => setTimeout(r, 200))
    }
    const remaining = this.totalSamples - this.transcribedSamples
    if (remaining >= MIN_CHUNK_SAMPLES) {
      this.stopped = false
      this.busy = false
      const forceFlush = this.flush()
      this.stopped = true
      await forceFlush
      while (this.busy) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    mkdirSync(join(audioOutPath, '..'), { recursive: true })
    writeWav(this.takeSamples(0, this.totalSamples), audioOutPath)
    return this.durationSec
  }
}
