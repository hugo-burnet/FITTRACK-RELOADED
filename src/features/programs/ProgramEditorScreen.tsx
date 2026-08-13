import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  ProgramRepositoryError,
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  getProgramDetail,
  replaceActiveProgram,
  replaceProgramWeeks,
  updateProgramDraft,
} from '@/data/repositories/programs';
import type { ProgramDetail } from '@/data/repositories/programs';
import { listRoutineSummaries } from '@/data/repositories/routines';
import type { RoutineSummary } from '@/data/repositories/routines';
import { listCompletedWorkouts } from '@/data/repositories/history';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { PROGRAM_PHASES } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { programPosition, resolveSchedule } from '@/lib/programs';
import { ActionBand, ConfirmSheet } from '@/ui';
import { ProgramBasicsStep } from './ProgramBasicsStep';
import type { ProgramBasicsDraft } from './ProgramBasicsStep';
import { ProgramSplitStep } from './ProgramSplitStep';
import type { ProgramSplitDraftEntry } from './ProgramSplitStep';
import { ProgramWeeksStep } from './ProgramWeeksStep';
import type { ProgramWeekDraft } from './ProgramWeeksStep';

type ProgramEditorStep = 'basics' | 'split' | 'weeks';
type ExistingProgramQuery =
  | { status: 'not_requested' }
  | { status: 'found'; detail: ProgramDetail; programWorkoutWeekIndexes: number[] }
  | { status: 'not_found' }
  | { status: 'error' };
type RoutinesQuery =
  | { status: 'ready'; routines: RoutineSummary[] }
  | { status: 'error' };

const STEP_NUMBER: Record<ProgramEditorStep, number> = { basics: 1, split: 2, weeks: 3 };
const STEP_NAME: Record<ProgramEditorStep, TranslationKey> = {
  basics: 'program.stepBasics',
  split: 'program.stepSplit',
  weeks: 'program.stepWeeks',
};

const emptySplit = (): ProgramSplitDraftEntry[] => [
  { routineId: '', dayOfWeek: 1, order: 0 },
];

const defaultWeeks = (durationWeeks: number): ProgramWeekDraft[] =>
  Array.from({ length: durationWeeks }, (_, weekIndex) => ({
    weekIndex,
    loadIndex: 100,
    phase: 'construction',
  }));

function formatLocalDate(timestamp: number): string {
  if (timestamp <= 0) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return 0;
  return date.getTime();
}

function orderedSplit(entries: ProgramSplitDraftEntry[]): ProgramSplitDraftEntry[] {
  const orders = new Map<number, number>();
  return entries.map((entry) => {
    const order = orders.get(entry.dayOfWeek) ?? 0;
    orders.set(entry.dayOfWeek, order + 1);
    return { ...entry, order };
  });
}

function splitForWeek(detail: ProgramDetail, weekIndex: number): ProgramSplitDraftEntry[] {
  const entries = resolveSchedule(
    detail.revisions.map(({ revision }) => revision),
    detail.revisions.flatMap(({ entries: revisionEntries }) => revisionEntries),
    weekIndex,
  );
  return entries.length === 0
    ? emptySplit()
    : entries.map(({ routineId, dayOfWeek, order }) => ({ routineId, dayOfWeek, order }));
}

function effectiveWeekOptions(
  detail: ProgramDetail,
  programWorkoutWeekIndexes: readonly number[],
  at: number,
): number[] {
  const latestRevisionWeek = detail.revisions.reduce(
    (latest, { revision }) => Math.max(latest, revision.effectiveFromWeekIndex),
    -1,
  );
  const position = programPosition(detail.program.startsAt, detail.program.durationWeeks, at);
  if (position.phase === 'after') return [];
  const workoutWeeks = new Set(programWorkoutWeekIndexes);

  return Array.from({ length: detail.program.durationWeeks }, (_, weekIndex) => weekIndex).filter(
    (weekIndex) => {
      if (weekIndex < latestRevisionWeek) return false;
      if (position.phase !== 'active') return true;
      if (weekIndex < position.weekIndex) return false;
      return weekIndex !== position.weekIndex || !workoutWeeks.has(weekIndex);
    },
  );
}

function repositoryErrorKey(error: unknown): TranslationKey {
  if (error instanceof ProgramRepositoryError) {
    if (error.code === 'another_program_active') return 'program.errorAnotherActive';
    if (error.code === 'routine_missing') return 'program.errorRoutineMissing';
  }
  return 'program.errorSave';
}

export function ProgramEditorScreen() {
  const { id: routeProgramId } = useParams();
  const navigate = useNavigate();
  const [editorOpenedAt] = useState(() => Date.now());
  const [step, setStep] = useState<ProgramEditorStep>('basics');
  const [basics, setBasics] = useState<ProgramBasicsDraft>({
    name: '',
    startsAt: 0,
    durationWeeks: 8,
  });
  const [dateValue, setDateValue] = useState('');
  const [split, setSplit] = useState<ProgramSplitDraftEntry[]>(emptySplit);
  const [weeks, setWeeks] = useState<ProgramWeekDraft[]>(() => defaultWeeks(8));
  const [programId, setProgramId] = useState(routeProgramId ?? '');
  const [hydratedId, setHydratedId] = useState('');
  const [hasPersistedWeeks, setHasPersistedWeeks] = useState(false);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [effectiveFromWeekIndex, setEffectiveFromWeekIndex] = useState<number | null>(null);
  const [replacementOpen, setReplacementOpen] = useState(false);

  const existing = useLiveQuery<ExistingProgramQuery>(
    async () => {
      if (routeProgramId === undefined) return { status: 'not_requested' };
      try {
        const detail = await getProgramDetail(routeProgramId);
        if (detail === null) return { status: 'not_found' };
        const [completedWorkouts, activeWorkout] = await Promise.all([
          listCompletedWorkouts(),
          getActiveWorkout(),
        ]);
        const programWorkoutWeekIndexes = [
          ...completedWorkouts,
          ...(activeWorkout === undefined ? [] : [activeWorkout]),
        ].flatMap((workout) =>
          workout.programId === detail.program.id && workout.programWeekIndex !== undefined
            ? [workout.programWeekIndex]
            : [],
        );
        return { status: 'found', detail, programWorkoutWeekIndexes };
      } catch {
        return { status: 'error' };
      }
    },
    [routeProgramId],
  );
  const routinesQuery = useLiveQuery<RoutinesQuery>(async () => {
    try {
      return { status: 'ready', routines: await listRoutineSummaries() };
    } catch {
      return { status: 'error' };
    }
  });
  const routines = routinesQuery?.status === 'ready' ? routinesQuery.routines : undefined;
  const routinesReadFailed = routinesQuery?.status === 'error';

  if (routeProgramId !== undefined && existing?.status === 'found' && hydratedId !== routeProgramId) {
    const { detail, programWorkoutWeekIndexes } = existing;
    const position = programPosition(
      detail.program.startsAt,
      detail.program.durationWeeks,
      editorOpenedAt,
    );
    const hydrateWeekIndex =
      position.phase === 'active'
        ? position.weekIndex
        : position.phase === 'before'
          ? 0
          : detail.program.durationWeeks - 1;
    const options = effectiveWeekOptions(detail, programWorkoutWeekIndexes, editorOpenedAt);
    const initialEffectiveWeekIndex = options[0] ?? null;
    setBasics({
      name: detail.program.name,
      startsAt: detail.program.startsAt,
      durationWeeks: detail.program.durationWeeks,
    });
    setDateValue(formatLocalDate(detail.program.startsAt));
    setSplit(splitForWeek(detail, initialEffectiveWeekIndex ?? hydrateWeekIndex));
    setWeeks(
      detail.weeks.length === detail.program.durationWeeks
        ? detail.weeks.map(({ weekIndex, loadIndex, phase }) => ({
            weekIndex,
            loadIndex,
            phase,
          }))
        : defaultWeeks(detail.program.durationWeeks),
    );
    setHasPersistedWeeks(detail.weeks.length > 0);
    setProgramId(routeProgramId);
    if (detail.program.status === 'active') {
      setEffectiveFromWeekIndex(initialEffectiveWeekIndex);
      setStep('split');
    }
    setHydratedId(routeProgramId);
  }

  const existingDetail = existing?.status === 'found' ? existing.detail : null;
  const activeEdit = existingDetail?.program.status === 'active';
  const availableEffectiveWeeks =
    activeEdit && existing?.status === 'found'
      ? effectiveWeekOptions(
          existing.detail,
          existing.programWorkoutWeekIndexes,
          editorOpenedAt,
        )
      : [];

  const goBack = () => {
    setErrorKey(null);
    if (activeEdit) {
      const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (index > 0) void navigate(-1);
      else void navigate(`/programs/${programId}`);
    } else if (step === 'weeks') setStep('split');
    else if (step === 'split') setStep('basics');
    else {
      const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (index > 0) void navigate(-1);
      else void navigate('/programs');
    }
  };

  const completeStep = async () => {
    if (saving) return;
    setErrorKey(null);

    if (step === 'basics') {
      const valid =
        basics.name.trim().length > 0 &&
        basics.startsAt > 0 &&
        new Date(basics.startsAt).getDay() === 1 &&
        Number.isInteger(basics.durationWeeks) &&
        basics.durationWeeks >= 4 &&
        basics.durationWeeks <= 12;
      if (!valid) {
        setErrorKey('program.errorBasics');
        return;
      }
    } else if (step === 'split') {
      if (
        split.length === 0 ||
        split.some(
          (entry) => entry.routineId === '' || entry.dayOfWeek < 1 || entry.dayOfWeek > 7,
        )
      ) {
        setErrorKey('program.errorSplit');
        return;
      }
    } else {
      const phaseSet = new Set<string>(PROGRAM_PHASES);
      const invalidWeek = weeks.some(
        (week) =>
          !Number.isFinite(week.loadIndex) ||
          !Number.isInteger(week.loadIndex) ||
          !phaseSet.has(week.phase),
      );
      if (weeks.length !== basics.durationWeeks || invalidWeek) {
        setErrorKey('program.errorWeeks');
        return;
      }
    }

    setSaving(true);
    try {
      if (step === 'basics') {
        if (programId === '') {
          const program = await createProgramDraft({ ...basics, name: basics.name.trim() });
          setProgramId(program.id);
        } else {
          await updateProgramDraft(programId, { ...basics, name: basics.name.trim() });
        }
        if (weeks.length !== basics.durationWeeks) {
          const resizedWeeks = Array.from(
            { length: basics.durationWeeks },
            (_, weekIndex) => weeks[weekIndex] ?? defaultWeeks(basics.durationWeeks)[weekIndex]!,
          );
          if (hasPersistedWeeks) await replaceProgramWeeks(programId, resizedWeeks);
          setWeeks(resizedWeeks);
        }
        setStep('split');
      } else if (step === 'split') {
        if (activeEdit && existingDetail !== null) {
          if (
            effectiveFromWeekIndex === null ||
            !availableEffectiveWeeks.includes(effectiveFromWeekIndex)
          ) {
            setErrorKey('program.errorNoFutureRevision');
            return;
          }
          await createScheduleRevision(programId, effectiveFromWeekIndex, orderedSplit(split));
          void navigate(`/programs/${programId}`);
        } else {
          await createScheduleRevision(programId, 0, orderedSplit(split));
          setStep('weeks');
        }
      } else {
        await replaceProgramWeeks(programId, weeks);
        setHasPersistedWeeks(true);
        await activateProgram(programId);
        void navigate(`/programs/${programId}`);
      }
    } catch (error) {
      if (error instanceof ProgramRepositoryError && error.code === 'another_program_active') {
        setReplacementOpen(true);
      } else {
        setErrorKey(repositoryErrorKey(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmReplacement = async () => {
    if (saving || programId === '') return;
    setSaving(true);
    setErrorKey(null);
    try {
      await replaceActiveProgram(programId);
      void navigate(`/programs/${programId}`);
    } catch (error) {
      setErrorKey(repositoryErrorKey(error));
    } finally {
      setSaving(false);
    }
  };

  if (routeProgramId !== undefined && existing?.status === 'error') {
    return (
      <Screen title={t('program.editTitle')} onBack={goBack}>
        <p className="text-[var(--text-2)]">{t('program.errorRead')}</p>
      </Screen>
    );
  }

  if (routeProgramId !== undefined && existing?.status === 'not_found') {
    return (
      <Screen title={t('program.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  if (routeProgramId !== undefined && (existing === undefined || hydratedId !== routeProgramId)) {
    return (
      <Screen title={t('program.editTitle')} onBack={goBack}>
        <p className="text-[var(--text-2)]">{t('program.loading')}</p>
      </Screen>
    );
  }

  return (
    <Screen
      title={routeProgramId === undefined ? t('program.newTitle') : t('program.editTitle')}
      onBack={goBack}
      footer={
        <ActionBand
          label={
            activeEdit
              ? effectiveFromWeekIndex === null
                ? t('program.saveRevision')
                : t('program.saveRevisionWeek', { number: effectiveFromWeekIndex + 1 })
              : step === 'weeks'
                ? t('program.activate')
                : t('program.continue')
          }
          disabled={
            saving ||
            (step === 'split' &&
              (routinesQuery === undefined || routinesReadFailed || routines?.length === 0)) ||
            (activeEdit && effectiveFromWeekIndex === null)
          }
          onClick={() => void completeStep()}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {!activeEdit && (
          <nav
            aria-label={t('program.stepProgress', {
              current: STEP_NUMBER[step],
              name: t(STEP_NAME[step]),
            })}
          >
            <p className="text-sm font-semibold text-[var(--text-1)]">
              {t('program.stepProgress', {
                current: STEP_NUMBER[step],
                name: t(STEP_NAME[step]),
              })}
            </p>
            <ol className="mt-3 flex gap-4">
              {([1, 2, 3] as const).map((n) => (
                <li
                  key={n}
                  aria-current={n === STEP_NUMBER[step] ? 'step' : undefined}
                  className={
                    n === STEP_NUMBER[step]
                      ? 'text-[var(--text-1)]'
                      : 'text-[var(--text-2)]'
                  }
                >
                  {n}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {errorKey && (
          <p role="alert" className="rounded-xl bg-[var(--surface-1)] p-4 text-sm leading-relaxed text-[var(--danger-ink)]">
            {t(errorKey)}
          </p>
        )}

        {step === 'basics' && (
          <ProgramBasicsStep
            value={basics}
            dateValue={dateValue}
            onChange={setBasics}
            onDateChange={(value) => {
              setDateValue(value);
              setBasics((current) => ({ ...current, startsAt: parseLocalDate(value) }));
            }}
          />
        )}
        {step === 'split' && (
          <>
            {activeEdit && (
              <label className="flex flex-col gap-2">
                <span className="label-xs font-semibold text-[var(--text-2)]">
                  {t('program.effectiveWeekLabel')}
                </span>
                <select
                  aria-label={t('program.effectiveWeekLabel')}
                  value={effectiveFromWeekIndex ?? ''}
                  disabled={availableEffectiveWeeks.length === 0}
                  onChange={(event) => {
                    if (existingDetail === null) return;
                    const weekIndex = Number(event.target.value);
                    setEffectiveFromWeekIndex(weekIndex);
                    setSplit(splitForWeek(existingDetail, weekIndex));
                  }}
                  className="min-h-12 rounded-lg bg-[var(--surface-2)] px-4 text-base
                    text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]"
                >
                  {availableEffectiveWeeks.map((weekIndex) => (
                    <option key={weekIndex} value={weekIndex}>
                      {t('program.week', { number: weekIndex + 1 })}
                    </option>
                  ))}
                </select>
                <span className="text-sm leading-relaxed text-[var(--text-2)]">
                  {t('program.effectiveWeekHint')}
                </span>
              </label>
            )}
            {routinesReadFailed ? (
              <p role="alert" className="text-sm leading-relaxed text-[var(--danger-ink)]">
                {t('program.routinesReadError')}
              </p>
            ) : (
              <ProgramSplitStep entries={split} routines={routines} onChange={setSplit} />
            )}
          </>
        )}
        {step === 'weeks' && <ProgramWeeksStep weeks={weeks} onChange={setWeeks} />}
      </div>
      <ConfirmSheet
        open={replacementOpen}
        onClose={() => setReplacementOpen(false)}
        title={t('program.replaceActiveTitle')}
        body={t('program.replaceActiveBody')}
        confirmLabel={t('program.replaceActiveConfirm')}
        onConfirm={() => void confirmReplacement()}
      />
    </Screen>
  );
}
