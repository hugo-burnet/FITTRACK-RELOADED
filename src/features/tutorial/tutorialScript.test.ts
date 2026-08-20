import { describe, expect, it } from 'vitest';
import { textOf } from '@/audio/cues';
import { t } from '@/i18n/fr';
import { FULL_TUTORIAL, contextualTutorial, tutorialTopicForPath } from './tutorialScript';

describe('script du tutoriel', () => {
  it('possède un texte parlé et un résumé bref pour chaque chapitre', () => {
    expect(FULL_TUTORIAL.length).toBeGreaterThanOrEqual(8);
    for (const step of FULL_TUTORIAL) {
      expect(textOf(step.clip), step.id).toBeTruthy();
      const summary = t(step.summaryKey);
      expect(summary.length, step.id).toBeGreaterThan(20);
      expect(summary.length, step.id).toBeLessThan(90);
    }
  });

  it('associe les sous-pages à leur grande fonctionnalité', () => {
    expect(tutorialTopicForPath('/programs/new')).toBe('routines');
    expect(tutorialTopicForPath('/workout/finish')).toBe('coach');
    expect(tutorialTopicForPath('/analytics/records')).toBe('analytics');
    expect(tutorialTopicForPath('/exercises/bench')).toBe('exercises');
  });

  it('garde le tutoriel contextuel sur la page courante', () => {
    expect(contextualTutorial('history')).toEqual([
      expect.objectContaining({ id: 'history', route: undefined }),
    ]);
  });
});
