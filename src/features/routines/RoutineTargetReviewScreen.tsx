import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { addExercisesToRoutine } from '@/data/repositories/routines';
import {
  applyRoutineTargetProposals,
  loadRoutineTargetReview,
} from '@/data/repositories/routineTargetReview';
import type {
  RoutineTargetProposal,
  RoutineUnchangedReason,
  RoutineUpdateReview,
} from '@/lib/routineTargets';
import { t, type TranslationKey } from '@/i18n/fr';
import { exerciseDisplayName } from '@/i18n/labels';
import { ActionBand, Button, Card, EmptyState, SectionTitle } from '@/ui';

/** « 15 septembre 2026 » — une revue se lit, elle ne se scanne pas. */
const longDate = (epochMs: number): string =>
  new Date(epochMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const decimal = (value: number): string => value.toLocaleString('fr-FR');

const kg = (value: number): string => `${decimal(value)} kg`;

const REASON_KEYS: Record<RoutineUnchangedReason, TranslationKey> = {
  no_working_sets: 'routineReview.reasonNoWorkingSets',
  no_weight_target: 'routineReview.reasonNoWeightTarget',
  no_rep_target: 'routineReview.reasonNoRepTarget',
  no_history: 'routineReview.reasonNoHistory',
  below_target: 'routineReview.reasonBelowTarget',
  range_not_completed: 'routineReview.reasonRangeNotCompleted',
  effort_too_high: 'routineReview.reasonEffortTooHigh',
  increment_unavailable: 'routineReview.reasonIncrementUnavailable',
};

type Decision = 'accepted' | 'refused';

interface ReviewState {
  /** La routine que cet état décrit. `null` en revue : la routine a disparu. */
  id: string;
  review: RoutineUpdateReview | null;
  decisions: Record<string, Decision>;
  added: Record<string, true>;
}

/** Une ligne chiffrée de la carte : le libellé à gauche, la valeur à droite. */
function Reading({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-h-11 items-baseline justify-between gap-4">
      <span className="text-sm text-[var(--text-2)]">{label}</span>
      <span
        className={`metric shrink-0 text-base ${
          strong ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--text-1)]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ProposalCard({
  proposal,
  decision,
  onAccept,
  onRefuse,
}: {
  proposal: RoutineTargetProposal;
  decision: Decision | undefined;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const performed =
    proposal.performedReps === undefined
      ? kg(proposal.performedWeight)
      : t('routineReview.repsAt', {
          weight: kg(proposal.performedWeight),
          reps: proposal.performedReps,
        });

  const effort =
    proposal.reference.maxRpe === undefined
      ? t('routineReview.effortNotNoted')
      : t('routineReview.effortNoted', { rpe: decimal(proposal.reference.maxRpe) });

  const sets =
    proposal.reference.workingSetCount === 1
      ? t('routineReview.setsHeldOne')
      : t('routineReview.setsHeld', { count: proposal.reference.workingSetCount });

  return (
    <Card padded>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-1)]">
            {exerciseDisplayName(proposal.exerciseName, proposal.isUnilateral)}
          </h3>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {proposal.kind === 'increase_weight' && proposal.incrementKg !== undefined
              ? t('routineReview.kindIncrease', { increment: decimal(proposal.incrementKg) })
              : t('routineReview.kindAlign')}
          </p>
        </div>

        <div className="flex flex-col divide-y divide-[var(--border)]">
          <Reading
            label={t('routineReview.currentTarget')}
            value={
              proposal.currentWeight === undefined
                ? t('routineReview.noCurrentTarget')
                : kg(proposal.currentWeight)
            }
          />
          <Reading label={t('routineReview.performed')} value={performed} />
          <Reading label={t('routineReview.proposal')} value={kg(proposal.proposedWeight)} strong />
        </div>

        <p className="text-xs text-[var(--text-2)]">
          {t('routineReview.referenceOn', { date: longDate(proposal.reference.performedAt) })}
          {` · ${sets} · ${effort}`}
        </p>

        {decision === undefined ? (
          <div className="flex gap-2">
            {/* Refuser d'abord, à gauche : le geste qui n'écrit rien ne se
                trouve pas sous le pouce qui vient d'accepter la carte d'avant. */}
            <Button variant="ghost" onClick={onRefuse} fullWidth>
              {t('routineReview.refuse')}
            </Button>
            <Button variant="primary" onClick={onAccept} fullWidth>
              {t('routineReview.accept')}
            </Button>
          </div>
        ) : (
          <p className="min-h-11 text-sm font-semibold text-[var(--text-2)]">
            {t(decision === 'accepted' ? 'routineReview.accepted' : 'routineReview.refused')}
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * La revue des cibles d'une routine — **proposer, et n'écrire que sur un geste**.
 *
 * Les cibles d'une routine sont figées à sa création, l'historique non : un
 * rowing prescrit à 57,5 kg et tiré à 70 depuis trois séances fait de la routine
 * une donnée morte. Cet écran met les deux côte à côte, ligne par ligne, et
 * chaque ligne attend un doigt. Rien n'est appliqué à l'ouverture, rien ne l'est
 * à la fermeture, et une baisse n'est jamais proposée — le moteur
 * (`lib/routineTargets`) n'en produit aucune.
 *
 * **Un instantané, pas un `useLiveQuery`.** C'est l'exception à la règle de
 * réactivité du projet, et elle est délibérée : accepter une proposition écrit
 * la cible, ce qui ferait disparaître sous le doigt la carte qu'on vient de
 * toucher et redessinerait la liste entière. La revue est donc lue une fois,
 * puis chaque carte porte son propre état. Rouvrir l'écran relit l'historique.
 *
 * **Pas une feuille de fin de séance.** Choisir ses charges n'est pas un geste
 * de salle, et une fenêtre qui s'ouvre après le dernier effort est exactement là
 * où on accepte n'importe quoi pour la faire disparaître.
 */
export function RoutineTargetReviewScreen() {
  const { id = '' } = useParams();
  const navigate = useAppNavigate();

  /**
   * La revue, ses décisions et ses ajouts en **un seul état, estampillé de la
   * routine qu'il décrit**.
   *
   * Trois états séparés qu'un effet remettrait à zéro au changement d'`id`
   * appelleraient `setState` en plein effet — trois rendus en cascade, et un
   * instant où les décisions d'une routine s'affichent sur la revue d'une
   * autre. L'estampille répond à la question directement : ce qui ne porte pas
   * l'`id` courant n'est pas encore chargé.
   */
  const [state, setState] = useState<ReviewState | null>(null);
  const loaded = state !== null && state.id === id ? state : undefined;

  useEffect(() => {
    let current = true;
    void loadRoutineTargetReview(id).then((review) => {
      if (current) setState({ id, review, decisions: {}, added: {} });
    });
    return () => {
      current = false;
    };
  }, [id]);

  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(`/routines/${id}`);
  };

  /** Le seul chemin d'écriture de l'écran : l'appui, puis la base, puis l'état. */
  const accept = (proposals: readonly RoutineTargetProposal[]) => {
    if (proposals.length === 0) return;
    void applyRoutineTargetProposals(proposals).then(() => {
      setState((previous) => {
        if (previous === null || previous.id !== id) return previous;
        const decisions = { ...previous.decisions };
        for (const proposal of proposals) decisions[proposal.routineExerciseId] = 'accepted';
        return { ...previous, decisions };
      });
    });
  };

  const refuse = (routineExerciseId: string) => {
    setState((previous) =>
      previous === null || previous.id !== id
        ? previous
        : {
            ...previous,
            decisions: { ...previous.decisions, [routineExerciseId]: 'refused' },
          },
    );
  };

  const markAdded = (exerciseId: string) => {
    setState((previous) =>
      previous === null || previous.id !== id
        ? previous
        : { ...previous, added: { ...previous.added, [exerciseId]: true } },
    );
  };

  if (loaded === undefined) {
    return (
      <Screen title={t('routineReview.title')} onBack={goBack}>
        <p className="text-base text-[var(--text-2)]">{t('routineReview.loading')}</p>
      </Screen>
    );
  }

  const review = loaded.review;

  if (review === null) {
    return (
      <Screen title={t('routine.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  const pending = review.proposals.filter(
    (proposal) => loaded.decisions[proposal.routineExerciseId] === undefined,
  );

  if (review.proposals.length === 0 && review.missingExercises.length === 0) {
    return (
      <Screen title={t('routineReview.title')} onBack={goBack}>
        <EmptyState title={t('routineReview.emptyTitle')} body={t('routineReview.emptyBody')} />
      </Screen>
    );
  }

  return (
    <Screen
      title={t('routineReview.title')}
      onBack={goBack}
      footer={
        pending.length === 0 ? undefined : (
          <ActionBand
            label={t('routineReview.acceptAllCount', { count: pending.length })}
            onClick={() => accept(pending)}
          />
        )
      }
    >
      <div className="flex flex-col gap-9">
        {review.proposals.length > 0 && (
          <section>
            <SectionTitle>{t('routineReview.proposalsTitle')}</SectionTitle>
            <div className="flex flex-col gap-3">
              {review.proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.routineExerciseId}
                  proposal={proposal}
                  decision={loaded.decisions[proposal.routineExerciseId]}
                  onAccept={() => accept([proposal])}
                  onRefuse={() => refuse(proposal.routineExerciseId)}
                />
              ))}
            </div>
          </section>
        )}

        {review.missingExercises.length > 0 && (
          <section>
            <SectionTitle>{t('routineReview.missingTitle')}</SectionTitle>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--text-2)]">{t('routineReview.missingBody')}</p>
              {review.missingExercises.map((missing) => (
                <Card key={missing.exerciseId} padded>
                  <div className="flex flex-col gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text-1)]">
                        {exerciseDisplayName(missing.exerciseName, missing.isUnilateral)}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-2)]">
                        {t('routineReview.missingLast', {
                          date: longDate(missing.lastPerformedAt),
                        })}
                        {missing.bestWeight === undefined ? '' : ` · ${kg(missing.bestWeight)}`}
                      </p>
                    </div>
                    {loaded.added[missing.exerciseId] === undefined ? (
                      <Button
                        variant="secondary"
                        fullWidth
                        onClick={() => {
                          void addExercisesToRoutine(id, [missing.exerciseId]).then(() => {
                            markAdded(missing.exerciseId);
                          });
                        }}
                      >
                        {t('routineReview.missingAdd')}
                      </Button>
                    ) : (
                      <p className="min-h-11 text-sm font-semibold text-[var(--text-2)]">
                        {t('routineReview.missingAdded')}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {review.unchanged.length > 0 && (
          <section>
            <SectionTitle>{t('routineReview.unchangedTitle')}</SectionTitle>
            <Card padded>
              <ul className="flex flex-col gap-3">
                {review.unchanged.map((line) => (
                  <li key={line.routineExerciseId}>
                    <p className="text-base text-[var(--text-1)]">
                      {exerciseDisplayName(line.exerciseName, line.isUnilateral)}
                    </p>
                    <p className="text-sm text-[var(--text-2)]">{t(REASON_KEYS[line.reason])}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>
    </Screen>
  );
}
