import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
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

  it('ouvre le cycle deux côtés sur une ligne unilatérale, et pas ailleurs', () => {
    const uni = mount('weight_reps', [workoutSet('s1', 8)], true);
    act(() => {
      uni.pace().startFor(uni.line);
    });
    expect(uni.pace().sideStageOf('s1')).toBe('first');

    const bi = mount('weight_reps');
    act(() => {
      bi.pace().startFor(bi.line);
    });
    expect(bi.pace().sideStageOf('s1')).toBeNull();
  });

  // Le contrat : même série, même identifiant, dix secondes réelles.
  it('reprend le second côté sur le même setId, dix secondes plus tard', () => {
    const { line, pace } = mount('weight_reps', [workoutSet('s1', 8)], true);
    act(() => {
      pace().startFor(line);
    });
    expect(useRepPacer.getState().startedAt).toBe(now);

    act(() => {
      expect(pace().turnSideOf(line, 's1')).toBe('changed');
    });

    expect(announce).toHaveBeenCalledWith('side-change');
    expect(useRepPacer.getState().setId).toBe('s1');
    expect(useRepPacer.getState().startedAt).toBe(now + 10_000);
    expect(pace().sideStageOf('s1')).toBe('transition');
  });

  it('termine la série au bout du second côté', () => {
    const { line, pace } = mount('time_only', [workoutSet('s1')], true);
    act(() => {
      pace().startFor(line);
      pace().turnSideOf(line, 's1');
    });

    // Les dix secondes passées, le second côté a commencé.
    vi.setSystemTime(now + 30_000);
    act(() => {
      expect(pace().turnSideOf(line, 's1')).toBe('completed');
    });
    expect(pace().sideStageOf('s1')).toBeNull();
  });

  it('ne tourne rien sur une ligne bilatérale', () => {
    const { line, pace } = mount('weight_reps');
    act(() => {
      pace().startFor(line);
      expect(pace().turnSideOf(line, 's1')).toBe('none');
    });
  });

  it('referme le cycle avec l’horloge', () => {
    const { line, pace } = mount('weight_reps', [workoutSet('s1', 8)], true);
    act(() => {
      pace().startFor(line);
      pace().stop();
    });
    expect(pace().sideStageOf('s1')).toBeNull();
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
