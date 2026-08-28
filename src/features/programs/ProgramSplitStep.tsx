import { useState } from 'react';
import type { RoutineSummary } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { Button, Card, Input, Sheet } from '@/ui';

export interface ProgramSplitDraftEntry {
  routineId: string;
  dayOfWeek: number;
  order: number;
}

interface Props {
  entries: ProgramSplitDraftEntry[];
  routines: RoutineSummary[] | undefined;
  onChange: (entries: ProgramSplitDraftEntry[]) => void;
  /** Crée une routine vide et rend son identifiant, pour la sélectionner aussitôt. */
  onCreateRoutine?: (name: string) => Promise<string>;
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

export function ProgramSplitStep({ entries, routines, onChange, onCreateRoutine }: Props) {
  const tutorial = useTutorialControls();
  const [creatingFor, setCreatingFor] = useState<number | null>(null);
  const [newName, setNewName] = useState('');

  const updateEntry = (index: number, changes: Partial<ProgramSplitDraftEntry>) => {
    onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...changes } : entry)));
  };

  const openCreate = (index: number) => {
    setNewName('');
    setCreatingFor(index);
  };

  const submitCreate = async () => {
    const index = creatingFor;
    const name = newName.trim();
    if (index === null || name === '' || onCreateRoutine === undefined) return;
    setCreatingFor(null);
    const routineId = await onCreateRoutine(name);
    updateEntry(index, { routineId });
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-[var(--text-2)]">{t('program.splitIntro')}</p>
      <Card>
        <div className="divide-y divide-[var(--border)]">
          {entries.map((entry, index) => {
            const number = index + 1;
            // Un jour déjà pris par une autre séance se signale, il ne se
            // bloque pas : deux séances le même jour est un choix légitime.
            const takenElsewhere = new Set(
              entries.filter((_, other) => other !== index).map((other) => other.dayOfWeek),
            );
            return (
              <section key={index} className="flex flex-col gap-4 p-4">
                <div className="flex min-h-12 items-center justify-between gap-3">
                  <h2 className="label-xs font-semibold text-[var(--text-2)]">
                    {t('program.session', { number })}
                  </h2>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      aria-label={t('program.removeSession', { number })}
                      onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
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
                            updateEntry(index, { dayOfWeek: day });
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
                                : takenElsewhere.has(day)
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
                      updateEntry(index, { routineId: event.target.value });
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
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => openCreate(index)}
                  >
                    {t('program.newRoutine')}
                  </Button>
                )}
              </section>
            );
          })}
          <div className="p-2" data-tutorial-id="program-split-add">
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() =>
                onChange([...entries, { routineId: '', dayOfWeek: 1, order: 0 }])
              }
            >
              {t('program.addSession')}
            </Button>
          </div>
        </div>
      </Card>

      <Sheet
        open={creatingFor !== null}
        onClose={() => setCreatingFor(null)}
        title={t('program.newRoutine')}
      >
        <div className="flex flex-col gap-5 pb-2">
          <Input
            label={t('program.newRoutineLabel')}
            placeholder={t('program.newRoutinePlaceholder')}
            value={newName}
            enterKeyHint="done"
            onChange={(event) => setNewName(event.target.value)}
          />
          <p className="text-sm leading-relaxed text-[var(--text-2)]">
            {t('program.newRoutineHint')}
          </p>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={newName.trim() === ''}
            onClick={() => void submitCreate()}
          >
            {t('program.newRoutineCreate')}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
