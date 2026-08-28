import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import type { SetValues } from '@/data/repositories/workouts';
import type { SideStage } from './sideProgress';
import type { SetType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { setTypeLabel, unitLabel } from '@/i18n/labels';
import { isRepRange, isSetRecordable, repsReading } from '@/lib/measurement';
import type { EntryColumn, ResolvedValues, TargetField } from '@/lib/measurement';
import { formatNumber } from '@/ui/numberField';
import { BoltIcon, CheckIcon, DropsetIcon, FlameIcon } from '@/ui/icons';
import { SetValueCell } from './SetValueCell';
import { setReading } from './summary';

/** Non-normal sets replace their rank with a distinct, non-color-only mark. */
const TYPE_MARK: Partial<Record<SetType, ComponentType<SVGProps<SVGSVGElement>>>> = {
  warmup: FlameIcon,
  dropset: DropsetIcon,
  failure: BoltIcon,
};

const FIELD_KEY = {
  weight: 'weight',
  reps: 'reps',
  duration: 'durationSeconds',
  distance: 'distanceMeters',
} as const satisfies Record<TargetField, keyof SetValues>;

const TARGET_KEY = {
  weight: 'targetWeight',
  reps: 'targetReps',
  duration: 'targetDurationSeconds',
  distance: 'targetDistanceMeters',
} as const satisfies Record<TargetField, keyof WorkoutSet>;

/** Fixed widths preserve numeric entry at the 375 px minimum viewport. */
const WIDTH = { first: '4.75rem', second: '3.5rem' } as const;

type Props = {
  set: WorkoutSet;
  number: number;
  columns: EntryColumn[];
  /** The same rank from the previous session. */
  previous: WorkoutSet | undefined;
  /**
   * Le rang de cette ligne pour le tutoriel, quand il en désigne une.
   *
   * Deux rangs suffisent : la campagne fait valider une première série, puis
   * une seconde, et une consigne qui vise « la série » sans dire laquelle
   * encadrerait la mauvaise dès qu'il y en a deux.
   */
  tutorialRank?: 'first' | 'second';
  /**
   * Vrai tant que le chrono tourne sur cette série. La coche est alors le geste
   * qui l'arrête : la désactiver parce qu'aucune durée n'est encore tapée
   * enfermerait le chrono sans aucune sortie — la durée, justement, c'est lui
   * qui l'écrit. Il n'écrit qu'elle : les autres colonnes gardent leur garde.
   */
  holding?: boolean;
  /**
   * Où en est le cycle deux côtés, `null` hors d'un exercice unilatéral.
   *
   * La coche change alors de sens : elle ferme un côté avant de fermer la
   * série. Le libellé le dit, parce qu'une coche qui ne coche pas est un
   * bouton cassé tant qu'on ne sait pas ce qu'elle fait.
   */
  sideStage?: SideStage | null;
  onWrite: (values: Partial<SetValues>, recordable: boolean) => void;
  onComplete: (values: Partial<SetValues>) => void;
  onUncomplete: () => void;
  onMenu: () => void;
};

/** Previous values, current entry, and one-tap validation for a workout set. */
export function WorkoutSetRow({
  set,
  number,
  columns,
  previous,
  tutorialRank,
  holding = false,
  sideStage = null,
  onWrite,
  onComplete,
  onUncomplete,
  onMenu,
}: Props) {
  const done = set.isCompleted === 1;
  const Mark = TYPE_MARK[set.setType];

  /*
   * Le compte à rebours du changement de côté, redessiné quatre fois par
   * seconde et **seulement** pendant la transition : le stade reste dérivé de
   * l'échéance persistée, l'intervalle ne sert qu'à rafraîchir le nombre. Un
   * minuteur permanent redessinerait toute la grille pendant une séance
   * entière pour un libellé qui ne bouge pas.
   */
  const [now, setNow] = useState(() => Date.now());
  const deadline = set.unilateralSecondSideStartsAt;
  useEffect(() => {
    if (deadline === undefined) return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= deadline) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [deadline]);

  const turning = sideStage === 'transition';
  const remainingSides =
    deadline === undefined ? 0 : Math.max(0, Math.ceil((deadline - now) / 1_000));

  const completeLabel =
    sideStage === 'first'
      ? t('workout.completeFirstSide', { number })
      : sideStage === 'second'
        ? t('workout.completeSecondSide', { number })
        : t('workout.complete', { number });

  // Never borrow another rank: proposed values may be recorded with one tap.
  const previousValue = (field: TargetField): number | undefined => previous?.[FIELD_KEY[field]];

  const valueOf = (field: TargetField): number | undefined => set[FIELD_KEY[field]];

  // Today's prescription takes precedence over the previous session.
  const ghostOf = (field: TargetField): number | undefined =>
    set[TARGET_KEY[field]] ?? previousValue(field);

  const targetOf = (field: TargetField): string | undefined =>
    field === 'reps' && isRepRange(set) ? repsReading(set)?.value : undefined;

  // A range is guidance, not a recordable value; reuse the previous count.
  const ghostNumberOf = (field: TargetField): number | undefined =>
    targetOf(field) === undefined ? ghostOf(field) : previousValue(field);

  const resolved: ResolvedValues = {};
  for (const column of columns) {
    const value = valueOf(column.field) ?? ghostNumberOf(column.field);
    if (value !== undefined) resolved[column.field] = value;
  }

  /*
   * Le chrono fournit la durée, et **rien d'autre**.
   *
   * Pendant un maintien la coche doit rester active alors que la cellule des
   * secondes est vide — c'est elle qui l'arrête, et l'exiger remplie
   * l'enfermerait sans sortie. Mais lever la garde pour toute la ligne laisserait
   * valider un rameur sans sa distance : la seule colonne à considérer comme
   * déjà tenue est celle que le chrono écrira.
   */
  const recordable = isSetRecordable(
    columns,
    holding ? { ...resolved, duration: resolved.duration ?? 0 } : resolved,
  );

  const collect = (pick: (field: TargetField) => number | undefined): Partial<SetValues> => {
    const values: Partial<SetValues> = {};
    for (const column of columns) values[FIELD_KEY[column.field]] = pick(column.field);
    return values;
  };

  const single = (field: TargetField, value: number | undefined): Partial<SetValues> => {
    const values: Partial<SetValues> = {};
    values[FIELD_KEY[field]] = value;
    return values;
  };

  const previousReading = previous === undefined ? '' : setReading(previous, columns);

  const write = (values: Partial<SetValues>) => {
    const next: ResolvedValues = { ...resolved };
    const apply = (field: keyof ResolvedValues, key: keyof SetValues) => {
      if (!(key in values)) return;
      const value = values[key];
      if (typeof value === 'number') next[field] = value;
      else delete next[field];
    };
    apply('weight', 'weight');
    apply('reps', 'reps');
    apply('duration', 'durationSeconds');
    apply('distance', 'distanceMeters');
    onWrite(values, isSetRecordable(columns, next));
  };

  return (
    <div
      data-tutorial-id={tutorialRank === undefined ? undefined : `workout-${tutorialRank}-set`}
      className={`relative flex min-h-[3.75rem] items-center gap-1.5 px-2 pb-2
        transition-colors duration-[var(--dur-1)]
        ${done ? 'bg-[var(--surface-2)]' : ''}`}
    >
      <button
        type="button"
        // The accessible name carries the set type hidden by the icon.
        aria-label={
          Mark === undefined
            ? t('workout.setNumber', { number })
            : `${t('workout.setNumber', { number })} — ${setTypeLabel(set.setType)}`
        }
        onClick={onMenu}
        className="flex size-12 shrink-0 items-center justify-center rounded-lg text-sm
          text-[var(--text-2)] active:bg-[var(--surface-2)]"
      >
        {Mark === undefined ? (
          <span className="tabular">{number}</span>
        ) : (
          <Mark className="text-[var(--accent-ink)]" />
        )}
      </button>

      <button
        type="button"
        disabled={previousReading === ''}
        aria-label={t('workout.previous')}
        onClick={() => write(collect(previousValue))}
        className="metric min-h-12 min-w-0 flex-1 truncate rounded-lg px-1 text-center text-sm
          text-[var(--text-2)] active:bg-[var(--surface-2)] disabled:active:bg-transparent"
      >
        {previousReading === '' ? t('workout.noPrevious') : previousReading}
      </button>

      {columns.map((column, index) => {
        const target = targetOf(column.field);
        return (
          <SetValueCell
            key={column.field}
            value={valueOf(column.field)}
            ghost={formatNumber(ghostNumberOf(column.field))}
            target={target}
            // Durations are stored as whole seconds.
            integer={column.field === 'duration'}
            onChange={(next) => write(single(column.field, next))}
            width={index === 0 ? WIDTH.first : WIDTH.second}
            // Pair the visually hidden target with its input for screen readers.
            aria-label={[
              t('workout.setNumber', { number }),
              unitLabel(column.unit),
              target === undefined ? undefined : t('workout.target', { value: target }),
            ]
              .filter((part) => part !== undefined)
              .join(' — ')}
          />
        );
      })}

      <button
        type="button"
        data-tutorial-id={
          tutorialRank === undefined ? undefined : `workout-${tutorialRank}-set-complete`
        }
        aria-pressed={done}
        // Pendant la transition, la coche n'a rien à fermer : le premier côté est
        // fini et le second n'a pas commencé.
        disabled={(!done && !recordable) || turning}
        aria-label={
          done
            ? t('workout.uncomplete', { number })
            : turning
              ? t('workout.sideTransition', { seconds: remainingSides })
              : completeLabel
        }
        onClick={() =>
          done ? onUncomplete() : onComplete(collect((f) => valueOf(f) ?? ghostNumberOf(f)))
        }
        className="flex size-12 shrink-0 items-center justify-center
          transition-transform duration-[var(--dur-1)] ease-[var(--ease-mech)]
          active:scale-[0.92] disabled:pointer-events-none disabled:opacity-40"
      >
        {/* Clé sur `done` : le geste le plus répété de l'app mérite d'être
            accusé réception, et une animation CSS ne rejoue qu'au montage. Sur
            la coche seule — remonter la ligne entière remonterait les champs de
            saisie avec elle, et le clavier partirait entre deux séries. */}
        <span
          key={done ? 'done' : 'todo'}
          className={`flex size-[2.125rem] items-center justify-center rounded-lg
            transition-colors duration-[var(--dur-1)]
            ${
              done
                ? 'animate-pop bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                : 'bg-[var(--surface-2)] text-[var(--text-2)]'
            }`}
        >
          <CheckIcon width={14} height={14} />
        </span>
      </button>
    </div>
  );
}
