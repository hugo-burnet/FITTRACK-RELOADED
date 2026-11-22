import { useState } from 'react';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { workoutExerciseIdentityOf } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { exerciseDisplayName } from '@/i18n/labels';
import type { TriggeredEvent } from '@/lib/rpeDiscipline';
import { Button, ConfirmSheet, Sheet } from '@/ui';
import { formatNumber } from '@/ui/numberField';

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

/** Où se trouve la série qui a déclenché : son exercice, son rang affiché. */
function locate(
  exercises: readonly WorkoutExerciseDetail[],
  setId: string,
): { exercise: string; number: number } | null {
  for (const line of exercises) {
    const index = line.sets.findIndex((set) => set.id === setId);
    if (index === -1) continue;
    const identity = workoutExerciseIdentityOf(line);
    const name =
      identity.name === undefined
        ? t('workout.deletedExercise')
        : exerciseDisplayName(identity.name, identity.isUnilateral);
    return { exercise: name, number: index + 1 };
  }
  return null;
}

/**
 * Le panneau du protocole disciplinaire RPE, en tête de séance tant que la séance est suspendue.
 *
 * **Il dit ce qui s'est passé et ce qui reste permis**, parce qu'une grille grisée sans explication
 * ressemble à une panne. Les deux sorties sont des gestes distincts, chacun derrière sa propre
 * feuille : corriger une *erreur de saisie* n'est pas *déroger* à la règle, et les mélanger
 * ferait de la correction la porte de service du déverrouillage. Les deux restent inscrits dans la
 * séance (`Workout.rpeDiscipline`).
 *
 * « Terminer la séance » n'est pas ici : il reste en bas de l'écran et dans le menu, à sa place.
 */
export function RpeDisciplinePanel({
  trigger,
  exercises,
  onCorrect,
  onOverride,
}: {
  trigger: TriggeredEvent;
  exercises: readonly WorkoutExerciseDetail[];
  onCorrect: (rpe: number | undefined) => Promise<void>;
  onOverride: () => Promise<void>;
}) {
  const [sheet, setSheet] = useState<'correct' | 'override' | null>(null);
  const [failure, setFailure] = useState<'correct' | 'override' | null>(null);
  const where = locate(exercises, trigger.setId);
  const rpe = formatNumber(trigger.rpe);
  const ceiling = formatNumber(trigger.ceiling);

  const run = (kind: 'correct' | 'override', action: () => Promise<void>) => {
    setFailure(null);
    void action().catch(() => setFailure(kind));
  };

  return (
    <section
      role="alert"
      aria-labelledby="rpe-discipline-title"
      data-part="rpe-discipline"
      className="rounded-2xl border-2 border-[var(--danger-ink)] bg-[var(--surface-1)] p-4"
    >
      <h2
        id="rpe-discipline-title"
        className="text-lg leading-snug font-bold text-[var(--danger-ink)] [overflow-wrap:anywhere]"
      >
        {t('rpeDiscipline.lockedTitle')}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-[var(--text-1)] [overflow-wrap:anywhere]">
        {where === null
          ? t('rpeDiscipline.lockedBodyUnknownSet', { rpe, ceiling })
          : t('rpeDiscipline.lockedBody', { rpe, ceiling, ...where })}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
        {t('rpeDiscipline.lockedRule')}
      </p>
      {failure !== null && (
        <p className="mt-2 text-sm text-[var(--danger-ink)]">
          {t(
            failure === 'correct' ? 'rpeDiscipline.correctFailed' : 'rpeDiscipline.overrideFailed',
          )}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="secondary" fullWidth onClick={() => setSheet('correct')}>
          {t('rpeDiscipline.correct')}
        </Button>
        <Button variant="danger" fullWidth onClick={() => setSheet('override')}>
          {t('rpeDiscipline.override')}
        </Button>
      </div>

      <Sheet
        open={sheet === 'correct'}
        onClose={() => setSheet(null)}
        title={t('rpeDiscipline.correctTitle')}
      >
        <p className="mb-4 text-base leading-relaxed text-[var(--text-2)]">
          {t('rpeDiscipline.correctBody', { rpe })}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {RPE_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === trigger.rpe}
              aria-label={t('rpeDiscipline.correctOption', { value: formatNumber(value) })}
              onClick={() => {
                setSheet(null);
                if (value !== trigger.rpe) run('correct', () => onCorrect(value));
              }}
              className={`metric min-h-12 rounded-xl border text-sm transition-colors
                duration-[var(--dur-1)] ${
                  value === trigger.rpe
                    ? 'border-[var(--danger-ink)] font-bold text-[var(--danger-ink)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-1)]'
                }`}
            >
              {formatNumber(value)}
            </button>
          ))}
          <button
            type="button"
            aria-label={t('rpeDiscipline.correctClear')}
            onClick={() => {
              setSheet(null);
              run('correct', () => onCorrect(undefined));
            }}
            className="metric min-h-12 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]
              text-sm text-[var(--text-1)]"
          >
            —
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={sheet === 'override'}
        onClose={() => setSheet(null)}
        title={t('rpeDiscipline.overrideTitle')}
        body={t('rpeDiscipline.overrideBody')}
        confirmLabel={t('rpeDiscipline.overrideConfirm')}
        danger
        onConfirm={() => run('override', onOverride)}
      />
    </section>
  );
}
