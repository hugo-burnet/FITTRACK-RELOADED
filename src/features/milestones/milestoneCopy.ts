import { t, type TranslationKey } from '@/i18n/fr';
import { milestoneById } from '@/lib/milestones/catalogue';
import type { MilestoneDefinition, MilestoneGroup } from '@/lib/milestones/types';
import { formatNumber } from '@/ui/numberField';

/**
 * Ce qu'un palier dit, et ce que son jeton affiche.
 *
 * **Le jeton porte le chiffre, jamais un dessin.** C'est la décision de forme de
 * toute la fonctionnalité : « 100 » se reconnaît d'un coup d'œil et se raconte,
 * là où une médaille dorée aurait fait de la pratique un jeu — exactement ce que
 * l'accueil a refusé en supprimant son compteur de semaines. Le chiffre est
 * aussi ce qui rend le dessin inutile : aucune image à générer, aucun fichier à
 * embarquer, aucun réseau (règles n° 2 et 3).
 *
 * Le jeton n'a donc **pas d'unité** : la légende juste dessous la donne, et
 * « 100 kg » dans un disque de 48 px ne tient pas sans devenir illisible.
 *
 * Pur, et testé à part : c'est la seule partie de l'affichage qui décide quelque
 * chose.
 */

export interface MilestoneReading {
  title: string;
  /** Le contenu du jeton : le seuil dans son unité naturelle, sans unité écrite. */
  token: string;
  /** Ce que le palier a réellement valu, quand ce n'est pas le seuil rond. */
  reached?: string;
  group: MilestoneGroup;
}

const SECONDS_PER_MINUTE = 60;
const KG_PER_TONNE = 1000;

/** Le seuil dans l'unité que la légende emploie : minutes, tonnes, kilos, unités. */
function naturalThreshold(definition: MilestoneDefinition): number {
  if (definition.kind === 'exercise_duration') return definition.threshold / SECONDS_PER_MINUTE;
  if (definition.kind === 'lifetime_tonnage') return definition.threshold / KG_PER_TONNE;
  return definition.threshold;
}

/** `milestone.subject.pullUp` → `pullUp`, pour aller chercher la phrase de première fois. */
function subjectNameOf(definition: MilestoneDefinition): string | undefined {
  return definition.subjectKey?.split('.').at(-1);
}

/**
 * `t` rend la clé elle-même quand elle n'existe pas : c'est ce qui permet de
 * demander une phrase de première fois sans savoir si elle a été écrite, et de
 * retomber sur le gabarit générique quand elle ne l'a pas été.
 */
function translated(key: string): string | undefined {
  const value = t(key as TranslationKey);
  return value === key ? undefined : value;
}

function titleOf(definition: MilestoneDefinition): string {
  const subject = definition.subjectKey === undefined ? '' : translated(definition.subjectKey) ?? '';
  const value = naturalThreshold(definition);

  switch (definition.kind) {
    case 'exercise_load':
      return t('milestone.load', { subject, value: formatNumber(value) });
    case 'exercise_reps': {
      // La toute première répétition a sa phrase entière, écrite au bon genre.
      // Cf. `milestone.first` : « Première dips » n'est pas du français.
      const name = subjectNameOf(definition);
      const first =
        definition.threshold === 1 && name !== undefined
          ? translated(`milestone.first.${name}`)
          : undefined;
      return first ?? t('milestone.reps', { subject, value });
    }
    case 'exercise_duration':
      return t('milestone.duration', { subject, value: formatNumber(value) });
    case 'dumbbell_pair':
      return t('milestone.dumbbellPair', { value: formatNumber(value) });
    case 'session_count':
      return t('milestone.sessions', { value });
    case 'active_weeks':
      return t('milestone.weeks', { value });
    case 'training_years':
      return definition.threshold === 1
        ? t('milestone.yearOne')
        : t('milestone.years', { value });
    case 'lifetime_tonnage':
      return t('milestone.tonnage', { value: formatNumber(value) });
  }
}

/** `125` secondes → `2:05`. La seule lecture où les secondes comptent encore. */
function durationReading(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  return `${String(minutes)}:${String(whole % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

/**
 * Ce que le palier a réellement valu — et rien quand c'est le seuil tout rond.
 *
 * On passe les 100 kg *à 102,5*, et c'est ce chiffre-là qu'on se rappelle. Mais
 * répéter « franchi à 100 kg » sous « Développé couché à 100 kg » n'apprendrait
 * rien et ferait deux lignes là où une suffit.
 *
 * Rien non plus pour les paliers de pratique et de volume : leur valeur est le
 * seuil par construction, ou un cumul dont le chiffre exact — 100 043 kg — ne
 * veut rien dire pour personne.
 */
function reachedOf(definition: MilestoneDefinition, value: number): string | undefined {
  if (value === definition.threshold) return undefined;

  switch (definition.kind) {
    case 'exercise_load':
    case 'dumbbell_pair':
      return t('milestone.reachedLoad', { value: formatNumber(value) });
    case 'exercise_reps':
      return t('milestone.reachedReps', { value });
    case 'exercise_duration':
      return t('milestone.reachedDuration', { value: durationReading(value) });
    default:
      return undefined;
  }
}

/**
 * `undefined` pour un palier retiré du catalogue.
 *
 * Sa ligne survit en base — on n'efface pas ce que quelqu'un a franchi parce
 * qu'on a changé d'avis sur la liste — mais l'écran ne sait plus quoi en dire et
 * la saute plutôt que d'afficher un identifiant.
 */
export function milestoneReading(
  definitionId: string,
  value: number,
): MilestoneReading | undefined {
  const definition = milestoneById(definitionId);
  if (definition === undefined) return undefined;

  const reached = reachedOf(definition, value);

  return {
    title: titleOf(definition),
    token: formatNumber(naturalThreshold(definition)),
    ...(reached === undefined ? {} : { reached }),
    group: definition.group,
  };
}
