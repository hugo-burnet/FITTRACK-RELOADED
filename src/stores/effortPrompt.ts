/**
 * Whether the effort strip appears after a validated working set.
 *
 * On by default, and one tap wide: the whole point of the strip is that RPE
 * entry through the set sheet is three taps too many to do thirty times a
 * session, so a version of it that has to be sought out would be the same
 * feature with the same problem.
 *
 * In `localStorage` rather than Dexie, like the theme and the announcer: it is
 * read on the validation path, and an `await` there would show the strip a beat
 * after the row has already moved.
 */
export const EFFORT_PROMPT_STORAGE_KEY = 'fittrack:effortPrompt';

let current: boolean | null = null;

export function loadEffortPrompt(): boolean {
  if (current !== null) return current;
  current = localStorage.getItem(EFFORT_PROMPT_STORAGE_KEY) !== 'off';
  return current;
}

export function applyEffortPrompt(enabled: boolean): void {
  current = enabled;
  localStorage.setItem(EFFORT_PROMPT_STORAGE_KEY, enabled ? 'on' : 'off');
}
