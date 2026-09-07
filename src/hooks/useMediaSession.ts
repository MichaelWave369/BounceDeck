import { useEffect } from 'react';
import type { Track } from '../types';

interface Controls {
  play: () => void;
  pause: () => void;
  previous: () => void;
  next: () => void;
  seekTo: (seconds: number) => void;
  seekBy: (seconds: number) => void;
}

export function useMediaSession(track: Track | undefined, playing: boolean, controls: Controls) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = track
      ? new MediaMetadata({
          title: track.title || track.name,
          artist: track.artist || 'BounceDeck local library',
          album: 'BounceDeck',
        })
      : null;
    navigator.mediaSession.playbackState = track ? (playing ? 'playing' : 'paused') : 'none';

    const register = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some platforms expose Media Session but omit individual actions.
      }
    };

    register('play', controls.play);
    register('pause', controls.pause);
    register('previoustrack', controls.previous);
    register('nexttrack', controls.next);
    register('seekto', (details) => {
      if (typeof details.seekTime === 'number') controls.seekTo(details.seekTime);
    });
    register('seekbackward', (details) => controls.seekBy(-(details.seekOffset ?? 10)));
    register('seekforward', (details) => controls.seekBy(details.seekOffset ?? 10));

    return () => {
      register('play', null);
      register('pause', null);
      register('previoustrack', null);
      register('nexttrack', null);
      register('seekto', null);
      register('seekbackward', null);
      register('seekforward', null);
    };
  }, [controls, playing, track]);
}
