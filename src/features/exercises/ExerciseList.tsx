import { normalizeSearch } from '@/data/repositories/exercises';
import type { Exercise } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle } from '@/i18n/labels';
import { Card, ListRow } from '@/ui';
import { CheckIcon } from '@/ui/icons';

type Props = {
  exercises: Exercise[];
  /**
   * Letter headings exist to break a wall of 168 rows into readable runs. A
   * filtered list of six is not a wall, so searching turns them off — the
   * heading marks a real property of the list, it does not decorate it.
   */
  grouped: boolean;
  onOpen: (exercise: Exercise) => void;
  /** Present = the list is a picker: rows toggle rather than open. */
  selectedIds?: ReadonlySet<string>;
};

type Group = { initial: string; exercises: Exercise[] };

/**
 * Grouped on the *normalised* name, so "Élévations" files under E rather than
 * opening a group of its own between Z and nothing.
 */
function groupByInitial(exercises: Exercise[]): Group[] {
  const groups: Group[] = [];

  for (const exercise of exercises) {
    const initial = normalizeSearch(exercise.name).charAt(0).toUpperCase();
    const current = groups.at(-1);
    if (current !== undefined && current.initial === initial) current.exercises.push(exercise);
    else groups.push({ initial, exercises: [exercise] });
  }

  return groups;
}

/**
 * The selection column. A leading box rather than a trailing tick: what you scan
 * when picking six exercises out of a list is the column of what you already
 * have, and a column reads down one edge, not down the ragged end of the names.
 */
function SelectionBox({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex size-6 items-center justify-center rounded-md border-2
        transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
        ${
          selected
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
            : 'border-[var(--border)]'
        }`}
    >
      {selected && <CheckIcon width="16" height="16" />}
    </span>
  );
}

function Row({
  exercise,
  onOpen,
  selectedIds,
}: {
  exercise: Exercise;
  onOpen: (exercise: Exercise) => void;
  selectedIds?: ReadonlySet<string>;
}) {
  const selectable = selectedIds !== undefined;
  const selected = selectedIds?.has(exercise.id) ?? false;

  return (
    <ListRow
      title={exercise.name}
      subtitle={exerciseSubtitle(exercise)}
      onClick={() => onOpen(exercise)}
      checked={selectable ? selected : undefined}
      leading={selectable ? <SelectionBox selected={selected} /> : undefined}
      trailing={
        // The accent marks exactly two things in this lot: what you own, and
        // what is engaged. This is the first.
        exercise.isCustom === 1 ? (
          <span className="label-xs font-semibold text-[var(--accent-ink)]">
            {t('exercises.custom')}
          </span>
        ) : undefined
      }
    />
  );
}

export function ExerciseList({ exercises, grouped, onOpen, selectedIds }: Props) {
  if (!grouped) {
    return (
      // `Card` has overflow-hidden, which makes its automatic minimum flex
      // height zero. Without this wrapper the filtered list is squeezed to 0px
      // instead of making Screen's scroll area overflow.
      <div className="shrink-0">
        <Card>
          {exercises.map((exercise) => (
            <Row key={exercise.id} exercise={exercise} onOpen={onOpen} selectedIds={selectedIds} />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByInitial(exercises).map((group) => (
        <section key={group.initial}>
          {/* Sticky: deep inside the D's — where a third of the catalogue lives —
              the letter is the only thing telling you where you are. */}
          <h2
            className="label-xs sticky top-0 z-10 -mx-4 bg-[var(--surface-0)] px-5 py-2
              font-semibold text-[var(--text-2)]"
          >
            {group.initial}
          </h2>
          <Card>
            {group.exercises.map((exercise) => (
              <Row
                key={exercise.id}
                exercise={exercise}
                onOpen={onOpen}
                selectedIds={selectedIds}
              />
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
