import type { LibraryState } from '../types';

export const EMPTY_LIBRARY: LibraryState = { roots: [], tracks: [], scannedAt: null };

export async function getLibrary() {
  return window.bounceDeck?.libraryGet ? window.bounceDeck.libraryGet() : EMPTY_LIBRARY;
}

export async function addLibraryFolder() {
  return window.bounceDeck?.libraryAddFolder ? window.bounceDeck.libraryAddFolder() : EMPTY_LIBRARY;
}

export async function refreshLibrary() {
  return window.bounceDeck?.libraryRefresh ? window.bounceDeck.libraryRefresh() : EMPTY_LIBRARY;
}

export async function clearLibrary() {
  return window.bounceDeck?.libraryClear ? window.bounceDeck.libraryClear() : EMPTY_LIBRARY;
}
