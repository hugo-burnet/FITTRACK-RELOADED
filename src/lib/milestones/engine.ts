import { startOfLocalWeek } from '@/lib/history';
import { isWorkingSet } from '@/lib/records';
import { anniversaryOf } from './calendar';
import { MILESTONES } from './catalogue';
import type {
  EarnedMilestone,
  MilestoneDefinition,
  MilestoneInput,
  MilestoneSession,
  MilestoneSet,
} from './types';

/**
 * Ce que l'historique a déjà franchi.
 *
 * **Une fonction de tout l'historique, pas un compteur qu'on incrémente.** Le
 * moteur relit tout à chaque appel et n'a aucune mémoire, ce qui a trois
 * conséquences qui valent leur coût :
 *
 * 1. Un historique importé d'ailleurs — dix ans de Hevy en un CSV — rend ses
 *    jalons **à leurs vraies dates**, et non tous datés du jour de l'import.
 *    C'est ce qui fait exister la rétrospective dès la première ouverture.
 * 2. Une séance corrigée après coup ne laisse pas un jalon faux derrière elle.
 * 3. Il n'y a pas d'état à réparer, donc pas d'écran de réparation à écrire.
 *
 * Pur par construction (§7) : des séries et des séances en entrée, des jalons en
 * sortie. Rien ici ne lit Dexie et rien ici ne parle français.
 *
 * **Un jalon est daté de la première fois qu'il a été franchi, pas de la
 * meilleure.** On se souvient du jour où l'on est passé aux 100, pas du jour où
 * l'on a fait 110 — et c'est le premier qui peut avoir un anniversaire.
 */
export function earnMilestones(input: MilestoneInput): EarnedMilestone[] {
  // `sort` est stable : trier sur le seul instant préserve l'ordre que le dépôt
  // a donné aux ex æquo, qui est celui des séries dans la séance.
  const sets = [...input.sets]
    .filter(isWorkingSet)
    .sort((left, right) => left.performedAt - right.performedAt);
  const sessions = [...input.sessions].sort((left, right) => left.startedAt - right.startedAt);

  const earned: (EarnedMilestone & { order: number })[] = [];

  MILESTONES.forEach((definition, order) => {
    const hit = firstCrossing(definition, sets, sessions, input.now);
    if (hit !== undefined) earned.push({ ...hit, order });
  });

  return (
    earned
      // Le rang du catalogue départage les ex æquo — trois paliers franchis par
      // la même série sortent dans l'ordre où ils sont écrits, jamais dans celui
      // d'un parcours d'objet.
      .sort((left, right) => left.achievedAt - right.achievedAt || left.order - right.order)
      .map(({ definitionId, achievedAt, workoutId, value }) => ({
        definitionId,
        achievedAt,
        workoutId,
        value,
      }))
  );
}

type Crossing = Omit<EarnedMilestone, 'definitionId'> & { definitionId: string };

function firstCrossing(
  definition: MilestoneDefinition,
  sets: readonly MilestoneSet[],
  sessions: readonly MilestoneSession[],
  now: number | undefined,
): Crossing | undefined {
  switch (definition.kind) {
    case 'exercise_load':
    case 'exercise_reps':
    case 'exercise_duration':
    case 'dumbbell_pair':
      return firstQualifyingSet(definition, sets);
    case 'session_count':
      return nthSession(definition, sessions);
    case 'active_weeks':
      return nthActiveWeek(definition, sessions);
    case 'training_years':
      return trainingAnniversary(definition, sessions);
    case 'lifetime_tonnage':
      return tonnageCrossing(definition, sets);
    case 'hours_since_first_session':
      return hoursSinceFirstSession(definition, sessions, now);
  }
}

const HOUR_MS = 3_600_000;

function hoursSinceFirstSession(
  definition: MilestoneDefinition,
  sessions: readonly MilestoneSession[],
  now: number | undefined,
): Crossing | undefined {
  if (now === undefined) return undefined;
  const first = sessions[0];
  if (first === undefined) return undefined;
  const dueAt = first.startedAt + definition.threshold * HOUR_MS;
  if (now < dueAt) return undefined;
  return {
    definitionId: definition.id,
    achievedAt: dueAt,
    workoutId: first.workoutId,
    value: definition.threshold,
  };
}

/**
 * La mesure d'une série pour un genre donné — et `undefined` quand la série ne
 * concerne pas ce jalon du tout.
 *
 * Le genre décide **quel champ** est lu, ce qui est la garde contre la confusion
 * la plus facile à écrire ici : cent répétitions à 20 kg ne franchissent pas un
 * seuil de cent kilos.
 */
function measure(definition: MilestoneDefinition, set: MilestoneSet): number | undefined {
  switch (definition.kind) {
    case 'exercise_load':
      return matchesSlug(definition, set) ? set.weight : undefined;
    case 'exercise_reps':
      return matchesSlug(definition, set) ? set.reps : undefined;
    case 'exercise_duration':
      return matchesSlug(definition, set) ? set.durationSeconds : undefined;
    case 'dumbbell_pair':
      return isDumbbellPair(set) ? set.weight : undefined;
    default:
      return undefined;
  }
}

/**
 * Un exercice personnel n'a pas de slug, et ne porte donc aucun jalon nommé.
 * Cf. le commentaire de `MilestoneDefinition.slugs` : le prix est assumé.
 */
function matchesSlug(definition: MilestoneDefinition, set: MilestoneSet): boolean {
  return set.slug !== undefined && (definition.slugs?.includes(set.slug) ?? false);
}

/**
 * Deux haltères, tenus en même temps.
 *
 * `isUnilateral` est la seule chose qui sépare un développé haltères d'un rowing
 * à un bras, et c'est un drapeau de la fiche d'exercice — donc une donnée, pas
 * une déduction sur le nom. La mesure en répétitions écarte la marche du fermier
 * et les portés, où la charge se lit tout autrement.
 *
 * Le jalon ne nomme aucun exercice : il vaut donc aussi pour une fiche
 * personnelle, contrairement aux jalons de charge. Un rack d'haltères ne se
 * falsifie pas en tapant un nom, la porte peut rester ouverte.
 */
function isDumbbellPair(set: MilestoneSet): boolean {
  return (
    set.equipment === 'dumbbell' && !set.isUnilateral && set.measurementType === 'weight_reps'
  );
}

function firstQualifyingSet(
  definition: MilestoneDefinition,
  sets: readonly MilestoneSet[],
): Crossing | undefined {
  for (const set of sets) {
    const value = measure(definition, set);
    if (value === undefined || value < definition.threshold) continue;
    return {
      definitionId: definition.id,
      achievedAt: set.performedAt,
      workoutId: set.workoutId,
      value,
    };
  }
  return undefined;
}

function nthSession(
  definition: MilestoneDefinition,
  sessions: readonly MilestoneSession[],
): Crossing | undefined {
  const session = sessions[definition.threshold - 1];
  if (session === undefined) return undefined;
  return {
    definitionId: definition.id,
    achievedAt: session.startedAt,
    workoutId: session.workoutId,
    value: definition.threshold,
  };
}

/**
 * Des semaines **cumulées**, et c'est tout le sujet du module.
 *
 * Rien ici ne vérifie que les semaines se suivent : six mois d'arrêt ne
 * retirent rien, on reprend au chiffre où l'on s'était arrêté. C'est l'exact
 * opposé de la série de semaines consécutives, que l'accueil a supprimée parce
 * qu'on la perdait en se blessant.
 */
function nthActiveWeek(
  definition: MilestoneDefinition,
  sessions: readonly MilestoneSession[],
): Crossing | undefined {
  const weeks = new Set<number>();
  for (const session of sessions) {
    weeks.add(startOfLocalWeek(session.startedAt));
    if (weeks.size < definition.threshold) continue;
    return {
      definitionId: definition.id,
      achievedAt: session.startedAt,
      workoutId: session.workoutId,
      value: definition.threshold,
    };
  }
  return undefined;
}

/**
 * L'anniversaire est **acquis par une séance**, jamais par le calendrier.
 *
 * Une base laissée en sommeil ne fête pas ses dix ans de musculation : ce qui se
 * célèbre est d'être encore là, ce qui suppose d'être venu. La séance qui suit
 * l'anniversaire est donc à la fois la preuve et la date.
 */
function trainingAnniversary(
  definition: MilestoneDefinition,
  sessions: readonly MilestoneSession[],
): Crossing | undefined {
  const first = sessions[0];
  if (first === undefined) return undefined;

  const due = anniversaryOf(first.startedAt, definition.threshold);
  const session = sessions.find((item) => item.startedAt >= due);
  if (session === undefined) return undefined;

  return {
    definitionId: definition.id,
    achievedAt: session.startedAt,
    workoutId: session.workoutId,
    value: definition.threshold,
  };
}

function tonnageCrossing(
  definition: MilestoneDefinition,
  sets: readonly MilestoneSet[],
): Crossing | undefined {
  let total = 0;
  for (const set of sets) {
    total += set.tonnageKg;
    if (total < definition.threshold) continue;
    return {
      definitionId: definition.id,
      achievedAt: set.performedAt,
      workoutId: set.workoutId,
      value: total,
    };
  }
  return undefined;
}
