# BounceDeck roadmap

## v0.1 — Deck foundation

- [x] Electron + React + TypeScript shell
- [x] Local-file playlist
- [x] Web Audio playback graph
- [x] Three-band EQ
- [x] FFT / scope / orbital visualizers
- [x] Listening-context snapshot
- [x] Main-process OpenAI-compatible LLM bridge
- [x] Local companion fallback
- [x] Personality + chattiness controls

## v0.2 — Library and visualizer system

- Metadata parsing (artist, album, embedded artwork)
- Persistent library index
- Folder scanning through bounded Electron IPC
- Gapless playback and crossfade options
- Saved EQ presets
- GPU shader visualizer API
- MilkDrop-inspired preset architecture using original shaders
- Fullscreen visualizer mode
- Keyboard shortcuts and media keys
- Companion auto-comment policy with a real silence budget

## v0.3 — Listening intelligence

- Beat / onset / section-change analysis
- Timestamp bookmarks (“remember this part”)
- Session listening journal
- Companion context receipts visible in UI
- Optional local embeddings for personal library search
- Provider adapters and per-provider capability declaration
- Explicit tool permissions for queue/search/visualizer actions

## v0.4 — AI DJ, bounded

- Queue and playlist suggestion tools
- Mood / energy trajectory planning
- Transition recommendations
- Visualizer scene selection
- Tool-call approval policy
- Audit log for every companion-initiated action

## v1.0 — Music environment

- Plugin SDK
- Shareable visualizer and EQ preset packs
- Optional network library sources
- Companion profiles
- Hardware control protocol for a future physical BounceDeck
- Stable desktop packaging and signed releases

## Non-goals for early releases

- Uploading the user's music collection to an LLM provider
- Giving an LLM unrestricted filesystem access
- Letting generated text directly execute arbitrary system commands
- Pretending analyzer summaries are equivalent to hearing raw audio
