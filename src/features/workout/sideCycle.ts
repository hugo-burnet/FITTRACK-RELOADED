/**
 * Le cycle deux côtés d'une série unilatérale.
 *
 * **Une ligne, deux côtés, un `setId`.** C'est le contrat : une saisie, une
 * validation, un enregistrement. Ce module ne connaît donc qu'une série à la
 * fois — il dit à quel côté elle en est, jamais combien de séries il y a.
 *
 * **Trois stades visibles, deux stockés.** `transition` n'est pas un état de
 * plus : c'est `second` avant son instant de reprise. Le stade se **dérive**
 * d'un instant absolu au lieu d'être avancé par un minuteur — même règle que la
 * barre de repos, le métronome et le chrono, et une raison de moins pour que
 * deux horloges se désynchronisent.
 *
 * **Les dix secondes ne sont pas comptées deux fois.** Elles *sont* la fenêtre
 * de préparation de l'horloge du second côté : `resumesAt` et le `startedAt` de
 * cette horloge sont le même instant.
 */
export type SideStage = 'first' | 'transition' | 'second';

export type SideCycle =
  | { kind: 'idle' }
  | { kind: 'first'; setId: string }
  | { kind: 'second'; setId: string; resumesAt: number };

export const IDLE_SIDE_CYCLE: SideCycle = { kind: 'idle' };

/** « Changement de côté. Reprise dans dix secondes. » — et dix, réellement. */
export const SIDE_CHANGE_LEAD_SECONDS = 10;

/** Ce que devient le cycle quand une horloge démarre sur une série. */
export function openSideCycle(setId: string, unilateral: boolean): SideCycle {
  return unilateral ? { kind: 'first', setId } : IDLE_SIDE_CYCLE;
}

/** Le stade visible d'une série, `null` quand elle n'est pas dans le cycle. */
export function sideStageAt(cycle: SideCycle, setId: string, now: number): SideStage | null {
  if (cycle.kind === 'idle' || cycle.setId !== setId) return null;
  if (cycle.kind === 'first') return 'first';
  return now < cycle.resumesAt ? 'transition' : 'second';
}

export type SideTurn =
  /** Le premier côté est fini : annoncer, attendre dix secondes, reprendre. */
  | { kind: 'change'; cycle: SideCycle }
  /** Le second côté est fini : la série peut se terminer. */
  | { kind: 'complete' }
  /** Rien à faire : hors cycle, ou pendant les dix secondes. */
  | { kind: 'ignore' };

export function turnSide(cycle: SideCycle, setId: string, now: number): SideTurn {
  const stage = sideStageAt(cycle, setId, now);
  if (stage === null) return { kind: 'ignore' };
  if (stage === 'first') {
    return {
      kind: 'change',
      cycle: { kind: 'second', setId, resumesAt: now + SIDE_CHANGE_LEAD_SECONDS * 1_000 },
    };
  }
  // Pendant la transition, le second côté n'a pas commencé : il n'y a rien à
  // finir, et le compter terminerait la série sur un côté qui n'a pas eu lieu.
  return stage === 'transition' ? { kind: 'ignore' } : { kind: 'complete' };
}

/** Referme le cycle d'une série validée, arrêtée ou supprimée. */
export function sideCycleWithoutSet(cycle: SideCycle, setId?: string): SideCycle {
  if (cycle.kind === 'idle') return cycle;
  return setId === undefined || cycle.setId === setId ? IDLE_SIDE_CYCLE : cycle;
}
