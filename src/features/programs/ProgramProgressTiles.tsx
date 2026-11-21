import type { Program, ProgramWeek } from '@/data/types';
import { t } from '@/i18n/fr';
import { phaseLabel } from './weekReading';
import { shiftLocalDate } from '@/lib/programs';
import type { ProgramAdherence, ProgramPosition } from '@/lib/programs';
import { Tile, TileGrid } from '@/ui';

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dayOnly = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' });
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** « 16 au 22 nov. » — ou « 30 nov. au 6 déc. » quand la semaine change de mois. */
function weekSpan(startsAt: number, weekIndex: number): { from: string; to: string } {
  const first = shiftLocalDate(startsAt, weekIndex * 7);
  const last = shiftLocalDate(first, 6);
  const sameMonth = new Date(first).getMonth() === new Date(last).getMonth();
  return {
    from: sameMonth ? dayOnly.format(first) : dayMonth.format(first),
    to: dayMonth.format(last),
  };
}

interface Props {
  program: Program;
  position: ProgramPosition;
  /** La semaine lue en grand (celle d'aujourd'hui, ou la première / la dernière hors du programme). */
  week: ProgramWeek | null;
  nextWeek: ProgramWeek | undefined;
  adherence: ProgramAdherence;
  /** Tonnage de chaque semaine du programme, de la première à la dernière. */
  weeklyTonnage: readonly number[];
  displayWeekIndex: number;
  hasWorkouts: boolean;
}

const kg = (value: number): { value: string; unit: string } => ({
  value: Math.round(value).toLocaleString('fr-FR'),
  unit: t('units.kg'),
});

/**
 * « Où en est le programme » : trois chiffres, une tuile chacun, la plus
 * importante d'abord — la semaine. Aucune n'est `G` : il n'y a pas de courbe ici,
 * le tonnage n'a que deux valeurs à comparer (cette semaine, la précédente) et
 * l'empilement de `S` les dit sans dessin.
 */
export function ProgramProgressTiles({
  program,
  position,
  week,
  nextWeek,
  adherence,
  weeklyTonnage,
  displayWeekIndex,
  hasWorkouts,
}: Props) {
  const total = program.durationWeeks;
  const started = position.phase !== 'before';

  const weekValue =
    position.phase === 'before'
      ? { value: `0 / ${total}` }
      : { value: `${displayWeekIndex + 1} / ${total}` };
  const weekDetail =
    position.phase === 'before'
      ? t('program.detailWeekBefore', { date: longDate.format(program.startsAt) })
      : position.phase === 'after'
        ? t('program.detailWeekAfter', { count: total })
        : week === null
          ? undefined
          : [
              t('program.detailWeekPhase', {
                phase: phaseLabel(week.phase),
                ...weekSpan(program.startsAt, week.weekIndex),
              }),
              nextWeek?.phase === 'deload' && week.phase !== 'deload'
                ? t('program.detailNextDeload', { number: nextWeek.weekIndex + 1 })
                : null,
            ]
              .filter((part) => part !== null)
              .join(' ');

  const toDate = {
    value: `${adherence.doneToDate} / ${adherence.plannedToDate}`,
    caption: t('program.detailAdherenceToDate'),
    spoken: t('program.detailAdherenceSpoken', {
      done: adherence.doneToDate,
      planned: adherence.plannedToDate,
    }),
  } as const;
  const overall = {
    value: `${adherence.doneTotal} / ${adherence.plannedTotal}`,
    caption: t('program.detailAdherenceTotal'),
  } as const;
  // Avant le départ, rien n'est dû ni joué : « 0 / 0 » ne dirait rien, on ne garde que le total.
  // Un programme clos avant terme ne dit que « à ce jour » : les semaines qu'il n'a pas jouées
  // ne sont plus dues, « sur le programme » en ferait des séances manquées.
  const adherenceValue = adherence.plannedToDate === 0 ? overall : toDate;
  const adherenceDetail =
    adherence.plannedToDate === 0 || program.status === 'completed'
      ? undefined
      : t('program.detailAdherenceOverall', {
          done: adherence.doneTotal,
          planned: adherence.plannedTotal,
        });

  const current = weeklyTonnage[displayWeekIndex] ?? 0;
  const previous = displayWeekIndex > 0 ? weeklyTonnage[displayWeekIndex - 1] : undefined;
  const currentCaption =
    position.phase === 'active'
      ? t('program.detailTonnageCurrent', { number: displayWeekIndex + 1 })
      : t('program.detailTonnageWeek', { number: displayWeekIndex + 1 });
  const tonnageValue =
    previous === undefined
      ? ({ ...kg(current), caption: currentCaption } as const)
      : ([
          { ...kg(current), caption: currentCaption },
          {
            ...kg(previous),
            caption: t('program.detailTonnageWeek', { number: displayWeekIndex }),
          },
        ] as const);

  return (
    <TileGrid title={t('program.detailProgressTitle')}>
      <Tile
        key="week"
        size="L"
        label={t('program.detailWeekLabel')}
        value={weekValue}
        detail={weekDetail}
      />
      {started && (
        <Tile
          key="adherence"
          // « 12 / 24 » fait sept signes : au-delà des six d'une S (DESIGN.md › Grille modulaire).
          size="L"
          label={t('program.detailAdherenceLabel')}
          value={adherenceValue}
          detail={adherenceDetail}
        />
      )}
      {started && hasWorkouts && (
        <Tile key="tonnage" size="S" label={t('program.detailTonnageLabel')} value={tonnageValue} />
      )}
    </TileGrid>
  );
}
