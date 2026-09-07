import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { Visualizer } from './components/Visualizer';
import { askCompanion } from './companion/CompanionEngine';
import type { BuddyMessage, CompanionPersonality, Track, VisualizerMode } from './types';

const AUDIO_EXTENSION = /\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i;

export default function App() {
  const engine = useMemo(() => new AudioEngine(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.86);
  const [visualizer, setVisualizer] = useState<VisualizerMode>('spectrum');
  const [eq, setEq] = useState({ bass: 0, mid: 0, treble: 0 });
  const [messages, setMessages] = useState<BuddyMessage[]>([
    { role: 'assistant', text: 'Drop some music in. I’ll stay out of the way until you want company.', at: Date.now() },
  ]);
  const [chat, setChat] = useState('');
  const [thinking, setThinking] = useState(false);
  const [companionMode, setCompanionMode] = useState('LOCAL LISTENER');
  const [personality, setPersonality] = useState<CompanionPersonality>('bro');
  const [chattiness, setChattiness] = useState(28);

  const currentTrack = currentIndex >= 0 ? tracks[currentIndex] : undefined;

  useEffect(() => {
    engine.setVolume(volume);
  }, [engine, volume]);

  useEffect(() => {
    return () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      void engine.dispose();
    };
  }, [engine]);

  const selectTrack = useCallback(
    async (index: number, autoplay = false) => {
      const track = tracks[index];
      if (!track) return;
      engine.load(track.url);
      setCurrentIndex(index);
      setCurrentTime(0);
      setDuration(track.duration ?? 0);
      setPlaying(false);
      if (autoplay) {
        await engine.play();
        setPlaying(true);
      }
    },
    [engine, tracks],
  );

  useEffect(() => {
    const audio = engine.audio;
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onDuration = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setDuration(nextDuration);
      setTracks((existing) =>
        existing.map((track, index) => (index === currentIndex ? { ...track, duration: nextDuration } : track)),
      );
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      if (tracks.length > 1) void selectTrack((currentIndex + 1) % tracks.length, true);
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
  }, [currentIndex, engine, selectTrack, tracks.length]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const accepted = Array.from(list).filter(
        (file) => file.type.startsWith('audio/') || AUDIO_EXTENSION.test(file.name),
      );
      if (!accepted.length) return;

      const created = accepted.map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.push(url);
        return {
          id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          file,
          url,
        } satisfies Track;
      });

      setTracks((existing) => {
        const combined = [...existing, ...created];
        if (currentIndex === -1 && combined[0]) {
          queueMicrotask(() => {
            engine.load(combined[0].url);
            setCurrentIndex(0);
          });
        }
        return combined;
      });
    },
    [currentIndex, engine],
  );

  const togglePlayback = async () => {
    if (!tracks.length) {
      fileInput.current?.click();
      return;
    }

    if (playing) {
      engine.pause();
      return;
    }

    if (currentIndex === -1) {
      engine.load(tracks[0].url);
      setCurrentIndex(0);
    }
    await engine.play();
    setPlaying(true);
  };

  const skip = (direction: number) => {
    if (!tracks.length) return;
    const base = currentIndex < 0 ? 0 : currentIndex;
    const next = (base + direction + tracks.length) % tracks.length;
    void selectTrack(next, playing);
  };

  const updateEq = (band: 'bass' | 'mid' | 'treble', value: number) => {
    setEq((existing) => ({ ...existing, [band]: value }));
    engine.setEq(band, value);
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
        snapshot: engine.snapshot(),
        personality,
        chattiness,
        recentMessages,
      });
      setCompanionMode(response.mode === 'llm' ? `LLM // ${response.model ?? 'CONNECTED'}` : response.mode === 'fallback' ? 'LOCAL FALLBACK' : 'LOCAL LISTENER');
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
          <div className="eyebrow">LOCAL AUDIO ENVIRONMENT // v0.1</div>
          <h1>BOUNCEDECK</h1>
        </div>
        <div className="topbar-status">
          <span className={`status-dot ${playing ? 'live' : ''}`} />
          {playing ? 'DECK LIVE' : 'DECK IDLE'}
        </div>
      </header>

      <section className="workspace">
        <div className="deck-column">
          <section className="visualizer-panel panel">
            <Visualizer engine={engine} mode={visualizer} active={playing} />
            <div className="visualizer-overlay">
              <div>
                <span className="eyebrow">NOW PLAYING</span>
                <h2>{currentTrack?.name ?? 'Drop audio to wake the deck'}</h2>
              </div>
              <div className="mode-switcher">
                {(['spectrum', 'scope', 'orbital'] as VisualizerMode[]).map((mode) => (
                  <button className={visualizer === mode ? 'active' : ''} onClick={() => setVisualizer(mode)} key={mode}>
                    {mode}
                  </button>
                ))}
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
                  <span className="eyebrow">LOCAL LIBRARY</span>
                  <h3>{tracks.length} TRACK{tracks.length === 1 ? '' : 'S'}</h3>
                </div>
                <button className="add-button" onClick={() => fileInput.current?.click()}>+ ADD AUDIO</button>
                <input
                  hidden
                  multiple
                  ref={fileInput}
                  type="file"
                  accept="audio/*,.flac,.opus"
                  onChange={(event) => event.target.files && addFiles(event.target.files)}
                />
              </div>

              <div className="track-list">
                {tracks.length ? tracks.map((track, index) => (
                  <button className={`track-row ${index === currentIndex ? 'selected' : ''}`} key={track.id} onClick={() => void selectTrack(index, playing)}>
                    <span className="track-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="track-title">{track.name}</span>
                    <span className="track-duration">{formatTime(track.duration ?? 0)}</span>
                  </button>
                )) : (
                  <button className="drop-zone" onClick={() => fileInput.current?.click()}>
                    DROP MP3 / WAV / FLAC / OGG HERE
                    <small>Files stay on your machine.</small>
                  </button>
                )}
              </div>
            </section>

            <section className="eq-panel panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">THREE BAND</span>
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

          <p className="companion-note">The buddy sees track/time + analyzer summaries, not raw audio. Silence stays a feature.</p>
        </aside>
      </section>
    </main>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
