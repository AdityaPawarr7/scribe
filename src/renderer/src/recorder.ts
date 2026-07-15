const TARGET_SAMPLE_RATE = 16000
/** batch ~0.5s of audio per IPC message */
const BATCH_SAMPLES = 8000

export interface CaptureResult {
  /** true when the other side of the call (system audio) is being heard too */
  systemAudio: boolean
}

/**
 * Records the whole conversation: the microphone (you) and — when available —
 * macOS loopback audio (everyone else: Meet, Zoom, FaceTime, any app that
 * makes sound). Both are summed by WebAudio into one 16kHz mono PCM stream
 * for whisper.cpp. If loopback is unavailable (permission not granted,
 * unsupported platform) we fall back to mic-only rather than failing.
 */
export class MicRecorder {
  private micStream: MediaStream | null = null
  private systemStream: MediaStream | null = null
  private context: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private pending: Float32Array[] = []
  private pendingSamples = 0

  constructor(private onChunk: (pcm16: ArrayBuffer) => void) {}

  async start(wantSystemAudio: boolean): Promise<CaptureResult> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    })

    // the other side of the call — main process answers this with loopback audio
    if (wantSystemAudio) {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
        display.getVideoTracks().forEach((track) => track.stop()) // audio is all we want
        if (display.getAudioTracks().length > 0) {
          this.systemStream = display
        }
      } catch {
        this.systemStream = null // mic-only fallback
      }
    }

    // A 16kHz context makes WebAudio resample everything for us,
    // which is exactly what whisper.cpp wants.
    this.context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
    await this.context.audioWorklet.addModule(
      new URL('pcm-worklet.js', document.baseURI).toString()
    )

    this.node = new AudioWorkletNode(this.context, 'pcm-capture')
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.pending.push(event.data)
      this.pendingSamples += event.data.length
      if (this.pendingSamples >= BATCH_SAMPLES) this.flush()
    }

    // connections to the same input sum — mic + system become one signal
    this.context.createMediaStreamSource(this.micStream).connect(this.node)
    if (this.systemStream) {
      this.context.createMediaStreamSource(this.systemStream).connect(this.node)
    }

    // AudioWorkletNode needs a destination to keep processing in some engines;
    // route through a zero-gain node so nothing is audible.
    const mute = this.context.createGain()
    mute.gain.value = 0
    this.node.connect(mute)
    mute.connect(this.context.destination)

    return { systemAudio: this.systemStream !== null }
  }

  private flush(): void {
    if (this.pendingSamples === 0) return
    const int16 = new Int16Array(this.pendingSamples)
    let offset = 0
    for (const block of this.pending) {
      for (let i = 0; i < block.length; i++) {
        const sample = Math.max(-1, Math.min(1, block[i]))
        int16[offset + i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      }
      offset += block.length
    }
    this.pending = []
    this.pendingSamples = 0
    this.onChunk(int16.buffer)
  }

  async stop(): Promise<void> {
    this.flush()
    this.node?.port.close()
    this.node?.disconnect()
    this.node = null
    this.micStream?.getTracks().forEach((track) => track.stop())
    this.micStream = null
    this.systemStream?.getTracks().forEach((track) => track.stop())
    this.systemStream = null
    if (this.context && this.context.state !== 'closed') {
      await this.context.close()
    }
    this.context = null
  }
}
