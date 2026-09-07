# BounceDeck architecture

BounceDeck separates the deterministic music system from the optional generative companion.

## Runtime boundaries

```text
Renderer (React)
  ├─ local file picker / drag-drop
  ├─ transport UI
  ├─ Web Audio engine
  │   ├─ low-shelf EQ
  │   ├─ peaking mid EQ
  │   ├─ high-shelf EQ
  │   └─ AnalyserNode
  ├─ visualizer renderer
  └─ companion UI
          │
          │ bounded context only
          ▼
Electron preload
  └─ companionChat(payload)
          │
          ▼
Electron main process
  └─ OpenAI-compatible /chat/completions provider
```

## Authority rule

The companion has **no direct transport, filesystem, or operating-system authority in v0.1**. It receives a listening-context packet and returns text.

Future player tools must be exposed individually and intentionally rather than by giving the model generic IPC or command execution.

## Audio data boundary

Raw audio remains inside the local player path. The companion packet contains only:

- track display name
- playback time / duration
- normalized low, mid, and high spectral-energy summaries
- RMS level
- companion personality / chattiness settings
- recent text conversation

This is deliberately weaker than claiming the language model "hears" the song. Future richer audio understanding should be introduced as a separate capability with explicit UI disclosure and provider policy.

## Secret boundary

Provider configuration is read from the Electron main-process environment:

- `BOUNCEDECK_LLM_MODEL`
- `BOUNCEDECK_LLM_BASE_URL`
- `BOUNCEDECK_LLM_API_KEY`

The API key is not exposed through the preload bridge and must never be placed in `VITE_*` variables, which are renderer-visible.

## Next architectural step

v0.2 should introduce a typed event bus between playback, analysis, visualizers, and companion context generation. That will let beat/onset/section detectors evolve independently without coupling the UI to analyzer implementation details.
