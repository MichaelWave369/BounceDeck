# BounceDeck architecture

BounceDeck separates deterministic playback, filesystem custody, analysis, visualization, and the optional generative companion.

## v0.2 runtime boundaries

```text
Electron main process
  ├─ persistent library store (app data)
  │   ├─ saved roots
  │   ├─ absolute track paths
  │   └─ stable path-derived track ids
  ├─ bounce-media:// protocol
  │   └─ id -> known local path -> net.fetch(file:)
  └─ companion provider bridge
          ▲
          │ narrow preload methods only
          │
Electron preload
  ├─ libraryGet()
  ├─ libraryAddFolder()
  ├─ libraryRefresh()
  ├─ libraryClear()
  └─ companionChat(payload)
          ▲
          │
Renderer (React)
  ├─ persistent public library records
  ├─ session drag/drop files
  ├─ Web Audio engine
  │   ├─ low-shelf EQ
  │   ├─ peaking mid EQ
  │   ├─ high-shelf EQ
  │   └─ AnalyserNode
  ├─ typed DeckEventBus
  │   ├─ analysis frames
  │   ├─ playback events
  │   └─ track events
  ├─ 2D visualizers
  ├─ WebGL shader visualizer
  ├─ Media Session integration
  └─ companion UI
```

## Filesystem custody

The persistent library is owned by Electron's main process.

The renderer receives:

- stable track id
- title / optional filename-derived artist
- extension
- source kind
- `bounce-media://track/<id>` media URL

The renderer does **not** receive the absolute path stored in the main-process library index.

`bounce-media://` resolves only an id already present in the in-memory library map. The renderer cannot provide an arbitrary path through this protocol.

Session drag/drop files remain browser `File` objects with temporary blob URLs and are intentionally non-persistent.

## Authority rule

The companion has **no direct transport, filesystem, library, or operating-system authority in v0.2**. It receives context and returns text.

Future player tools must be exposed individually and intentionally rather than by giving the model generic IPC or command execution.

## Audio data boundary

Raw audio remains inside the local player path. The companion packet contains only:

- track display name
- playback time / duration
- normalized low, mid, and high spectral-energy summaries
- RMS level
- a short aggregate analysis window and RMS delta
- companion personality / chattiness settings
- recent text conversation

The rolling window is produced from typed local analysis events and compressed before it reaches the companion. Raw FFT arrays are not included.

## Event boundary

`DeckEventBus` is the first internal decoupling layer between playback and future listening intelligence.

Current event types:

- `analysis`
- `playback`
- `track`

Visualizers can continue reading high-frequency analyzer buffers directly where frame-rate performance matters, while slower consumers such as the companion work from bounded aggregate events. Future beat, onset, section, and bookmark detectors should publish typed events rather than reaching into React state.

## Visualizer boundary

The first GPU mode, `plasma`, is an original fragment shader. Its uniforms are limited to:

- render time
- canvas resolution
- low energy
- mid energy
- high energy
- RMS

Shader rendering never receives the user's files or filesystem paths.

## Secret boundary

Provider configuration is read from the Electron main-process environment:

- `BOUNCEDECK_LLM_MODEL`
- `BOUNCEDECK_LLM_BASE_URL`
- `BOUNCEDECK_LLM_API_KEY`

The API key is not exposed through the preload bridge and must never be placed in `VITE_*` variables, which are renderer-visible.

## Next architectural step

The next safe expansion is listening intelligence: beat/onset/section events and user-created timestamp bookmarks. Companion-controlled player actions should remain later than those read-only capabilities and should receive explicit typed permissions plus an action audit trail.
