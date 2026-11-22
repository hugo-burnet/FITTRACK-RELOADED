import type { RpeDisciplineEvent, SetType, WorkoutStatus } from '@/data/types';

export type { RpeDisciplineEvent };

/**
 * Le protocole disciplinaire RPE — le plafond d'effort qu'on s'est fixé pour la séance.
 *
 * **Ce n'est pas le seuil du coach.** Le coach lit `INCREASE_MAX_RPE` (8,5) *après* la séance pour
 * décider si la charge peut monter ; ce plafond-ci agit *pendant* la séance et arrête les séries.
 * Deux règles, deux constantes, deux modules : les confondre ferait qu'un réglage de discipline
 * change en silence les progressions proposées, ou l'inverse.
 *
 * **Le protocole ne touche jamais au RPE.** Il lit la valeur que la personne a saisie et écrit à côté
 * d'elle, sur la séance, un journal d'événements (`Workout.rpeDiscipline`). Le verrou se *déduit* de
 * ce journal : c'est ce qui le fait survivre à un rechargement, à un kill et à l'absence de réseau
 * sans aucun état en mémoire, et ce qui rend chaque correction et chaque dérogation traçables.
 *
 * Pur : la base, l'horloge et l'audio sont à l'extérieur (`data/repositories/rpeDiscipline.ts`).
 */

export interface RpeDisciplineSettings {
  enabled: boolean;
  /** Le RPE le plus haut autorisé. Strictement au-dessus : dépassement. */
  ceiling: number;
}

export const DEFAULT_RPE_DISCIPLINE: Readonly<RpeDisciplineSettings> = {
  enabled: true,
  ceiling: 8,
};

/**
 * Les plafonds proposés : la grille du RPE (RF-30, 6 à 10 par demi-points), sans 10 — un plafond
 * à 10 ne peut jamais être dépassé, c'est un protocole désactivé qui ne le dit pas.
 */
export const RPE_CEILING_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5] as const;

/** Assez pour absorber un 8,000000001 venu d'un calcul, jamais assez pour avaler un demi-point. */
const EPSILON = 1e-9;

export function normalizeRpeDisciplineSettings(value: unknown): RpeDisciplineSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_RPE_DISCIPLINE };
  const record = value as Record<string, unknown>;
  const { enabled, ceiling } = record;
  if (
    typeof enabled !== 'boolean' ||
    typeof ceiling !== 'number' ||
    !(RPE_CEILING_OPTIONS as readonly number[]).includes(ceiling)
  ) {
    return { ...DEFAULT_RPE_DISCIPLINE };
  }
  return { enabled, ceiling };
}

/** Un RPE manquant ne dépasse rien : on ne punit pas une case vide. */
export function exceedsCeiling(rpe: number | undefined, ceiling: number): boolean {
  return typeof rpe === 'number' && Number.isFinite(rpe) && rpe > ceiling + EPSILON;
}

export type TriggeredEvent = Extract<RpeDisciplineEvent, { kind: 'triggered' }>;

export type RpeDisciplineState =
  | { status: 'clear'; overrides: number }
  | { status: 'locked'; trigger: TriggeredEvent; overrides: number };

function isEvent(value: unknown): value is RpeDisciplineEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  if (typeof event.at !== 'number' || typeof event.setId !== 'string') return false;
  if (typeof event.ceiling !== 'number') return false;
  switch (event.kind) {
    case 'triggered':
      return typeof event.rpe === 'number';
    case 'corrected':
    case 'override':
      return true;
    default:
      return false;
  }
}

/** Les événements lisibles, dans l'ordre où ils ont été écrits. */
export function readDisciplineEvents(events: unknown): RpeDisciplineEvent[] {
  return Array.isArray(events) ? events.filter(isEvent) : [];
}

/**
 * Le verrou, déduit du journal — jamais stocké à part, donc jamais en désaccord avec lui.
 *
 * - `triggered` verrouille ;
 * - `corrected` sur la série qui verrouille rouvre si la valeur corrigée tient sous le plafond
 *   **figé au déclenchement**, et met sinon la valeur à jour ;
 * - `override` rouvre.
 */
export function disciplineState(events: unknown): RpeDisciplineState {
  let lock = null as TriggeredEvent | null;
  let overrides = 0;

  for (const event of readDisciplineEvents(events)) {
    switch (event.kind) {
      case 'triggered':
        lock = event;
        break;
      case 'corrected': {
        const current: TriggeredEvent | null = lock;
        if (current === null || current.setId !== event.setId) break;
        lock =
          event.rpe !== undefined && exceedsCeiling(event.rpe, current.ceiling)
            ? { ...current, rpe: event.rpe }
            : null;
        break;
      }
      case 'override':
        if (lock === null) break;
        overrides += 1;
        lock = null;
        break;
    }
  }

  return lock === null
    ? { status: 'clear', overrides }
    : { status: 'locked', trigger: lock, overrides };
}

/** Ce que le dépôt sait d'une série au moment où son RPE vient d'être écrit. */
export interface RpeDisciplineSubject {
  workoutStatus: WorkoutStatus;
  events: unknown;
  setId: string;
  setType: SetType;
  isCompleted: boolean;
  /** Le RPE avant l'écriture. */
  previousRpe: number | undefined;
  /** Le RPE après l'écriture. */
  rpe: number | undefined;
}

/**
 * L'événement à ajouter au journal après l'écriture d'une série, ou `null`.
 *
 * **Une seule voie, quel que soit le geste** — la coche, la bande d'effort, la feuille de série, la
 * correction depuis le panneau : chacune écrit la série, puis demande ici ce que cela change. C'est
 * ce qui garantit qu'un dépassement n'est constaté qu'une fois, et qu'aucune modification du RPE
 * d'une série qui a déclenché le protocole n'échappe au journal.
 *
 * Ne s'applique qu'à une séance **en cours** : corriger l'historique d'une séance passée n'a rien de
 * disciplinaire, et le protocole ne s'applique jamais rétroactivement.
 */
export function decideRpeDiscipline(
  settings: RpeDisciplineSettings,
  subject: RpeDisciplineSubject,
  now: number,
): RpeDisciplineEvent | null {
  if (!settings.enabled || subject.workoutStatus !== 'active') return null;
  if (!subject.isCompleted) return null;

  const events = readDisciplineEvents(subject.events);
  const state = disciplineState(events);
  const changed = subject.previousRpe !== subject.rpe;

  const correction = (ceiling: number): RpeDisciplineEvent => ({
    kind: 'corrected',
    at: now,
    setId: subject.setId,
    ...(subject.previousRpe === undefined ? {} : { previousRpe: subject.previousRpe }),
    ...(subject.rpe === undefined ? {} : { rpe: subject.rpe }),
    ceiling,
  });

  if (state.status === 'locked' && state.trigger.setId === subject.setId) {
    return changed ? correction(state.trigger.ceiling) : null;
  }

  // Une dérogation exempte la série qu'elle couvre — pas les suivantes.
  const exempt = events.some((event) => event.kind === 'override' && event.setId === subject.setId);
  if (
    state.status === 'clear' &&
    !exempt &&
    subject.setType !== 'warmup' &&
    exceedsCeiling(subject.rpe, settings.ceiling)
  ) {
    return {
      kind: 'triggered',
      at: now,
      setId: subject.setId,
      rpe: subject.rpe!,
      ceiling: settings.ceiling,
    };
  }

  const traced = events.some(
    (event) => event.kind === 'triggered' && event.setId === subject.setId,
  );
  if (traced && changed) {
    const last = [...events].reverse().find((event) => event.setId === subject.setId);
    return correction(last?.ceiling ?? settings.ceiling);
  }
  return null;
}

/**
 * L'état qui s'applique **maintenant** : protocole désactivé ou séance close, jamais verrouillé — le
 * journal reste ce qu'il est, seul son effet s'éteint. La même lecture pour le dépôt et pour l'écran,
 * sans quoi l'un pourrait refuser une série que l'autre montre comme validable.
 */
export function effectiveDisciplineState(
  settings: RpeDisciplineSettings,
  workoutStatus: WorkoutStatus,
  events: unknown,
): RpeDisciplineState {
  const state = disciplineState(events);
  if (state.status === 'locked' && (!settings.enabled || workoutStatus !== 'active')) {
    return { status: 'clear', overrides: state.overrides };
  }
  return state;
}
