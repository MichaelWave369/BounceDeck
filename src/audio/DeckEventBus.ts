import type { DeckEvents } from '../types';

type Handler<T> = (payload: T) => void;

export class DeckEventBus {
  private listeners = new Map<keyof DeckEvents, Set<Handler<never>>>();

  on<K extends keyof DeckEvents>(type: K, handler: Handler<DeckEvents[K]>) {
    const listeners = this.listeners.get(type) ?? new Set<Handler<never>>();
    listeners.add(handler as Handler<never>);
    this.listeners.set(type, listeners);
    return () => listeners.delete(handler as Handler<never>);
  }

  emit<K extends keyof DeckEvents>(type: K, payload: DeckEvents[K]) {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    for (const handler of listeners) (handler as Handler<DeckEvents[K]>)(payload);
  }
}

export const deckBus = new DeckEventBus();
