export type VisualizerMode = 'spectrum' | 'scope' | 'orbital';
export type CompanionPersonality = 'bro' | 'listener' | 'producer';

export interface Track {
  id: string;
  name: string;
  file: File;
  url: string;
  duration?: number;
}

export interface AudioSnapshot {
  low: number;
  mid: number;
  high: number;
  rms: number;
}

export interface BuddyMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}
