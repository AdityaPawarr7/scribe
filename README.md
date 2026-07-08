<p align="center">
  <img src="assets/logo.svg" width="96" alt="Scribe — grains together" />
</p>

<h1 align="center">Scribe</h1>

<p align="center"><strong>Open-source AI meeting notes.</strong> Local transcription. Bring your own key. Any model.</p>

Record a meeting, take rough notes while you talk, and let AI merge them with the transcript into polished notes — the [Granola](https://granola.ai) workflow, but open source and local-first. Like the grains in the logo: your notes and the transcript are stronger together.

- **Local transcription** — audio is transcribed on your machine with [whisper.cpp](https://github.com/ggerganov/whisper.cpp). Your recordings never leave your laptop.
- **Your notes stay yours** — everything is stored as plain JSON + WAV on disk. No accounts, no backend, no sync servers.
- **Bring your own key 🔑** — no subscription, no middleman markup. Plug in one [Concentrate AI](https://concentrate.ai) key and get 150+ models through a single door — Claude, GPT, Gemini, and everything else in the [model fortress](https://concentrate.ai/models). Switch models from a dropdown right in the app. **No budget? Concentrate serves `gpt-oss-120b` for free**, so you can run Scribe end-to-end at $0.
- **Ask your notes 💬** — a built-in chat that answers questions across every meeting you've captured ("what did I promise last week?"), grounded in your notes library.
- **Make it yours** — dark/light liquid-glass themes, six accent colors, and font packs (System, Typewriter, Monospace, Serif), all in Settings.
- **Text-only egress** — enhancement and chat are the only steps that call an external API, and they send text, never audio.

## How it works

```
mic ──► 16kHz PCM ──► whisper.cpp (local) ──► live transcript ─┐
                                                               ├──► Concentrate AI ──► enhanced notes
you type rough notes during the meeting ──────────────────────┘        (model of your choice)
```

1. Hit **Record** when your meeting starts. Scribe captures your microphone and transcribes it locally in ~15-second chunks, so the transcript appears live.
2. Type fragments into **My notes** — just the things *you* care about. Don't try to keep up with the conversation; that's the transcript's job.
3. Hit **Stop** — that's it. The moment a recording ends, Scribe automatically merges your fragments with the transcript into clean, structured notes (toggle off in Settings if you prefer the manual ✦ button), refers to you by name instead of "the speaker", and titles the meeting from what was actually discussed.

## Getting started

Requirements: macOS, Node 20+, and whisper.cpp.

```sh
brew install whisper-cpp   # local transcription engine
git clone https://github.com/AdityaPawarr7/scribe && cd scribe
npm install
npm run dev
```

On first launch Scribe walks you through everything: downloading the speech model (one click, ~150MB, one-time), pasting your [Concentrate AI](https://concentrate.ai) key (`sk-cn-…`, or export `CONCENTRATE_API_KEY`), picking a model, and testing the connection — including a one-click "use the free model" path via `gpt-oss-120b`. The default model is `claude-opus-4.8`; switch anytime from the dropdown in the meeting header or Settings.

Then create a meeting and hit Record.

> **Note on capture:** v0.1 records your **microphone** only. For in-person meetings and calls on speaker this works out of the box. Capturing system audio (the other side of a headphones call) requires a native ScreenCaptureKit helper — it's the top item on the roadmap.

## Architecture

| Piece | Where | What |
|---|---|---|
| `src/main/transcriber.ts` | Electron main | Accumulates PCM, writes WAV, shells out to `whisper-cli` in rolling 15s chunks |
| `src/main/enhancer.ts` | Electron main | Streams the notes+transcript merge from Concentrate AI (`POST /v1/responses`, SSE — plain `fetch`, no SDK) |
| `src/main/concentrate.ts` | Electron main | Model fortress catalog (`GET /v1/models`) + connection test used by onboarding and the model dropdown |
| `src/main/store.ts` | Electron main | Meetings as plain JSON + WAV under the app's `userData` dir |
| `src/renderer/src/recorder.ts` | Renderer | Mic capture via `getUserMedia` + AudioWorklet at 16kHz |
| `src/renderer` | Renderer | React UI: meeting list, notes editor, live transcript, settings |

No database, no server, no native modules, zero runtime npm dependencies in the main process — the only binary dependency is `whisper-cli`, discovered on `PATH`/Homebrew or configurable in Settings.

## Roadmap

Scribe is meant to grow into a full open meeting workspace. Rough order:

- [ ] **System audio capture** (macOS ScreenCaptureKit helper) — hear both sides of a call
- [ ] Calendar integration — auto-create meetings from your calendar, attach attendees
- [ ] Note templates (1:1s, pitches, standups, user interviews)
- [x] Ask-your-meetings chat (Q&A across all your notes)
- [ ] Speaker diarization
- [ ] Share/export (Markdown, email, Notion, Slack)
- [ ] MCP server — expose your meeting notes to any AI agent
- [ ] Windows/Linux support
- [ ] Packaged releases (signed .dmg)

Contributions welcome — the codebase is intentionally small and boring.

## License

MIT
