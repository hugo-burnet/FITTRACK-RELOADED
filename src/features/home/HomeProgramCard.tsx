import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeProgramProjection } from '@/data/repositories/home';
import {
  ProgramWorkoutWarningAcknowledgementError,
  preflightProgramWorkout,
  startWorkoutFromProgram,
  type ProgramWorkoutPreflight,
  type ProgramWorkoutWarningAcknowledgement,
} from '@/data/repositories/programWorkout';
import { t } from '@/i18n/fr';
import { Button, Card } from '@/ui';
import { ProgramWorkoutWarningSheet } from '@/features/programs/ProgramSessionList';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

function prescriptionLabel(program: HomeProgramProjection): string | null {
  if (program.week === null) return null;
  return t('program.percentReading', { value: program.week.loadIndex });
}

function ruleLabel(program: HomeProgramProjection): string {
  const { pick } = program;
  if (pick.kind === 'announcement') {
    return pick.rule === 'starts'
      ? t('home.programStarts', { date: dateFormatter.format(pick.startsAt) })
      : t('home.programNextWeek', {
          week: pick.weekIndex + 1,
          date: dateFormatter.format(pick.startsAt),
        });
  }
  if (pick.kind === 'none') return t('home.programWeekComplete');

  const date = dateFormatter.format(pick.scheduledAt);
  if (pick.rule === 'today') return t('home.programTodayRule');
  if (pick.rule === 'missed') return t('home.programMissedRule', { date });
  return t('home.programUpcomingRule', { date });
}

interface Props {
  program: HomeProgramProjection;
  disabled: boolean;
}

/** Displays the repository's exact pick; ranking stays out of the component. */
export function HomeProgramCard({ program, disabled }: Props) {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [warningPreflight, setWarningPreflight] = useState<ProgramWorkoutPreflight | null>(null);
  const startingRef = useRef(false);
  const prescription = prescriptionLabel(program);
  const pick = program.pick;

  const releaseStart = () => {
    startingRef.current = false;
    setStarting(false);
  };

  const persistStart = async (
    warningAcknowledgement?: ProgramWorkoutWarningAcknowledgement,
  ) => {
    try {
      await startWorkoutFromProgram({
        programId: program.programId,
        programScheduleEntryId: pick.kind === 'session' ? pick.programScheduleEntryId : '',
        ...(warningAcknowledgement === undefined ? {} : { warningAcknowledgement }),
      });
      void navigate('/workout');
    } catch (error) {
      if (error instanceof ProgramWorkoutWarningAcknowledgementError) {
        setWarningPreflight(error.preflight);
      } else {
        setFailed(true);
      }
      releaseStart();
    }
  };

  const start = async () => {
    if (pick.kind !== 'session' || pick.routineName === null || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setFailed(false);
    try {
      const preflight = await preflightProgramWorkout({
        programId: program.programId,
        programScheduleEntryId: pick.programScheduleEntryId,
      });
      if (preflight.warningAcknowledgement !== null) {
        setWarningPreflight(preflight);
        releaseStart();
        return;
      }
      await persistStart();
    } catch {
      setFailed(true);
      releaseStart();
    }
  };

  const confirmWarnings = () => {
    const acknowledgement = warningPreflight?.warningAcknowledgement;
    if (acknowledgement === null || acknowledgement === undefined || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setFailed(false);
    setWarningPreflight(null);
    void persistStart(acknowledgement);
  };

  return (
    <>
      {/* Pas de titre de section : le sur-titre « Semaine 2 sur 8 » dit déjà
          qu'on est dans un bloc, et l'accueil a besoin de ses 32 px pour garder
          le bouton « Lancer » au-dessus de la ligne de flottaison. */}
      <section>
        <Card padded>
        <div className="space-y-4">
          <div>
            <p className="label-xs font-semibold text-[var(--text-2)]">
              {t('home.programWeek', {
                current: (program.week?.weekIndex ?? 0) + 1,
                total: program.durationWeeks,
              })}
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-[var(--text-1)]">
              {pick.kind === 'session'
                ? (pick.routineName ?? t('program.missingRoutine'))
                : program.programName}
            </h3>
            {prescription !== null && (
              <p className="mt-1 text-sm font-semibold text-[var(--text-2)]">
                {prescription}
                {program.week?.phase === 'deload' ? ` · ${t('program.prescriptionDeload')}` : ''}
              </p>
            )}
          </div>

          {pick.kind === 'session' && pick.routineName !== null && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={disabled || starting}
              aria-label={t('home.startRoutine', { name: pick.routineName })}
              onClick={() => void start()}
            >
              {t('routine.start')}
            </Button>
          )}

          {pick.kind === 'session' && pick.routineName === null && (
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => void navigate(`/programs/${program.programId}/edit`)}
            >
              {t('program.repairSplit')}
            </Button>
          )}

          <p className="text-sm leading-relaxed text-[var(--text-2)]">{ruleLabel(program)}</p>
          {failed && (
            <p role="alert" className="text-sm text-[var(--danger-ink)]">
              {t('home.programStartError')}
            </p>
          )}
        </div>
        </Card>
      </section>
      <ProgramWorkoutWarningSheet
        preflight={warningPreflight}
        working={starting}
        onClose={() => setWarningPreflight(null)}
        onConfirm={confirmWarnings}
      />
    </>
  );
}
