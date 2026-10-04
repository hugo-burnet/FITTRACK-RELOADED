import { useState } from 'react';
import type { RoutineSummary } from '@/data/repositories/routines';
import type { RoutineFolder } from '@/data/types';
import { MAX_CYCLE_WEEKS } from '@/lib/programs';
import { t } from '@/i18n/fr';
import { Button, Card, ChoiceChip, Input, OptionSheet, Sheet } from '@/ui';
import {
  addFolderSessions,
  addSplitSession,
  resizeCycle,
  splitFolderChoices,
  type SplitFolderChoice,
} from './programSplitModel';
import { ProgramSplitSession } from './ProgramSplitSession';

export interface ProgramSplitDraftEntry {
  routineId: string;
  dayOfWeek: number;
  order: number;
  /** Semaine du cycle, à partir de 0. */
  cycleWeek: number;
}

/** Le split tel que l'éditeur le tient : un cycle de `cycleWeeks` semaines et ses séances. */
export interface ProgramSplitDraft {
  cycleWeeks: number;
  /** Triées par semaine du cycle : le numéro d'une séance suit sa place à l'écran. */
  entries: ProgramSplitDraftEntry[];
}

interface Props {
  split: ProgramSplitDraft;
  routines: RoutineSummary[] | undefined;
  /** Les dossiers de la bibliothèque : ce qui permet d'ajouter les routines de l'un d'eux d'un coup. */
  folders?: readonly RoutineFolder[] | undefined;
  onChange: (split: ProgramSplitDraft) => void;
  /** Crée une routine vide et rend son identifiant, pour la sélectionner aussitôt. */
  onCreateRoutine?: (name: string) => Promise<string>;
  /** Semaine du bloc (à partir de 1) où le split sera écrit, quand ce n'est pas la première. */
  restartsAtWeek?: number;
}

const CYCLE_LENGTHS = Array.from({ length: MAX_CYCLE_WEEKS }, (_, index) => index + 1);

const choiceValue = (choice: SplitFolderChoice): string =>
  choice.folderId === '' ? 'root' : `folder:${choice.folderId}`;

/**
 * Le rythme du bloc : un cycle de une à quatre semaines, rejoué en boucle.
 *
 * Une semaine répétée ne dit pas « haut / bas une semaine, push / pull / jambes
 * la suivante ». Avec un cycle d'une semaine l'écran est celui d'avant : une
 * seule liste de séances, sans titre de semaine. Au-delà, chaque semaine du
 * cycle a sa liste — c'est la forme qu'on est en train de poser, comme les
 * sept jours d'une séance.
 */
export function ProgramSplitStep({
  split,
  routines,
  folders,
  onChange,
  onCreateRoutine,
  restartsAtWeek,
}: Props) {
  const [creatingFor, setCreatingFor] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  // La semaine du cycle à laquelle la feuille « dossier » est en train d'ajouter.
  const [folderFor, setFolderFor] = useState<number | null>(null);
  const { cycleWeeks, entries } = split;
  const folderChoices = splitFolderChoices(folders ?? [], routines ?? []);

  const updateEntry = (index: number, changes: Partial<ProgramSplitDraftEntry>) => {
    onChange({
      ...split,
      entries: entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...changes } : entry,
      ),
    });
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

  const renderWeek = (week: number) => {
    const rows = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.cycleWeek === week);

    return (
      <Card>
        <div className="divide-y divide-[var(--border)]">
          {rows.length === 0 && (
            <p className="p-4 text-sm leading-relaxed text-[var(--text-2)]">
              {t('program.cycleWeekEmpty')}
            </p>
          )}
          {rows.map(({ entry, index }) => (
            <ProgramSplitSession
              key={index}
              index={index}
              entry={entry}
              routines={routines}
              // Un jour déjà pris par une autre séance se signale, il ne se
              // bloque pas : deux séances le même jour est un choix légitime.
              takenDays={
                new Set(
                  rows
                    .filter((other) => other.index !== index)
                    .map((other) => other.entry.dayOfWeek),
                )
              }
              removable={entries.length > 1}
              onChange={(changes) => updateEntry(index, changes)}
              onRemove={() =>
                onChange({
                  ...split,
                  entries: entries.filter((_, entryIndex) => entryIndex !== index),
                })
              }
              onCreateRoutine={onCreateRoutine === undefined ? undefined : () => openCreate(index)}
            />
          ))}
          {/* Seule la première semaine porte l'ancre du tutoriel. */}
          <div className="p-2" data-tutorial-id={week === 0 ? 'program-split-add' : undefined}>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => onChange(addSplitSession(split, week))}
            >
              {cycleWeeks === 1
                ? t('program.addSession')
                : t('program.addSessionToWeek', { number: week + 1 })}
            </Button>
          </div>
          {folderChoices.length > 0 && (
            <div className="p-2">
              <Button
                type="button"
                variant="ghost"
                fullWidth
                aria-label={
                  cycleWeeks === 1
                    ? t('program.addFolder')
                    : t('program.addFolderToWeek', { number: week + 1 })
                }
                onClick={() => setFolderFor(week)}
              >
                {t('program.addFolder')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {t('program.cycleLabel')}
        </span>
        <div
          role="group"
          aria-label={t('program.cycleLabel')}
          data-tutorial-id="program-split-cycle"
          className="grid grid-cols-2 gap-2"
        >
          {CYCLE_LENGTHS.map((length) => (
            <ChoiceChip
              key={length}
              fill
              label={
                length === 1 ? t('program.cycleOne') : t('program.cycleMany', { count: length })
              }
              active={cycleWeeks === length}
              onClick={() => onChange(resizeCycle(split, length))}
            />
          ))}
        </div>
      </div>

      <p className="text-base leading-relaxed text-[var(--text-2)]">
        {cycleWeeks === 1
          ? t('program.splitIntro')
          : t('program.cycleHintMany', { count: cycleWeeks })}
      </p>
      {cycleWeeks > 1 && restartsAtWeek !== undefined && restartsAtWeek > 1 && (
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('program.cycleRestartHint', { number: restartsAtWeek })}
        </p>
      )}

      {cycleWeeks === 1
        ? renderWeek(0)
        : Array.from({ length: cycleWeeks }, (_, week) => (
            <section key={week} className="flex flex-col gap-2">
              <h2 className="label-xs px-1 font-semibold text-[var(--text-2)]">
                {t('program.cycleWeekTitle', { number: week + 1 })}
              </h2>
              {renderWeek(week)}
            </section>
          ))}

      <OptionSheet
        open={folderFor !== null}
        onClose={() => setFolderFor(null)}
        title={t('program.addFolderTitle')}
        options={folderChoices.map((choice) => ({
          value: choiceValue(choice),
          label: choice.name ?? t('routines.rootFolder'),
          hint: t(
            choice.routineIds.length === 1
              ? 'program.folderRoutineCountOne'
              : 'program.folderRoutineCount',
            { count: choice.routineIds.length },
          ),
        }))}
        // Rien n'est présélectionné : on ne « choisit » pas un dossier, on en prend un.
        value=""
        onSelect={(value) => {
          const choice = folderChoices.find((candidate) => choiceValue(candidate) === value);
          if (folderFor === null || choice === undefined) return;
          onChange(addFolderSessions(split, folderFor, choice.routineIds));
        }}
      />

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
