import { describe, expect, it } from 'vitest';
import {
  IDLE_PACE_PLAN,
  PACE_LEAD_SECONDS,
  PACE_SETTLE_MS,
  leadSecondsAt,
  paceDecision,
  planAskingReps,
  planWithoutSet,
  plannedSetIdOf,
  type PacePlan,
} from './paceMachine';
import type { PacePreparation } from './paceTarget';

const ready = (setId: string): PacePreparation => ({
  kind: 'ready',
  target: { setId, reps: 8, repSeconds: 3 },
});
const missing = (setId: string): PacePreparation => ({ kind: 'missing-reps', setId });
const done: PacePreparation = { kind: 'done' };

const awaiting: PacePlan = { kind: 'awaiting-reps', rowId: 'row-1', setId: 'set-1' };
const arming = (launchAt: number): PacePlan => ({
  kind: 'arming',
  rowId: 'row-1',
  setId: 'set-1',
  launchAt,
});

describe('paceDecision', () => {
  it('ne fait rien quand aucun plan n’attend', () => {
    expect(paceDecision(IDLE_PACE_PLAN, ready('set-1'), 0)).toEqual({ kind: 'hold' });
  });

  describe('en attente des répétitions', () => {
    it('lance la cadence dès que la série est renseignée, avec dix secondes', () => {
      const decision = paceDecision(awaiting, ready('set-1'), 0);
      expect(decision).toMatchObject({
        kind: 'start',
        delayMs: PACE_SETTLE_MS,
        rowId: 'row-1',
        setId: 'set-1',
        launchAt: null,
        announceStart: true,
      });
    });

    it('attend sans rien programmer tant que les répétitions manquent', () => {
      expect(paceDecision(awaiting, missing('set-1'), 0)).toEqual({ kind: 'hold' });
    });

    it('oublie la série validée pendant son attente', () => {
      // La cible passe à la suivante : le plan ne pointe plus rien à faire.
      expect(paceDecision(awaiting, ready('set-2'), 0)).toEqual({ kind: 'forget' });
    });

    it('oublie la série supprimée avec sa ligne', () => {
      expect(paceDecision(awaiting, null, 0)).toEqual({ kind: 'forget' });
    });

    it('oublie l’exercice terminé', () => {
      expect(paceDecision(awaiting, done, 0)).toEqual({ kind: 'forget' });
    });
  });

  describe('armée par la saisie', () => {
    it('fixe la cible sur la valeur stabilisée et garde l’échéance', () => {
      const decision = paceDecision(arming(10_000), ready('set-1'), 0);
      expect(decision).toMatchObject({
        kind: 'start',
        delayMs: PACE_SETTLE_MS,
        setId: 'set-1',
        launchAt: 10_000,
        // Le tap qui a armé le plan a déjà dit « dans dix secondes ».
        announceStart: false,
      });
    });

    it('demande les répétitions à l’échéance quand elles manquent toujours', () => {
      expect(paceDecision(arming(10_000), missing('set-1'), 2_000)).toEqual({
        kind: 'ask',
        delayMs: 8_000,
        rowId: 'row-1',
        setId: 'set-1',
      });
    });

    it('demande sans délai négatif quand l’échéance est passée', () => {
      expect(paceDecision(arming(1_000), missing('set-1'), 9_000)).toMatchObject({
        kind: 'ask',
        delayMs: 0,
      });
    });

    it('oublie la série validée dans ses dix secondes de préparation', () => {
      // Le geste ordinaire : saisir la série après l’avoir faite, puis la
      // valider. L’état qui la préparait doit partir avec elle.
      expect(paceDecision(arming(10_000), ready('set-2'), 0)).toEqual({ kind: 'forget' });
    });
  });
});

describe('leadSecondsAt', () => {
  it('donne dix secondes pleines à un départ sans échéance', () => {
    expect(leadSecondsAt(null, 5_000)).toBe(PACE_LEAD_SECONDS);
  });

  it('ne garde que le temps restant jusqu’à l’échéance', () => {
    expect(leadSecondsAt(10_000, 2_500)).toBe(7.5);
  });

  it('repart sur dix secondes quand l’échéance est déjà passée', () => {
    expect(leadSecondsAt(10_000, 12_000)).toBe(PACE_LEAD_SECONDS);
  });
});

describe('transitions', () => {
  it('libère le plan de la série confiée au métronome', () => {
    expect(planWithoutSet(awaiting, 'set-1')).toEqual(IDLE_PACE_PLAN);
  });

  it('laisse en place un plan armé entre-temps sur une autre série', () => {
    const later: PacePlan = { kind: 'arming', rowId: 'row-1', setId: 'set-2', launchAt: 10_000 };
    expect(planWithoutSet(later, 'set-1')).toBe(later);
  });

  it('bascule la saisie armée vers l’attente des répétitions', () => {
    expect(planAskingReps(arming(10_000), 'row-1', 'set-1')).toEqual({
      kind: 'awaiting-reps',
      rowId: 'row-1',
      setId: 'set-1',
    });
  });

  it('ne rebascule pas un plan qui a déjà changé de série', () => {
    const plan = arming(10_000);
    expect(planAskingReps(plan, 'row-1', 'set-2')).toBe(plan);
  });

  it('nomme la série attendue, et rien quand il n’y en a pas', () => {
    expect(plannedSetIdOf(awaiting)).toBe('set-1');
    expect(plannedSetIdOf(IDLE_PACE_PLAN)).toBeNull();
  });
});
