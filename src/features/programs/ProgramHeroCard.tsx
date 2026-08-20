import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeProgramProjection } from '@/data/repositories/home';
import { startWorkoutFromProgram } from '@/data/repositories/programWorkout';
import { t } from '@/i18n/fr';
import { Button, Card } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import { MissingRoutineReplacementSheet } from './MissingRoutineReplacementSheet';
import { phaseLabel } from './weekReading';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

/**
 * La phase seule : le sur-titre au-dessus dit déjà « Semaine 2 sur 8 », et la
 * lecture complète y répétait « Semaine 2 » à deux lignes d'intervalle.
 */
function intentionLabel(program: HomeProgramProjection): string | null {
  if (program.week === null) return null;
  return phaseLabel(program.week.phase);
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
  /**
   * Which name the card leads with. Home answers « what do I do now », so it
   * leads with the session. The Programmes list answers « which block », so it
   * leads with the block — the routine still names the button either way.
   */
  leadWith?: 'session' | 'block';
}

/** Displays the repository's exact pick; ranking stays out of the component. */
export function ProgramHeroCard({ program, disabled, leadWith = 'session' }: Props) {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const startingRef = useRef(false);
  const intention = intentionLabel(program);
  const pick = program.pick;

  const releaseStart = () => {
    startingRef.current = false;
    setStarting(false);
  };

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
      releaseStart();
    }
  };

  return (
    // Pas de titre de section : le sur-titre « Semaine 2 sur 8 » dit déjà
    // qu'on est dans un bloc, et l'accueil a besoin de ses 32 px pour garder
    // le bouton « Lancer » au-dessus de la ligne de flottaison.
    <section>
      <Card padded>
        <div className="space-y-4">
          {/*
            L'en-tête ouvre la fiche du bloc. C'est la seule porte vers ses
            options — modifier, décaler, supprimer — et un bloc qui n'a pas
            encore commencé n'affiche aucun autre bouton : ni « Démarrer »
            (aucune séance avant la date de départ), ni « Réparer le split ».
            Il était alors parfaitement inatteignable, la liste le retirant de
            ses lignes puisqu'il est déjà en tête. Le titre reste celui que
            l'écran a demandé ; c'est le bloc qu'on ouvre dans les deux cas,
            d'où le nom du bloc dans l'étiquette.
          */}
          <button
            type="button"
            aria-label={t('program.openBlock', { name: program.programName })}
            onClick={() => void navigate(`/programs/${program.programId}`)}
            // Aucune marge, aucun retrait : l'en-tête garde exactement l'assise
            // qu'il avait quand c'était un `<div>`. L'appui se dit en opacité,
            // comme les autres surfaces qui ne peuvent pas se peindre un fond.
            className="flex w-full items-center gap-3 text-left transition-opacity
              duration-[var(--dur-1)] active:opacity-70"
          >
            <span className="min-w-0 flex-1">
              <span className="label-xs block font-semibold text-[var(--text-2)]">
                {t('home.programWeek', {
                  current: (program.week?.weekIndex ?? 0) + 1,
                  total: program.durationWeeks,
                })}
              </span>
              <span className="mt-1 block truncate text-lg font-semibold text-[var(--text-1)]">
                {leadWith === 'session' && pick.kind === 'session'
                  ? (pick.routineName ?? t('program.missingRoutine'))
                  : program.programName}
              </span>
              {intention !== null && (
                <span
                  className={`mt-1 block text-sm font-semibold ${
                    program.week?.phase === 'deload'
                      ? 'text-[var(--accent-ink)]'
                      : 'text-[var(--text-2)]'
                  }`}
                >
                  {intention}
                </span>
              )}
            </span>
            <span className="shrink-0 text-[var(--text-2)]">
              <ChevronRightIcon />
            </span>
          </button>

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

          {pick.kind === 'session' &&
            pick.routineName === null &&
            pick.repairUnavailableReason !== 'locked' &&
            !disabled && (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => setReplacementOpen(true)}
              >
                {t('program.repairSplit')}
              </Button>
            )}

          {pick.kind === 'session' &&
            pick.routineName === null &&
            (pick.repairUnavailableReason === 'locked' || disabled) && (
              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {t('program.missingRoutineLocked')}
              </p>
            )}

          <p className="text-sm leading-relaxed text-[var(--text-2)]">{ruleLabel(program)}</p>
          {failed && (
            <p role="alert" className="text-sm text-[var(--danger-ink)]">
              {t('home.programStartError')}
            </p>
          )}
        </div>
      </Card>

      {replacementOpen && pick.kind === 'session' && pick.routineName === null && (
        <MissingRoutineReplacementSheet
          open
          programId={program.programId}
          entryId={pick.programScheduleEntryId}
          effectiveFromWeekIndex={program.week?.weekIndex ?? 0}
          onClose={() => setReplacementOpen(false)}
        />
      )}
    </section>
  );
}
