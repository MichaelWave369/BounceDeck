import type { LibraryState } from './types';

declare global {
  interface Window {
    bounceDeck?: {
      companionChat: (payload: unknown) => Promise<{
        configured: boolean;
        text?: string;
        model?: string;
      }>;
      libraryGet: () => Promise<LibraryState>;
      libraryAddFolder: () => Promise<LibraryState>;
      libraryRefresh: () => Promise<LibraryState>;
      libraryClear: () => Promise<LibraryState>;
    };
  }
}

export {};
