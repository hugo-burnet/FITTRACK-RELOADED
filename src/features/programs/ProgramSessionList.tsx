import type { ProgramWeek } from '@/data/types';
import type {
  ProgramWorkoutPreflight,
  ProgramWorkoutPreflightWarning,
} from '@/data/repositories/programWorkout';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Button, SectionTitle, Sheet } from '@/ui';

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

const WARNING_KEYS: Record<ProgramWorkoutPreflightWarning['code'], TranslationKey> = {
  missing_one_rep_max: 'program.warningMissingOneRepMax',
  unsupported_measurement: 'program.warningUnsupportedMeasurement',
  assistance_not_supported: 'program.warningAssistanceNotSupported',
};

export function ProgramWorkoutWarningSheet({
  preflight,
  working,
  onClose,
  onConfirm,
}: {
  preflight: ProgramWorkoutPreflight | null;
  working: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet
      open={preflight !== null}
      onClose={onClose}
      title={t('program.warningTitle')}
    >
      <div className="flex flex-col gap-5 pb-2">
        <p className="text-base leading-relaxed text-[var(--text-2)]">
          {t('program.warningIntro')}
        </p>
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {(preflight?.warnings ?? []).map((warning) => (
            <li
              key={`${warning.exerciseId}:${warning.code}`}
              className="py-3 text-sm leading-relaxed text-[var(--text-1)]"
            >
              {t(WARNING_KEYS[warning.code], { name: warning.exerciseName })}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose} disabled={working}>
            {t('exercise.cancel')}
          </Button>
          <Button variant="primary" size="lg" fullWidth onClick={onConfirm} disabled={working}>
            {t('program.warningConfirm')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function programPrescriptionReading(week: ProgramWeek): string {
  return t('program.percentReading', { value: week.loadIndex });
}

export function UpcomingWeeks({ weeks }: { weeks: ProgramWeek[] }) {
  if (weeks.length === 0) return null;
  return (
    <section>
      <SectionTitle>{t('program.upcomingTitle')}</SectionTitle>
      <div className="border-y border-[var(--border)]">
        {weeks.map((week) => (
          <div
            key={week.id}
            className="flex min-h-14 items-center justify-between gap-4 border-b
              border-[var(--border)] py-3 last:border-b-0"
          >
            <span className="text-base text-[var(--text-1)]">
              {week.phase === 'deload'
                ? t('program.upcomingDeload', { number: week.weekIndex + 1 })
                : t('program.week', { number: week.weekIndex + 1 })}
            </span>
            <span className="text-sm text-[var(--text-2)]">
              {programPrescriptionReading(week)}
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
