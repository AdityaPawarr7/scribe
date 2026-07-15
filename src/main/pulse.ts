import { loadSettings } from './settings'
import { CONCENTRATE_URL } from './enhancer'
import type { Meeting, PulseNote } from '@shared/types'

/**
 * Pulse: every few minutes of a live call, read the transcript so far and
 * surface what matters *right now* — things worth acting on, and the
 * questions that would move the conversation forward.
 */

function extractText(parsed: {
  output?: Array<{ type?: string; content?: Array<{ text?: string }> }>
}): string {
  const message = (parsed.output ?? []).find((item) => item.type === 'message')
  return (message?.content ?? []).map((block) => block.text ?? '').join('')
}

/** models sometimes wrap JSON in prose or code fences — dig it out */
function parseLenient(raw: string): { summary?: string; actions?: string[]; questions?: string[] } | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function generatePulse(meeting: Meeting): Promise<PulseNote | null> {
  const settings = loadSettings()
  const apiKey = settings.concentrateApiKey || process.env.CONCENTRATE_API_KEY || ''
  if (!apiKey) return null

  const transcript = meeting.transcript
    .map((segment) => `[${Math.floor(segment.t / 60)}:${String(Math.floor(segment.t % 60)).padStart(2, '0')}] ${segment.text}`)
    .join('\n')
  if (!transcript) return null

  const who = settings.userName || 'the user'
  const instructions = `You are a live meeting copilot for ${who}. You receive the transcript of a call that is STILL IN PROGRESS, plus ${who}'s rough notes. Your job: help ${who} steer the rest of the call well.

Reply with ONLY a JSON object, no prose, in this exact shape:
{"summary": "<one sentence: where the conversation is right now>", "actions": ["<concrete actionable point surfaced so far>", ...], "questions": ["<a sharp question ${who} should ask next to move the call forward or close a gap>", ...]}

Rules:
- 1-3 actions, 1-3 questions. Fewer, sharper items beat many vague ones.
- Actions are things already said or implied that deserve follow-through.
- Questions must be askable RIGHT NOW in this call — specific to what was said, not generic.
- If the transcript is thin or idle chatter, return smaller lists — never pad.`

  const input = `<rough_notes>\n${meeting.notes.trim() || '(none yet)'}\n</rough_notes>\n\n<transcript_so_far>\n${transcript.slice(-14000)}\n</transcript_so_far>`

  try {
    const response = await fetch(CONCENTRATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'claude-opus-4.8',
        instructions,
        input,
        max_output_tokens: 3000
      })
    })
    if (!response.ok) return null
    const parsed = parseLenient(extractText((await response.json()) as never))
    if (!parsed) return null

    const lastSegment = meeting.transcript[meeting.transcript.length - 1]
    const pulse: PulseNote = {
      t: lastSegment ? Math.round(lastSegment.t) : 0,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      actions: Array.isArray(parsed.actions) ? parsed.actions.filter((a) => typeof a === 'string').slice(0, 3) : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions.filter((q) => typeof q === 'string').slice(0, 3) : []
    }
    if (pulse.actions.length === 0 && pulse.questions.length === 0) return null
    return pulse
  } catch {
    return null
  }
}
