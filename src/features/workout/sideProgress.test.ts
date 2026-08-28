import { describe, expect, it } from 'vitest';
import { SIDE_TRANSITION_MS, sideStageFor } from './sideProgress';

const pending = { isCompleted: 0 as const, setType: 'normal' as const };

describe('sideStageFor', () => {
  /*
   * Une échéance absolue, pas un compte à rebours.
   *
   * La transition doit survivre à un écran éteint, à un appel, à un kill de
   * l'app : un minuteur en mémoire repartait de zéro au retour et renvoyait au
   * premier côté quelqu'un qui avait déjà fini les deux.
   */
  it('dérive premier, transition et second depuis une échéance absolue', () => {
    expect(sideStageFor(pending, true, 1_000)).toBe('first');
    expect(sideStageFor({ ...pending, unilateralSecondSideStartsAt: 11_000 }, true, 5_000)).toBe(
      'transition',
    );
    expect(sideStageFor({ ...pending, unilateralSecondSideStartsAt: 11_000 }, true, 11_000)).toBe(
      'second',
    );
  });

  it('ne connaît aucun côté hors d’un exercice unilatéral', () => {
    expect(sideStageFor(pending, false, 1_000)).toBeNull();
  });

  /*
   * Les échauffements restent hors cycle : ils se font des deux côtés sans
   * qu'on les compte, et leur donner une transition ajouterait dix secondes
   * d'attente à chaque montée en charge.
   */
  it('laisse les échauffements hors du cycle', () => {
    expect(sideStageFor({ ...pending, setType: 'warmup' }, true, 1_000)).toBeNull();
  });

  it('n’a plus de côté une fois la série validée', () => {
    expect(sideStageFor({ ...pending, isCompleted: 1 }, true, 1_000)).toBeNull();
    expect(
      sideStageFor(
        { isCompleted: 1, setType: 'normal', unilateralSecondSideStartsAt: 11_000 },
        true,
        20_000,
      ),
    ).toBeNull();
  });

  it('donne dix secondes pour changer de côté', () => {
    expect(SIDE_TRANSITION_MS).toBe(10_000);
  });
});
