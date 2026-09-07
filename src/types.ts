export type VisualizerMode = 'spectrum' | 'scope' | 'orbital' | 'plasma';
export type CompanionPersonality = 'bro' | 'listener' | 'producer';
export type TrackSource = 'session' | 'library';

export interface Track {
  id: string;
  name: string;
  title?: string;
  artist?: string;
  extension?: string;
  file?: File;
  url: string;
  source: TrackSource;
  duration?: number;
}

export interface LibraryRoot {
  id: string;
  name: string;
}

export interface LibraryState {
  roots: LibraryRoot[];
  tracks: Track[];
  scannedAt: number | null;
}

export interface AudioSnapshot {
  low: number;
  mid: number;
  high: number;
  rms: number;
}

export interface AudioAnalysisFrame extends AudioSnapshot {
  at: number;
  playing: boolean;
  currentTime: number;
}

export interface DeckPlaybackEvent {
  at: number;
  playing: boolean;
  currentTime: number;
}

export interface DeckTrackEvent {
  at: number;
  trackId: string | null;
  title: string | null;
}

export interface DeckEvents {
  analysis: AudioAnalysisFrame;
  playback: DeckPlaybackEvent;
  track: DeckTrackEvent;
}

export interface BuddyMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}
