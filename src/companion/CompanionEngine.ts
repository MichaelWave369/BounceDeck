import type { AudioSnapshot, BuddyMessage, CompanionPersonality } from '../types';

export interface AnalysisWindowSummary {
  samples: number;
  spanSeconds: number;
  average: AudioSnapshot;
  rmsDelta: number;
}

export interface CompanionContext {
  question: string;
  track: string;
  currentTime: number;
  duration: number;
  snapshot: AudioSnapshot;
  analysisWindow?: AnalysisWindowSummary;
  personality: CompanionPersonality;
  chattiness: number;
  recentMessages: BuddyMessage[];
}

export interface CompanionResponse {
  text: string;
  mode: 'llm' | 'local' | 'fallback';
  model?: string;
}

export async function askCompanion(context: CompanionContext): Promise<CompanionResponse> {
  if (window.bounceDeck?.companionChat) {
    try {
      const result = await window.bounceDeck.companionChat({
        ...context,
        currentTime: round(context.currentTime),
        duration: round(context.duration),
        instruction: `Chattiness is ${context.chattiness}/100. Keep the reply proportionally restrained.`,
      });

      if (result.configured && result.text) return { text: result.text, mode: 'llm', model: result.model };
    } catch (error) {
      console.warn('BounceDeck LLM bridge failed; using local listener.', error);
      return { text: localReply(context), mode: 'fallback' };
    }
  }
  return { text: localReply(context), mode: 'local' };
}

function localReply(context: CompanionContext) {
  const { snapshot, track, currentTime, personality, analysisWindow } = context;
  const strongest = [
    ['low end', snapshot.low],
    ['midrange', snapshot.mid],
    ['top end', snapshot.high],
  ].sort((a, b) => Number(b[1]) - Number(a[1]))[0][0];

  const energy = snapshot.rms > 0.24 ? 'hitting pretty hard' : snapshot.rms > 0.1 ? 'moving nicely' : 'sitting pretty restrained';
  const trend = analysisWindow
    ? analysisWindow.rmsDelta > 0.035
      ? ' and it has been building over the last few seconds'
      : analysisWindow.rmsDelta < -0.035
        ? ' and it has been easing down over the last few seconds'
        : ''
    : '';
  const stamp = formatTime(currentTime);

  if (personality === 'producer') {
    return `At ${stamp} in “${track}”, the analyzer has the ${strongest} carrying the most energy and the overall level is ${energy}${trend}. I’m on local-listener mode, so I won’t invent arrangement details I can’t actually measure.`;
  }
  if (personality === 'listener') {
    return `I’m with you at ${stamp}. The analyzer says the ${strongest} is leading and the track is ${energy}${trend}. I’ll keep quiet unless you pull me in.`;
  }
  return `I’m right here at ${stamp} in “${track}”. The ${strongest} is winning the analyzer right now and the whole thing is ${energy}${trend}. Until the LLM bridge is connected, I’m the tiny honest goblin watching the meters.`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function round(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}
