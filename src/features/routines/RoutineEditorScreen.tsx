import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { getActiveProgramDetail } from '@/data/repositories/programs';
import {
  addRoutineSet,
  applyToAllSets,
  createRoutineVersionDraft,
  deleteRoutineSet,
  getRoutineDetail,
  groupWithPrevious,
  isRoutineSealed,
  listFolders,
  listRoutineLineage,
  publishRoutineVersion,
  removeRoutineExercise,
  reorderRoutineExercises,
  ungroupSuperset,
  updateRoutine,
  updateRoutineExercise,
  updateRoutineSet,
} from '@/data/repositories/routines';
import type { RoutineExerciseDetail, RoutineSetTargets } from '@/data/repositories/routines';
import { getActiveWorkout, startWorkoutFromRoutine } from '@/data/repositories/workouts';
import type { RoutineSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle, unitLabel } from '@/i18n/labels';
import { targetParts } from '@/lib/measurement';
import { supersetPlaces } from '@/lib/routineOrder';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import {
  ActionBand,
  AddRow,
  Button,
  Card,
  EmptyState,
  Input,
  ListRow,
  OptionSheet,
  OrderLockButton,
  ReorderableList,
} from '@/ui';
import type { Option } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';
import { RoutineExerciseCard } from './RoutineExerciseCard';
import { RoutineExerciseSheet } from './RoutineExerciseSheet';
import { RoutineSetSheet } from './RoutineSetSheet';
import { routineSummaryLine } from './summary';

type SheetState =
  | { kind: 'folder' }
  | { kind: 'exercise'; rowId: string }
  | { kind: 'set'; setId: string; rowId: string; number: number }
  | { kind: 'effectiveWeek' };

function ReadOnlyExercise({ line }: { line: RoutineExerciseDetail }) {
  const name = line.exercise?.name ?? t('routine.deletedExercise');

  return (
    <Card>
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="text-base text-[var(--text-1)]">{name}</p>
        <p className="mt-0.5 text-sm text-[var(--text-2)]">
          {line.exercise === undefined
            ? t('routine.deletedExerciseHint')
            : exerciseSubtitle(line.exercise)}
        </p>
      </div>
      {line.sets.map((set, index) => {
        const parts = targetParts(line.exercise?.measurementType ?? 'weight_reps', set);
        const reading =
          parts.length === 0
            ? t('routine.setFree')
            : parts
                .map((part) => `${part.prefix}${part.value} ${unitLabel(part.unit)}`)
                .join(' · ');
        return (
          <div
            key={set.id}
            className="flex min-h-12 items-center gap-3 border-b border-[var(--border)] px-4 py-2 last:border-b-0"
          >
            <span className="tabular w-5 shrink-0 text-sm text-[var(--text-2)]">{index + 1}</span>
            {set.setType === 'warmup' && (
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('routine.warmupShort')}
              </span>
            )}
            <span className="ml-auto text-right text-sm font-semibold text-[var(--text-1)]">
              {reading}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

/**
 * A routine's screen **is** its editor.
 *
 * There is no read-only view because there is nothing to distinguish it from:
 * every keystroke below is already in the database, so there is no modified
 * state to commit and no "cancel" to offer. Lot 5 adds "Démarrer" at the top of
 * this same screen — and until it exists there is deliberately no button for it,
 * because a button that does nothing is worse than no button.
 */
export function RoutineEditorScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [actionError, setActionError] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [programReload, setProgramReload] = useState(0);
  const creatingVersionRef = useRef(false);
  const reorderUnlocked = useExerciseOrderLock((state) => state.unlocked.routine);
  const toggleReorder = useExerciseOrderLock((state) => state.toggle);

  // `null` is "gone", `undefined` is "not answered yet" — without the
  // distinction the screen flashes "cette routine n'existe plus" on every open.
  const detail = useLiveQuery(() => getRoutineDetail(id), [id]);
  const folders = useLiveQuery(listFolders);
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const sealed = useLiveQuery(() => isRoutineSealed(id), [id]);
  const lineage = useLiveQuery(() => listRoutineLineage(id), [id]);
  const activeProgramQuery = useLiveQuery(async () => {
    try {
      return { status: 'ready' as const, value: await getActiveProgramDetail(Date.now()) };
    } catch {
      return { status: 'error' as const };
    }
  }, [id, programReload]);

  /**
   * `null` = aucune séance, `undefined` = pas encore répondu. Tant qu'une
   * séance tourne, cet écran ne propose plus de démarrer : une seule séance à
   * la fois est le seul état que l'app connaisse, et le retour vers celle qui
   * tourne appartient à la barre de reprise.
   */
  const running = active != null;

  const start = () => {
    void startWorkoutFromRoutine(id).then(() => navigate('/workout'));
  };

  /**
   * Name and subtitle are typed here and written straight through. The draft
   * exists only to keep `useLiveQuery` from echoing each write back into the
   * field and moving the caret — the exact bug Lot 3 measured on the exercise
   * notes.
   */
  const [draft, setDraft] = useState<{ id: string; name: string; subtitle: string } | null>(null);
  if (detail != null && draft?.id !== detail.routine.id) {
    setDraft({
      id: detail.routine.id,
      name: detail.routine.name,
      subtitle: detail.routine.subtitle ?? '',
    });
  }

  const goBack = () => {
    // React Router's own history index, not `location.key`: arriving here through
    // a `replace` mints a fresh key while leaving the index at 0, so the key says
    // "you can go back" and `navigate(-1)` silently does nothing.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/routines');
  };

  if (detail === null) {
    return (
      <Screen title={t('routine.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  if (
    detail === undefined ||
    (detail !== null && detail.routine.id !== id) ||
    draft === null ||
    sealed === undefined ||
    lineage === undefined ||
    activeProgramQuery === undefined
  ) {
    return (
      <Screen title="" onBack={goBack}>
        <span />
      </Screen>
    );
  }

  const { routine, exercises } = detail;
  const activeProgram = activeProgramQuery.status === 'ready' ? activeProgramQuery.value : null;
  const isReadOnly = routine.versionState === 'published' && sealed;
  const places = supersetPlaces(exercises.map(({ row }) => row));
  const setCount = exercises.reduce((total, line) => total + line.sets.length, 0);
  const lineageIds = new Set(lineage.map((candidate) => candidate.id));
  const activeProgramUsesLineage =
    activeProgram !== null &&
    activeProgram.revisions.some(({ entries }) =>
      entries.some((entry) => lineageIds.has(entry.routineId)),
    );
  const firstEffectiveWeek =
    activeProgram === null || !activeProgramUsesLineage
      ? null
      : activeProgram.position.phase === 'before'
        ? 0
        : activeProgram.position.phase === 'active' &&
            activeProgram.position.weekIndex + 1 < activeProgram.program.durationWeeks
          ? activeProgram.position.weekIndex + 1
          : null;
  const effectiveWeekOptions: Option<string>[] =
    activeProgram === null || firstEffectiveWeek === null
      ? []
      : Array.from(
          { length: activeProgram.program.durationWeeks - firstEffectiveWeek },
          (_, offset) => {
            const weekIndex = firstEffectiveWeek + offset;
            return {
              value: String(weekIndex),
              label: t('program.week', { number: weekIndex + 1 }),
            };
          },
        );

  const createVersion = async () => {
    if (creatingVersionRef.current) return;
    const resumable = lineage
      .filter((candidate) => candidate.versionState === 'draft')
      .sort((left, right) => right.version - left.version)[0];
    if (resumable !== undefined) {
      void navigate(`/routines/${resumable.id}`, { replace: true });
      return;
    }
    creatingVersionRef.current = true;
    setCreatingVersion(true);
    setActionError(false);
    try {
      const created = await createRoutineVersionDraft(routine.id);
      void navigate(`/routines/${created.id}`, { replace: true });
    } catch {
      setActionError(true);
      creatingVersionRef.current = false;
      setCreatingVersion(false);
    }
  };

  const publishFromWeek = async (weekIndex: number) => {
    if (activeProgram === null) return;
    setActionError(false);
    try {
      await publishRoutineVersion({
        draftRoutineId: routine.id,
        programId: activeProgram.program.id,
        effectiveFromWeekIndex: weekIndex,
      });
    } catch {
      setActionError(true);
    }
  };

  const lineOf = (rowId: string): RoutineExerciseDetail | null =>
    exercises.find((line) => line.row.id === rowId) ?? null;

  const openSheetSet = (): RoutineSet | null => {
    if (sheet?.kind !== 'set') return null;
    return lineOf(sheet.rowId)?.sets.find((set) => set.id === sheet.setId) ?? null;
  };

  const folderOptions: Option<string>[] = [
    { value: '', label: t('routines.noFolder') },
    ...(folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })),
  ];
  const folderName =
    routine.folderId === ''
      ? t('routines.noFolder')
      : (folders?.find((folder) => folder.id === routine.folderId)?.name ??
        t('routines.noFolder'));

  return (
    <Screen
      title={routine.name === '' ? t('routines.untitled') : routine.name}
      /* The arrow is the only thing beside the title. A reading here made three
         elements compete for 375px against a name the user chose, and it
         wrapped badly the moment the name was longer than "Poussée" — reported
         from a real phone. The count now sits above the list it counts, which
         is also where it is actually informative. */
      onBack={goBack}
      /* Le verbe de cet écran, et rien d'autre. Il a porté « Terminé » à côté
         pendant un temps : le même `goBack` que la flèche de l'en-tête, deux
         commandes pour une navigation. Composer une routine, c'est ce qu'on
         fait chez soi ; en salle, ce qu'on vient y faire, c'est démarrer.

         Rien du tout quand une séance tourne : la barre de reprise mène déjà
         là, en permanence, et les deux étaient du même vert, de la même
         hauteur, à 32 px l'une de l'autre. */
      footer={
        running ? undefined : isReadOnly ? (
          <ActionBand
            label={t('routine.createVersion')}
            disabled={creatingVersion}
            onClick={() => void createVersion()}
          />
        ) : routine.versionState === 'draft' ? (
          firstEffectiveWeek === null ? undefined : (
            <ActionBand
              label={t('routine.useFromWeek', { number: firstEffectiveWeek + 1 })}
              onClick={() => setSheet({ kind: 'effectiveWeek' })}
            />
          )
        ) : (
          <ActionBand
            label={t('routine.start')}
            // Une routine sans exercice démarrerait une séance vide sous un nom
            // qui promet des exercices. L'état vide dit déjà quoi faire.
            disabled={active === undefined || exercises.length === 0}
            onClick={start}
          />
        )
      }
    >
      <div className="flex flex-col gap-6">
        <Card padded>
          <p className="label-xs font-semibold text-[var(--text-2)]">
            {routine.versionState === 'draft'
              ? t('routine.versionDraft', { version: routine.version })
              : t('routine.versionPublished', { version: routine.version })}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
            {isReadOnly
              ? t('routine.sealedHint')
              : routine.versionState === 'draft'
                ? t('routine.draftHint')
                : t('routine.publishedEditableHint')}
          </p>
        </Card>

        {actionError && (
          <p role="alert" className="text-sm text-[var(--danger-ink)]">
            {t('routine.versionActionError')}
          </p>
        )}

        {activeProgramQuery.status === 'error' && (
          <Card padded>
            <p role="alert" className="text-sm leading-relaxed text-[var(--danger-ink)]">
              {t('routine.programReadError')}
            </p>
            <div className="mt-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setProgramReload((value) => value + 1)}
              >
                {t('routine.programRetry')}
              </Button>
            </div>
          </Card>
        )}

        {activeProgramQuery.status === 'ready' &&
          routine.versionState === 'draft' && firstEffectiveWeek === null && (
          <p className="text-sm leading-relaxed text-[var(--text-2)]">
            {t('routine.noEffectiveWeek')}
          </p>
        )}

        {isReadOnly ? (
          <>
            {(routine.subtitle ?? '') !== '' && (
              <Card padded>
                <p className="text-base leading-relaxed text-[var(--text-1)]">
                  {routine.subtitle}
                </p>
              </Card>
            )}

            <Card>
              <ListRow
                title={t('routine.folderLabel')}
                trailing={<span className="text-base text-[var(--text-1)]">{folderName}</span>}
              />
            </Card>

            {exercises.length === 0 ? (
              <EmptyState
                reading="0"
                unit={t('routine.emptyUnit')}
                body={t('routine.sealedEmptyBody')}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="label-xs px-1 font-semibold text-[var(--text-2)]">
                  {routineSummaryLine(exercises.length, setCount)}
                </p>
                {exercises.map((line) => (
                  <ReadOnlyExercise key={line.row.id} line={line} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
        <Card padded>
          <div className="flex flex-col gap-5">
            <Input
              label={t('routine.nameLabel')}
              placeholder={t('routine.namePlaceholder')}
              value={draft.name}
              enterKeyHint="done"
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                void updateRoutine(routine.id, { name: event.target.value });
              }}
            />
            {/* Everything the name should not have to carry, so the title stays
                one scannable line instead of wrapping into a paragraph. */}
            <Input
              label={t('routine.subtitleLabel')}
              placeholder={t('routine.subtitlePlaceholder')}
              value={draft.subtitle}
              enterKeyHint="done"
              onChange={(event) => {
                setDraft({ ...draft, subtitle: event.target.value });
                void updateRoutine(routine.id, { subtitle: event.target.value });
              }}
            />
          </div>
        </Card>

        <Card>
          <ListRow
            title={t('routine.folderLabel')}
            onClick={() => setSheet({ kind: 'folder' })}
            trailing={
              <span className="flex items-center gap-1 text-base text-[var(--text-1)]">
                {folderName}
                <ChevronDownIcon className="text-[var(--text-2)]" />
              </span>
            }
          />
        </Card>

        {exercises.length === 0 ? (
          <EmptyState
            reading="0"
            unit={t('routine.emptyUnit')}
            body={t('routine.emptyBody')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* The reading, above the list it measures rather than in the header
                where it fought the routine's name for room. Outside the
                reorderable list on purpose: that component maps its children to
                item indices one for one, so a stray child would misalign every
                drag. */}
            <div className="flex min-h-12 items-center pl-1">
              <p className="label-xs min-w-0 flex-1 font-semibold text-[var(--text-2)]">
                {routineSummaryLine(exercises.length, setCount)}
              </p>
              <OrderLockButton
                unlocked={reorderUnlocked}
                onToggle={() => toggleReorder('routine')}
              />
            </div>
            <ReorderableList
              className="flex flex-col gap-3"
              items={exercises}
              keyOf={(line) => line.row.id}
              disabled={!reorderUnlocked}
              onReorder={(from, to) => void reorderRoutineExercises(routine.id, from, to)}
              renderItem={(line, _index, state) => (
                <RoutineExerciseCard
                  line={line}
                  superset={places.get(line.row.id)}
                  state={state}
                  reorderEnabled={reorderUnlocked}
                  onMenu={() => setSheet({ kind: 'exercise', rowId: line.row.id })}
                  onOpenSet={(set) =>
                    setSheet({
                      kind: 'set',
                      setId: set.id,
                      rowId: line.row.id,
                      number: line.sets.indexOf(set) + 1,
                    })
                  }
                  onDeleteSet={(set) => void deleteRoutineSet(set.id)}
                  onAddSet={() => void addRoutineSet(line.row.id)}
                />
              )}
            />
          </div>
        )}

        {/* Sorti de la barre collante au Lot 5 pour laisser la place à
            « Démarrer ». Il descend au pied de la liste qu'il allonge, avec le
            geste que les cartes emploient déjà pour leurs séries — une carte,
            pleine, sans bordure. */}
        <Card>
          <AddRow
            label={t('routine.addExercise')}
            onClick={() => void navigate(`/routines/${routine.id}/add`)}
          />
        </Card>
          </>
        )}
      </div>

      <OptionSheet<string>
        open={sheet?.kind === 'folder'}
        onClose={() => setSheet(null)}
        title={t('routine.folderLabel')}
        options={folderOptions}
        value={routine.folderId}
        onSelect={(folderId) => void updateRoutine(routine.id, { folderId })}
      />

      <RoutineExerciseSheet
        open={sheet?.kind === 'exercise'}
        onClose={() => setSheet(null)}
        line={sheet?.kind === 'exercise' ? lineOf(sheet.rowId) : null}
        canGroup={
          sheet?.kind === 'exercise' &&
          exercises.findIndex((line) => line.row.id === sheet.rowId) > 0
        }
        onWrite={(changes) => {
          if (sheet?.kind === 'exercise') void updateRoutineExercise(sheet.rowId, changes);
        }}
        onGroup={() => {
          if (sheet?.kind === 'exercise') void groupWithPrevious(routine.id, sheet.rowId);
        }}
        onUngroup={() => {
          if (sheet?.kind === 'exercise') void ungroupSuperset(routine.id, sheet.rowId);
        }}
        onRemove={() => {
          if (sheet?.kind === 'exercise') void removeRoutineExercise(sheet.rowId);
        }}
      />

      <RoutineSetSheet
        open={sheet?.kind === 'set'}
        onClose={() => setSheet(null)}
        set={openSheetSet()}
        // What the exercise is measured in decides which fields exist at all.
        measurementType={
          (sheet?.kind === 'set' ? lineOf(sheet.rowId)?.exercise?.measurementType : undefined) ??
          'weight_reps'
        }
        number={sheet?.kind === 'set' ? sheet.number : 1}
        onSave={(changes: RoutineSetTargets) => {
          if (sheet?.kind === 'set') void updateRoutineSet(sheet.setId, changes);
        }}
        onApplyToAll={(changes: RoutineSetTargets) => {
          if (sheet?.kind === 'set') void applyToAllSets(sheet.rowId, changes);
        }}
        onDelete={() => {
          if (sheet?.kind === 'set') void deleteRoutineSet(sheet.setId);
        }}
      />

      <OptionSheet<string>
        open={sheet?.kind === 'effectiveWeek'}
        onClose={() => setSheet(null)}
        title={t('routine.effectiveWeekTitle')}
        options={effectiveWeekOptions}
        value={firstEffectiveWeek === null ? '' : String(firstEffectiveWeek)}
        onSelect={(value) => void publishFromWeek(Number(value))}
      />
    </Screen>
  );
}
