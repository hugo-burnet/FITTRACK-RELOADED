import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  completeProgram,
  getProgramDetail,
  shiftProgram,
} from '@/data/repositories/programs';
import type { ProgramDetail } from '@/data/repositories/programs';
import { listCompletedWorkouts } from '@/data/repositories/history';
import { startWorkoutFromProgram } from '@/data/repositories/programWorkout';
import { getRoutineDetail } from '@/data/repositories/routines';
import { getActiveWorkout } from '@/data/repositories/workouts';
import type { Program, ProgramWeek } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { pickProgramSession, programPosition, resolveSchedule } from '@/lib/programs';
import type { ProgramPosition } from '@/lib/programs';
import { ActionBand, HeaderAction } from '@/ui';
import { MoreIcon } from '@/ui/icons';
import { ProgramActionsSheet } from './ProgramActionsSheet';
import { ProgramSessionList, UpcomingWeeks } from './ProgramSessionList';
import type { ProgramSessionReading } from './ProgramSessionList';
import { phaseIntention, weekLine } from './weekReading';

interface DetailProjection {
  detail: ProgramDetail;
  position: ProgramPosition;
  week: ProgramWeek | null;
  sessions: ProgramSessionReading[];
  activeWorkoutExists: boolean;
}

type DetailQuery =
  | { status: 'ready'; value: DetailProjection }
  | { status: 'not_found' }
  | { status: 'error' };

const STATUS_KEYS: Record<Program['status'], TranslationKey> = {
  draft: 'program.statusDraft',
  active: 'program.statusActive',
  completed: 'program.statusCompleted',
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric',
});

function ProgramProgressReading({ program, position }: { program: Program; position: ProgramPosition }) {
  return (
    <section className="px-1 pt-1">
      <p className="label-xs font-semibold text-[var(--text-2)]">{t(STATUS_KEYS[program.status])}</p>
      {position.phase === 'active' ? (
        <p className="metric mt-2 text-4xl leading-none font-semibold tracking-tight text-[var(--text-1)]">
          {t('program.progressWeek', {
            current: position.weekIndex + 1,
            total: program.durationWeeks,
          })}
        </p>
      ) : (
        <p className="mt-2 text-xl font-semibold leading-snug text-[var(--text-1)]">
          {position.phase === 'before'
            ? t('program.progressBefore', { date: dateFormatter.format(program.startsAt) })
            : t('program.progressAfter', { count: program.durationWeeks })}
        </p>
      )}
    </section>
  );
}

function CurrentIntention({ week }: { week: ProgramWeek }) {
  const intention = phaseIntention(week.phase);
  return (
    <section className="border-y border-[var(--border)] py-4">
      <p className="label-xs font-semibold text-[var(--text-2)]">
        {t('program.intentionTitle')}
      </p>
      <p
        className={`mt-2 text-xl font-semibold ${
          week.phase === 'deload' ? 'text-[var(--accent-ink)]' : 'text-[var(--text-1)]'
        }`}
      >
        {weekLine(week)}
      </p>
      {intention !== null && (
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{intention}</p>
      )}
      {week.notes && <p className="mt-2 text-sm text-[var(--text-2)]">{week.notes}</p>}
    </section>
  );
}

async function readProjection(programId: string): Promise<DetailQuery> {
  try {
    const detail = await getProgramDetail(programId);
    if (detail === null) return { status: 'not_found' };

    const now = Date.now();
    const position = programPosition(detail.program.startsAt, detail.program.durationWeeks, now);
    const weekIndex =
      position.phase === 'active'
        ? position.weekIndex
        : position.phase === 'before'
          ? 0
          : detail.program.durationWeeks - 1;
    const entries = resolveSchedule(
      detail.revisions.map(({ revision }) => revision),
      detail.revisions.flatMap(({ entries: revisionEntries }) => revisionEntries),
      weekIndex,
    );
    const [completedWorkouts, activeWorkout, routines] = await Promise.all([
      listCompletedWorkouts(),
      getActiveWorkout(),
      Promise.all(entries.map((entry) => getRoutineDetail(entry.routineId))),
    ]);
    const completedEntries = new Set(
      completedWorkouts
        .filter(
          (workout) =>
            workout.programId === detail.program.id &&
            workout.programWeekIndex === weekIndex &&
            workout.programScheduleEntryId !== undefined,
        )
        .map((workout) => workout.programScheduleEntryId),
    );
    const currentDay = position.phase === 'active' ? position.dayOfWeek : 0;
    const sessions: ProgramSessionReading[] = entries.map((entry, index) => ({
      entryId: entry.id,
      routineName: routines[index]?.routine.name ?? null,
      dayOfWeek: entry.dayOfWeek,
      order: entry.order,
      state: completedEntries.has(entry.id)
        ? 'completed'
        : currentDay === entry.dayOfWeek
          ? 'today'
          : currentDay > entry.dayOfWeek
            ? 'missed'
            : 'upcoming',
    }));

    return {
      status: 'ready',
      value: {
        detail,
        position,
        week: detail.weeks.find((candidate) => candidate.weekIndex === weekIndex) ?? null,
        sessions,
        activeWorkoutExists: activeWorkout !== undefined,
      },
    };
  } catch {
    return { status: 'error' };
  }
}

export function ProgramDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const query = useLiveQuery(() => readProjection(id), [id]);

  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/programs');
  };

  if (query === undefined) {
    return (
      <Screen title={t('program.detailTitle')} onBack={goBack}>
        <p className="text-[var(--text-2)]">{t('program.loading')}</p>
      </Screen>
    );
  }
  if (query.status === 'error') {
    return (
      <Screen title={t('program.detailTitle')} onBack={goBack}>
        <p role="alert" className="text-[var(--danger-ink)]">
          {t('program.detailReadError')}
        </p>
      </Screen>
    );
  }
  if (query.status === 'not_found') {
    return (
      <Screen title={t('program.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  const { detail, position, week, sessions, activeWorkoutExists } = query.value;
  const candidates = sessions
    .filter((session) => session.routineName !== null)
    .map((session) => ({
      entryId: session.entryId,
      routineId: session.entryId,
      weekIndex: position.phase === 'active' ? position.weekIndex : 0,
      dayOfWeek: session.dayOfWeek,
      order: session.order,
      completed: session.state === 'completed',
    }));
  const suggested = pickProgramSession(candidates, position, detail.program.durationWeeks);
  const suggestedEntryId = 'session' in suggested ? suggested.session.entryId : null;
  const selectable = sessions.filter((session) => session.routineName !== null);
  const effectiveSelected =
    selectable.find((session) => session.entryId === selectedEntryId) ??
    selectable.find((session) => session.entryId === suggestedEntryId) ??
    null;
  const canStart =
    detail.program.status === 'active' &&
    position.phase === 'active' &&
    !activeWorkoutExists &&
    effectiveSelected !== null;
  const upcomingWeeks =
    position.phase === 'active'
      ? detail.weeks.filter((candidate) => candidate.weekIndex > position.weekIndex)
      : detail.weeks;

  const runAction = async (action: () => Promise<void>) => {
    setActionError(false);
    try {
      await action();
    } catch {
      setActionError(true);
    }
  };

  const releaseStart = () => {
    startingRef.current = false;
    setStarting(false);
  };

  const beginStart = async () => {
    if (!canStart || effectiveSelected === null || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setActionError(false);
    try {
      await startWorkoutFromProgram({
        programId: detail.program.id,
        programScheduleEntryId: effectiveSelected.entryId,
      });
      void navigate('/workout');
    } catch {
      setActionError(true);
      releaseStart();
    }
  };

  return (
    <Screen
      title={detail.program.name}
      onBack={goBack}
      action={detail.program.status !== 'completed' ? (
        <HeaderAction label={t('program.actionsLabel')} onClick={() => setActionsOpen(true)}>
          <MoreIcon />
        </HeaderAction>
      ) : undefined}
      footer={
        canStart ? (
          <ActionBand
            label={t('program.startSession', { name: effectiveSelected.routineName! })}
            disabled={starting}
            onClick={() => void beginStart()}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-7">
        <ProgramProgressReading program={detail.program} position={position} />
        {week !== null && <CurrentIntention week={week} />}
        {activeWorkoutExists && detail.program.status === 'active' && (
          <p className="text-sm font-semibold text-[var(--text-2)]">
            {t('program.activeWorkoutCollision')}
          </p>
        )}
        {actionError && (
          <p role="alert" className="text-sm text-[var(--danger-ink)]">
            {t('program.actionError')}
          </p>
        )}
        {(position.phase === 'active' || detail.program.status === 'completed') && (
          <ProgramSessionList
            sessions={sessions}
            selectedEntryId={effectiveSelected?.entryId ?? null}
            startDisabled={activeWorkoutExists || detail.program.status !== 'active'}
            onSelect={setSelectedEntryId}
            onRepair={() => void navigate(`/programs/${detail.program.id}/edit`)}
          />
        )}
        <UpcomingWeeks weeks={upcomingWeeks} />
      </div>

      {detail.program.status !== 'completed' && (
        <ProgramActionsSheet
          open={actionsOpen}
          hasStarted={position.phase !== 'before'}
          canComplete={detail.program.status === 'active'}
          onClose={() => setActionsOpen(false)}
          onEditFuture={() => void navigate(`/programs/${detail.program.id}/edit`)}
          onShift={(days) => runAction(() => shiftProgram(detail.program.id, days))}
          onComplete={() => runAction(() => completeProgram(detail.program.id))}
        />
      )}
    </Screen>
  );
}
