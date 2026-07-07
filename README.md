# 🥣 Muesli

**Open-source AI meeting notes.** Record a meeting, take rough notes while you talk, and let AI merge them with the transcript into polished notes — the [Granola](https://granola.ai) workflow, but open source and local-first.

- **Local transcription** — audio is transcribed on your machine with [whisper.cpp](https://github.com/ggerganov/whisper.cpp). Your recordings never leave your laptop.
- **Your notes stay yours** — everything is stored as plain JSON + WAV on disk. No accounts, no backend, no sync servers.
- **AI enhancement with Claude** — one click merges your rough notes with the transcript into structured notes (summary, decisions, action items). This is the only step that calls an external API, and it sends text only.

## How it works

```
mic ──► 16kHz PCM ──► whisper.cpp (local) ──► live transcript ─┐
                                                               ├──► Claude ──► enhanced notes
you type rough notes during the meeting ──────────────────────┘
```

1. Hit **Record** when your meeting starts. Muesli captures your microphone and transcribes it locally in ~15-second chunks, so the transcript appears live.
2. Type fragments into **My notes** — just the things *you* care about. Don't try to keep up with the conversation; that's the transcript's job.
3. Hit **✦ Enhance notes** when the meeting ends. Claude merges your fragments with the transcript into clean, structured notes.

## Getting started

Requirements: macOS, Node 20+, and whisper.cpp.

```sh
brew install whisper-cpp   # local transcription engine
git clone <this repo> && cd muesli
npm install
npm run dev
```

First run:

1. Open **Settings** (bottom of the sidebar).
2. Download the Whisper model (one click, ~150MB, one-time).
3. Add your Anthropic API key — or leave it empty if you have `ANTHROPIC_API_KEY` exported or are logged in via [`ant auth login`](https://platform.claude.com/docs/en/api/sdks/cli).

Then create a meeting and hit Record.

> **Note on capture:** v0.1 records your **microphone** only. For in-person meetings and calls on speaker this works out of the box. Capturing system audio (the other side of a headphones call) requires a native ScreenCaptureKit helper — it's the top item on the roadmap.

## Architecture

| Piece | Where | What |
|---|---|---|
| `src/main/transcriber.ts` | Electron main | Accumulates PCM, writes WAV, shells out to `whisper-cli` in rolling 15s chunks |
| `src/main/enhancer.ts` | Electron main | Streams the notes+transcript merge from the Claude API (`@anthropic-ai/sdk`) |
| `src/main/store.ts` | Electron main | Meetings as plain JSON + WAV under the app's `userData` dir |
| `src/renderer/src/recorder.ts` | Renderer | Mic capture via `getUserMedia` + AudioWorklet at 16kHz |
| `src/renderer` | Renderer | React UI: meeting list, notes editor, live transcript, settings |

No database, no server, no native modules — the only binary dependency is `whisper-cli`, discovered on `PATH`/Homebrew or configurable in Settings.

## Roadmap

Muesli is meant to grow into a full open meeting workspace. Rough order:

- [ ] **System audio capture** (macOS ScreenCaptureKit helper) — hear both sides of a call
- [ ] Calendar integration — auto-create meetings from your calendar, attach attendees
- [ ] Note templates (1:1s, pitches, standups, user interviews)
- [ ] Ask-your-meetings chat (search + Q&A across all transcripts)
- [ ] Speaker diarization
- [ ] Share/export (Markdown, email, Notion, Slack)
- [ ] MCP server — expose your meeting notes to any AI agent
- [ ] Windows/Linux support
- [ ] Packaged releases (signed .dmg)

Contributions welcome — the codebase is intentionally small and boring.

## License

MIT
