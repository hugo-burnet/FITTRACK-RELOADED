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
  updateRoutine,
} from '@/data/repositories/routines';
import type { RoutineSummary } from '@/data/repositories/routines';
import { ROUTINE_TEMPLATES, instantiateTemplate } from '@/data/seed/routineTemplates';
import type { Routine, RoutineFolder } from '@/data/types';
import { t } from '@/i18n/fr';
import { ActionSheet, Button, Card, ConfirmSheet, EmptyState, OptionSheet } from '@/ui';
import type { Option } from '@/ui';
import { MoreIcon, PlusIcon } from '@/ui/icons';
import { FolderFormSheet } from './FolderFormSheet';

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

type Section = { folder?: RoutineFolder; routines: RoutineSummary[] };

/**
 * Root routines first and without a heading, then one section per folder —
 * including the empty ones, which still need somewhere to be renamed from.
 */
function toSections(summaries: RoutineSummary[], folders: RoutineFolder[]): Section[] {
  const root = summaries.filter((row) => row.routine.folderId === '');
  const sections: Section[] = root.length > 0 ? [{ routines: root }] : [];

  for (const folder of folders) {
    sections.push({
      folder,
      routines: summaries.filter((row) => row.routine.folderId === folder.id),
    });
  }

  return sections;
}

/** "6 exercices · 18 séries" — what the routine costs, before you open it. */
function summaryLine({ exerciseCount, setCount }: RoutineSummary): string {
  if (exerciseCount === 0) return t('routines.empty');
  const exercises =
    exerciseCount === 1
      ? t('routines.exerciseCountOne')
      : t('routines.exerciseCount', { count: exerciseCount });
  const sets =
    setCount === 1 ? t('routines.setCountOne') : t('routines.setCount', { count: setCount });
  return `${exercises} · ${sets}`;
}

/**
 * A row with two targets: the routine, and its menu. Built here rather than from
 * `ListRow` because a button inside a button is invalid, and the "⋯" has to be
 * reachable without opening the routine first.
 */
function RoutineRow({
  summary,
  onOpen,
  onMenu,
}: {
  summary: RoutineSummary;
  onOpen: () => void;
  onMenu: () => void;
}) {
  return (
    <div
      className="flex items-stretch border-b border-[var(--border)] bg-[var(--surface-1)]
        last:border-b-0"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-1 py-3 pl-4 text-left
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <span className="truncate text-base text-[var(--text-1)]">{summary.routine.name}</span>
        <span className="tabular text-sm text-[var(--text-2)]">{summaryLine(summary)}</span>
      </button>
      <button
        type="button"
        aria-label={`${t('routines.actionsTitle')} — ${summary.routine.name}`}
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

  const folderOptions: Option<string>[] = [
    { value: '', label: t('routines.noFolder') },
    ...(folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })),
  ];

  // `undefined` is "not answered yet" — rendering the empty state on it flashes
  // "0 routines" on every load.
  const loaded = summaries !== undefined && folders !== undefined;
  const sections = loaded ? toSections(summaries, folders) : [];

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
          <button
            type="button"
            aria-label={t('routines.create')}
            onClick={() => setSheet({ kind: 'create' })}
            className="-mr-2 flex size-12 items-center justify-center rounded-xl
              text-[var(--accent-ink)] active:bg-[var(--surface-1)]"
          >
            <PlusIcon />
          </button>
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
          <div className="flex flex-col gap-5">
            {sections.map((section) => (
              <section key={section.folder?.id ?? 'root'}>
                {/* The same sticky device as the library's letters, on real
                    structure instead of an initial. */}
                {section.folder && (
                  <div
                    className="sticky top-0 z-10 -mx-4 flex items-center gap-2
                      bg-[var(--surface-0)] px-5 py-2"
                  >
                    <h2 className="label-xs min-w-0 flex-1 truncate font-semibold text-[var(--text-2)]">
                      {section.folder.name}
                    </h2>
                    <button
                      type="button"
                      aria-label={`${t('routines.folderTitle')} — ${section.folder.name}`}
                      onClick={() =>
                        section.folder &&
                        setSheet({ kind: 'folderActions', folder: section.folder })
                      }
                      className="-my-2 -mr-2 flex size-12 items-center justify-center
                        text-[var(--text-2)]"
                    >
                      <MoreIcon width="18" height="18" />
                    </button>
                  </div>
                )}

                {section.routines.length === 0 ? (
                  <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">
                    {t('routines.folderDeleteHintEmpty')}
                  </p>
                ) : (
                  <Card>
                    {section.routines.map((summary) => (
                      <RoutineRow
                        key={summary.routine.id}
                        summary={summary}
                        onOpen={() => openEditor(summary.routine)}
                        onMenu={() => setSheet({ kind: 'routineActions', routine: summary.routine })}
                      />
                    ))}
                  </Card>
                )}
              </section>
            ))}
          </div>
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
                  label: t('routines.duplicate'),
                  hint: t('routines.duplicateHint'),
                  onSelect: () =>
                    void duplicateRoutine(
                      sheet.routine.id,
                      t('routines.copyName', { name: sheet.routine.name }),
                    ),
                },
                {
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
    </Screen>
  );
}
