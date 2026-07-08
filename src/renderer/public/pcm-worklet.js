// AudioWorklet processor that forwards raw PCM frames to the main thread.
// Served as a static file because CSP `script-src 'self'` blocks blob: worklets.
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
