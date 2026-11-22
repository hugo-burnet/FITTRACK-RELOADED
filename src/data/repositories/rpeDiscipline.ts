import { db } from '@/data/db';
import type { RpeDisciplineEvent, WorkoutSet } from '@/data/types';
import { FIRST_RPE_BREACH_MILESTONE_ID } from '@/lib/milestones/catalogue';
import {
  DEFAULT_RPE_DISCIPLINE,
  decideRpeDiscipline,
  disciplineState,
  effectiveDisciplineState,
  normalizeRpeDisciplineSettings,
  readDisciplineEvents,
  type RpeDisciplineSettings,
  type RpeDisciplineState,
} from '@/lib/rpeDiscipline';
import { touch } from './base';
import { grantSecretMilestone } from './milestones';

/**
 * Le protocole disciplinaire RPE côté base : le réglage, le journal de la séance, et les deux gestes
 * qui le font sortir du verrou (correction, dérogation).
 *
 * Les règles sont dans `lib/rpeDiscipline` ; ici, seulement ce qui lit et écrit. Les écritures de
 * séries (`workoutSets.ts`) appellent `applyRpeDisciplineAfterWrite` **dans leur propre
 * transaction** : la série et le constat du dépassement entrent en base ensemble, ou pas du tout.
 * Un kill entre les deux ne peut donc pas laisser une série à RPE 9 sans verrou.
 */

const SETTINGS_KEY = 'rpeDiscipline';

/** Une série validée sur une séance verrouillée : le refus vient de la base, pas seulement de l'écran. */
export class RpeDisciplineLockedError extends Error {
  constructor() {
    super('Protocole disciplinaire RPE : séries suspendues pour cette séance');
    this.name = 'RpeDisciplineLockedError';
  }
}

/** Ce que l'écriture d'un RPE a changé au protocole. `triggered` = annoncer, une fois. */
export type RpeDisciplineOutcome = 'triggered' | 'corrected' | 'none';

export async function getRpeDisciplineSettings(): Promise<RpeDisciplineSettings> {
  const stored = await db.settings.get(SETTINGS_KEY);
  return stored === undefined
    ? { ...DEFAULT_RPE_DISCIPLINE }
    : normalizeRpeDisciplineSettings(stored.value);
}

export async function setRpeDisciplineSettings(
  settings: RpeDisciplineSettings,
): Promise<RpeDisciplineSettings> {
  const normalized = normalizeRpeDisciplineSettings(settings);
  await db.settings.put({ key: SETTINGS_KEY, value: normalized, updatedAt: Date.now() });
  return normalized;
}

/**
 * L'état du protocole pour une séance. Protocole désactivé ou séance close : jamais verrouillé.
 * Le journal, lui, reste intact — désactiver n'efface rien.
 */
export async function getRpeDisciplineState(workoutId: string): Promise<RpeDisciplineState> {
  const [settings, workout] = await Promise.all([
    getRpeDisciplineSettings(),
    db.workouts.get(workoutId),
  ]);
  if (workout === undefined) return disciplineState(undefined);
  return effectiveDisciplineState(settings, workout.status, workout.rpeDiscipline);
}

/** À appeler dans une transaction qui couvre `workouts` et `settings`. */
export async function assertRpeDisciplineOpen(workoutId: string): Promise<void> {
  if ((await getRpeDisciplineState(workoutId)).status === 'locked') {
    throw new RpeDisciplineLockedError();
  }
}

async function appendEvent(workoutId: string, event: RpeDisciplineEvent): Promise<void> {
  const workout = await db.workouts.get(workoutId);
  if (workout === undefined) return;
  await db.workouts.put(
    touch(workout, { rpeDiscipline: [...readDisciplineEvents(workout.rpeDiscipline), event] }),
  );
}

/**
 * Après l'écriture d'une série : le constat, la trace de correction, ou rien.
 *
 * À appeler **dans** la transaction qui a écrit `next`, avec les tables `workouts` et `settings`.
 * Un second appel sur une séance déjà verrouillée ne rend jamais `triggered` : c'est ce qui fait
 * que l'annonce ne part qu'une fois par déclenchement, même sur un double appui.
 */
export async function applyRpeDisciplineAfterWrite(
  previous: WorkoutSet,
  next: WorkoutSet,
  now = Date.now(),
): Promise<RpeDisciplineOutcome> {
  const [settings, workout] = await Promise.all([
    getRpeDisciplineSettings(),
    db.workouts.get(next.workoutId),
  ]);
  if (workout === undefined) return 'none';

  const event = decideRpeDiscipline(
    settings,
    {
      workoutStatus: workout.status,
      events: workout.rpeDiscipline,
      setId: next.id,
      setType: next.setType,
      isCompleted: next.isCompleted === 1 && next.deletedAt === 0,
      previousRpe: previous.rpe,
      rpe: next.rpe,
    },
    now,
  );
  if (event === null) return 'none';
  await appendEvent(workout.id, event);
  return event.kind === 'triggered' ? 'triggered' : 'corrected';
}

/**
 * Le premier dépassement de toute une vie de pratiquant vaut un palier secret. Hors transaction,
 * et sans jamais lever : un palier qui ne s'écrit pas ne doit pas faire échouer une série, et le
 * rattrapage du démarrage (`grantRpeBreachMilestoneIfEarned`) le rendra.
 */
export async function celebrateRpeBreach(outcome: RpeDisciplineOutcome): Promise<void> {
  if (outcome !== 'triggered') return;
  try {
    await grantSecretMilestone(FIRST_RPE_BREACH_MILESTONE_ID, { celebrate: true });
  } catch (error) {
    console.error('Le palier « Vous pouvez disposer » n’a pas pu être écrit', error);
  }
}

/**
 * Le rattrapage : une séance porte un dépassement constaté, le palier n'existe pas encore (une
 * restauration, un kill au mauvais moment). Il entre acquitté — consultable, muet.
 */
export async function grantRpeBreachMilestoneIfEarned(): Promise<void> {
  try {
    const workouts = await db.workouts.toArray();
    const breached = workouts.some(
      (workout) =>
        workout.deletedAt === 0 &&
        readDisciplineEvents(workout.rpeDiscipline).some((event) => event.kind === 'triggered'),
    );
    if (breached) await grantSecretMilestone(FIRST_RPE_BREACH_MILESTONE_ID, { celebrate: false });
  } catch (error) {
    console.error('Le rattrapage du palier « Vous pouvez disposer » a échoué', error);
  }
}

/**
 * Corriger une erreur de saisie sur la série qui a déclenché le protocole.
 *
 * La valeur saisie à tort n'est pas perdue : elle reste dans l'événement `triggered` et dans le
 * `previousRpe` de la correction. Le verrou se lève si la valeur corrigée tient sous le plafond
 * figé au déclenchement, et reste en place sinon.
 */
export async function correctRpeDisciplineTrigger(
  workoutId: string,
  rpe: number | undefined,
  now = Date.now(),
): Promise<RpeDisciplineOutcome> {
  return db.transaction('rw', db.workouts, db.workoutSets, db.settings, async () => {
    const state = await getRpeDisciplineState(workoutId);
    if (state.status !== 'locked') return 'none';
    const set = await db.workoutSets.get(state.trigger.setId);
    if (set === undefined) return 'none';
    const next = touch(set, { rpe });
    await db.workoutSets.put(next);
    return applyRpeDisciplineAfterWrite(set, next, now);
  });
}

/**
 * Le déverrouillage exceptionnel. L'écran l'a fait confirmer ; la base en garde l'heure, le
 * plafond et la série concernée. Rend `false` quand il n'y avait rien à déverrouiller.
 */
export async function overrideRpeDiscipline(workoutId: string, now = Date.now()): Promise<boolean> {
  return db.transaction('rw', db.workouts, db.settings, async () => {
    const state = await getRpeDisciplineState(workoutId);
    if (state.status !== 'locked') return false;
    await appendEvent(workoutId, {
      kind: 'override',
      at: now,
      setId: state.trigger.setId,
      ceiling: state.trigger.ceiling,
    });
    return true;
  });
}
