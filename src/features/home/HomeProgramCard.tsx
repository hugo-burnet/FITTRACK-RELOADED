import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeProgramProjection } from '@/data/repositories/home';
import { startWorkoutFromProgram } from '@/data/repositories/programWorkout';
import { t } from '@/i18n/fr';
import { Button, Card, SectionTitle } from '@/ui';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

function prescriptionLabel(program: HomeProgramProjection): string | null {
  if (program.week === null) return null;
  return program.week.prescriptionKind === 'percent_1rm'
    ? t('program.percentReading', { value: program.week.prescriptionValue })
    : t('program.rpeReading', { value: program.week.prescriptionValue });
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
  const startingRef = useRef(false);
  const prescription = prescriptionLabel(program);
  const pick = program.pick;

  const start = async () => {
    if (pick.kind !== 'session' || pick.routineName === null || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setFailed(false);
    try {
      await startWorkoutFromProgram({
        programId: program.programId,
        programScheduleEntryId: pick.programScheduleEntryId,
      });
      void navigate('/workout');
    } catch {
      setFailed(true);
      startingRef.current = false;
      setStarting(false);
    }
  };

  return (
    <section>
      <SectionTitle>{t('home.programSection')}</SectionTitle>
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
                {program.week?.isDeload === 1 ? ` · ${t('program.prescriptionDeload')}` : ''}
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
  );
}
