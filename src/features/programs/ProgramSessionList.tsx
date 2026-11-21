import type { ProgramWeek } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Button, Card, SectionTitle } from '@/ui';
import { DayColumn, RowText, RowTrailing } from './programRows';
import {
  PRESSABLE_ROW_CLASS,
  SELECT_PART_CLASS,
  WEEK_ROW_CLASS,
  dayDateReading,
} from './programRowStyle';
import { ChevronRightIcon } from '@/ui/icons';
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
  /** Le jour où elle est prévue — ou, une fois faite, celui où elle l'a été. */
  date: number;
  /** Présent quand la séance est faite : sa fiche d'historique est `/history/:workoutId`. */
  workoutId?: string;
  repairUnavailableReason?: 'locked' | 'completed' | null;
}

interface Props {
  sessions: ProgramSessionReading[];
  /** « Semaine 2 du cycle de 2 semaines » — absent quand le split se répète chaque semaine. */
  cycleReading?: string | null;
  selectedEntryId: string | null;
  startDisabled: boolean;
  /** Le jour d'aujourd'hui (ISO 1-7) quand la semaine affichée est la semaine en cours ; sinon `null`. */
  todayDayOfWeek?: number | null;
  onSelect: (entryId: string) => void;
  onRepair: (session: ProgramSessionReading) => void;
  /** Ouvre la séance faite : le lien manquant entre un programme et son historique. */
  onOpenWorkout: (workoutId: string) => void;
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
 * Ce qui reste du programme, par changements et non par semaines.
 *
 * Une ligne par semaine donnait huit lignes identiques sur un trajet plat —
 * huit fois la même phrase pour apprendre qu'il ne se passe rien. Les suites
 * identiques sont repliées : ce qui reste à l'écran, ce sont les endroits où le
 * programme change d'avis.
 */
export function UpcomingWeeks({ weeks }: { weeks: ProgramWeek[] }) {
  if (weeks.length === 0) return null;
  return (
    <section>
      <SectionTitle>{t('program.upcomingTitle')}</SectionTitle>
      <Card>
        {groupWeekRuns(weeks).map((run) => (
          <div key={run.weekIndex} className={WEEK_ROW_CLASS}>
            <span
              className={`min-w-0 flex-1 text-base ${
                run.phase === 'deload'
                  ? 'font-semibold text-[var(--accent-ink)]'
                  : 'text-[var(--text-1)]'
              }`}
            >
              {weekRunLine(run)}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

/** Lundi → dimanche : l'ordre dans lequel une semaine se lit, repos compris. */
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Un jour sans séance. Le repos est un fait de la semaine, pas un objet à
 * ouvrir : une ligne sans geste, en texte secondaire.
 */
function RestRow({ dayOfWeek, today }: { dayOfWeek: number; today: boolean }) {
  return (
    <div className={WEEK_ROW_CLASS}>
      <DayColumn dayOfWeek={dayOfWeek} today={today} />
      <RowText title={t('program.restDay')} muted />
      {today && <RowTrailing>{t('program.sessionToday')}</RowTrailing>}
    </div>
  );
}

/**
 * La semaine entière, du lundi au dimanche.
 *
 * Ne lister que les jours travaillés donnait une semaine en creux : on voyait
 * deux séances sans voir qu'elles étaient collées, ni combien de jours les
 * séparaient. Les jours de repos sont la moitié de l'information d'un programme.
 *
 * Une séance faite mène à sa fiche ; les autres se choisissent, c'est celle
 * qu'on lance depuis le bas de l'écran.
 */
function SessionRow({
  session,
  selected,
  startDisabled,
  today,
  onSelect,
  onRepair,
  onOpenWorkout,
}: {
  session: ProgramSessionReading;
  selected: boolean;
  startDisabled: boolean;
  today: boolean;
  onSelect: (entryId: string) => void;
  onRepair: (session: ProgramSessionReading) => void;
  onOpenWorkout: (workoutId: string) => void;
}) {
  if (session.routineName === null) {
    const day = t(DAY_KEYS[session.dayOfWeek - 1]!).toLocaleLowerCase('fr-FR');
    const blockedHint =
      session.repairUnavailableReason === 'completed'
        ? t('program.missingRoutineCompleted')
        : session.repairUnavailableReason === 'locked'
          ? t('program.missingRoutineLocked')
          : null;
    return (
      <div className={WEEK_ROW_CLASS}>
        <DayColumn dayOfWeek={session.dayOfWeek} today={today} />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[var(--text-1)]">
            {t('program.missingRoutine')}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-[var(--warn-ink)]">
            {t('program.missingRoutineHint', { day })}
          </span>
          {blockedHint !== null && (
            <span className="mt-1 block text-sm leading-snug text-[var(--text-2)]">
              {blockedHint}
            </span>
          )}
        </span>
        {session.repairUnavailableReason == null && (
          <Button variant="ghost" onClick={() => onRepair(session)}>
            {t('program.repairSplit')}
          </Button>
        )}
      </div>
    );
  }

  const stateLabel = t(STATE_KEYS[session.state]);
  const date = dayDateReading(session.date);

  const select = (
    <button
      type="button"
      aria-label={`${session.routineName}, ${stateLabel}`}
      aria-pressed={selected}
      disabled={startDisabled}
      onClick={() => onSelect(session.entryId)}
      className={session.workoutId === undefined ? PRESSABLE_ROW_CLASS : SELECT_PART_CLASS}
    >
      <DayColumn dayOfWeek={session.dayOfWeek} today={today || selected} />
      <RowText title={session.routineName} subtitle={date} selected={selected} />
      <RowTrailing>{stateLabel}</RowTrailing>
    </button>
  );
  if (session.workoutId === undefined) return select;

  // Une séance faite se choisit encore (pour la refaire) **et** s'ouvre : deux
  // cibles côte à côte, la ligne pour le choix, la flèche pour la fiche. Une
  // ligne qui ne ferait que s'ouvrir supprimerait le geste « refaire celle-ci ».
  const { workoutId } = session;
  return (
    <div className="flex items-stretch border-b border-[var(--border)] last:border-b-0">
      {select}
      <button
        type="button"
        aria-label={t('program.detailOpenSession', { name: session.routineName, date })}
        onClick={() => onOpenWorkout(workoutId)}
        className="flex min-h-14 w-12 shrink-0 items-center justify-center bg-[var(--surface-1)]
          text-[var(--text-2)] transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

export function ProgramSessionList({
  sessions,
  cycleReading = null,
  selectedEntryId,
  startDisabled,
  todayDayOfWeek = null,
  onSelect,
  onRepair,
  onOpenWorkout,
}: Props) {
  return (
    <section>
      <SectionTitle>{t('program.sessionsTitle')}</SectionTitle>
      {cycleReading !== null && (
        <p className="-mt-1 mb-3 px-1 text-sm text-[var(--text-2)]">{cycleReading}</p>
      )}
      <Card>
        {WEEK_DAYS.map((dayOfWeek) => {
          const daySessions = sessions.filter((session) => session.dayOfWeek === dayOfWeek);
          const today = todayDayOfWeek === dayOfWeek;
          if (daySessions.length === 0) {
            return <RestRow key={dayOfWeek} dayOfWeek={dayOfWeek} today={today} />;
          }

          // Un jour peut porter deux séances : elles se suivent, chacune sa
          // ligne, et le jour est écrit sur chacune.
          return daySessions.map((session) => (
            <SessionRow
              key={session.entryId}
              session={session}
              selected={selectedEntryId === session.entryId}
              startDisabled={startDisabled}
              today={today}
              onSelect={onSelect}
              onRepair={onRepair}
              onOpenWorkout={onOpenWorkout}
            />
          ));
        })}
      </Card>
    </section>
  );
}
