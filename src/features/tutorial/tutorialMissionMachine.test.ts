import { describe, expect, it } from 'vitest';
import script from '@/audio/voiceScript.json';
import { createTutorialState } from './tutorialStore';
import { advanceMission, dismissMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath, P1_MISSIONS } from './tutorialMissions';

describe('tutorial mission machine', () => {
  it('starts a mission at its first step', () => {
    expect(startMission(createTutorialState(), 'TUT-ROU-03')).toMatchObject({
      activeMissionId: 'TUT-ROU-03',
      activeStepIndex: 0,
    });
  });

  it('ignores unrelated events', () => {
    const state = startMission(createTutorialState(), 'TUT-WRK-02');
    expect(advanceMission(state, { type: 'routine-created', routineId: 'r1' })).toBe(state);
  });

  it('requires both target and rest steps before starting the routine mission', () => {
    const started = startMission(createTutorialState(), 'TUT-ROU-03');
    const targeted = advanceMission(started, {
      type: 'routine-target-updated',
      routineId: 'r1',
    });
    expect(targeted.activeStepIndex).toBe(1);
    const rested = advanceMission(targeted, {
      type: 'routine-rest-updated',
      routineId: 'r1',
      seconds: 90,
    });
    expect(rested.missions['TUT-ROU-03']).toBe('completed');
    expect(rested.activeMissionId).toBe('TUT-ROU-04');
  });

  it('does not accept an empty export or a restoration write', () => {
    const exporting = startMission(createTutorialState(), 'TUT-DAT-01');
    expect(
      advanceMission(exporting, { type: 'backup-exported', outcome: 'downloaded' }),
    ).toMatchObject({ activeMissionId: 'TUT-DAT-02' });
    const restoring = startMission(createTutorialState(), 'TUT-DAT-02');
    expect(advanceMission(restoring, { type: 'restore-confirmation-opened' })).toMatchObject({
      activeMissionId: null,
      missions: { 'TUT-DAT-02': 'completed' },
    });
  });

  it('persists an explicit dismissal without completing the mission', () => {
    const dismissed = dismissMission(startMission(createTutorialState(), 'TUT-REC-01'));
    expect(dismissed).toMatchObject({
      activeMissionId: null,
      missions: { 'TUT-REC-01': 'dismissed' },
    });
  });

  it('hides incompatible route missions', () => {
    const state = createTutorialState();
    expect(contextualMissionsForPath('/routines', state, { hasActiveWorkout: true })).toEqual([]);
    expect(contextualMissionsForPath('/workout', state, { hasActiveWorkout: false })).toEqual([]);
  });

  it('does not advance when no exercise was added', () => {
    const state = startMission(createTutorialState(), 'TUT-ROU-02');
    expect(
      advanceMission(state, { type: 'routine-exercise-added', routineId: 'r1', count: 0 }),
    ).toBe(state);
  });

  it('does not advance when rest is zero seconds', () => {
    const state = advanceMission(startMission(createTutorialState(), 'TUT-ROU-03'), {
      type: 'routine-target-updated',
      routineId: 'r1',
    });
    expect(
      advanceMission(state, { type: 'routine-rest-updated', routineId: 'r1', seconds: 0 }),
    ).toBe(state);
  });

  it('does not advance when a written workout set is not recordable', () => {
    const state = startMission(createTutorialState(), 'TUT-WRK-01');
    expect(
      advanceMission(state, { type: 'workout-set-written', setId: 's1', recordable: false }),
    ).toBe(state);
  });

  // Le contrat s'est inversé : les missions parlent désormais. Ce qui compte est
  // qu'aucune n'annonce un clip absent du script — un `clipId` orphelin serait un
  // silence qui se fait passer pour une consigne.
  it('donne à chaque étape P1 un clip déclaré dans le script vocal', () => {
    const declared = new Set(script.lines.map((line) => line.id));
    const steps = P1_MISSIONS.flatMap((mission) => mission.steps);

    expect(steps).not.toHaveLength(0);
    for (const step of steps) {
      expect(step.clipId, `${step.id} n'a pas de clip`).toBeDefined();
      expect(declared.has(step.clipId ?? ''), `${step.clipId} absent du script`).toBe(true);
    }
  });
});
