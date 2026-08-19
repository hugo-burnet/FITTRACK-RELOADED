import { describe, expect, it } from 'vitest';
import { pickSuggestedRoutine, type SuggestionCandidate } from './home';

const at = (year: number, month: number, day: number): number =>
  new Date(year, month, day, 12).getTime();

const push: SuggestionCandidate = { routineId: 'push', name: 'PUSH A', order: 0 };
const pull: SuggestionCandidate = { routineId: 'pull', name: 'PULL A', order: 1 };
const legs: SuggestionCandidate = { routineId: 'legs', name: 'LOWER A', order: 2 };

/** Une séance lancée depuis l'app : son `routineId` suffit, son nom ne sert pas. */
const done = (routineId: string, startedAt: number) => ({
  routineId,
  name: '',
  startedAt,
});

/** Une séance importée ou libre : plus de `routineId`, seulement un titre. */
const imported = (name: string, startedAt: number) => ({
  routineId: '',
  name,
  startedAt,
});

describe('pickSuggestedRoutine', () => {
  it('propose une routine jamais réalisée avant toute autre', () => {
    const pick = pickSuggestedRoutine(
      [push, pull, legs],
      [
        done('push', at(2026, 6, 20)),
        done('legs', at(2026, 0, 5)),
      ],
    );

    expect(pick).toEqual({ routineId: 'pull', lastPerformedAt: null });
  });

  it('propose la routine réalisée le moins récemment', () => {
    const pick = pickSuggestedRoutine(
      [push, pull, legs],
      [
        done('push', at(2026, 6, 20)),
        done('pull', at(2026, 6, 10)),
        done('legs', at(2026, 6, 15)),
        // Une séance plus ancienne ne rajeunit pas la routine : c'est la
        // dernière fois qui compte, pas la première.
        done('push', at(2026, 0, 2)),
      ],
    );

    expect(pick).toEqual({ routineId: 'pull', lastPerformedAt: at(2026, 6, 10) });
  });

  it('ignore les séances sans routine', () => {
    const pick = pickSuggestedRoutine(
      [push, pull],
      [
        done('push', at(2026, 6, 20)),
        done('pull', at(2026, 6, 25)),
        // Séance libre sans nom de routine : aucune routine derrière, aucun effet.
        imported('Séance libre', at(2026, 6, 30)),
      ],
    );

    expect(pick).toEqual({ routineId: 'push', lastPerformedAt: at(2026, 6, 20) });
  });

  it('ne propose jamais une routine supprimée ou introuvable', () => {
    const pick = pickSuggestedRoutine(
      [push],
      [
        // `legs` n'est plus dans la liste : ses séances restent dans
        // l'historique, elle ne doit pas ressortir comme « la plus ancienne ».
        done('legs', at(2025, 0, 1)),
        done('push', at(2026, 6, 20)),
      ],
    );

    expect(pick).toEqual({ routineId: 'push', lastPerformedAt: at(2026, 6, 20) });
  });

  it('tranche les égalités par l’ordre de la liste, quel que soit l’ordre des lignes', () => {
    const sameDay = at(2026, 6, 20);
    const workouts = [
      done('push', sameDay),
      done('pull', sameDay),
    ];

    expect(pickSuggestedRoutine([push, pull], workouts)).toEqual({
      routineId: 'push',
      lastPerformedAt: sameDay,
    });
    expect(pickSuggestedRoutine([pull, push], [...workouts].reverse())).toEqual({
      routineId: 'push',
      lastPerformedAt: sameDay,
    });
    // Deux routines jamais réalisées : la première de la liste sort aussi.
    expect(pickSuggestedRoutine([legs, pull], [])).toEqual({
      routineId: 'pull',
      lastPerformedAt: null,
    });
  });

  /**
   * Reporté du téléphone : « LOWER A — jamais réalisée » alors que l'historique
   * en était plein. L'import Hevy écrit ses séances sans `routineId` **et**
   * fabrique les routines à partir de ces mêmes séances, groupées par titre :
   * sans rattachement par le nom, toute une bibliothèque importée reste
   * éternellement « jamais réalisée ».
   */
  it('rattache par le nom une séance importée sans routineId', () => {
    const pick = pickSuggestedRoutine(
      [push, legs],
      [
        done('push', at(2026, 6, 20)),
        imported('LOWER A', at(2026, 6, 25)),
      ],
    );

    expect(pick).toEqual({ routineId: 'push', lastPerformedAt: at(2026, 6, 20) });
  });

  it('rattache par le nom malgré la casse et les espaces', () => {
    expect(
      pickSuggestedRoutine([legs], [imported('  lower   a ', at(2026, 6, 25))]),
    ).toEqual({ routineId: 'legs', lastPerformedAt: at(2026, 6, 25) });
  });

  it('garde la séance la plus récente entre rattachement direct et par le nom', () => {
    expect(
      pickSuggestedRoutine(
        [legs],
        [
          done('legs', at(2026, 6, 20)),
          imported('LOWER A', at(2026, 6, 25)),
        ],
      ),
    ).toEqual({ routineId: 'legs', lastPerformedAt: at(2026, 6, 25) });
  });

  it('compte pour les deux quand deux routines portent le même nom', () => {
    // Ne rattacher à aucune des deux était pire que de les compter toutes :
    // « LOWER A » réalisée hier laissait deux « LOWER A » en « jamais
    // réalisée », et l'accueil en proposait une le lendemain matin.
    const twin: SuggestionCandidate = { routineId: 'legs-bis', name: 'lower a', order: 3 };

    expect(pickSuggestedRoutine([legs, twin], [imported('LOWER A', at(2026, 6, 25))])).toEqual({
      routineId: 'legs',
      lastPerformedAt: at(2026, 6, 25),
    });
  });

  it('ne laisse pas le jumeau d’une routine faite ce matin passer pour jamais réalisée', () => {
    // Le cas vu sur le téléphone : la migration v8 a rendu visibles les copies
    // de version que la liste masquait. La séance du matin porte le
    // `routineId` de l'une ; l'autre, identique et jamais lancée, passait
    // devant tout le monde sous le même nom.
    const upper: SuggestionCandidate = { routineId: 'upper-a', name: 'UPPER A', order: 0 };
    const copy: SuggestionCandidate = { routineId: 'upper-a-copie', name: 'UPPER A', order: 1 };
    const lower: SuggestionCandidate = { routineId: 'lower-b', name: 'LOWER B', order: 2 };

    expect(
      pickSuggestedRoutine(
        [upper, copy, lower],
        [
          { routineId: 'upper-a', name: 'UPPER A', startedAt: at(2026, 7, 19) },
          { routineId: 'lower-b', name: 'LOWER B', startedAt: at(2026, 7, 16) },
        ],
      ),
    ).toEqual({ routineId: 'lower-b', lastPerformedAt: at(2026, 7, 16) });
  });

  it('rattache par le nom une séance dont la routine a été supprimée puis recréée', () => {
    // `routineId` pointe sur une routine qui n'existe plus ; celle qui porte le
    // nom aujourd'hui est bien celle que l'utilisateur a faite.
    expect(
      pickSuggestedRoutine(
        [legs],
        [{ routineId: 'ancienne-legs', name: 'LOWER A', startedAt: at(2026, 6, 25) }],
      ),
    ).toEqual({ routineId: 'legs', lastPerformedAt: at(2026, 6, 25) });
  });

  it('retourne null sans aucune routine', () => {
    expect(pickSuggestedRoutine([], [done('push', at(2026, 6, 20))])).toBeNull();
  });
});
