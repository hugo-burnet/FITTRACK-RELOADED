import type { MeasurementType } from '@/data/types';
import { t } from '@/i18n/fr';
import { unitLabel } from '@/i18n/labels';
import { targetParts, type TargetPart } from '@/lib/measurement';
import {
  decimal,
  frenchDate,
  markdownTable,
  renderDocument,
  type MarkdownColumn,
} from './markdown';
import type {
  ExportRoutine,
  ExportRoutineExercise,
  ExportRoutineSet,
  RoutineExport,
} from './types';

/**
 * Une routine, en document qu'on relit et qu'on fait relire.
 *
 * **Le même document que l'historique, une case plus haut.** Là-bas, un tableau
 * par exercice et une ligne par série faite ; ici, un tableau par routine et
 * une ligne par exercice. La différence n'est pas un choix de mise en page :
 * une séance est une suite d'événements qu'on lit l'un après l'autre, une
 * routine est une liste qu'on parcourt du regard. Un tableau par exercice
 * aurait donné, pour une routine ordinaire, neuf tableaux de quatre lignes
 * identiques.
 *
 * Il ne décide rien que l'app n'ait déjà décidé : les lectures viennent de
 * `targetParts`, les mots de `fr.ts`. Un document qui contredirait l'écran qui
 * l'a produit serait le vrai défaut.
 *
 * **Le nom des exercices y est nu.** Le suffixe « (unilatéral) »
 * (`exerciseDisplayName`) est une lecture d'écran : un document qu'on recolle
 * au catalogue, à la main ou par un modèle, a besoin du nom tel qu'il est
 * stocké.
 */

type Figure = 'reps' | 'weight' | 'duration' | 'distance';

/** Une cible d'une série, dans la forme que `lib/measurement` lui donne. */
function partOf(
  set: ExportRoutineSet,
  type: MeasurementType,
  field: Figure,
): TargetPart | undefined {
  return targetParts(type, {
    ...(field === 'reps' ? { targetReps: set.targetReps, targetRepsMax: set.targetRepsMax } : {}),
    ...(field === 'weight' ? { targetWeight: set.targetWeight } : {}),
    ...(field === 'duration' ? { targetDurationSeconds: set.targetDurationSeconds } : {}),
    ...(field === 'distance' ? { targetDistanceMeters: set.targetDistanceMeters } : {}),
  }).at(0);
}

/**
 * Les lectures d'une colonne, dédupliquées **dans l'ordre des séries**.
 *
 * Une routine prescrit le plus souvent la même chose à toutes ses séries, et
 * « 8 – 12 » répété quatre fois n'apprend rien. Quand les séries diffèrent, on
 * les écrit toutes : « 12 · 10 · 8 » est une montée en charge, et c'est
 * exactement ce qu'un lecteur veut voir.
 *
 * Essayé et écarté : ne montrer que la première série, ou un « min – max » sur
 * l'ensemble. Les deux aplatissent une pyramide en un chiffre, sur la seule
 * colonne qui disait ce que la séance allait être. La déduplication, elle, ne
 * perd rien : elle ne joint que ce qui est déjà identique et consécutif.
 */
function readings(
  sets: readonly ExportRoutineSet[],
  read: (set: ExportRoutineSet) => TargetPart | undefined,
): string {
  const values: string[] = [];
  for (const set of sets) {
    const part = read(set);
    if (part === undefined) continue;
    // La valeur *et* son unité : sur un gainage, « 45 s » et « 1:30 min »
    // changent d'unité d'une série à l'autre, et dédupliquer sur la valeur
    // seule rapprocherait deux durées différentes qui s'écrivent pareil.
    const reading = part.unit === 'reps' ? part.value : `${part.value} ${unitLabel(part.unit)}`;
    if (values.at(-1) !== reading) values.push(reading);
  }

  return values.length === 0 ? t('export.missingValue') : values.join(' · ');
}

/**
 * Le compte de séries, échauffements signalés.
 *
 * Signalés comme dans l'export d'historique — le même mot, la même source — mais
 * pas dans une colonne : avec une ligne par exercice, une colonne « Type »
 * n'aurait rien à répondre pour une ligne dont les séries sont de deux types.
 * La mention se range donc là où l'on lit déjà un nombre de séries.
 */
function setCountReading(sets: readonly ExportRoutineSet[]): string {
  const warmups = sets.filter((set) => set.type === 'warmup').length;
  if (warmups === 0) return decimal(sets.length);

  const working = decimal(sets.length - warmups);
  return warmups === 1
    ? t('export.routineSetsWithWarmupsOne', { count: working })
    : t('export.routineSetsWithWarmups', { count: working, warmups: decimal(warmups) });
}

type Column = MarkdownColumn<ExportRoutineExercise>;

function columnsFor(routine: ExportRoutine): Column[] {
  const has = (field: Figure): boolean =>
    routine.exercises.some((exercise) => {
      const type = exercise.measurementType;
      return type !== undefined && exercise.sets.some((set) => partOf(set, type, field) !== undefined);
    });

  const figure =
    (field: Figure): Column['of'] =>
    (exercise) => {
      const type = exercise.measurementType;
      return type === undefined
        ? t('export.missingValue')
        : readings(exercise.sets, (set) => partOf(set, type, field));
    };

  const columns: Column[] = [
    {
      label: t('export.columnExercise'),
      numeric: false,
      of: (exercise) => exercise.name ?? t('export.unknownExercise'),
    },
    {
      label: t('export.columnSets'),
      numeric: true,
      of: (exercise) => setCountReading(exercise.sets),
    },
  ];

  // Chaque colonne de chiffres n'existe que si au moins un exercice a quelque
  // chose à y mettre — la règle que l'export d'historique applique déjà à ses
  // colonnes « Type » et « Côté ». Une routine de gainage n'a pas de colonne
  // « Reps » vide, une routine de force pas de colonne « Durée » de tirets.
  if (has('reps')) columns.push({ label: t('export.columnReps'), numeric: true, of: figure('reps') });
  if (has('weight')) {
    columns.push({ label: t('export.columnWeightLoad'), numeric: true, of: figure('weight') });
  }
  if (has('duration')) {
    columns.push({ label: t('export.columnDuration'), numeric: true, of: figure('duration') });
  }
  if (has('distance')) {
    columns.push({ label: t('export.columnDistance'), numeric: true, of: figure('distance') });
  }

  // La note en dernier, et seulement s'il y en a une : c'est la colonne la plus
  // large, et elle serait vide sur la plupart des routines.
  if (routine.exercises.some((exercise) => exercise.notes !== undefined)) {
    columns.push({
      label: t('export.columnNote'),
      numeric: false,
      // `cell` (dans `markdown.ts`) ramène les sauts de ligne à des espaces : une
      // note de trois lignes ne peut pas vivre dans une case de tableau. Elle y
      // reste lisible, et c'est le prix du tableau.
      of: (exercise) => exercise.notes ?? t('export.missingValue'),
    });
  }

  return columns;
}

/** « Pectoraux, épaules · Dossier : Haut du corps ». */
function routineFacts(routine: ExportRoutine): string {
  return [
    routine.subtitle,
    routine.folderName === undefined
      ? t('export.routineNoFolder')
      : t('export.routineFolder', { name: routine.folderName }),
  ]
    .filter((part): part is string => part !== undefined && part !== '')
    .join(' · ');
}

/**
 * Les supersets, nommés sous le tableau.
 *
 * Pas une colonne : elle serait vide sur neuf routines sur dix, et un numéro de
 * groupe ne veut rien dire pour un lecteur. Mais pas rien non plus — sans ces
 * lignes, une routine en superset et la même en exercices séparés produisent
 * deux documents identiques, ce qui en ferait un document faux.
 */
function supersetLines(routine: ExportRoutine): string[] {
  const groups = [...new Set(routine.exercises.map((exercise) => exercise.supersetGroup))]
    .filter((group) => group !== 0)
    .sort((left, right) => left - right);

  return groups.map((group) => {
    const names = routine.exercises
      .filter((exercise) => exercise.supersetGroup === group)
      .map((exercise) => exercise.name ?? t('export.unknownExercise'));
    return `- ${t('export.routineSuperset', { names: names.join(' + ') })}`;
  });
}

function routineSection(routine: ExportRoutine): string[] {
  const facts = routineFacts(routine);
  const supersets = supersetLines(routine);

  return [
    `## ${routine.name === '' ? t('export.routineUntitled') : routine.name}`,
    '',
    ...(facts === '' ? [] : [facts, '']),
    ...(routine.exercises.length === 0
      ? [t('export.routineEmpty'), '']
      : [...markdownTable(columnsFor(routine), routine.exercises), '']),
    ...(supersets.length === 0 ? [] : [...supersets, '']),
  ];
}

function scopeLine(data: RoutineExport): string {
  if (data.scope.kind === 'routine') {
    const name = data.routines.at(0)?.name;
    return name === undefined || name === ''
      ? t('export.routineScopeOne')
      : t('export.routineScopeNamed', { name });
  }

  // La racine n'a pas de nom : « aucun dossier » est une place dans la
  // bibliothèque, pas un dossier qui s'appellerait comme ça.
  return data.folderName === undefined
    ? t('export.routineScopeRootFolder')
    : t('export.routineScopeFolder', { name: data.folderName });
}

export function serializeRoutineMarkdown(data: RoutineExport): string {
  return renderDocument([
    `# ${t('export.routineTitle')}`,
    '',
    `- ${scopeLine(data)}`,
    `- ${t('export.routineCount', { count: data.routineCount })}`,
    `- ${t('export.exportedAt', { date: frenchDate(data.exportedAt.slice(0, 10)) })}`,
    '',
    ...(data.routines.length === 0
      ? [t('export.routineNone'), '']
      : data.routines.flatMap(routineSection)),
  ]);
}
