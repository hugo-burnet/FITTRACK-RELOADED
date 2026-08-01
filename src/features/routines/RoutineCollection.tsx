import type { ReactElement } from 'react';
import type { RoutineSummary } from '@/data/repositories/routines';
import type { Routine, RoutineFolder } from '@/data/types';
import { t } from '@/i18n/fr';
import { moveItem } from '@/lib/routineOrder';
import { Button, EmptyState, ReorderableList } from '@/ui';
import type { ItemState } from '@/ui';
import { GripIcon, MoreIcon } from '@/ui/icons';
import { routineSummaryLine } from './summary';

export type RoutinePlacement = Readonly<{
  id: Routine['id'];
  folderId: Routine['folderId'];
}>;

export type RoutineCollectionIntent =
  | { kind: 'createBlank' }
  | { kind: 'showTemplates' }
  | { kind: 'openRoutine'; routine: Routine }
  | { kind: 'openRoutineActions'; routine: Routine }
  | { kind: 'openFolderActions'; folder: RoutineFolder }
  | { kind: 'reorderRoutines'; placement: readonly RoutinePlacement[] };

export type RoutineCollectionProps = Readonly<{
  summaries: readonly RoutineSummary[];
  folders: readonly RoutineFolder[];
  onIntent: (intent: RoutineCollectionIntent) => void;
}>;

type Entry =
  | { kind: 'heading'; id: string; folder?: RoutineFolder }
  | { kind: 'routine'; id: string; summary: RoutineSummary };

function projectEntries(
  summaries: readonly RoutineSummary[],
  folders: readonly RoutineFolder[],
): Entry[] {
  const entries: Entry[] = [];
  const inFolder = (id: string) => summaries.filter((row) => row.routine.folderId === id);

  if (folders.length > 0) entries.push({ kind: 'heading', id: 'root' });
  for (const summary of inFolder('')) {
    entries.push({ kind: 'routine', id: summary.routine.id, summary });
  }

  for (const folder of folders) {
    entries.push({ kind: 'heading', id: folder.id, folder });
    for (const summary of inFolder(folder.id)) {
      entries.push({ kind: 'routine', id: summary.routine.id, summary });
    }
  }

  return entries;
}

function projectPlacement(entries: readonly Entry[]): RoutinePlacement[] {
  const placement: RoutinePlacement[] = [];
  let folderId = '';

  for (const entry of entries) {
    if (entry.kind === 'heading') folderId = entry.folder?.id ?? '';
    else placement.push({ id: entry.id, folderId });
  }

  return placement;
}

function RoutineRow({
  summary,
  state,
  onIntent,
}: {
  summary: RoutineSummary;
  state: ItemState;
  onIntent: (intent: RoutineCollectionIntent) => void;
}) {
  const { routine, exerciseCount, setCount } = summary;
  const subtitle = routine.subtitle?.trim();

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-2xl transition-colors
        duration-[var(--dur-1)]
        ${
          state.dragging
            ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent-ink)]'
            : 'bg-[var(--surface-1)]'
        }`}
    >
      <button
        type="button"
        aria-label={t('routines.dragHandle', { name: routine.name })}
        className="flex w-11 shrink-0 cursor-grab items-center justify-center text-[var(--text-2)]
          active:cursor-grabbing"
        {...state.handleProps}
      >
        <GripIcon />
      </button>

      <button
        type="button"
        onClick={() => onIntent({ kind: 'openRoutine', routine })}
        className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-1 py-3 text-left
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <span className="truncate text-base text-[var(--text-1)]">{routine.name}</span>
        {subtitle !== undefined && subtitle !== '' && (
          <span className="truncate text-sm text-[var(--text-2)]">{subtitle}</span>
        )}
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {routineSummaryLine(exerciseCount, setCount)}
        </span>
      </button>

      <button
        type="button"
        aria-label={`${t('routines.actionsTitle')} — ${routine.name}`}
        onClick={() => onIntent({ kind: 'openRoutineActions', routine })}
        className="flex w-12 shrink-0 items-center justify-center text-[var(--text-2)]
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <MoreIcon />
      </button>
    </div>
  );
}

export function RoutineCollection({
  summaries,
  folders,
  onIntent,
}: RoutineCollectionProps): ReactElement {
  if (summaries.length === 0 && folders.length === 0) {
    return (
      <EmptyState
        reading="0"
        unit={t('routines.countUnit')}
        body={t('routines.emptyBody')}
        action={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => onIntent({ kind: 'createBlank' })}
            >
              {t('routines.newBlank')}
            </Button>
            <Button fullWidth onClick={() => onIntent({ kind: 'showTemplates' })}>
              {t('routines.newFromTemplate')}
            </Button>
          </div>
        }
      />
    );
  }

  const entries = projectEntries(summaries, folders);

  return (
    <ReorderableList
      className="flex flex-col gap-3"
      items={entries}
      keyOf={(entry) => entry.id}
      onReorder={(from, to) =>
        onIntent({
          kind: 'reorderRoutines',
          placement: projectPlacement(moveItem(entries, from, to)),
        })
      }
      renderItem={(entry, _index, state) =>
        entry.kind === 'routine' ? (
          <RoutineRow summary={entry.summary} state={state} onIntent={onIntent} />
        ) : (
          <div className="flex items-center gap-2 px-1 pt-2">
            <h2 className="label-xs min-w-0 flex-1 truncate font-semibold text-[var(--text-2)]">
              {entry.folder?.name ?? t('routines.rootFolder')}
            </h2>
            {entry.folder !== undefined && (
              <button
                type="button"
                aria-label={`${t('routines.folderTitle')} — ${entry.folder.name}`}
                onClick={() =>
                  entry.folder && onIntent({ kind: 'openFolderActions', folder: entry.folder })
                }
                className="-my-2 -mr-2 flex size-12 items-center justify-center
                  text-[var(--text-2)]"
              >
                <MoreIcon width="18" height="18" />
              </button>
            )}
          </div>
        )
      }
    />
  );
}
