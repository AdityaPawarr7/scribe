const TARGET_SAMPLE_RATE = 16000
/** batch ~0.5s of audio per IPC message */
const BATCH_SAMPLES = 8000

const WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length > 0) {
      this.port.postMessage(channel.slice(0))
    }
    return true
  }
}
registerProcessor('pcm-capture', PcmCaptureProcessor)
`

export class MicRecorder {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private pending: Float32Array[] = []
  private pendingSamples = 0

  constructor(private onChunk: (pcm16: ArrayBuffer) => void) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      }
    })

    // A 16kHz context makes WebAudio resample the mic input for us,
    // which is exactly what whisper.cpp wants.
    this.context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
    const workletUrl = URL.createObjectURL(
      new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
    )
    try {
      await this.context.audioWorklet.addModule(workletUrl)
    } finally {
      URL.revokeObjectURL(workletUrl)
    }

    const source = this.context.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.context, 'pcm-capture')
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.pending.push(event.data)
      this.pendingSamples += event.data.length
      if (this.pendingSamples >= BATCH_SAMPLES) this.flush()
    }
    source.connect(this.node)
    // AudioWorkletNode needs a destination to keep processing in some engines;
    // route through a zero-gain node so nothing is audible.
    const mute = this.context.createGain()
    mute.gain.value = 0
    this.node.connect(mute)
    mute.connect(this.context.destination)
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
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    if (this.context && this.context.state !== 'closed') {
      await this.context.close()
    }
    this.context = null
  }
}
