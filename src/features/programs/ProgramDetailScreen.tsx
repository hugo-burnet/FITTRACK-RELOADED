import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import {
  ProgramRepositoryError,
  activateProgram,
  completeProgram,
  deleteProgram,
  replaceActiveProgram,
  shiftProgram,
} from '@/data/repositories/programs';
import { startWorkoutFromProgram } from '@/data/repositories/programWorkout';
import type { Program } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { pickProgramSession } from '@/lib/programs';
import { ActionBand, ConfirmSheet, HeaderAction } from '@/ui';
import { MoreIcon } from '@/ui/icons';
import { ProgramActionsSheet } from './ProgramActionsSheet';
import { ProgramBenchmarkCard } from '@/features/benchmark/ProgramBenchmarkCard';
import { MissingRoutineReplacementSheet } from './MissingRoutineReplacementSheet';
import { ProgramIntention } from './ProgramIntention';
import { ProgramPastWeeks } from './ProgramPastWeeks';
import { ProgramProgressTiles } from './ProgramProgressTiles';
import { repositoryErrorKey } from './programEditorModel';
import { ProgramSessionList, UpcomingWeeks } from './ProgramSessionList';
import type { ProgramSessionReading } from './ProgramSessionList';
import { readProjection } from './readProgramDetail';

const STATUS_KEYS: Record<Program['status'], TranslationKey> = {
  draft: 'program.statusDraft',
  active: 'program.statusActive',
  completed: 'program.statusCompleted',
};

const startFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

export function ProgramDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useAppNavigate();
  const [actionsOpen, setActionsOpen] = useState(false);
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

  const {
    detail,
    position,
    week,
    sessions,
    activeWorkoutExists,
    draftReady,
    displayWeekIndex,
    cycle,
    nextWeek,
    adherence,
    weeklyTonnage,
    hasWorkouts,
    pastWeeks,
  } = query.value;
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

  const openWorkout = (workoutId: string) => void navigate(`/history/${workoutId}`);

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
          label={t('program.detailActionsLabel')}
          onClick={() => {
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
        <p className="text-sm text-[var(--text-2)]">
          {t('program.detailStatusLine', {
            status: t(STATUS_KEYS[detail.program.status]),
            count: detail.program.durationWeeks,
            date: startFormatter.format(detail.program.startsAt),
          })}
        </p>
        <ProgramProgressTiles
          program={detail.program}
          position={position}
          week={week}
          nextWeek={nextWeek}
          adherence={adherence}
          weeklyTonnage={weeklyTonnage}
          displayWeekIndex={displayWeekIndex}
          hasWorkouts={hasWorkouts}
        />
        {week !== null && <ProgramIntention week={week} nextWeek={nextWeek} />}
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
        {/* Une semaine de repos complet d'un cycle n'a aucune séance : sans
            la liste, la fiche n'en dirait rien — or c'est justement ce qu'on
            vient y lire. */}
        {(sessions.length > 0 || cycle !== null) && (
          <ProgramSessionList
            sessions={sessions}
            cycleReading={
              cycle === null
                ? null
                : t('program.cycleReading', { position: cycle.position + 1, length: cycle.length })
            }
            selectedEntryId={effectiveSelected?.entryId ?? null}
            startDisabled={activeWorkoutExists || detail.program.status !== 'active'}
            todayDayOfWeek={position.phase === 'active' ? position.dayOfWeek : null}
            onOpenWorkout={openWorkout}
            onSelect={(entryId) => {
              setSelectedEntryId(entryId);
            }}
            onRepair={setReplacementTarget}
          />
        )}
        {/* Avant de démarrer, c'est ici qu'on règle les charges de départ : celles du bloc viennent de ses routines.
            Un bloc terminé n'a plus de départ à régler. */}
        {detail.program.status !== 'completed' && (
          <ProgramBenchmarkCard sessions={sessions} busy={activeWorkoutExists} />
        )}
        <ProgramPastWeeks weeks={pastWeeks} onOpenWorkout={openWorkout} />
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
