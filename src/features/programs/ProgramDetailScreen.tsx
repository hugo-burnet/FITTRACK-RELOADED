import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import {
  ProgramRepositoryError,
  activateProgram,
  completeProgram,
  deleteProgram,
  getProgramDetail,
  replaceActiveProgram,
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
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { ActionBand, ConfirmSheet, HeaderAction } from '@/ui';
import { MoreIcon } from '@/ui/icons';
import { ProgramActionsSheet } from './ProgramActionsSheet';
import { MissingRoutineReplacementSheet } from './MissingRoutineReplacementSheet';
import { repositoryErrorKey } from './programEditorModel';
import { ProgramSessionList, UpcomingWeeks } from './ProgramSessionList';
import type { ProgramSessionReading } from './ProgramSessionList';
import { phaseEvidenceFor } from './phaseEvidence';
import { loadRuleReading, weekLine } from './weekReading';

interface DetailProjection {
  detail: ProgramDetail;
  position: ProgramPosition;
  week: ProgramWeek | null;
  sessions: ProgramSessionReading[];
  activeWorkoutExists: boolean;
  /** A draft is only activable once it has a split to run and a week for each. */
  draftReady: boolean;
  displayWeekIndex: number;
}

type DetailQuery =
  { status: 'ready'; value: DetailProjection } | { status: 'not_found' } | { status: 'error' };

const STATUS_KEYS: Record<Program['status'], TranslationKey> = {
  draft: 'program.statusDraft',
  active: 'program.statusActive',
  completed: 'program.statusCompleted',
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function ProgramProgressReading({
  program,
  position,
}: {
  program: Program;
  position: ProgramPosition;
}) {
  return (
    <section className="px-1 pt-1">
      <p className="label-xs font-semibold text-[var(--text-2)]">
        {t(STATUS_KEYS[program.status])}
      </p>
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
  const intention = loadRuleReading(week);
  const evidence = phaseEvidenceFor(week.phase);
  return (
    <section data-tutorial-id="program-intention" className="border-y border-[var(--border)] py-4">
      <p className="label-xs font-semibold text-[var(--text-2)]">{t('program.intentionTitle')}</p>
      <p
        className={`mt-2 text-xl font-semibold ${
          week.phase === 'deload' ? 'text-[var(--accent-ink)]' : 'text-[var(--text-1)]'
        }`}
      >
        {weekLine(week)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{intention}</p>
      {week.notes && <p className="mt-2 text-sm text-[var(--text-2)]">{week.notes}</p>}
      {/* Ce que la littérature dit de la phase traversée. L'app savait planifier
          une décharge, le corpus savait ce qu'on en sait — sans qu'aucun des
          deux ne mentionne l'autre. Le lien n'apparaît que si une section traite
          vraiment la phase : en proposer une vaguement voisine apprendrait au
          lecteur que le lien ment. */}
      {evidence !== null && (
        <Link
          viewTransition
          to={`/knowledge/p/${evidence.sectionId}`}
          className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--surface-1)] px-4 py-2"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--accent-ink)]">
              {t('program.evidenceLink')}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--text-2)]">
              {t(
                evidence.count === 1 ? 'program.evidenceCountOne' : 'program.evidenceCountMany',
                { count: evidence.count, section: evidence.title },
              )}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-[var(--accent-ink)]">
            →
          </span>
        </Link>
      )}
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
    const hasWorkoutInDisplayedWeek = [
      ...completedWorkouts,
      ...(activeWorkout ? [activeWorkout] : []),
    ].some(
      (workout) =>
        workout.programId === detail.program.id && workout.programWeekIndex === weekIndex,
    );
    const repairUnavailableReason =
      detail.program.status === 'completed' || position.phase === 'after'
        ? ('completed' as const)
        : detail.program.status === 'active' && hasWorkoutInDisplayedWeek
          ? ('locked' as const)
          : null;
    const sessions: ProgramSessionReading[] = entries.map((entry, index) => ({
      entryId: entry.id,
      routineId: entry.routineId,
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
      repairUnavailableReason,
    }));

    // Le brouillon se juge sur la semaine 1 : c'est celle par laquelle le bloc
    // démarrera, quelle que soit la date du jour.
    const initialSchedule = resolveSchedule(
      detail.revisions.map(({ revision }) => revision),
      detail.revisions.flatMap(({ entries: revisionEntries }) => revisionEntries),
      0,
    );

    return {
      status: 'ready',
      value: {
        detail,
        position,
        week: detail.weeks.find((candidate) => candidate.weekIndex === weekIndex) ?? null,
        sessions,
        activeWorkoutExists: activeWorkout !== undefined,
        draftReady:
          initialSchedule.length > 0 && detail.weeks.length === detail.program.durationWeeks,
        displayWeekIndex: weekIndex,
      },
    };
  } catch {
    return { status: 'error' };
  }
}

export function ProgramDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useAppNavigate();
  const [actionsOpen, setActionsOpen] = useState(false);
  const tutorial = useTutorialControls();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<TranslationKey | null>(null);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [replacementTarget, setReplacementTarget] = useState<ProgramSessionReading | null>(null);
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

  const { detail, position, week, sessions, activeWorkoutExists, draftReady, displayWeekIndex } =
    query.value;
  const isDraft = detail.program.status === 'draft';
  const candidates = sessions
    .filter((session) => session.routineName !== null)
    .map((session) => ({
      entryId: session.entryId,
      routineId: session.routineId,
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
  // Après celle que « Intention de la semaine » affiche déjà, quelle que soit
  // la phase. Avant le départ, la liste répétait la semaine 01 deux fois : une
  // fois en grand au-dessus, une fois en tête de la liste.
  const currentWeekIndex = week?.weekIndex ?? -1;
  const upcomingWeeks = detail.weeks.filter((candidate) => candidate.weekIndex > currentWeekIndex);

  const runAction = async (action: () => Promise<void>) => {
    setActionErrorKey(null);
    try {
      await action();
    } catch {
      setActionErrorKey('program.actionError');
    }
  };

  // Activer depuis la fiche : c'est ici qu'on voit le split et les semaines
  // qu'on lance. Un autre bloc actif n'est pas une erreur, c'est une question —
  // la même que celle posée à la fin de la création.
  const activate = async () => {
    setActionErrorKey(null);
    try {
      await activateProgram(detail.program.id);
    } catch (error) {
      if (error instanceof ProgramRepositoryError && error.code === 'another_program_active') {
        setReplacementOpen(true);
      } else {
        setActionErrorKey(repositoryErrorKey(error));
      }
    }
  };

  // `ConfirmSheet` referme la feuille lui-même : ici on n'écrit que le résultat.
  const confirmReplacement = async () => {
    setActionErrorKey(null);
    try {
      await replaceActiveProgram(detail.program.id);
    } catch (error) {
      setActionErrorKey(repositoryErrorKey(error));
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
    setActionErrorKey(null);
    try {
      await startWorkoutFromProgram({
        programId: detail.program.id,
        programScheduleEntryId: effectiveSelected.entryId,
      });
      void navigate('/workout');
    } catch {
      setActionErrorKey('program.actionError');
      releaseStart();
    }
  };

  return (
    <Screen
      title={detail.program.name}
      onBack={goBack}
      action={
        // Même un bloc terminé garde son menu : il reste à supprimer.
        <HeaderAction
          label={t('program.actionsLabel')}
          tutorialId="program-actions"
          onClick={() => {
            tutorial?.report({ type: 'program-actions-opened', programId: detail.program.id });
            setActionsOpen(true);
          }}
        >
          <MoreIcon />
        </HeaderAction>
      }
      footer={
        canStart ? (
          <ActionBand
            label={t('program.startSession', { name: effectiveSelected.routineName! })}
            tutorialId="program-start"
            disabled={starting}
            onClick={() => void beginStart()}
          />
        ) : isDraft ? (
          <ActionBand
            label={draftReady ? t('program.activate') : t('program.continueCreation')}
            onClick={() =>
              draftReady ? void activate() : void navigate(`/programs/${detail.program.id}/edit`)
            }
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
        {actionErrorKey !== null && (
          <p role="alert" className="text-sm text-[var(--danger-ink)]">
            {t(actionErrorKey)}
          </p>
        )}
        {/*
          La semaine se lit dès que le bloc en a une, même avant sa date de
          départ : c'est là qu'on vérifie qu'on a bien posé lundi et jeudi, et
          c'est le seul moment où l'on peut encore corriger sans rien perdre.
          La condition d'avant — bloc commencé ou terminé — laissait un bloc à
          venir sans aucun split à l'écran.
        */}
        {sessions.length > 0 && (
          <ProgramSessionList
            sessions={sessions}
            selectedEntryId={effectiveSelected?.entryId ?? null}
            startDisabled={activeWorkoutExists || detail.program.status !== 'active'}
            onSelect={(entryId) => {
              setSelectedEntryId(entryId);
              tutorial?.report({
                type: 'program-session-selected',
                programId: detail.program.id,
                entryId,
              });
            }}
            onRepair={setReplacementTarget}
          />
        )}
        <UpcomingWeeks weeks={upcomingWeeks} />
      </div>

      <ProgramActionsSheet
        open={actionsOpen}
        hasStarted={position.phase !== 'before'}
        canComplete={detail.program.status === 'active'}
        canEdit={detail.program.status !== 'completed'}
        onClose={() => setActionsOpen(false)}
        onEditFuture={() => void navigate(`/programs/${detail.program.id}/edit`)}
        onShift={(days) => runAction(() => shiftProgram(detail.program.id, days))}
        onComplete={() => runAction(() => completeProgram(detail.program.id))}
        onDelete={() =>
          runAction(async () => {
            await deleteProgram(detail.program.id);
            void navigate('/programs');
          })
        }
      />

      <ConfirmSheet
        open={replacementOpen}
        onClose={() => setReplacementOpen(false)}
        title={t('program.replaceActiveTitle')}
        body={t('program.replaceActiveBody')}
        confirmLabel={t('program.replaceActiveConfirm')}
        onConfirm={() => void confirmReplacement()}
      />

      {replacementTarget !== null && (
        <MissingRoutineReplacementSheet
          open
          programId={detail.program.id}
          entryId={replacementTarget.entryId}
          effectiveFromWeekIndex={displayWeekIndex}
          onClose={() => setReplacementTarget(null)}
        />
      )}
    </Screen>
  );
}
