import type { ProgramWeek } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Button, SectionTitle } from '@/ui';
import { weekRunLine } from './weekReading';
import { groupWeekRuns } from './weekRuns';

export type ProgramSessionState = 'completed' | 'today' | 'missed' | 'upcoming';

export interface ProgramSessionReading {
  entryId: string;
  routineId: string;
  routineName: string | null;
  dayOfWeek: number;
  order: number;
  state: ProgramSessionState;
}

interface Props {
  sessions: ProgramSessionReading[];
  selectedEntryId: string | null;
  startDisabled: boolean;
  onSelect: (entryId: string) => void;
  onRepair: () => void;
}

const STATE_KEYS: Record<ProgramSessionState, TranslationKey> = {
  completed: 'program.sessionCompleted',
  today: 'program.sessionToday',
  missed: 'program.sessionMissed',
  upcoming: 'program.sessionUpcoming',
};

const DAY_KEYS: TranslationKey[] = [
  'program.weekday1',
  'program.weekday2',
  'program.weekday3',
  'program.weekday4',
  'program.weekday5',
  'program.weekday6',
  'program.weekday7',
];

/**
 * Ce qui reste du bloc, par changements et non par semaines.
 *
 * Une ligne par semaine donnait huit lignes identiques sur un trajet plat —
 * huit fois la même phrase pour apprendre qu'il ne se passe rien. Les suites
 * identiques sont repliées : ce qui reste à l'écran, ce sont les endroits où le
 * bloc change d'avis.
 */
export function UpcomingWeeks({ weeks }: { weeks: ProgramWeek[] }) {
  if (weeks.length === 0) return null;
  return (
    <section>
      <SectionTitle>{t('program.upcomingTitle')}</SectionTitle>
      <div className="border-y border-[var(--border)]">
        {groupWeekRuns(weeks).map((run) => (
          <div
            key={run.weekIndex}
            className="flex min-h-14 items-center border-b border-[var(--border)] py-3
              last:border-b-0"
          >
            <span
              className={`text-base ${
                run.phase === 'deload'
                  ? 'font-semibold text-[var(--accent-ink)]'
                  : 'text-[var(--text-1)]'
              }`}
            >
              {weekRunLine(run)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Lundi → dimanche : l'ordre dans lequel une semaine se lit, repos compris. */
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Un jour sans séance. Même gabarit qu'une séance — barre de sélection
 * transparente comprise, pour que les deux colonnes restent alignées — mais en
 * texte secondaire : le repos est un fait de la semaine, pas un objet à ouvrir.
 */
function RestRow({ dayOfWeek }: { dayOfWeek: number }) {
  return (
    <div
      className="flex min-h-16 items-center gap-3 border-b border-[var(--border)] py-3
        last:border-b-0"
    >
      <span aria-hidden="true" className="h-8 w-0.5 shrink-0 rounded-full bg-transparent" />
      <span className="min-w-0 flex-1">
        <span className="block text-base text-[var(--text-2)]">{t('program.restDay')}</span>
        <span className="mt-0.5 block text-sm text-[var(--text-2)]">
          {t(DAY_KEYS[dayOfWeek - 1]!)}
        </span>
      </span>
    </div>
  );
}

/**
 * La semaine entière, du lundi au dimanche.
 *
 * Ne lister que les jours travaillés donnait une semaine en creux : on voyait
 * deux séances sans voir qu'elles étaient collées, ni combien de jours les
 * séparaient. Les jours de repos sont la moitié de l'information d'un bloc.
 */
function SessionRow({
  session,
  selected,
  startDisabled,
  onSelect,
  onRepair,
}: {
  session: ProgramSessionReading;
  selected: boolean;
  startDisabled: boolean;
  onSelect: (entryId: string) => void;
  onRepair: () => void;
}) {
  if (session.routineName === null) {
    return (
      <div
        className="flex min-h-16 items-center gap-3 border-b border-[var(--border)] py-3
          last:border-b-0"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[var(--text-1)]">
            {t('program.missingRoutine')}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-[var(--danger-ink)]">
            {t('program.missingRoutineHint')}
          </span>
        </span>
        <Button variant="ghost" onClick={onRepair}>
          {t('program.repairSplit')}
        </Button>
      </div>
    );
  }

  const stateLabel = t(STATE_KEYS[session.state]);
  return (
    <button
      type="button"
      aria-label={`${session.routineName}, ${stateLabel}`}
      aria-pressed={selected}
      disabled={startDisabled}
      onClick={() => onSelect(session.entryId)}
      className={`flex min-h-16 w-full items-center gap-3 border-b border-[var(--border)]
        py-3 text-left last:border-b-0 disabled:opacity-40
        ${selected ? 'text-[var(--accent-ink)]' : 'text-[var(--text-1)]'}`}
    >
      <span
        aria-hidden="true"
        className={`h-8 w-0.5 shrink-0 rounded-full ${
          selected ? 'bg-[var(--color-accent)]' : 'bg-transparent'
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{session.routineName}</span>
        <span className="mt-0.5 block text-sm text-[var(--text-2)]">
          {t(DAY_KEYS[session.dayOfWeek - 1]!)}
        </span>
      </span>
      <span
        className={`text-sm font-semibold ${
          session.state === 'completed' ? 'text-[var(--text-2)]' : ''
        }`}
      >
        {stateLabel}
      </span>
    </button>
  );
}

export function ProgramSessionList({
  sessions,
  selectedEntryId,
  startDisabled,
  onSelect,
  onRepair,
}: Props) {
  return (
    <section>
      <SectionTitle>{t('program.sessionsTitle')}</SectionTitle>
      <div className="border-y border-[var(--border)]">
        {WEEK_DAYS.map((dayOfWeek) => {
          const daySessions = sessions.filter((session) => session.dayOfWeek === dayOfWeek);
          if (daySessions.length === 0) return <RestRow key={dayOfWeek} dayOfWeek={dayOfWeek} />;

          // Un jour peut porter deux séances : elles se suivent, chacune sa
          // ligne, et le jour n'est écrit qu'une fois par ligne comme avant.
          return daySessions.map((session) => (
            <SessionRow
              key={session.entryId}
              session={session}
              selected={selectedEntryId === session.entryId}
              startDisabled={startDisabled}
              onSelect={onSelect}
              onRepair={onRepair}
            />
          ));
        })}
      </div>
    </section>
  );
}
