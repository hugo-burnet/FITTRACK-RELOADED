import type { ProgramWeek } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Button, SectionTitle } from '@/ui';
import { weekLine } from './weekReading';

export type ProgramSessionState = 'completed' | 'today' | 'missed' | 'upcoming';

export interface ProgramSessionReading {
  entryId: string;
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

export function UpcomingWeeks({ weeks }: { weeks: ProgramWeek[] }) {
  if (weeks.length === 0) return null;
  return (
    <section>
      <SectionTitle>{t('program.upcomingTitle')}</SectionTitle>
      <div className="border-y border-[var(--border)]">
        {weeks.map((week) => (
          <div
            key={week.id}
            className="flex min-h-14 items-center border-b border-[var(--border)] py-3
              last:border-b-0"
          >
            <span
              className={`text-base ${
                week.phase === 'deload'
                  ? 'font-semibold text-[var(--accent-ink)]'
                  : 'text-[var(--text-1)]'
              }`}
            >
              {weekLine(week)}
            </span>
          </div>
        ))}
      </div>
    </section>
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
        {sessions.map((session) => {
          if (session.routineName === null) {
            return (
              <div
                key={session.entryId}
                className="flex min-h-16 items-center gap-3 border-b border-[var(--border)] py-3 last:border-b-0"
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
          const selected = selectedEntryId === session.entryId;
          return (
            <button
              key={session.entryId}
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
        })}
      </div>
    </section>
  );
}
