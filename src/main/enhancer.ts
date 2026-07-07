import Anthropic from '@anthropic-ai/sdk'
import { loadSettings } from './settings'
import type { Meeting } from '@shared/types'

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

export function enhanceMeeting(meeting: Meeting, callbacks: EnhanceCallbacks): { cancel: () => void } {
  const settings = loadSettings()
  // Zero-config fallback: the SDK resolves ANTHROPIC_API_KEY or an `ant auth login` profile
  const client = new Anthropic(settings.anthropicApiKey ? { apiKey: settings.anthropicApiKey } : {})

  const transcriptText = meeting.transcript
    .map((segment) => `[${formatTime(segment.t)}] ${segment.text}`)
    .join('\n')

  const userContent = `<my_rough_notes>
${meeting.notes.trim() || '(no notes taken)'}
</my_rough_notes>

<transcript>
${transcriptText || '(no transcript available)'}
</transcript>

Meeting title: ${meeting.title}

Write the enhanced meeting notes.`

  const stream = client.messages.stream({
    model: settings.model || 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }]
  })

  stream.on('text', (delta) => callbacks.onDelta(delta))

  stream
    .finalMessage()
    .then((message) => {
      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('')
      callbacks.onDone(text)
    })
    .catch((error: unknown) => {
      if (error instanceof Anthropic.APIError) {
        callbacks.onError(`Claude API error (${error.status}): ${error.message}`)
      } else if (error instanceof Error && error.name === 'AbortError') {
        // cancelled by the user — no error to surface
      } else {
        callbacks.onError(error instanceof Error ? error.message : String(error))
      }
    })

  return { cancel: () => stream.abort() }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
