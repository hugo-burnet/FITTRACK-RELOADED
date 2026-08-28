import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { applyAnnouncerMode } from '@/stores/announcer';
import { useWorkoutPace, type WorkoutPace } from './useWorkoutPace';

const announce = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/audio/announce', () => ({ announce, primeAnnouncer: vi.fn() }));

const now = 1_000_000;

function exercise(measurementType: Exercise['measurementType'], unilateral = false): Exercise {
  return {
    id: 'ex',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    name: 'Gainage',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    measurementType,
    isCustom: 0,
    isUnilateral: unilateral ? 1 : 0,
  };
}

function row(): WorkoutExercise {
  return {
    id: 'row',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    workoutId: 'w',
    exerciseId: 'ex',
    order: 0,
    supersetGroup: 0,
    restSeconds: 60,
  };
}

function workoutSet(id: string, reps?: number): WorkoutSet {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    workoutExerciseId: 'row',
    exerciseId: 'ex',
    workoutId: 'w',
    order: 0,
    setType: 'normal',
    side: 'both',
    reps,
    isCompleted: 0,
    performedAt: 0,
  };
}

function mount(
  measurementType: Exercise['measurementType'],
  sets: WorkoutSet[] = [workoutSet('s1', 8)],
  unilateral = false,
) {
  const line = { row: row(), exercise: exercise(measurementType, unilateral), sets };
  const captured: { pace: WorkoutPace | null } = { pace: null };
  function Probe() {
    captured.pace = useWorkoutPace([line], 3);
    return null;
  }
  render(<Probe />);
  const pace = () => {
    if (captured.pace === null) throw new Error('hook non monté');
    return captured.pace;
  };
  return { line, pace };
}

describe('useWorkoutPace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
    useRestTimer.getState().stop();
  });

  afterEach(() => {
    vi.useRealTimers();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
    useRestTimer.getState().stop();
  });

  it('démarre un maintien avec dix secondes pour se mettre en position', () => {
    const { line, pace } = mount('time_only');

    act(() => {
      expect(pace().startFor(line)).toBe(true);
    });

    expect(useHoldTimer.getState().setId).toBe('s1');
    expect(useHoldTimer.getState().startedAt).toBe(now + 10_000);
    expect(announce).toHaveBeenCalledWith('pace-start-10');
  });

  // L'horloge d'un maintien est la valeur écrite dans la série : partie à la fin
  // du repos, elle compterait comme du gainage le temps de se mettre au sol. Le
  // 3-2-1 du repos dit « le repos se termine », pas « tu es en position ».
  it('garde ses dix secondes même quand le maintien suit un repos', () => {
    const { line, pace } = mount('time_only', [
      { ...workoutSet('s0'), isCompleted: 1 },
      workoutSet('s1'),
    ]);

    act(() => {
      expect(pace().startFor(line, 's0')).toBe(true);
    });

    expect(useHoldTimer.getState().setId).toBe('s1');
    expect(useHoldTimer.getState().startedAt).toBe(now + 10_000);
    // Et le T0 n'est pas muet : l'alerte de fin de repos est sautée dès que le
    // relais réussit, donc c'est cette annonce qui marque le passage.
    expect(announce).toHaveBeenCalledWith('pace-start-10');
  });

  // Une cadence de répétitions, elle, part bien à zéro après un repos : la main
  // est déjà sur la barre, et son premier battement tombe tout de suite.
  it('enchaîne une cadence de répétitions sans préparation après un repos', () => {
    const { line, pace } = mount('weight_reps', [
      { ...workoutSet('s0', 8), isCompleted: 1 },
      workoutSet('s1', 8),
    ]);

    act(() => {
      expect(pace().startFor(line, 's0')).toBe(true);
    });

    expect(useRepPacer.getState().setId).toBe('s1');
    expect(useRepPacer.getState().startedAt).toBe(now);
  });

  it('n’a jamais deux horloges qui tournent', () => {
    const timed = mount('time_only');
    act(() => {
      useRepPacer.getState().start('row', 's1', 8, 3);
      timed.pace().startFor(timed.line);
    });

    expect(useRepPacer.getState().setId).toBeNull();
    expect(useHoldTimer.getState().setId).toBe('s1');

    const counted = mount('weight_reps');
    act(() => {
      counted.pace().startFor(counted.line);
    });

    expect(useHoldTimer.getState().setId).toBeNull();
    expect(useRepPacer.getState().setId).toBe('s1');
  });

  it('arrête les deux horloges', () => {
    const { line, pace } = mount('time_only');
    act(() => {
      pace().startFor(line);
      pace().stop();
    });

    expect(useHoldTimer.getState().setId).toBeNull();
    expect(useRepPacer.getState().setId).toBeNull();
  });

  // Un exercice chronométré n'a pas de colonne « reps » : rien ne doit s'armer.
  it('ne s’arme pas sur une valeur saisie dans une ligne chronométrée', () => {
    const { line, pace } = mount('time_only');
    act(() => {
      pace().armFromTypedReps(line, 's1', 8);
    });

    expect(useRepPacer.getState().setId).toBeNull();
    expect(useHoldTimer.getState().setId).toBeNull();
  });

  it('arme toujours la cadence sur une valeur saisie dans une ligne comptée', () => {
    const { line, pace } = mount('weight_reps', [workoutSet('s1')]);
    act(() => {
      pace().armFromTypedReps(line, 's1', 8);
    });

    expect(announce).toHaveBeenCalledWith('pace-start-10');
  });

  /*
   * Le stade ne s'ouvre plus au démarrage d'une horloge : il se **lit dans la
   * série**, où le repository a écrit l'échéance du second côté. C'est ce qui
   * lui permet de survivre à un écran éteint, à un appel et à un kill — un
   * cycle en mémoire repartait de zéro et renvoyait au premier côté quelqu'un
   * qui venait de finir les deux.
   */
  it('lit le stade dans la série, pas dans une horloge', () => {
    const pending = mount('weight_reps', [workoutSet('s1', 8)], true);
    expect(pending.pace().sideStageOf('s1')).toBe('first');

    const turning = mount(
      'weight_reps',
      [{ ...workoutSet('s1', 8), unilateralSecondSideStartsAt: now + 10_000 }],
      true,
    );
    expect(turning.pace().sideStageOf('s1')).toBe('transition');

    vi.setSystemTime(now + 10_000);
    expect(turning.pace().sideStageOf('s1')).toBe('second');
  });

  it('ne connaît aucun côté sur une ligne bilatérale', () => {
    const bi = mount('weight_reps', [workoutSet('s1', 8)]);
    expect(bi.pace().sideStageOf('s1')).toBeNull();
  });

  // Le contrat : même série, même identifiant, dix secondes réelles.
  it('reprend le second côté sur le même setId, à l’échéance écrite', () => {
    const { line, pace } = mount('weight_reps', [workoutSet('s1', 8)], true);
    act(() => {
      pace().startFor(line);
    });
    expect(useRepPacer.getState().startedAt).toBe(now);

    act(() => {
      pace().startSecondSide(line, 's1', now + 10_000);
    });

    expect(useRepPacer.getState().setId).toBe('s1');
    expect(useRepPacer.getState().startedAt).toBe(now + 10_000);
  });

  /*
   * « Voix uniquement » n'a pas de cadence du tout, pas une cadence muette. La
   * refuser ici et pas seulement dans le magasin évite d'annoncer « dans dix
   * secondes » avant d'armer une horloge qui serait ensuite rejetée en silence.
   *
   * Le maintien n'est pas concerné : ce n'est pas un tempo, c'est la mesure de
   * la série, et la retirer effacerait la valeur écrite.
   */
  describe('Voix uniquement', () => {
    beforeEach(() => applyAnnouncerMode('voice-only'));
    afterEach(() => applyAnnouncerMode('voice'));

    it('ne lance jamais le métronome de répétitions', () => {
      const { line, pace } = mount('weight_reps', [workoutSet('s1', 8)]);

      act(() => {
        expect(pace().startFor(line)).toBe(false);
      });

      expect(useRepPacer.getState().setId).toBeNull();
      expect(announce).not.toHaveBeenCalledWith('pace-start-10');
    });

    it('n’arme rien non plus depuis la saisie des répétitions', () => {
      const { line, pace } = mount('weight_reps', [workoutSet('s1')]);

      act(() => {
        pace().armFromTypedReps(line, 's1', 8);
      });

      expect(announce).not.toHaveBeenCalledWith('pace-start-10');
    });

    it('garde le chrono de maintien', () => {
      const { line, pace } = mount('time_only', [workoutSet('h1')]);

      act(() => {
        expect(pace().startFor(line)).toBe(true);
      });

      expect(useHoldTimer.getState().setId).toBe('h1');
    });
  });

  /*
   * Arrêter l'horloge n'oublie plus le côté déjà fait, et c'est le changement.
   *
   * Le cycle en mémoire se refermait avec le métronome : couper le son au
   * milieu d'une série unilatérale, ou simplement laisser l'écran s'éteindre,
   * renvoyait au premier côté. La progression vit maintenant dans la série, et
   * seules la validation, la décoche et `resetUnilateralProgress` l'effacent.
   */
  it('n’oublie pas le côté déjà fait quand l’horloge s’arrête', () => {
    const turning = mount(
      'weight_reps',
      [{ ...workoutSet('s1', 8), unilateralSecondSideStartsAt: now + 10_000 }],
      true,
    );

    act(() => {
      turning.pace().stop();
    });

    expect(turning.pace().sideStageOf('s1')).toBe('transition');
  });

  it('dit à la feuille ce qu’elle pilote', () => {
    const timed = mount('time_only');
    expect(timed.pace().viewFor(timed.line, 'Gainage')).toMatchObject({
      kind: 'hold',
      canStart: true,
      running: false,
      reps: null,
    });

    const counted = mount('weight_reps');
    expect(counted.pace().viewFor(counted.line, 'Développé')).toMatchObject({
      kind: 'reps',
      canStart: true,
      reps: 8,
    });
  });
});
