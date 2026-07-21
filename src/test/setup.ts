import '@testing-library/jest-dom/vitest';
// jsdom ships no IndexedDB. Without this, every Dexie call in a test hangs
// forever instead of failing — the symptom is a timeout, not an error.
import 'fake-indexeddb/auto';
