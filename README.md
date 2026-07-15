<p align="center">
  <img src="assets/logo.svg" width="96" alt="Scribe — grains together" />
</p>

<h1 align="center">Scribe</h1>

<p align="center"><strong>AI meeting notes that answer to you, not a server.</strong><br/>Free. Open source. Runs on your Mac.</p>

## You're in control

Your meetings are some of the most sensitive information you produce — who you talked to, what was promised, what you really think. Scribe's position is simple: **that information belongs on your machine, under your control.**

- **Recording and transcription happen locally.** Audio is captured and transcribed on your Mac with whisper.cpp. No audio is ever uploaded, to us or anyone — there is no "us"; Scribe has no servers, no accounts, no telemetry.
- **Your data is just files.** Every meeting is plain JSON + WAV on your disk. Read them, back them up, grep them, delete them. No export button needed because nothing was ever taken from you.
- **Free, forever.** Scribe is MIT-licensed open source. No subscription, no seat pricing, no premium tier. The only cost is the AI you choose to use — and even that can be $0.
- **You choose the AI — or none.** Enhancement is bring-your-own-key through [Concentrate AI](https://concentrate.ai), and it sends text only, never audio.

Record a meeting, type rough fragments while you talk, and when you hit Stop, AI merges your notes with the transcript into polished, structured notes — like the grains in the logo: stronger together.

## What it does

- **Live local transcription** — [whisper.cpp](https://github.com/ggerganov/whisper.cpp) turns speech to text on-device while the meeting runs.
- **Hears the whole call** — captures your mic **and** system audio (macOS ScreenCaptureKit loopback), so Google Meet, Zoom, FaceTime, Teams — any call, any app — is transcribed from both sides. No virtual audio drivers.
- **Pulse ✦** — every 5 minutes of a live call, Scribe surfaces the actionable points so far and the sharpest questions to ask next, right beside the transcript.
- **Voice profile** — after real meetings, Scribe refines a local `profile.md` describing how you actually speak (pacing, phrases, habits) — the foundation for the upcoming dictation feature. Plain Markdown, on your disk, yours to edit or delete.
- **Auto-notes** — the moment a recording stops, your fragments + the transcript become clean structured notes (summary, decisions, action items), the meeting titles itself, and notes refer to you by name.
- **Ask your notes 💬** — built-in chat over every meeting you've captured: "what did I promise last week?"
- **One key, 150+ models 🔑** — powered by [Concentrate AI](https://concentrate.ai), the cleanest way we've found to be model-agnostic: one API key, one endpoint, and Claude, GPT, Gemini plus 150 more in their [model fortress](https://concentrate.ai/models), swappable from a dropdown in the app. Their free `gpt-oss-120b` tier means Scribe runs end-to-end at **$0**.
- **Make it yours** — dark/light liquid-glass themes, six accent colors, four font packs.

## How it works

```
mic ──► 16kHz PCM ──► whisper.cpp (local) ──► live transcript ─┐
                                                               ├──► Concentrate AI ──► enhanced notes
you type rough notes during the meeting ──────────────────────┘        (model of your choice)
```

1. Hit **Record** when your meeting starts. Scribe captures your microphone and transcribes it locally in ~15-second chunks, so the transcript appears live.
2. Type fragments into **My notes** — just the things *you* care about. Don't try to keep up with the conversation; that's the transcript's job.
3. Hit **Stop** — that's it. The moment a recording ends, Scribe automatically merges your fragments with the transcript into clean, structured notes (toggle off in Settings if you prefer the manual ✦ button), refers to you by name instead of "the speaker", and titles the meeting from what was actually discussed.

## Install

**[⬇ Download Scribe for macOS (Apple Silicon)](https://github.com/AdityaPawarr7/scribe/releases/latest)** — open the `.dmg`, drag Scribe to Applications.

Two notes for the first launch:

- Scribe is a community build and isn't code-signed yet, so macOS will warn you the first time: **right-click the app → Open → Open**. (Once, ever.)
- Local transcription needs whisper.cpp: `brew install whisper-cpp`, then download the speech model from Scribe's onboarding or Settings.

### Or run from source

Requirements: macOS, Node 20+, and whisper.cpp.

```sh
brew install whisper-cpp   # local transcription engine
git clone https://github.com/AdityaPawarr7/scribe && cd scribe
npm install
npm run dev                # develop
npm run dist               # build your own installable .app/.dmg
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

## Where this is going

Meetings are just the start. Future releases will plug Scribe into **Outlook, Google Calendar & Gmail, Apple Calendar & Notes, Zoom, Meet, and Teams** — growing it into an **ecosystem agent that keeps track of your life**: it knows what's coming up, captures what happened, remembers what was promised, and answers for all of it. Same rules as today: local-first, your keys, your files, free.

Rough order:

- [ ] **System audio capture** (macOS ScreenCaptureKit helper) — hear both sides of a call
- [ ] Calendar + mail integration (Outlook, Google, Apple) — meetings appear before they start, attendees attached
- [ ] Zoom / Meet / Teams awareness — know what call you're on, capture both sides
- [ ] The ecosystem agent — one place that tracks commitments, people, and follow-ups across your life
- [ ] Note templates (1:1s, pitches, standups, user interviews)
- [x] Ask-your-meetings chat (Q&A across all your notes)
- [ ] Speaker diarization
- [ ] Share/export (Markdown, email, Notion, Slack)
- [ ] MCP server — expose your meeting notes to any AI agent
- [ ] Windows/Linux support
- [x] Packaged releases (.dmg — signing/notarization still to come)

Contributions welcome — the codebase is intentionally small and boring.

## License

MIT
