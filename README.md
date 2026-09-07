# BounceDeck

**A local-first music player, reactive visualizer, and AI listening companion.**

BounceDeck is the software-first prototype for a modern music appliance inspired by the tactile joy of classic desktop players and reactive visualizers. The player stays deterministic and local. The companion is an optional layer that receives bounded listening context instead of owning playback.

## v0.1 foundation

- Local drag/drop audio playback
- MP3 / WAV / FLAC / OGG-style browser-supported formats
- Playlist with next/previous navigation
- Seek, volume, and real three-band Web Audio EQ
- FFT spectrum visualizer
- Oscilloscope visualizer
- Orbital reactive visualizer
- Full Electron desktop shell
- Companion chat with Bro / Listener / Producer personalities
- Chattiness control
- Bounded audio-analysis snapshots (low, mid, high, RMS)
- OpenAI-compatible LLM bridge in Electron main process
- Honest local-listener fallback when no LLM is configured

## Run it

Requirements: Node 20.19+.

```bash
npm install
npm run dev
```

The first playback click creates the Web Audio graph, which keeps browser autoplay policy happy.

### Production-style local run

```bash
npm run desktop
```

This builds Vite into `dist/` and opens the Electron shell against the generated files.

## Give the listening buddy an LLM

**Do not put provider keys in Vite variables or renderer source.** BounceDeck reads provider configuration only in Electron's main process.

OpenAI-compatible cloud endpoint, PowerShell example:

```powershell
$env:BOUNCEDECK_LLM_MODEL="your-model-name"
$env:BOUNCEDECK_LLM_API_KEY="your-key"
$env:BOUNCEDECK_LLM_BASE_URL="https://api.openai.com/v1"
npm run dev
```

Local OpenAI-compatible endpoint (for example a local server exposing `/v1/chat/completions`):

```powershell
$env:BOUNCEDECK_LLM_MODEL="your-local-model"
$env:BOUNCEDECK_LLM_BASE_URL="http://127.0.0.1:11434/v1"
npm run dev
```

The key is optional for local endpoints that do not require one.

### What the companion receives

The companion receives only a bounded context packet from the renderer:

- track display name
- playback timestamp and duration
- low / mid / high normalized spectral energy
- RMS level
- selected personality and chattiness
- recent companion conversation
- your current message

It does **not** receive the raw audio file. The system prompt explicitly tells remote models not to pretend otherwise.

## Design rule

```text
Local Files
    │
    ▼
Audio Engine ──► Analyzer ──► Visualizers
    │                │
    │                └──────► bounded listening snapshot
    │                                │
    ▼                                ▼
Transport / EQ                 Companion bridge
                                     │
                              local fallback or LLM
```

The companion does not get direct playback authority in v0.1.

## Next targets

See [`docs/ROADMAP.md`](docs/ROADMAP.md).
