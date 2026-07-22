import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  countRoutinesInFolder,
  createFolder,
  createRoutine,
  deleteFolder,
  deleteRoutine,
  duplicateRoutine,
  listFolders,
  listRoutineSummaries,
  renameFolder,
  reorderRoutines,
  updateRoutine,
} from '@/data/repositories/routines';
import type { RoutineSummary } from '@/data/repositories/routines';
import { getActiveWorkout, startWorkoutFromRoutine } from '@/data/repositories/workouts';
import { ROUTINE_TEMPLATES, instantiateTemplate } from '@/data/seed/routineTemplates';
import type { Routine, RoutineFolder } from '@/data/types';
import { t } from '@/i18n/fr';
import { moveItem } from '@/lib/routineOrder';
import {
  ActionSheet,
  Button,
  ConfirmSheet,
  EmptyState,
  HeaderAction,
  OptionSheet,
  ReorderableList,
} from '@/ui';
import type { ItemState, Option } from '@/ui';
import { GripIcon, MoreIcon, PlusIcon } from '@/ui/icons';
import { FolderFormSheet } from './FolderFormSheet';
import { routineSummaryLine } from './summary';

/** One sheet at a time: two stacked modals fight over the body scroll lock. */
type SheetState =
  | { kind: 'create' }
  | { kind: 'templates' }
  | { kind: 'folderForm'; folder?: RoutineFolder }
  | { kind: 'folderActions'; folder: RoutineFolder }
  | { kind: 'folderDelete'; folder: RoutineFolder; count: number }
  | { kind: 'routineActions'; routine: Routine }
  | { kind: 'routineMove'; routine: Routine }
  | { kind: 'routineDelete'; routine: Routine };

/**
 * The list is flat, and a heading is a position in it rather than a container.
 *
 * That is what makes filing a routine a drag: the folder a routine belongs to is
 * simply the heading above it, so dropping it anywhere both reorders it and
 * re-files it. There is no separate "drop into folder" target to aim at with a
 * thumb, and no cross-container bookkeeping.
 */
type Entry =
  | { kind: 'heading'; id: string; folder?: RoutineFolder }
  | { kind: 'routine'; id: string; summary: RoutineSummary };

function toEntries(summaries: RoutineSummary[], folders: RoutineFolder[]): Entry[] {
  const entries: Entry[] = [];
  const inFolder = (id: string) => summaries.filter((row) => row.routine.folderId === id);

  // The root heading appears only once folders exist — but then it must always
  // be there, or a routine dragged into a folder could never come back out.
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

/** Reads each routine's folder back out of where it now sits. */
function toPlacement(entries: Entry[]): { id: string; folderId: string }[] {
  const placement: { id: string; folderId: string }[] = [];
  let folderId = '';

  for (const entry of entries) {
    if (entry.kind === 'heading') folderId = entry.folder?.id ?? '';
    else placement.push({ id: entry.id, folderId });
  }

  return placement;
}

/**
 * A routine: a handle, the routine itself, and its menu.
 *
 * Its own card rather than a hairline inside a shared one — a row has to be able
 * to lift away from its neighbours to be dragged, which is the same reason the
 * editor gives each exercise a card.
 */
function RoutineRow({
  summary,
  state,
  onOpen,
  onMenu,
}: {
  summary: RoutineSummary;
  state: ItemState;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const { routine, exerciseCount, setCount } = summary;
  const subtitle = routine.subtitle?.trim();

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-2xl transition-colors
        duration-[var(--dur-1)]
        ${
          state.dragging
            ? 'bg-[var(--surface-2)] ring-2 ring-[var(--accent-ink)]'
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
        onClick={onOpen}
        className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-1 py-3 text-left
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <span className="truncate text-base text-[var(--text-1)]">{routine.name}</span>
        {/* The quiet line: everything the title should not have to carry. */}
        {subtitle !== undefined && subtitle !== '' && (
          <span className="truncate text-sm text-[var(--text-2)]">{subtitle}</span>
        )}
        {/* Engraved, not prose: a count annotates, it does not narrate — and it
            keeps the two grey lines from reading as one grey block. */}
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {routineSummaryLine(exerciseCount, setCount)}
        </span>
      </button>

      <button
        type="button"
        aria-label={`${t('routines.actionsTitle')} — ${routine.name}`}
        onClick={onMenu}
        className="flex w-12 shrink-0 items-center justify-center text-[var(--text-2)]
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <MoreIcon />
      </button>
    </div>
  );
}

export function RoutinesScreen() {
  const navigate = useNavigate();
  const summaries = useLiveQuery(listRoutineSummaries);
  const folders = useLiveQuery(listFolders);
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const openEditor = (routine: Routine) => void navigate(`/routines/${routine.id}`);

  const startBlank = () => {
    void createRoutine(t('routines.defaultName')).then(openEditor);
  };

  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);

  /**
   * Proposé seulement quand rien ne tourne. Avant, « Démarrer » sur la routine
   * B pendant une séance de la routine A t'emmenait dans la séance A : le
   * bouton mentait sur ce qu'il venait de faire. Désactivé avec sa raison, ce
   * qu'un menu sait dire (`hint`) et qu'un bouton qui redirige ne dit pas.
   */
  const start = (routineId: string) => {
    void startWorkoutFromRoutine(routineId).then(() => navigate('/workout'));
  };

  const folderOptions: Option<string>[] = [
    { value: '', label: t('routines.noFolder') },
    ...(folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })),
  ];

  // `undefined` is "not answered yet" — rendering the empty state on it flashes
  // "0 routines" on every load.
  const loaded = summaries !== undefined && folders !== undefined;
  const entries = loaded ? toEntries(summaries, folders) : [];

  return (
    <Screen
      title={t('routines.title')}
      action={
        <div className="flex items-center gap-3">
          {loaded && summaries.length > 0 && (
            <p className="text-right">
              <span className="metric text-xl font-semibold text-[var(--text-1)]">
                {summaries.length.toLocaleString('fr-FR')}
              </span>{' '}
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('routines.countUnit')}
              </span>
            </p>
          )}
          <HeaderAction label={t('routines.create')} onClick={() => setSheet({ kind: 'create' })}>
            <PlusIcon />
          </HeaderAction>
        </div>
      }
    >
      {loaded &&
        (summaries.length === 0 && folders.length === 0 ? (
          <EmptyState
            reading="0"
            unit={t('routines.countUnit')}
            body={t('routines.emptyBody')}
            action={
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="lg" fullWidth onClick={startBlank}>
                  {t('routines.newBlank')}
                </Button>
                <Button fullWidth onClick={() => setSheet({ kind: 'templates' })}>
                  {t('routines.newFromTemplate')}
                </Button>
              </div>
            }
          />
        ) : (
          <ReorderableList
            className="flex flex-col gap-3"
            items={entries}
            keyOf={(entry) => entry.id}
            onReorder={(from, to) =>
              void reorderRoutines(toPlacement(moveItem(entries, from, to)))
            }
            renderItem={(entry, _index, state) =>
              entry.kind === 'routine' ? (
                <RoutineRow
                  summary={entry.summary}
                  state={state}
                  onOpen={() => openEditor(entry.summary.routine)}
                  onMenu={() => setSheet({ kind: 'routineActions', routine: entry.summary.routine })}
                />
              ) : (
                // Headings are landmarks, not rows: no handle, so they stay put
                // while routines move between them.
                <div className="flex items-center gap-2 px-1 pt-2">
                  <h2 className="label-xs min-w-0 flex-1 truncate font-semibold text-[var(--text-2)]">
                    {entry.folder?.name ?? t('routines.rootFolder')}
                  </h2>
                  {entry.folder !== undefined && (
                    <button
                      type="button"
                      aria-label={`${t('routines.folderTitle')} — ${entry.folder.name}`}
                      onClick={() =>
                        entry.folder && setSheet({ kind: 'folderActions', folder: entry.folder })
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
        ))}

      <ActionSheet
        open={sheet?.kind === 'create'}
        onClose={() => setSheet(null)}
        title={t('routines.createTitle')}
        actions={[
          { label: t('routines.newBlank'), hint: t('routines.newBlankHint'), onSelect: startBlank },
          {
            label: t('routines.newFromTemplate'),
            hint: t('routines.newFromTemplateHint'),
            onSelect: () => setSheet({ kind: 'templates' }),
          },
          {
            label: t('routines.newFolder'),
            hint: t('routines.newFolderHint'),
            onSelect: () => setSheet({ kind: 'folderForm' }),
          },
        ]}
      />

      <ActionSheet
        open={sheet?.kind === 'templates'}
        onClose={() => setSheet(null)}
        title={t('routines.templatesTitle')}
        actions={ROUTINE_TEMPLATES.map((template) => ({
          label: template.name,
          hint: template.description,
          onSelect: () => void instantiateTemplate(template).then(openEditor),
        }))}
      />

      <FolderFormSheet
        open={sheet?.kind === 'folderForm'}
        onClose={() => setSheet(null)}
        folder={sheet?.kind === 'folderForm' ? sheet.folder : undefined}
        onSubmit={(name) => {
          const target = sheet?.kind === 'folderForm' ? sheet.folder : undefined;
          void (target === undefined ? createFolder(name) : renameFolder(target.id, name));
        }}
      />

      <ActionSheet
        open={sheet?.kind === 'folderActions'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'folderActions' ? sheet.folder.name : t('routines.folderTitle')}
        actions={
          sheet?.kind === 'folderActions'
            ? [
                {
                  label: t('routines.folderRename'),
                  onSelect: () => setSheet({ kind: 'folderForm', folder: sheet.folder }),
                },
                {
                  label: t('routines.folderDelete'),
                  danger: true,
                  onSelect: () =>
                    void countRoutinesInFolder(sheet.folder.id).then((count) =>
                      setSheet({ kind: 'folderDelete', folder: sheet.folder, count }),
                    ),
                },
              ]
            : []
        }
      />

      <ConfirmSheet
        open={sheet?.kind === 'folderDelete'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'folderDelete' ? sheet.folder.name : ''}
        body={
          sheet?.kind !== 'folderDelete'
            ? ''
            : sheet.count === 0
              ? t('routines.folderDeleteHintEmpty')
              : sheet.count === 1
                ? t('routines.folderDeleteHintOne')
                : t('routines.folderDeleteHint', { count: sheet.count })
        }
        confirmLabel={t('routines.folderDeleteConfirm')}
        danger
        onConfirm={() => {
          if (sheet?.kind === 'folderDelete') void deleteFolder(sheet.folder.id);
        }}
      />

      <ActionSheet
        open={sheet?.kind === 'routineActions'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'routineActions' ? sheet.routine.name : t('routines.actionsTitle')}
        actions={
          sheet?.kind === 'routineActions'
            ? [
                {
                  // First, because in the gym it is the only one you want.
                  label: t('routines.start'),
                  disabled: active != null,
                  hint: active != null ? t('routines.startBusyHint') : undefined,
                  onSelect: () => start(sheet.routine.id),
                },
                {
                  label: t('routines.duplicate'),
                  hint: t('routines.duplicateHint'),
                  onSelect: () =>
                    void duplicateRoutine(
                      sheet.routine.id,
                      t('routines.copyName', { name: sheet.routine.name }),
                    ),
                },
                {
                  // Kept alongside the drag: dragging is fast, a picker is
                  // precise, and with a dozen routines the target folder can be
                  // two screens away from the thumb.
                  label: t('routines.moveTo'),
                  onSelect: () => setSheet({ kind: 'routineMove', routine: sheet.routine }),
                },
                {
                  label: t('routines.delete'),
                  danger: true,
                  onSelect: () => setSheet({ kind: 'routineDelete', routine: sheet.routine }),
                },
              ]
            : []
        }
      />

      <ConfirmSheet
        open={sheet?.kind === 'routineDelete'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'routineDelete' ? sheet.routine.name : ''}
        body={t('routines.deleteHint')}
        confirmLabel={t('routines.deleteConfirm')}
        danger
        onConfirm={() => {
          if (sheet?.kind === 'routineDelete') void deleteRoutine(sheet.routine.id);
        }}
      />

      <OptionSheet<string>
        open={sheet?.kind === 'routineMove'}
        onClose={() => setSheet(null)}
        title={t('routines.moveTo')}
        options={folderOptions}
        value={sheet?.kind === 'routineMove' ? sheet.routine.folderId : ''}
        onSelect={(folderId) => {
          if (sheet?.kind === 'routineMove') void updateRoutine(sheet.routine.id, { folderId });
        }}
      />
    </Screen>
  );
}
