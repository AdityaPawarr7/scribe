import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { Meeting, MeetingSummary } from '@shared/types'

function meetingsDir(): string {
  const dir = join(app.getPath('userData'), 'meetings')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function meetingDir(id: string): string {
  return join(meetingsDir(), id)
}

export function audioPath(id: string): string {
  return join(meetingDir(id), 'audio.wav')
}

function meetingJsonPath(id: string): string {
  return join(meetingDir(id), 'meeting.json')
}

export function listMeetings(): MeetingSummary[] {
  const summaries: MeetingSummary[] = []
  for (const id of readdirSync(meetingsDir())) {
    try {
      const meeting = getMeeting(id)
      if (meeting) {
        summaries.push({
          id: meeting.id,
          title: meeting.title,
          createdAt: meeting.createdAt,
          durationSec: meeting.durationSec
        })
      }
    } catch {
      // skip unreadable entries
    }
  }
  return summaries.sort((a, b) => b.createdAt - a.createdAt)
}

export function getMeeting(id: string): Meeting | null {
  const path = meetingJsonPath(id)
  if (!existsSync(path)) return null
  const meeting = JSON.parse(readFileSync(path, 'utf8')) as Meeting
  if (!Array.isArray(meeting.pulses)) meeting.pulses = [] // pre-Pulse meetings
  return meeting
}

export function createMeeting(): Meeting {
  const now = Date.now()
  const meeting: Meeting = {
    id: randomUUID(),
    title: 'Untitled',
    createdAt: now,
    updatedAt: now,
    notes: '',
    transcript: [],
    enhancedNotes: '',
    durationSec: 0,
    hasAudio: false,
    pulses: []
  }
  saveMeeting(meeting)
  return meeting
}

export function saveMeeting(meeting: Meeting): void {
  meeting.updatedAt = Date.now()
  mkdirSync(meetingDir(meeting.id), { recursive: true })
  writeFileSync(meetingJsonPath(meeting.id), JSON.stringify(meeting, null, 2))
}

export function updateMeeting(id: string, patch: Partial<Meeting>): Meeting | null {
  const meeting = getMeeting(id)
  if (!meeting) return null
  const next = { ...meeting, ...patch, id: meeting.id }
  saveMeeting(next)
  return next
}

export function deleteMeeting(id: string): void {
  rmSync(meetingDir(id), { recursive: true, force: true })
}
