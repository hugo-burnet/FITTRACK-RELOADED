import { Fragment, useState } from 'react';
import {
  workoutExerciseIdentityOf,
  type WorkoutExerciseDetail,
  type SetValues,
} from '@/data/repositories/workouts';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import type { CoachRecommendation, PersonalRecordType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle, unitLabel } from '@/i18n/labels';
import { entryColumns } from '@/lib/measurement';
import type { SupersetPlace } from '@/lib/routineOrder';
import type { RepPacer } from '@/stores/repPacer';
import { AddRow, SwipeToDelete, UndoRow } from '@/ui';
import type { ItemState } from '@/ui';
import {
  CheckIcon,
  ChevronDownIcon,
  GripIcon,
  MoreIcon,
  PlateIcon,
  StarIcon,
  StopIcon,
  StopwatchIcon,
} from '@/ui/icons';
import { CoachCard } from './CoachCard';
import { EffortStrip } from './EffortStrip';
import { recommendationAsSignal } from './coachCopy';
import { RecordNote } from './RecordNote';
import { RepPaceRail } from './RepPaceRail';
import { RestRail, RestStatus } from './RestRail';
import { WorkoutSetRow } from './WorkoutSetRow';
import type { WorkoutFoldCommand } from './workoutFold';
import { setReading } from './summary';

type DeletedSet = { setId: string; rank: number; reading: string };

export interface WorkoutRecordNotice {
  types: PersonalRecordType[];
  entries: RecordTimelineEntry[];
}

export type WorkoutRecordNotices = Map<string, WorkoutRecordNotice>;

// Exported for the view-model contract tests; it remains colocated with the
// prop contract consumed by this card.
// eslint-disable-next-line react-refresh/only-export-components
export function workoutRecordNotices(
  entries: readonly RecordTimelineEntry[],
): WorkoutRecordNotices {
  const notices: WorkoutRecordNotices = new Map();

  for (const entry of entries) {
    if (entry.previousValue === undefined) continue;
    const sourceSetId = entry.triggerWorkoutSetId ?? entry.record.workoutSetId;
    if (sourceSetId === undefined) continue;
    const notice = notices.get(sourceSetId);
    if (notice === undefined) {
      notices.set(sourceSetId, {
        types: [entry.record.type],
        entries: [entry],
      });
    } else {
      notice.types.push(entry.record.type);
      notice.entries.push(entry);
    }
  }

  return notices;
}

export type CardRest = {
  setId: string;
  startedAt: number;
  endsAt: number;
  /** True when the rest flows directly into the next set's cadence. */
  onDone: () => boolean;
};

export type CardPace = RepPacer & { setId: string; onFinished: () => void };

/** The effort question waiting under one validated set. */
export type CardEffort = {
  setId: string;
  onAnswer: (rpe: number) => void;
  onExpire: () => void;
};

type Props = {
  line: WorkoutExerciseDetail;
  tutorial?: boolean;
  superset?: SupersetPlace;
  rest: CardRest | null;
  /** The metronome running on this card's next set, if any. */
  pace: CardPace | null;
  /** The effort strip, when the set it belongs to is on this card. */
  effort: CardEffort | null;
  /** Persisted improvements keyed by the set that triggered them. */
  records: WorkoutRecordNotices;
  state: ItemState;
  reorderEnabled: boolean;
  foldCommand: WorkoutFoldCommand;
  onMenu: () => void;
  /** Opens the cadence of this exercise — tempo, and the button that beats it. */
  onPace: () => void;
  /** Present only while this card's cadence is running. */
  onStopPace?: () => void;
  onPlates?: () => void;
  onSetMenu: (set: WorkoutSet, number: number) => void;
  onWrite: (setId: string, values: Partial<SetValues>, recordable: boolean) => void;
  onComplete: (setId: string, values: Partial<SetValues>, set: WorkoutSet) => void;
  onUncomplete: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onRestoreSet: (setId: string) => void;
  onAddSet: () => void;
  /** Pending coach objective from a previous session — display only, never pre-fills. */
  coachObjective?: CoachRecommendation;
  onDismissCoach?: () => void;
  /** Tap on the objective writes its load onto the sets left to do. */
  onApplyCoach?: () => void;
};

const alternationMark = (index: number): string => String.fromCharCode(65 + index);

const WIDTH = { first: '4.75rem', second: '3.5rem' } as const;

/** Live-workout exercise card with set entry, records, rest, and supersets. */
export function WorkoutExerciseCard({
  line,
  tutorial = false,
  superset,
  rest,
  pace,
  effort,
  records,
  state,
  reorderEnabled,
  foldCommand,
  onMenu,
  onPace,
  onStopPace,
  onPlates,
  onSetMenu,
  onWrite,
  onComplete,
  onUncomplete,
  onDeleteSet,
  onRestoreSet,
  onAddSet,
  coachObjective,
  onDismissCoach,
  onApplyCoach,
}: Props) {
  const { row, exercise, sets, previous } = line;
  const identity = workoutExerciseIdentityOf(line);
  const name = identity.name ?? t('workout.deletedExercise');
  const columns = entryColumns(identity.measurementType);

  const first = superset !== undefined && superset.index === 0;
  const last = superset !== undefined && superset.index === superset.size - 1;

  const allDone = sets.length > 0 && sets.every((set) => set.isCompleted === 1);

  // Convergent render-time adjustment prevents one stale expanded frame.
  const [expanded, setExpanded] = useState(!allDone);
  const [wasAllDone, setWasAllDone] = useState(allDone);
  const [seenFoldVersion, setSeenFoldVersion] = useState(foldCommand.version);
  if (foldCommand.version !== seenFoldVersion) {
    setSeenFoldVersion(foldCommand.version);
    setWasAllDone(allDone);
    setExpanded(foldCommand.expanded);
  } else if (allDone !== wasAllDone) {
    setWasAllDone(allDone);
    setExpanded(!allDone);
  }

  const lastSet = sets.length > 0 ? sets[sets.length - 1] : undefined;
  const doneReading = lastSet !== undefined ? setReading(lastSet, columns) : '';

  // Preserve record feedback when completing a set folds the card.
  const hasRecord = sets.some((set) => records.has(set.id));

  const [deleted, setDeleted] = useState<DeletedSet | null>(null);

  const undoRow =
    deleted === null ? null : (
      <UndoRow
        reading={deleted.reading}
        onUndo={() => {
          setDeleted(null);
          onRestoreSet(deleted.setId);
        }}
        onExpire={() => setDeleted(null)}
      />
    );

  return (
    <div
      data-tutorial-id={rest !== null ? 'workout-rest' : undefined}
      className={`relative ${superset === undefined ? '' : 'pl-3'}`}
    >
      {superset !== undefined && (
        <span
          aria-hidden="true"
          className={`absolute top-0 left-0 w-[3px] bg-[var(--accent-ink)]
            ${first ? 'rounded-t-full' : ''} ${last ? 'rounded-b-full' : ''}`}
          // Extend through the list gap to keep the superset bracket continuous.
          style={{ bottom: last ? 0 : '-0.75rem' }}
        />
      )}

      <div
        className={`relative overflow-hidden rounded-2xl transition-colors duration-[var(--dur-1)]
          ${
            state.dragging
              ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent-ink)]'
              : expanded
                ? 'bg-[var(--surface-1)]'
                : 'bg-[var(--surface-2)]'
          }`}
      >
        <div
          className={`relative flex items-stretch
            ${expanded ? 'border-b border-[var(--border)]' : ''}`}
        >
          {reorderEnabled && (
            <button
              type="button"
              aria-label={t('routines.dragHandle', { name })}
              className="flex w-11 shrink-0 cursor-grab items-center justify-center
                text-[var(--text-2)] active:cursor-grabbing"
              {...state.handleProps}
            >
              <GripIcon />
            </button>
          )}

          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            // Same as the routine card: locked order removes the handle that was
            // insetting this header, so the inset moves onto the header itself.
            className={`flex min-w-0 flex-1 items-center gap-2 py-3 pr-1 text-left
              ${reorderEnabled ? '' : 'pl-4'}`}
          >
            {!expanded && allDone && <CheckIcon className="shrink-0 text-[var(--accent-ink)]" />}
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="flex min-w-0 items-baseline gap-2">
                {superset !== undefined && (
                  <span className="label-xs shrink-0 font-semibold text-[var(--accent-ink)]">
                    {alternationMark(superset.index)}
                  </span>
                )}
                <span
                  className={`min-w-0 truncate text-base ${
                    expanded ? 'text-[var(--text-1)]' : 'text-[var(--text-2)]'
                  }`}
                >
                  {name}
                </span>
                {!expanded && hasRecord && (
                  <StarIcon
                    width={16}
                    height={16}
                    role="img"
                    aria-hidden={false}
                    aria-label={t('workout.recordFolded')}
                    className="shrink-0 text-[var(--accent-ink)]"
                  />
                )}
              </span>
              {rest !== null ? (
                <RestStatus endsAt={rest.endsAt} />
              ) : pace === null && expanded ? (
                exercise !== undefined && (
                  <span className="truncate text-sm text-[var(--text-2)]">
                    {exerciseSubtitle(exercise)}
                  </span>
                )
              ) : (
                pace === null &&
                doneReading !== '' && (
                  <span className="metric truncate text-sm text-[var(--text-2)]">
                    {doneReading}
                  </span>
                )
              )}
              {/* Mounted for as long as the cadence runs, even when the rest
                  reading takes the slot: this component's lifetime *is* the
                  pace's, so hiding it by unmounting cancels every beat left in
                  the set — silently, and with the store still armed. */}
              {pace !== null && (
                <span className={rest === null ? 'contents' : 'hidden'}>
                  <RepPaceRail pacer={pace} onFinished={pace.onFinished} />
                </span>
              )}
            </span>
            <ChevronDownIcon
              className={`shrink-0 text-[var(--text-2)] transition-transform
                duration-[var(--dur-1)] ${expanded ? '' : '-rotate-90'}`}
            />
          </button>

          {/* Le chrono de l'exercice. Une seule place dans le bandeau pour deux
              gestes qui ne se présentent jamais ensemble : ouvrir la cadence
              quand rien ne tourne, l'arrêter d'un doigt quand elle tourne — la
              vieille case « stop » n'apparaissait qu'à ce moment-là, elle est
              donc exactement ce bouton dans son autre état. */}
          {pace !== null && onStopPace !== undefined ? (
            <button
              type="button"
              aria-label={t('workout.paceStop')}
              onClick={onStopPace}
              className="flex w-12 shrink-0 items-center justify-center text-[var(--accent-ink)]
                transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
            >
              <StopIcon width={18} height={18} />
            </button>
          ) : (
            <button
              type="button"
              aria-label={t('workout.paceOpen', { name })}
              onClick={onPace}
              className="flex w-11 shrink-0 items-center justify-center text-[var(--text-2)]
                transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
            >
              <StopwatchIcon width={20} height={20} />
            </button>
          )}

          {onPlates !== undefined && (
            <button
              type="button"
              aria-label={t('workout.plates')}
              onClick={onPlates}
              className="flex w-11 shrink-0 items-center justify-center text-[var(--text-2)]
                transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
            >
              <PlateIcon width={20} height={20} />
            </button>
          )}

          <button
            type="button"
            aria-label={t('workout.exerciseMenu', { name })}
            onClick={onMenu}
            className="flex w-12 shrink-0 items-center justify-center text-[var(--text-2)]
              transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
          >
            <MoreIcon />
          </button>

          {rest !== null && (
            <RestRail
              key={rest.setId}
              startedAt={rest.startedAt}
              endsAt={rest.endsAt}
              onDone={rest.onDone}
            />
          )}
        </div>

        {expanded && (
          <>
            {row.notes !== undefined && row.notes !== '' && (
              <p
                className="border-b border-[var(--border)] px-4 py-2 text-sm leading-relaxed
                text-[var(--text-2)]"
              >
                {row.notes}
              </p>
            )}

            {coachObjective !== undefined && (
              <div className="border-b border-[var(--border)]">
                <CoachCard
                  signal={recommendationAsSignal(coachObjective)}
                  // An observation with no load to put on the bar — a plateau,
                  // a long rest — is not an objective. Only a figure is.
                  tone={coachObjective.nextLoadKg === undefined ? 'signal' : 'objective'}
                  variant="strip"
                  onDismiss={onDismissCoach}
                  onApply={onApplyCoach}
                />
              </div>
            )}

            <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
              <span className="w-12 shrink-0" />
              <span className="label-xs min-w-0 flex-1 text-center font-semibold text-[var(--text-2)]">
                {t('workout.previous')}
              </span>
              {columns.map((column, index) => (
                <span
                  key={column.field}
                  style={{ width: index === 0 ? WIDTH.first : WIDTH.second }}
                  className={`shrink-0 text-center font-semibold text-[var(--text-2)] ${
                    column.unit === 'reps' ? 'label-xs' : 'text-[0.6875rem] tracking-[0.08em]'
                  }`}
                >
                  {column.prefix}
                  {unitLabel(column.unit)}
                </span>
              ))}
              <span className="w-12 shrink-0" />
            </div>

            {sets.map((set, index) => {
              const record = records.get(set.id);
              return (
                <Fragment key={set.id}>
                  {deleted?.rank === index && undoRow}
                  <SwipeToDelete
                    label={t('workout.swipeDelete')}
                    onDelete={() => {
                      setDeleted({
                        setId: set.id,
                        rank: index,
                        reading:
                          setReading(set, columns) ||
                          t('workout.emptySetReading', { number: index + 1 }),
                      });
                      onDeleteSet(set.id);
                    }}
                  >
                    <WorkoutSetRow
                      set={set}
                      number={index + 1}
                      columns={columns}
                      previous={previous[index]}
                      tutorial={tutorial && index === 0}
                      onWrite={(values, recordable) => onWrite(set.id, values, recordable)}
                      onComplete={(values) => onComplete(set.id, values, set)}
                      onUncomplete={() => onUncomplete(set.id)}
                      onMenu={() => onSetMenu(set, index + 1)}
                    />
                    {record !== undefined && <RecordNote notice={record} />}
                  </SwipeToDelete>
                  {effort?.setId === set.id && (
                    <EffortStrip onAnswer={effort.onAnswer} onExpire={effort.onExpire} />
                  )}
                </Fragment>
              );
            })}

            {deleted !== null && deleted.rank >= sets.length && undoRow}

            <AddRow label={t('workout.addSet')} onClick={onAddSet} />
          </>
        )}

        {/* Completing the last set folds the card. The answer must survive
            that fold, otherwise the one effort reading most likely to matter
            is also the only one the person can never enter. */}
        {!expanded && effort !== null && (
          <EffortStrip onAnswer={effort.onAnswer} onExpire={effort.onExpire} />
        )}
      </div>
    </div>
  );
}
