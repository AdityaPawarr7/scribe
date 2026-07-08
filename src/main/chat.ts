import { loadSettings } from './settings'
import { listMeetings, getMeeting } from './store'
import { CONCENTRATE_URL, parseSse, describeHttpError } from './enhancer'
import type { ChatTurn } from '@shared/types'

/** keep the notes library within a sane prompt size */
const MAX_CORPUS_CHARS = 80_000

export interface ChatCallbacks {
  onDelta: (text: string) => void
  onDone: (fullText: string) => void
  onError: (message: string) => void
}

function buildCorpus(): string {
  const sections: string[] = []
  let used = 0
  for (const summary of listMeetings()) {
    const meeting = getMeeting(summary.id)
    if (!meeting) continue
    const body =
      meeting.enhancedNotes.trim() ||
      meeting.notes.trim() ||
      meeting.transcript.map((segment) => segment.text).join(' ')
    if (!body) continue
    const date = new Date(meeting.createdAt).toLocaleString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
    const section = `## ${meeting.title} — ${date}\n${body}\n`
    if (used + section.length > MAX_CORPUS_CHARS) break
    sections.push(section)
    used += section.length
  }
  return sections.join('\n')
}

export function askChat(
  question: string,
  history: ChatTurn[],
  callbacks: ChatCallbacks
): { cancel: () => void } {
  const settings = loadSettings()
  const apiKey = settings.concentrateApiKey || process.env.CONCENTRATE_API_KEY || ''
  const controller = new AbortController()

  if (!apiKey) {
    queueMicrotask(() => callbacks.onError('No API key — add one in Settings'))
    return { cancel: () => controller.abort() }
  }

  const who = settings.userName ? ` The user's name is ${settings.userName}.` : ''
  const instructions = `You are Scribe's notes assistant.${who} Answer questions using only the meeting notes library provided. Mention which meeting (title and date) information comes from. If the notes don't contain the answer, say so plainly. Be concise; use Markdown.`

  const conversation = history
    .slice(-12)
    .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`)
    .join('\n\n')

  const input = `<notes_library>
${buildCorpus() || '(no meetings with content yet)'}
</notes_library>

${conversation ? `Conversation so far:\n${conversation}\n\n` : ''}User: ${question}`

  void stream(input, instructions, apiKey, settings.model, controller.signal, callbacks)
  return { cancel: () => controller.abort() }
}

async function stream(
  input: string,
  instructions: string,
  apiKey: string,
  model: string,
  signal: AbortSignal,
  callbacks: ChatCallbacks
): Promise<void> {
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
        input,
        max_output_tokens: 8000,
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
        case 'response.incomplete':
          callbacks.onDone(fullText)
          return
        case 'response.failed':
        case 'error':
          callbacks.onError(event.message ?? 'The model failed to answer — try again')
          return
      }
    }
    if (fullText) callbacks.onDone(fullText)
    else callbacks.onError('Stream ended unexpectedly')
  } catch (error) {
    if (signal.aborted) return
    callbacks.onError(error instanceof Error ? error.message : String(error))
  }
}
