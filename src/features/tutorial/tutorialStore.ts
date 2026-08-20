export const TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v1';

export type TutorialCompletion = 'completed' | 'skipped';

export function loadTutorialCompletion(): TutorialCompletion | null {
  const value = localStorage.getItem(TUTORIAL_STORAGE_KEY);
  return value === 'completed' || value === 'skipped' ? value : null;
}

export function saveTutorialCompletion(value: TutorialCompletion): void {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, value);
}
