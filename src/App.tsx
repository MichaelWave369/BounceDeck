import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { deckBus } from './audio/DeckEventBus';
import { askCompanion, type AnalysisWindowSummary } from './companion/CompanionEngine';
import { Visualizer } from './components/Visualizer';
import { useMediaSession } from './hooks/useMediaSession';
import { usePersistentState } from './hooks/usePersistentState';
import {
  addLibraryFolder,
  clearLibrary,
  EMPTY_LIBRARY,
  getLibrary,
  refreshLibrary,
} from './library/LibraryClient';
import type {
  AudioAnalysisFrame,
  BuddyMessage,
  CompanionPersonality,
  LibraryState,
  Track,
  VisualizerMode,
} from './types';

const AUDIO_EXTENSION = /\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i;
const VISUALIZER_MODES: VisualizerMode[] = ['plasma', 'spectrum', 'scope', 'orbital'];
const ZERO_SNAPSHOT = { low: 0, mid: 0, high: 0, rms: 0 };

export default function App() {
  const engine = useMemo(() => new AudioEngine(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const visualizerPanel = useRef<HTMLElement>(null);
  const sessionUrls = useRef<string[]>([]);
  const analysisHistory = useRef<AudioAnalysisFrame[]>([]);
  const playbackRef = useRef({ playing: false, currentTime: 0 });

  const [library, setLibrary] = useState<LibraryState>(EMPTY_LIBRARY);
  const [sessionTracks, setSessionTracks] = useState<Track[]>([]);
  const tracks = useMemo(() => [...library.tracks, ...sessionTracks], [library.tracks, sessionTracks]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const currentIndex = tracks.findIndex((track) => track.id === currentTrackId);
  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : undefined;

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = usePersistentState('bouncdeck.volume', 0.86);
  const [visualizer, setVisualizer] = usePersistentState<VisualizerMode>('bouncdeck.visualizer', 'plasma');
  const [eq, setEq] = usePersistentState('bouncdeck.eq', { bass: 0, mid: 0, treble: 0 });
  const [personality, setPersonality] = usePersistentState<CompanionPersonality>('bouncdeck.personality', 'bro');
  const [chattiness, setChattiness] = usePersistentState('bouncdeck.chattiness', 28);
  const [fullscreen, setFullscreen] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState('');

  const [messages, setMessages] = useState<BuddyMessage[]>([
    { role: 'assistant', text: 'Drop some music in. I’ll stay out of the way until you want company.', at: Date.now() },
  ]);
  const [chat, setChat] = useState('');
  const [thinking, setThinking] = useState(false);
  const [companionMode, setCompanionMode] = useState('LOCAL LISTENER');

  useEffect(() => {
    engine.setVolume(volume);
  }, [engine, volume]);

  useEffect(() => {
    engine.setEq('bass', eq.bass);
    engine.setEq('mid', eq.mid);
    engine.setEq('treble', eq.treble);
  }, [engine, eq]);

  useEffect(() => {
    let cancelled = false;
    void getLibrary()
      .then((state) => {
        if (!cancelled) setLibrary(state);
      })
      .catch((error) => {
        console.warn('BounceDeck library bootstrap failed.', error);
        if (!cancelled) setLibraryError('LIBRARY INDEX UNAVAILABLE');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    playbackRef.current = { playing, currentTime };
  }, [playing, currentTime]);

  useEffect(() =>
    deckBus.on('analysis', (frame) => {
      analysisHistory.current.push(frame);
      if (analysisHistory.current.length > 40) analysisHistory.current.splice(0, analysisHistory.current.length - 40);
    }),
  []);

  useEffect(() => {
    const emit = () => {
      const playback = playbackRef.current;
      const snapshot = playback.playing ? engine.snapshot() : ZERO_SNAPSHOT;
      deckBus.emit('analysis', {
        ...snapshot,
        at: Date.now(),
        playing: playback.playing,
        currentTime: playback.currentTime,
      });
    };
    emit();
    const timer = window.setInterval(emit, 125);
    return () => window.clearInterval(timer);
  }, [engine]);

  useEffect(() => {
    deckBus.emit('playback', { at: Date.now(), playing, currentTime });
  }, [playing, currentTime]);

  useEffect(() => {
    deckBus.emit('track', {
      at: Date.now(),
      trackId: currentTrack?.id ?? null,
      title: currentTrack?.title ?? currentTrack?.name ?? null,
    });
  }, [currentTrack?.id, currentTrack?.name, currentTrack?.title]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === visualizerPanel.current);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    return () => {
      sessionUrls.current.forEach((url) => URL.revokeObjectURL(url));
      void engine.dispose();
    };
  }, [engine]);

  useEffect(() => {
    if (!tracks.length) {
      if (currentTrackId) {
        engine.pause();
        setCurrentTrackId(null);
        setCurrentTime(0);
        setDuration(0);
      }
      return;
    }
    if (currentIndex >= 0) return;
    const first = tracks[0];
    engine.load(first.url);
    setCurrentTrackId(first.id);
    setCurrentTime(0);
    setDuration(first.duration ?? 0);
  }, [currentIndex, currentTrackId, engine, tracks]);

  const selectTrack = useCallback(
    async (index: number, autoplay = false) => {
      const track = tracks[index];
      if (!track) return;
      engine.load(track.url);
      setCurrentTrackId(track.id);
      setCurrentTime(0);
      setDuration(track.duration ?? 0);
      setPlaying(false);
      if (autoplay) await engine.play();
    },
    [engine, tracks],
  );

  useEffect(() => {
    const audio = engine.audio;
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      if (!currentTrackId) return;
      setSessionTracks((existing) =>
        existing.map((track) => (track.id === currentTrackId ? { ...track, duration: nextDuration } : track)),
      );
      setLibrary((existing) => ({
        ...existing,
        tracks: existing.tracks.map((track) =>
          track.id === currentTrackId ? { ...track, duration: nextDuration } : track,
        ),
      }));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      if (tracks.length > 1 && currentIndex >= 0) void selectTrack((currentIndex + 1) % tracks.length, true);
      else setPlaying(false);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, currentTrackId, engine, selectTrack, tracks.length]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const accepted = Array.from(list).filter(
      (file) => file.type.startsWith('audio/') || AUDIO_EXTENSION.test(file.name),
    );
    if (!accepted.length) return;

    const created = accepted.map((file) => {
      const url = URL.createObjectURL(file);
      sessionUrls.current.push(url);
      const parsed = parseFileName(file.name);
      return {
        id: `session-${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: parsed.title,
        title: parsed.title,
        artist: parsed.artist,
        extension: parsed.extension,
        file,
        url,
        source: 'session' as const,
      } satisfies Track;
    });
    setSessionTracks((existing) => [...existing, ...created]);
  }, []);

  const playCurrent = useCallback(async () => {
    if (!tracks.length) {
      fileInput.current?.click();
      return;
    }
    const target = currentTrack ?? tracks[0];
    if (!currentTrack) {
      engine.load(target.url);
      setCurrentTrackId(target.id);
      setCurrentTime(0);
      setDuration(target.duration ?? 0);
    }
    await engine.play();
  }, [currentTrack, engine, tracks]);

  const pauseCurrent = useCallback(() => engine.pause(), [engine]);

  const togglePlayback = useCallback(async () => {
    if (playing) pauseCurrent();
    else await playCurrent();
  }, [pauseCurrent, playCurrent, playing]);

  const skip = useCallback(
    (direction: number) => {
      if (!tracks.length) return;
      const base = currentIndex < 0 ? 0 : currentIndex;
      const next = (base + direction + tracks.length) % tracks.length;
      void selectTrack(next, playing);
    },
    [currentIndex, playing, selectTrack, tracks.length],
  );

  const mediaControls = useMemo(
    () => ({
      play: () => void playCurrent(),
      pause: pauseCurrent,
      previous: () => skip(-1),
      next: () => skip(1),
      seekTo: (seconds: number) => engine.seek(seconds),
      seekBy: (seconds: number) => engine.seek(engine.audio.currentTime + seconds),
    }),
    [engine, pauseCurrent, playCurrent, skip],
  );

  useMediaSession(currentTrack, playing, currentTime, duration, mediaControls);

  const updateEq = (band: 'bass' | 'mid' | 'treble', value: number) => {
    setEq((existing) => ({ ...existing, [band]: value }));
    engine.setEq(band, value);
  };

  const runLibraryAction = useCallback(async (action: () => Promise<LibraryState>) => {
    setLibraryBusy(true);
    setLibraryError('');
    try {
      setLibrary(await action());
    } catch (error) {
      console.warn('BounceDeck library action failed.', error);
      setLibraryError('LIBRARY ACTION FAILED');
    } finally {
      setLibraryBusy(false);
    }
  }, []);

  const forgetLibrary = () => {
    if (!library.roots.length) return;
    if (!window.confirm('Forget indexed music folders? BounceDeck will not delete any music files.')) return;
    void runLibraryAction(clearLibrary);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await visualizerPanel.current?.requestFullscreen();
  };

  const sendMessage = async () => {
    const question = chat.trim();
    if (!question || thinking) return;
    const userMessage: BuddyMessage = { role: 'user', text: question, at: Date.now() };
    const recentMessages = [...messages, userMessage].slice(-8);
    setMessages((existing) => [...existing, userMessage]);
    setChat('');
    setThinking(true);

    try {
      const response = await askCompanion({
        question,
        track: currentTrack?.name ?? 'No track loaded',
        currentTime,
        duration,
        snapshot: playing ? engine.snapshot() : ZERO_SNAPSHOT,
        analysisWindow: summarizeAnalysis(analysisHistory.current),
        personality,
        chattiness,
        recentMessages,
      });
      setCompanionMode(
        response.mode === 'llm'
          ? `LLM // ${response.model ?? 'CONNECTED'}`
          : response.mode === 'fallback'
            ? 'LOCAL FALLBACK'
            : 'LOCAL LISTENER',
      );
      setMessages((existing) => [...existing, { role: 'assistant', text: response.text, at: Date.now() }]);
    } finally {
      setThinking(false);
    }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  return (
    <main className="app-shell" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <header className="topbar">
        <div>
          <div className="eyebrow">LOCAL AUDIO ENVIRONMENT // v0.2</div>
          <h1>BOUNCEDECK</h1>
        </div>
        <div className="topbar-status">
          <span className={`status-dot ${playing ? 'live' : ''}`} />
          {playing ? 'DECK LIVE' : 'DECK IDLE'}
        </div>
      </header>

      <section className="workspace">
        <div className="deck-column">
          <section className="visualizer-panel panel" ref={visualizerPanel}>
            <Visualizer engine={engine} mode={visualizer} active={playing} />
            <div className="visualizer-overlay">
              <div>
                <span className="eyebrow">NOW PLAYING</span>
                <h2>{currentTrack?.title ?? currentTrack?.name ?? 'Drop audio to wake the deck'}</h2>
                {currentTrack?.artist && <p className="now-artist">{currentTrack.artist}</p>}
              </div>
              <div className="visualizer-actions">
                <div className="mode-switcher">
                  {VISUALIZER_MODES.map((mode) => (
                    <button className={visualizer === mode ? 'active' : ''} onClick={() => setVisualizer(mode)} key={mode}>
                      {mode}
                    </button>
                  ))}
                </div>
                <button className="fullscreen-button" onClick={() => void toggleFullscreen()}>
                  {fullscreen ? 'EXIT' : 'FULL'}
                </button>
              </div>
            </div>
          </section>

          <section className="transport panel">
            <div className="timeline-row">
              <span>{formatTime(currentTime)}</span>
              <input
                aria-label="Seek"
                type="range"
                min="0"
                max={duration || 1}
                step="0.1"
                value={Math.min(currentTime, duration || 1)}
                onChange={(event) => engine.seek(Number(event.target.value))}
              />
              <span>{formatTime(duration)}</span>
            </div>
            <div className="transport-row">
              <div className="transport-buttons">
                <button className="skip-button" onClick={() => skip(-1)} aria-label="Previous track">◀◀</button>
                <button className="play-button" onClick={() => void togglePlayback()} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? 'Ⅱ' : '▶'}
                </button>
                <button className="skip-button" onClick={() => skip(1)} aria-label="Next track">▶▶</button>
              </div>
              <label className="volume-control">
                <span>VOL {Math.round(volume * 100)}</span>
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
              </label>
            </div>
          </section>

          <section className="lower-grid">
            <section className="library panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">PERSISTENT + SESSION LIBRARY</span>
                  <h3>{tracks.length} TRACK{tracks.length === 1 ? '' : 'S'}</h3>
                </div>
                <div className="library-actions">
                  <button className="add-button" disabled={libraryBusy} onClick={() => void runLibraryAction(addLibraryFolder)}>+ FOLDER</button>
                  <button className="add-button" disabled={libraryBusy || !library.roots.length} onClick={() => void runLibraryAction(refreshLibrary)}>REFRESH</button>
                  <button className="add-button" onClick={() => fileInput.current?.click()}>+ FILES</button>
                </div>
                <input
                  hidden
                  multiple
                  ref={fileInput}
                  type="file"
                  accept="audio/*,.flac,.opus"
                  onChange={(event) => event.target.files && addFiles(event.target.files)}
                />
              </div>

              <div className="library-meta">
                <span>{library.roots.length} SAVED FOLDER{library.roots.length === 1 ? '' : 'S'} // {library.tracks.length} PERSISTENT // {sessionTracks.length} SESSION</span>
                {library.roots.length > 0 && <button onClick={forgetLibrary}>FORGET INDEX</button>}
              </div>
              {libraryError && <div className="library-error">{libraryError}</div>}

              <div className="track-list">
                {tracks.length ? tracks.map((track, index) => (
                  <button className={`track-row v02 ${track.id === currentTrackId ? 'selected' : ''}`} key={track.id} onClick={() => void selectTrack(index, playing)}>
                    <span className="track-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="track-title-stack">
                      <span className="track-title">{track.title ?? track.name}</span>
                      <small>{track.artist ?? (track.source === 'library' ? 'Indexed local audio' : 'Session audio')}</small>
                    </span>
                    <span className={`track-source ${track.source}`}>{track.source === 'library' ? 'LIB' : 'NOW'}</span>
                    <span className="track-duration">{formatTime(track.duration ?? 0)}</span>
                  </button>
                )) : (
                  <button className="drop-zone" onClick={() => fileInput.current?.click()}>
                    DROP AUDIO HERE OR ADD A MUSIC FOLDER
                    <small>Indexed paths stay in Electron. Music files stay on your machine.</small>
                  </button>
                )}
              </div>
            </section>

            <section className="eq-panel panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">THREE BAND // SAVED</span>
                  <h3>EQUALIZER</h3>
                </div>
              </div>
              <div className="eq-controls">
                {(['bass', 'mid', 'treble'] as const).map((band) => (
                  <label key={band}>
                    <span>{band.toUpperCase()}</span>
                    <strong>{eq[band] > 0 ? '+' : ''}{eq[band].toFixed(1)} dB</strong>
                    <input type="range" min="-12" max="12" step="0.5" value={eq[band]} onChange={(event) => updateEq(band, Number(event.target.value))} />
                  </label>
                ))}
              </div>
            </section>
          </section>
        </div>

        <aside className="companion panel">
          <div className="companion-header">
            <div>
              <span className="eyebrow">LISTENING BUDDY</span>
              <h3>COMPANION</h3>
            </div>
            <span className="companion-mode">{companionMode}</span>
          </div>

          <div className="companion-settings">
            <label>
              PERSONALITY
              <select value={personality} onChange={(event) => setPersonality(event.target.value as CompanionPersonality)}>
                <option value="bro">Bro</option>
                <option value="listener">Listener</option>
                <option value="producer">Producer</option>
              </select>
            </label>
            <label>
              CHATTINESS {chattiness}
              <input type="range" min="0" max="100" value={chattiness} onChange={(event) => setChattiness(Number(event.target.value))} />
            </label>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.at}-${index}`}>
                <span>{message.role === 'assistant' ? 'BUDDY' : 'YOU'}</span>
                <p>{message.text}</p>
              </div>
            ))}
            {thinking && <div className="message assistant"><span>BUDDY</span><p>Listening to the numbers...</p></div>}
          </div>

          <div className="chat-box">
            <textarea
              value={chat}
              placeholder="bro listen to this part..."
              onChange={(event) => setChat(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <button onClick={() => void sendMessage()} disabled={!chat.trim() || thinking}>SEND</button>
          </div>

          <p className="companion-note">Buddy context now includes a short analyzer trend window, never raw audio or filesystem paths. Silence stays a feature.</p>
        </aside>
      </section>
    </main>
  );
}

function parseFileName(fileName: string) {
  const match = fileName.match(/\.([^.]+)$/);
  const extension = match?.[1]?.toLowerCase();
  const base = fileName.replace(/\.[^.]+$/, '');
  const separator = base.indexOf(' - ');
  if (separator > 0) {
    return {
      artist: base.slice(0, separator).trim(),
      title: base.slice(separator + 3).trim() || base,
      extension,
    };
  }
  return { artist: undefined, title: base, extension };
}

function summarizeAnalysis(frames: AudioAnalysisFrame[]): AnalysisWindowSummary | undefined {
  const recent = frames.slice(-32);
  if (!recent.length) return undefined;
  const average = recent.reduce(
    (sum, frame) => ({
      low: sum.low + frame.low,
      mid: sum.mid + frame.mid,
      high: sum.high + frame.high,
      rms: sum.rms + frame.rms,
    }),
    { low: 0, mid: 0, high: 0, rms: 0 },
  );
  const count = recent.length;
  const first = recent[0];
  const last = recent[recent.length - 1];
  return {
    samples: count,
    spanSeconds: Number(((last.at - first.at) / 1000).toFixed(2)),
    average: {
      low: Number((average.low / count).toFixed(3)),
      mid: Number((average.mid / count).toFixed(3)),
      high: Number((average.high / count).toFixed(3)),
      rms: Number((average.rms / count).toFixed(3)),
    },
    rmsDelta: Number((last.rms - first.rms).toFixed(3)),
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
