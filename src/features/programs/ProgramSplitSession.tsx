import type { RoutineSummary } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { Button } from '@/ui';
import type { ProgramSplitDraftEntry } from './ProgramSplitStep';

interface Props {
  /** Place dans la liste entière, à partir de 0 : c'est elle que les libellés et le tutoriel citent. */
  index: number;
  entry: ProgramSplitDraftEntry;
  routines: RoutineSummary[] | undefined;
  /** Les jours déjà pris par une autre séance de la même semaine du cycle. */
  takenDays: ReadonlySet<number>;
  removable: boolean;
  onChange: (changes: Partial<ProgramSplitDraftEntry>) => void;
  onRemove: () => void;
  onCreateRoutine?: () => void;
}

const selectClass = `min-h-12 w-full rounded-lg bg-[var(--surface-2)] px-3 text-base
  text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]`;

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

const dayLabel = (day: number) =>
  t(`program.weekday${day}` as
    | 'program.weekday1'
    | 'program.weekday2'
    | 'program.weekday3'
    | 'program.weekday4'
    | 'program.weekday5'
    | 'program.weekday6'
    | 'program.weekday7');

/**
 * Trois lettres, sur quatre colonnes.
 *
 * Sept pastilles sur une ligne mesuraient 32 px de large sur un téléphone de
 * 375 px — mesuré dans le navigateur — là où la charte en exige 48 pour une
 * main en sueur. Quatre colonnes donnent 74 px, et de la place pour trois
 * lettres au lieu d'initiales dont trois jours se partagent la première.
 */
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

/** Une séance du split : son jour, sa routine, et de quoi la retirer ou créer la routine qui lui manque. */
export function ProgramSplitSession({
  index,
  entry,
  routines,
  takenDays,
  removable,
  onChange,
  onRemove,
  onCreateRoutine,
}: Props) {
  const tutorial = useTutorialControls();
  const number = index + 1;

  return (
    <section className="flex flex-col gap-4 p-4">
      <div className="flex min-h-12 items-center justify-between gap-3">
        <h2 className="label-xs font-semibold text-[var(--text-2)]">
          {t('program.session', { number })}
        </h2>
        {removable && (
          <button
            type="button"
            aria-label={t('program.removeSession', { number })}
            onClick={onRemove}
            className="min-h-12 rounded-xl px-3 text-sm font-semibold text-[var(--danger-ink)]
              active:bg-[var(--surface-2)]"
          >
            {t('program.removeSession', { number })}
          </button>
        )}
      </div>

      {/*
        Sept pastilles plutôt qu'un menu déroulant : la semaine est une
        forme, et c'est cette forme qu'on est en train de poser. Un
        menu la cachait derrière un mot à la fois — on choisissait
        « Jeudi » sans jamais voir que jeudi tombait la veille de la
        séance suivante. Même traitement plein/creux que les niveaux
        et les recettes de l'étape des semaines.
      */}
      <div className="flex flex-col gap-2">
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {t('program.sessionDayLabel', { number })}
        </span>
        <div
          role="group"
          aria-label={t('program.sessionDayLabel', { number })}
          /* Seule la première séance porte l'ancre : une consigne qui
             dit « choisis le jour » doit désigner une rangée, pas
             toutes celles de la liste. */
          data-tutorial-id={index === 0 ? 'program-split-day' : undefined}
          className="grid grid-cols-4 gap-2"
        >
          {DAYS.map((day, dayIndex) => {
            const active = entry.dayOfWeek === day;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                aria-label={dayLabel(day)}
                onClick={() => {
                  onChange({ dayOfWeek: day });
                  tutorial?.report({
                    type: 'program-split-day-set',
                    index,
                    dayOfWeek: day,
                  });
                }}
                className={`min-h-12 rounded-xl text-sm font-semibold
                  transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                  ${
                    active
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : takenDays.has(day)
                        ? 'bg-[var(--surface-2)] text-[var(--accent-ink)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-1)]'
                  }`}
              >
                {DAY_SHORT[dayIndex]}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {t('program.sessionRoutineLabel', { number })}
        </span>
        <select
          aria-label={t('program.sessionRoutineLabel', { number })}
          data-tutorial-id={index === 0 ? 'program-split-routine' : undefined}
          value={entry.routineId}
          disabled={routines === undefined}
          onChange={(event) => {
            onChange({ routineId: event.target.value });
            tutorial?.report({
              type: 'program-split-routine-set',
              index,
              routineId: event.target.value,
            });
          }}
          className={selectClass}
        >
          <option value="">
            {routines === undefined ? t('program.routinesLoading') : t('program.chooseRoutine')}
          </option>
          {(routines ?? []).map(({ routine }) => (
            <option key={routine.id} value={routine.id}>{routine.name}</option>
          ))}
        </select>
      </label>

      {/*
        La sortie de secours de l'étape : composer un bloc supposait
        une bibliothèque déjà faite, et sans routine cet écran était
        une impasse — sortir, composer, revenir. Le bloc pose la forme
        de la semaine, la routine se remplit après.
      */}
      {onCreateRoutine !== undefined && (
        <Button type="button" variant="ghost" fullWidth onClick={onCreateRoutine}>
          {t('program.newRoutine')}
        </Button>
      )}
    </section>
  );
}
