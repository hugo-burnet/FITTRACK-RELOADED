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
    // Les blocs ont leur chapitre : leur écran n'emprunte plus celui des routines.
    expect(tutorialTopicForPath('/programs/new')).toBe('programs');
    expect(tutorialTopicForPath('/routines/abc')).toBe('routines');
    expect(tutorialTopicForPath('/workout/finish')).toBe('coach');
    expect(tutorialTopicForPath('/analytics/records')).toBe('analytics');
    expect(tutorialTopicForPath('/exercises/bench')).toBe('exercises');
  });

  /*
   * L'aide effaçait la route du chapitre pour ne pas déplacer l'utilisateur.
   * Depuis `/routines/:id`, elle expliquait donc Routines devant un éditeur :
   * le chapitre parle de la liste et encadre son onglet, et rien de ce qu'il
   * décrivait n'était à l'écran.
   */
  it('ouvre le chapitre contextuel sur la page dont il parle', () => {
    expect(contextualTutorial('history')).toEqual([
      expect.objectContaining({ id: 'history', route: '/history' }),
    ]);
  });
});
