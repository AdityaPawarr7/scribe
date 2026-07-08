import { loadSettings } from './settings'
import type { Meeting } from '@shared/types'

export const CONCENTRATE_URL = 'https://api.concentrate.ai/v1/responses'

const SYSTEM_PROMPT = `You are a meeting-notes editor. You receive a meeting transcript and the rough notes the user typed during the meeting. Produce a single polished set of meeting notes in Markdown.

Rules:
- The user's rough notes tell you what THEY cared about — treat every point in them as important, expand it with detail from the transcript, and keep their intent and any of their exact phrasing that carries meaning.
- Use the transcript to add context, correct details, and capture important points the user didn't have time to write down.
- Structure: start with a one-or-two-sentence summary, then clear sections with headers. Always include an "Action items" section if any commitments or follow-ups were made (with owners when identifiable) and a "Decisions" section if decisions were made. Omit either section if there is nothing for it.
- Be faithful: never invent facts, numbers, names, or commitments that appear in neither source. If the transcript is garbled somewhere, prefer the user's notes.
- Keep it scannable — short bullets over paragraphs.
- Output only the Markdown notes, no preamble.`

export interface EnhanceCallbacks {
  onDelta: (text: string) => void
  onDone: (fullText: string) => void
  onError: (message: string) => void
}

interface StreamEvent {
  type: string
  delta?: string
  code?: string
  message?: string
  response?: { incomplete_details?: { reason?: string } }
}

function buildUserContent(meeting: Meeting): string {
  const transcriptText = meeting.transcript
    .map((segment) => `[${formatTime(segment.t)}] ${segment.text}`)
    .join('\n')

  return `<my_rough_notes>
${meeting.notes.trim() || '(no notes taken)'}
</my_rough_notes>

<transcript>
${transcriptText || '(no transcript available)'}
</transcript>

Meeting title: ${meeting.title}

Write the enhanced meeting notes.`
}

export function enhanceMeeting(meeting: Meeting, callbacks: EnhanceCallbacks): { cancel: () => void } {
  const settings = loadSettings()
  const apiKey = settings.concentrateApiKey || process.env.CONCENTRATE_API_KEY || ''
  const controller = new AbortController()

  if (!apiKey) {
    // report asynchronously so the caller's registration flow matches the happy path
    queueMicrotask(() =>
      callbacks.onError(
        'No Concentrate API key — add one in Settings (or export CONCENTRATE_API_KEY)'
      )
    )
    return { cancel: () => controller.abort() }
  }

  void streamEnhancement(meeting, apiKey, settings.model, settings.userName, controller.signal, callbacks)
  return { cancel: () => controller.abort() }
}

async function streamEnhancement(
  meeting: Meeting,
  apiKey: string,
  model: string,
  userName: string,
  signal: AbortSignal,
  callbacks: EnhanceCallbacks
): Promise<void> {
  const instructions = userName
    ? `${SYSTEM_PROMPT}\n- The person who recorded this meeting and wrote the rough notes is named ${userName}. The transcript mostly captures their microphone. Refer to them as ${userName} — never "the speaker", "the user", or "the note-taker".`
    : SYSTEM_PROMPT
  let fullText = ''
  try {
    const response = await fetch(CONCENTRATE_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'claude-opus-4.8',
        instructions,
        input: buildUserContent(meeting),
        max_output_tokens: 16000,
        stream: true
      })
    })

    if (!response.ok || !response.body) {
      callbacks.onError(await describeHttpError(response))
      return
    }

    for await (const event of parseSse(response.body, signal)) {
      switch (event.type) {
        case 'response.output_text.delta':
          if (event.delta) {
            fullText += event.delta
            callbacks.onDelta(event.delta)
          }
          break
        case 'response.completed':
          callbacks.onDone(fullText)
          return
        case 'response.incomplete': {
          const reason = event.response?.incomplete_details?.reason ?? 'unknown reason'
          callbacks.onDone(fullText + `\n\n> ⚠️ Output was cut short (${reason}).`)
          return
        }
        case 'response.failed':
          callbacks.onError('The model failed to generate a response — try again or switch models in Settings')
          return
        case 'error':
          callbacks.onError(`Concentrate error (${event.code ?? 'unknown'}): ${event.message ?? ''}`)
          return
      }
    }
    // stream ended without a terminal event; keep whatever we got
    if (fullText) callbacks.onDone(fullText)
    else callbacks.onError('Stream ended unexpectedly with no output')
  } catch (error) {
    if (signal.aborted) return // cancelled by the user
    callbacks.onError(error instanceof Error ? error.message : String(error))
  }
}

/** Minimal SSE parser: yields the JSON payload of each `data:` line. */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          yield JSON.parse(payload) as StreamEvent
        } catch {
          // skip malformed keep-alive/partial lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function describeHttpError(response: Response): Promise<string> {
  const hints: Record<number, string> = {
    401: 'invalid API key',
    402: 'insufficient Concentrate credits',
    424: 'this model is currently unavailable — pick another in Settings',
    429: 'rate limited — try again shortly'
  }
  let detail = ''
  try {
    const parsed = (await response.json()) as { error?: { message?: string }; message?: string }
    detail = parsed.error?.message ?? parsed.message ?? ''
  } catch {
    // non-JSON error body
  }
  const hint = hints[response.status]
  return `Concentrate API ${response.status}${hint ? ` (${hint})` : ''}${detail ? `: ${detail}` : ''}`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Ask the model for a short title once notes exist. Returns null on any failure. */
export async function generateTitle(meeting: Meeting): Promise<string | null> {
  const settings = loadSettings()
  const apiKey = settings.concentrateApiKey || process.env.CONCENTRATE_API_KEY || ''
  if (!apiKey) return null

  const source = `${meeting.notes}\n${meeting.transcript.map((s) => s.text).join(' ')}`.slice(0, 6000)
  try {
    const response = await fetch(CONCENTRATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'claude-opus-4.8',
        instructions:
          'Title this meeting in 2-6 words based on what it was actually about. Reply with the title only — no quotes, no trailing punctuation.',
        input: source,
        max_output_tokens: 2000
      })
    })
    if (!response.ok) return null
    const parsed = (await response.json()) as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
    }
    const message = (parsed.output ?? []).find((item) => item.type === 'message')
    const title = (message?.content ?? [])
      .map((block) => block.text ?? '')
      .join('')
      .trim()
      .replace(/^["'\u201c]|["'\u201d.]$/g, '')
      .slice(0, 60)
    return title || null
  } catch {
    return null
  }
}
