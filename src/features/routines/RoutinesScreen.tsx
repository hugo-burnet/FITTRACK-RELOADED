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
import { getActiveWorkout, startWorkoutFromRoutine } from '@/data/repositories/workouts';
import { ROUTINE_TEMPLATES, instantiateTemplate } from '@/data/seed/routineTemplates';
import type { Routine, RoutineFolder } from '@/data/types';
import { t } from '@/i18n/fr';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { ActionSheet, ConfirmSheet, HeaderAction, OptionSheet } from '@/ui';
import type { Option } from '@/ui';
import { PlusIcon } from '@/ui/icons';
import { FolderFormSheet } from './FolderFormSheet';
import { RoutineCollection } from './RoutineCollection';
import type { RoutineCollectionIntent } from './RoutineCollection';
import { PlanningTabs } from '@/features/planning/PlanningTabs';

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

export function RoutinesScreen() {
  const navigate = useNavigate();
  const tutorial = useTutorialControls();
  const summaries = useLiveQuery(listRoutineSummaries);
  const folders = useLiveQuery(listFolders);
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const openEditor = (routine: Routine) => void navigate(`/routines/${routine.id}`);

  const startBlank = () => {
    void createRoutine(t('routines.defaultName'))
      .then((routine) => {
        tutorial?.report({ type: 'routine-created', routineId: routine.id });
        openEditor(routine);
      })
      .catch(() => undefined);
  };

  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);

  /**
   * Proposé seulement quand rien ne tourne. Avant, « Démarrer » sur la routine
   * B pendant une séance de la routine A t'emmenait dans la séance A : le
   * bouton mentait sur ce qu'il venait de faire. Désactivé avec sa raison, ce
   * qu'un menu sait dire (`hint`) et qu'un bouton qui redirige ne dit pas.
   */
  const start = (routineId: string) => {
    void startWorkoutFromRoutine(routineId)
      .then((workout) => {
        tutorial?.report({ type: 'workout-started', workoutId: workout.id, routineId });
        navigate('/workout');
      })
      .catch(() => undefined);
  };

  const folderOptions: Option<string>[] = [
    { value: '', label: t('routines.noFolder') },
    ...(folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })),
  ];

  // `undefined` is "not answered yet" — rendering the empty state on it flashes
  // "0 routines" on every load.
  const loaded = summaries !== undefined && folders !== undefined;
  const handleCollectionIntent = (intent: RoutineCollectionIntent) => {
    switch (intent.kind) {
      case 'createBlank':
        startBlank();
        return;
      case 'showTemplates':
        setSheet({ kind: 'templates' });
        return;
      case 'openRoutine':
        openEditor(intent.routine);
        return;
      case 'openRoutineActions':
        setSheet({ kind: 'routineActions', routine: intent.routine });
        return;
      case 'openFolderActions':
        setSheet({ kind: 'folderActions', folder: intent.folder });
        return;
      case 'reorderRoutines':
        void reorderRoutines(intent.placement.map(({ id, folderId }) => ({ id, folderId })));
        return;
    }

    const unhandled: never = intent;
    return unhandled;
  };

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
          <HeaderAction
            label={t('routines.create')}
            tutorialId="routine-create"
            onClick={() => setSheet({ kind: 'create' })}
          >
            <PlusIcon />
          </HeaderAction>
        </div>
      }
    >
      {/* Rien au-dessus de la bibliothèque sauf la navigation de Planifier : les
          blocs vivent sur l'accueil, où une séance commence. Ici on compose, on
          duplique, on range. */}
      <div className="flex flex-col gap-6">
        <PlanningTabs />
        {loaded && (
          <RoutineCollection
            summaries={summaries}
            folders={folders}
            onIntent={handleCollectionIntent}
          />
        )}
      </div>

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
