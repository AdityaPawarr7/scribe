import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadSettings } from './settings'
import { CONCENTRATE_URL } from './enhancer'
import type { Meeting, VoiceProfileStatus } from '@shared/types'

/**
 * Voice profile: after each substantial meeting, quietly refine a local
 * profile.md describing how the user actually speaks — cadence, vocabulary,
 * signature phrases, how they open, push back, and close. This file is the
 * raw material for Scribe's upcoming dictation voice.
 *
 * It is a plain Markdown file the user can open, edit, or delete. It is
 * built from text only and never leaves the machine except as prompt text
 * to the user's own chosen model.
 */

const MIN_SEGMENTS = 6 // don't learn from throat-clearing

export function profilePath(): string {
  return join(app.getPath('userData'), 'profile.md')
}

function metaPath(): string {
  return join(app.getPath('userData'), 'profile-meta.json')
}

export function profileStatus(): VoiceProfileStatus {
  let meetingsAnalyzed = 0
  try {
    if (existsSync(metaPath())) {
      meetingsAnalyzed = (JSON.parse(readFileSync(metaPath(), 'utf8')) as { count?: number }).count ?? 0
    }
  } catch {
    // treat unreadable meta as a fresh profile
  }
  return { exists: existsSync(profilePath()), meetingsAnalyzed, path: profilePath() }
}

function extractText(parsed: {
  output?: Array<{ type?: string; content?: Array<{ text?: string }> }>
}): string {
  const message = (parsed.output ?? []).find((item) => item.type === 'message')
  return (message?.content ?? []).map((block) => block.text ?? '').join('')
}

export async function updateVoiceProfile(meeting: Meeting): Promise<boolean> {
  const settings = loadSettings()
  if (!settings.voiceProfile) return false
  const apiKey = settings.concentrateApiKey || process.env.CONCENTRATE_API_KEY || ''
  if (!apiKey) return false
  if (meeting.transcript.length < MIN_SEGMENTS) return false

  const existing = existsSync(profilePath()) ? readFileSync(profilePath(), 'utf8') : ''
  const who = settings.userName || 'the user'
  const transcript = meeting.transcript.map((segment) => segment.text).join('\n').slice(0, 16000)

  const instructions = `You maintain a VOICE PROFILE of ${who} — a living document describing how they actually speak, built up meeting by meeting. It will later drive a text-to-speech dictation feature, so precision about their real patterns matters more than flattery.

The transcript below is from ${who}'s microphone during a meeting (it may include some other voices — weigh recurring patterns, not one-offs).

${existing ? 'Update the existing profile below with evidence from the new transcript: reinforce what repeats, revise what contradicts, add what is new. Keep it stable — do not rewrite sections without evidence.' : 'Create the first version of the profile from this transcript. Where evidence is thin, say so rather than inventing.'}

Output ONLY the complete updated Markdown document in exactly this structure:

# Voice Profile — ${who}

## Voice & tone
(warm/direct/wry? formal register? energy level?)

## Pacing & delivery
(sentence length, pauses, filler words they actually use, how they emphasize)

## Vocabulary & signature phrases
(recurring words, verbal tics, phrases worth quoting verbatim)

## Conversational habits
(how they open topics, interrupt, agree, push back, wrap up)

## Sample lines
(3-5 short verbatim quotes that sound unmistakably like them)

Keep the whole document under 350 words. Plain, observational, specific.`

  try {
    const response = await fetch(CONCENTRATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: settings.model || 'claude-opus-4.8',
        instructions,
        input: `${existing ? `<current_profile>\n${existing}\n</current_profile>\n\n` : ''}<new_transcript>\n${transcript}\n</new_transcript>`,
        max_output_tokens: 4000
      })
    })
    if (!response.ok) return false
    const text = extractText((await response.json()) as never).trim()
    if (!text.startsWith('#')) return false

    writeFileSync(profilePath(), text + '\n')
    const previous = profileStatus().meetingsAnalyzed
    writeFileSync(metaPath(), JSON.stringify({ count: previous + 1, updatedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}
