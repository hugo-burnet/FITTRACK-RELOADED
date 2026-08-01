import { describe, expect, it } from 'vitest';
import { pickSuggestedRoutine, type SuggestionCandidate } from './home';

const at = (year: number, month: number, day: number): number =>
  new Date(year, month, day, 12).getTime();

const push: SuggestionCandidate = { routineId: 'push', order: 0 };
const pull: SuggestionCandidate = { routineId: 'pull', order: 1 };
const legs: SuggestionCandidate = { routineId: 'legs', order: 2 };

describe('pickSuggestedRoutine', () => {
  it('propose une routine jamais réalisée avant toute autre', () => {
    const pick = pickSuggestedRoutine(
      [push, pull, legs],
      [
        { routineId: 'push', startedAt: at(2026, 6, 20) },
        { routineId: 'legs', startedAt: at(2026, 0, 5) },
      ],
    );

    expect(pick).toEqual({ routineId: 'pull', lastPerformedAt: null });
  });

  it('propose la routine réalisée le moins récemment', () => {
    const pick = pickSuggestedRoutine(
      [push, pull, legs],
      [
        { routineId: 'push', startedAt: at(2026, 6, 20) },
        { routineId: 'pull', startedAt: at(2026, 6, 10) },
        { routineId: 'legs', startedAt: at(2026, 6, 15) },
        // Une séance plus ancienne ne rajeunit pas la routine : c'est la
        // dernière fois qui compte, pas la première.
        { routineId: 'push', startedAt: at(2026, 0, 2) },
      ],
    );

    expect(pick).toEqual({ routineId: 'pull', lastPerformedAt: at(2026, 6, 10) });
  });

  it('ignore les séances sans routine', () => {
    const pick = pickSuggestedRoutine(
      [push, pull],
      [
        { routineId: 'push', startedAt: at(2026, 6, 20) },
        { routineId: 'pull', startedAt: at(2026, 6, 25) },
        // Séance libre et import Hevy : aucune routine derrière, aucun effet.
        { routineId: '', startedAt: at(2026, 6, 30) },
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
        { routineId: 'legs', startedAt: at(2025, 0, 1) },
        { routineId: 'push', startedAt: at(2026, 6, 20) },
      ],
    );

    expect(pick).toEqual({ routineId: 'push', lastPerformedAt: at(2026, 6, 20) });
  });

  it('tranche les égalités par l’ordre de la liste, quel que soit l’ordre des lignes', () => {
    const sameDay = at(2026, 6, 20);
    const workouts = [
      { routineId: 'push', startedAt: sameDay },
      { routineId: 'pull', startedAt: sameDay },
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

  it('retourne null sans aucune routine', () => {
    expect(pickSuggestedRoutine([], [{ routineId: 'push', startedAt: at(2026, 6, 20) }])).toBeNull();
  });
});
