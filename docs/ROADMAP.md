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

### Landed in the v0.2 branch

- [x] Persistent library index in Electron app data
- [x] Recursive folder scanning through bounded Electron IPC
- [x] Stable path-derived library track IDs
- [x] Main-process-only absolute filesystem paths
- [x] `bounce-media://` id-gated streaming protocol
- [x] Reduced media-protocol privileges with renderer Fetch API access disabled
- [x] Filename metadata bootstrap (`Artist - Title`)
- [x] Typed deck event bus (`analysis`, `playback`, `track`)
- [x] Rolling bounded analysis summary for companion context
- [x] First original GPU fragment-shader visualizer (`plasma`)
- [x] Fullscreen visualizer mode
- [x] OS media-session controls and seek position
- [x] Persistent volume / EQ / visualizer / companion settings
- [x] CI coverage for all `bouncdeck-v*` branches
- [x] Upgrade desktop runtime to Electron 44.2.0
- [x] Dependency audit cleanup: 0 vulnerabilities in v0.2 CI

### Remaining v0.2.x work

- [ ] Full tag metadata parsing (artist / album / track number)
- [ ] Embedded artwork extraction and cache
- [ ] Gapless playback
- [ ] Optional crossfade engine
- [ ] Named EQ presets
- [ ] Shader preset interface and original preset packs
- [ ] Keyboard shortcuts beyond OS media keys
- [ ] Companion auto-comment policy with a real silence budget

## v0.3 — Listening intelligence

- [ ] Beat / onset detection
- [ ] Section-change candidates
- [ ] Timestamp bookmarks (“remember this part”)
- [ ] Session listening journal
- [ ] Companion context receipts visible in UI
- [ ] Optional local embeddings for personal library search
- [ ] Provider adapters and per-provider capability declaration
- [ ] Explicit tool permissions for queue/search/visualizer actions

## v0.4 — AI DJ, bounded

- [ ] Queue and playlist suggestion tools
- [ ] Mood / energy trajectory planning
- [ ] Transition recommendations
- [ ] Visualizer scene selection
- [ ] Tool-call approval policy
- [ ] Audit log for every companion-initiated action

## v1.0 — Music environment

- [ ] Plugin SDK
- [ ] Shareable visualizer and EQ preset packs
- [ ] Optional network library sources
- [ ] Companion profiles
- [ ] Hardware control protocol for a future physical BounceDeck
- [ ] Stable desktop packaging and signed releases

## Non-goals for early releases

- Uploading the user's music collection to an LLM provider
- Giving an LLM unrestricted filesystem access
- Letting generated text directly execute arbitrary system commands
- Pretending analyzer summaries are equivalent to hearing raw audio
