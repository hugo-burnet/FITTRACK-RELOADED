import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { deleteExercise, getExercise, updateExercise } from '@/data/repositories/exercises';
import { getDefaultLoadStepKg } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { exerciseDisplayName, exerciseSubtitle } from '@/i18n/labels';
import { defaultLoadIncrementKg, LOAD_STEP_MAX_KG, LOAD_STEP_MIN_KG } from '@/lib/loadIncrement';
import { DEFAULT_REST_SECONDS } from '@/lib/rest';
import {
  Card,
  ConfirmAction,
  ListRow,
  NumberInput,
  RestPicker,
  SectionTitle,
  Tabs,
  Textarea,
} from '@/ui';
import { hasDrawableMuscles } from '@/ui/muscleMap';
import { ExerciseDocumentationView } from './ExerciseDocumentationView';
import { ExerciseLoadCard } from './ExerciseLoadCard';
import { ExerciseMusclesCard } from './ExerciseMusclesCard';
import { ExerciseTrackingView } from './ExerciseTrackingView';

export function ExerciseDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useAppNavigate();

  // `null` is "gone", `undefined` is "not answered yet" — without the
  // distinction a freshly opened screen flashes "cet exercice n'existe plus".
  const exercise = useLiveQuery(async () => (await getExercise(id)) ?? null, [id]);
  // Le pas de toute l'appli : `undefined` tant qu'il n'est pas lu, `null` quand les Réglages n'en ont aucun.
  const appLoadStep = useLiveQuery(async () => (await getDefaultLoadStepKg()) ?? null, []);

  /**
   * Notes, rest and load increment are typed here and written straight through
   * to the database, so the draft only exists to keep `useLiveQuery` from
   * echoing each write back into the field and moving the caret. Keyed on the
   * exercise id so walking from one exercise to another re-reads.
   */
  /**
   * Suivi ou Documentation. La vue est éphémère : revenir sur une fiche part
   * toujours du Suivi, parce que c'est ce qu'on ouvre pendant une séance.
   */
  const [view, setView] = useState<'tracking' | 'documentation'>('tracking');

  const [draft, setDraft] = useState<{
    id: string;
    notes: string;
    rest?: number;
    loadIncrementKg?: number;
  } | null>(null);
  if (exercise != null && draft?.id !== exercise.id) {
    setDraft({
      id: exercise.id,
      notes: exercise.userNotes ?? '',
      rest: exercise.defaultRestSeconds,
      loadIncrementKg: exercise.loadIncrementKg,
    });
  }

  /**
   * Back to wherever you came from, so a search or a filter survives the trip.
   *
   * The test is React Router's own history index, not `location.key`: creating
   * an exercise lands here through a `replace`, which mints a fresh key while
   * leaving the index at 0 — so the key says "you can go back" and `navigate(-1)`
   * silently does nothing. Measured, on the very flow the user reported.
   */
  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/exercises');
  };

  if (exercise === null) {
    return (
      <Screen title={t('exercise.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  if (exercise === undefined || draft === null) {
    return (
      <Screen title="" onBack={goBack}>
        <span />
      </Screen>
    );
  }

  const writeNotes = (notes: string) => {
    setDraft({ ...draft, notes });
    void updateExercise(exercise.id, { userNotes: notes });
  };

  const writeRest = (rest: number | undefined) => {
    setDraft({ ...draft, rest });
    void updateExercise(exercise.id, { defaultRestSeconds: rest });
  };

  const writeLoadIncrement = (loadIncrementKg: number | undefined) => {
    setDraft({ ...draft, loadIncrementKg });
    void updateExercise(exercise.id, { loadIncrementKg });
  };

  // « Vide » veut dire le pas des Réglages quand il y en a un, sinon la table du matériel.
  const fromSettings = typeof appLoadStep === 'number';
  const emptyIncrement = fromSettings ? appLoadStep : defaultLoadIncrementKg(exercise.equipment);
  const emptyIncrementReading = emptyIncrement.toLocaleString('fr-FR');
  const loadIncrementHint =
    exercise.measurementType === 'assisted_weight_reps'
      ? t(
          fromSettings ? 'exercise.loadIncrementAssistHintApp' : 'exercise.loadIncrementAssistHint',
          {
            value: emptyIncrementReading,
          },
        )
      : t(fromSettings ? 'exercise.loadIncrementHintApp' : 'exercise.loadIncrementHint', {
          value: emptyIncrementReading,
        });

  return (
    <Screen title={exerciseDisplayName(exercise.name, exercise.isUnilateral)} onBack={goBack}>
      <div className="flex flex-col gap-9">
        <p className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-[var(--text-2)]">
          {exerciseSubtitle(exercise)}
          {exercise.isUnilateral === 1 && (
            <span className="label-xs font-semibold text-[var(--text-2)]">
              {t('exercises.unilateral')}
            </span>
          )}
          {exercise.isCustom === 1 && (
            <span className="label-xs font-semibold text-[var(--accent-ink)]">
              {t('exercises.custom')}
            </span>
          )}
        </p>

        {/* Deux vues nommées, pas un accordéon : « Suivi » est ce qu'on ouvre en
            salle, « Documentation » ce qu'on lit à froid. Les mélanger sur un
            seul écran ferait descendre les records sous quinze paragraphes. */}
        <Tabs
          label={t('exercise.viewsLabel')}
          value={view}
          onChange={setView}
          items={[
            { value: 'tracking', label: t('exerciseDoc.tabTracking') },
            { value: 'documentation', label: t('exerciseDoc.tabDocumentation') },
          ]}
        >
          <div className="mt-9 flex flex-col gap-9">
            {view === 'documentation' ? (
              <>
                {/* Nothing at all for a stretching routine: a mute grey body would be
                worse than no body, and it is the roadmap's own checkpoint here.
                La carte vit ici, pas dans le Suivi : on la lit à froid. */}
                {hasDrawableMuscles(exercise) && <ExerciseMusclesCard exercise={exercise} />}
                <ExerciseDocumentationView exercise={exercise} />
              </>
            ) : (
              <>
                <ExerciseTrackingView exercise={exercise} />

                <section>
                  <SectionTitle>{t('exercise.yoursSection')}</SectionTitle>
                  <Card padded>
                    <Textarea
                      label={t('exercise.notesLabel')}
                      hint={t('exercise.notesHint')}
                      placeholder={t('exercise.notesPlaceholder')}
                      value={draft.notes}
                      onChange={(event) => writeNotes(event.target.value)}
                    />

                    <div className="mt-6">
                      <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
                        {t('exercise.restLabel')}
                      </p>
                      <RestPicker
                        value={draft.rest}
                        onChange={writeRest}
                        baseWhenEmpty={DEFAULT_REST_SECONDS}
                        emptyReading={t('rest.none')}
                        clearLabel={t('rest.none')}
                        aria-label={t('exercise.restLabel')}
                      />
                      <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                        {t('exercise.restHint')}
                      </p>
                    </div>

                    <div className="mt-6">
                      <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
                        {t('exercise.loadIncrementLabel')}
                      </p>
                      <NumberInput
                        aria-label={t('exercise.loadIncrementLabel')}
                        value={draft.loadIncrementKg}
                        onChange={writeLoadIncrement}
                        step={0.25}
                        min={LOAD_STEP_MIN_KG}
                        max={LOAD_STEP_MAX_KG}
                        suffix={t('units.kg')}
                        placeholder={emptyIncrementReading}
                      />
                      <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                        {loadIncrementHint}
                      </p>
                    </div>
                  </Card>
                </section>

                {/* Sa propre section, sous « Tes réglages » : le coefficient et le
            chargement ne sont pas des préférences de confort mais ce avec quoi
            l'app compte — le tonnage d'un côté, les disques à empiler de
            l'autre. Ils valent pour un exercice du catalogue comme pour un
            exercice fait maison, ce que le formulaire de création ne pouvait
            pas offrir : il ne s'ouvre que sur les seconds. */}
                <ExerciseLoadCard exercise={exercise} />

                {exercise.isCustom === 1 ? (
                  <Card>
                    <ListRow
                      title={t('exercise.edit')}
                      onClick={() => void navigate(`/exercises/${exercise.id}/edit`)}
                    />
                    <ConfirmAction
                      label={t('exercise.delete')}
                      hint={t('exercise.deleteHint')}
                      confirmLabel={t('exercise.deleteConfirm')}
                      danger
                      onConfirm={() => {
                        void deleteExercise(exercise.id).then(() => navigate('/exercises'));
                      }}
                    />
                  </Card>
                ) : (
                  <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">
                    {t('exercise.catalogueNote')}
                  </p>
                )}
              </>
            )}
          </div>
        </Tabs>
      </div>
    </Screen>
  );
}
