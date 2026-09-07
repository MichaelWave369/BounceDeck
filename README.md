# BounceDeck

**A local-first music player, reactive visualizer, and AI listening companion.**

BounceDeck is the software-first prototype for a modern music appliance inspired by the tactile joy of classic desktop players and reactive visualizers. Playback remains deterministic and local. The companion is optional and receives bounded listening context instead of owning the player.

## Try the web deck

The GitHub Pages build is designed to run directly in the browser at:

**https://michaelwave369.github.io/BounceDeck/**

The web deck supports local drag/drop audio, EQ, spectrum/scope/orbital/Plasma visualizers, fullscreen mode, Media Session controls, saved browser settings, and the honest local listening companion.

Browser mode is deliberately **session-only** for music files. It does not receive persistent filesystem authority and it does not upload your audio. Persistent folder indexing and the configured remote/local LLM bridge remain desktop Electron capabilities.

## v0.2 current build

### Music deck

- Local drag/drop session audio
- Persistent folder-backed music library in Electron
- Browser-only GitHub Pages session deck
- MP3 / WAV / FLAC / OGG / M4A / AAC / Opus-style local formats
- Stable track IDs across library re-sorts and rescans
- Play/pause, previous/next, seek, volume
- Real three-band Web Audio EQ
- Saved volume, EQ, visualizer, personality, and chattiness settings
- OS/browser Media Session integration for play/pause, seek, previous, and next

### Visual system

- **Plasma**: original WebGL fragment shader driven by low/mid/high/RMS analyzer values
- FFT spectrum visualizer
- Oscilloscope visualizer
- Orbital reactive visualizer
- Fullscreen visualizer mode

### Listening companion

- Bro / Listener / Producer personalities
- Chattiness control
- Current track + timestamp context
- Normalized low / mid / high energy + RMS
- Short rolling analyzer trend summary
- OpenAI-compatible LLM bridge in Electron main process
- Honest local-listener fallback in Electron or the browser when no LLM is configured

## Desktop persistent-library boundary

Persistent folders are selected through bounded Electron IPC. Electron stores the private library index under its app-data directory and gives the renderer only public track records.

```text
Music folders
     │
     ▼
Electron library index
     │
     ├── absolute paths stay here
     │
     └── track id ──► bounce-media://track/<id>
                            │
                            ▼
                       Audio Engine
```

The renderer does **not** receive absolute filesystem paths for indexed tracks. The custom media protocol resolves only track IDs already present in the main-process library map. Its scheme privileges are restricted to secure, standard streaming behavior; renderer Fetch API access is intentionally not enabled.

Filename metadata currently recognizes the common `Artist - Title.ext` convention. Full tag parsing, album fields, and embedded artwork remain future work.

## Run it locally

Requirements: Node 20.19+.

```bash
npm install
npm run dev
```

The first playback click creates the Web Audio graph, which keeps browser autoplay policy happy.

### Production-style desktop run

```bash
npm run desktop
```

This builds Vite into `dist/` and opens the Electron shell against the generated files.

### Browser / Pages build

```bash
npm run build:pages
npm run preview
```

GitHub Pages deployment is handled by `.github/workflows/pages.yml` after Pages is configured to use **GitHub Actions** as its source. Pushes to `main` then build and deploy the `dist/` artifact automatically.

## Give the desktop listening buddy an LLM

**Do not put provider keys in Vite variables or renderer source.** BounceDeck reads provider configuration only in Electron's main process.

OpenAI-compatible cloud endpoint, PowerShell example:

```powershell
$env:BOUNCEDECK_LLM_MODEL="your-model-name"
$env:BOUNCEDECK_LLM_API_KEY="your-key"
$env:BOUNCEDECK_LLM_BASE_URL="https://api.openai.com/v1"
npm run dev
```

Local OpenAI-compatible endpoint:

```powershell
$env:BOUNCEDECK_LLM_MODEL="your-local-model"
$env:BOUNCEDECK_LLM_BASE_URL="http://127.0.0.1:11434/v1"
npm run dev
```

The key is optional for local endpoints that do not require one.

### What the companion receives

The companion receives a bounded context packet:

- track display name
- playback timestamp and duration
- low / mid / high normalized spectral energy
- RMS level
- a short aggregate analyzer window and RMS trend
- selected personality and chattiness
- recent companion conversation
- your current message

It does **not** receive raw audio or indexed filesystem paths. The system prompt explicitly tells remote models not to pretend they literally heard details absent from the supplied context.

## Architecture rule

```text
                  ┌───────────────────────────┐
                  │ Electron main process     │
Music folders ───►│ library index + media IDs │
                  └────────────┬──────────────┘
                               │ bounded IPC / media protocol
                               ▼
Local session files ───► Audio Engine ───► Deck Event Bus
                              │                  │
                              ├──► Visualizers   ├──► analyzer trend window
                              ├──► Transport     │
                              └──► EQ            ▼
                                         Companion bridge
                                               │
                                      local fallback or LLM
```

The companion has **no direct playback, filesystem, or operating-system authority in v0.2**. Future player tools must be exposed individually and intentionally.

## Validation

GitHub Actions runs `npm install`, `tsc --noEmit`, the desktop-oriented Vite production build, and the Pages web build on `main` and every `bouncdeck-v*` branch.

The v0.2 validation pass uses Electron 44.2.0 and currently reports **0 npm audit vulnerabilities**. Compile/build success does not replace real desktop playback testing on target operating systems, so packaged release claims remain later work.

## License

BounceDeck is released under the **MIT License**. See [`LICENSE`](LICENSE).

## Next targets

See [`docs/ROADMAP.md`](docs/ROADMAP.md).
