import '@testing-library/jest-dom/vitest';
// jsdom ships no IndexedDB. Without this, every Dexie call in a test hangs
// forever instead of failing — the symptom is a timeout, not an error.
import 'fake-indexeddb/auto';

// jsdom ne fournit pas non plus `ResizeObserver`. Le tutoriel s'en sert pour
// suivre l'élément qu'il encadre ; sans lui, `new ResizeObserver` lève, et le
// test échoue sur une référence manquante au lieu de dire ce qu'il vérifie.
// Rien ne mesure en jsdom : cette doublure n'a donc qu'à exister, pas à notifier.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
