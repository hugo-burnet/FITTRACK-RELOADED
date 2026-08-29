import type { ReactElement } from 'react';
import type { RoutineSummary } from '@/data/repositories/routines';
import type { Routine, RoutineFolder } from '@/data/types';
import { t } from '@/i18n/fr';
import { moveItem } from '@/lib/routineOrder';
import { Button, EmptyState, ReorderableList } from '@/ui';
import type { ItemState } from '@/ui';
import { ChevronDownIcon, GripIcon, MoreIcon } from '@/ui/icons';
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
  /** Dossiers repliés. La racine porte l'identifiant littéral `root`. */
  collapsedFolderIds: ReadonlySet<string>;
  reorderUnlocked: boolean;
  onToggleFolder: (folderId: string) => void;
}>;

// Le `folderId` voyage avec la routine : sans lui, filtrer les repliées
// demanderait de rejouer le regroupement, et deux regroupements finissent
// toujours par diverger.
type Entry =
  | { kind: 'heading'; id: string; folder?: RoutineFolder }
  | { kind: 'routine'; id: string; folderId: string; summary: RoutineSummary };

function projectEntries(
  summaries: readonly RoutineSummary[],
  folders: readonly RoutineFolder[],
): Entry[] {
  const entries: Entry[] = [];
  const inFolder = (id: string) => summaries.filter((row) => row.routine.folderId === id);

  const rootSummaries = inFolder('');
  if (folders.length > 0 && rootSummaries.length > 0) {
    entries.push({ kind: 'heading', id: 'root' });
  }
  for (const summary of rootSummaries) {
    entries.push({ kind: 'routine', id: summary.routine.id, folderId: 'root', summary });
  }

  for (const folder of folders) {
    entries.push({ kind: 'heading', id: folder.id, folder });
    for (const summary of inFolder(folder.id)) {
      entries.push({ kind: 'routine', id: summary.routine.id, folderId: folder.id, summary });
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
  draggable,
}: {
  summary: RoutineSummary;
  state: ItemState;
  onIntent: (intent: RoutineCollectionIntent) => void;
  draggable: boolean;
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
      {/* Verrouillé, la poignée n'existe pas — ni à la souris, ni au clavier,
          ni pour un lecteur d'écran. La masquer en CSS aurait laissé un bouton
          focalisable qui annonce un déplacement impossible. */}
      {draggable && (
        <button
          type="button"
          aria-label={t('routines.dragHandle', { name: routine.name })}
          className="flex w-11 shrink-0 cursor-grab items-center justify-center text-[var(--text-2)]
            active:cursor-grabbing"
          {...state.handleProps}
        >
          <GripIcon />
        </button>
      )}

      {/* Le retrait à gauche est celui de la poignée quand elle est là. Sans
          elle — c'est-à-dire dans l'état verrouillé, qui est le défaut — rien ne
          décollait plus le libellé du bord de la carte : `pl-4` le remplace, au
          lieu d'un retrait permanent qui décalerait deux fois le texte lorsque
          la poignée revient. La zone de pression continue d'atteindre le bord. */}
      <button
        type="button"
        onClick={() => onIntent({ kind: 'openRoutine', routine })}
        className={`flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-1 py-3 text-left
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]
          ${draggable ? '' : 'pl-4'}`}
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
  collapsedFolderIds,
  reorderUnlocked,
  onToggleFolder,
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

  /**
   * **Déverrouillé, la liste est complète.** C'est cette ligne qui porte
   * l'invariant : aucun déplacement ne peut être calculé sur une liste dont une
   * partie est invisible, donc le repli n'a aucun effet pendant un
   * réordonnancement — y compris si l'appelant transmettait un ensemble replié
   * incohérent, ce que le store empêche déjà de son côté.
   *
   * `onReorder` lit `allEntries` plutôt que `visibleEntries` : c'est un second
   * verrou, redondant tant que la ligne au-dessus tient. Il coûte un mot et
   * survivrait à quelqu'un qui retirerait le premier.
   */
  const allEntries = projectEntries(summaries, folders);
  const visibleEntries = reorderUnlocked
    ? allEntries
    : allEntries.filter(
        (entry) => entry.kind === 'heading' || !collapsedFolderIds.has(entry.folderId),
      );

  const countInFolder = (folderId: string) =>
    allEntries.filter((entry) => entry.kind === 'routine' && entry.folderId === folderId).length;

  return (
    <ReorderableList
      className="flex flex-col gap-3"
      items={visibleEntries}
      keyOf={(entry) => entry.id}
      disabled={!reorderUnlocked}
      onReorder={(from, to) =>
        onIntent({
          kind: 'reorderRoutines',
          placement: projectPlacement(moveItem(allEntries, from, to)),
        })
      }
      renderItem={(entry, _index, state) => {
        if (entry.kind === 'routine') {
          return (
            <RoutineRow
              summary={entry.summary}
              state={state}
              onIntent={onIntent}
              draggable={reorderUnlocked}
            />
          );
        }

        const collapsed = collapsedFolderIds.has(entry.id);
        const name = entry.folder?.name ?? t('routines.rootFolder');
        const count = countInFolder(entry.id);
        return (
          <div className="flex items-center gap-2 px-1 pt-2">
            {/* min-h-12 = 48 px. Le repli est gelé pendant un réordonnancement :
                un dossier qui se ferme sous un doigt en train de déplacer une
                routine ferait disparaître la cible du geste. */}
            <button
              type="button"
              aria-expanded={!collapsed}
              disabled={reorderUnlocked}
              onClick={() => onToggleFolder(entry.id)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-left
                disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className={`shrink-0 transition-transform duration-[var(--dur-1)]
                  ${collapsed ? '-rotate-90' : ''}`}
              >
                <ChevronDownIcon />
              </span>
              <h2 className="label-xs min-w-0 flex-1 truncate font-semibold text-[var(--text-2)]">
                {name}
              </h2>
              <span className="record-figure shrink-0 text-xs text-[var(--text-2)]">{count}</span>
            </button>
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
        );
      }}
    />
  );
}
