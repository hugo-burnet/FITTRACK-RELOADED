import { useLiveQuery } from 'dexie-react-hooks';
import { listRecommendationsForWorkout } from '@/data/repositories/coachRecommendations';
import type { CoachRecommendation } from '@/data/types';
import { CoachCard } from '@/features/workout/CoachCard';
import { recommendationAsSignal } from '@/features/workout/coachCopy';
import { t } from '@/i18n/fr';
import { Card, SectionTitle } from '@/ui';

const shortDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function statusLabel(status: CoachRecommendation['status']): string {
  switch (status) {
    case 'pending':
      return t('coach.statusPending');
    case 'followed':
      return t('coach.statusFollowed');
    case 'dismissed':
      return t('coach.statusDismissed');
    case 'superseded':
      return t('coach.statusSuperseded');
  }
}

/**
 * « Ce que le coach en a conclu » : les propositions que cette séance a produites, avec ce qu'il en est
 * advenu (suivie, remplacée, en attente…), à la date où elle s'est résolue quand on la connaît.
 *
 * `names` vient de la séance elle-même : une recommandation ne porte que l'id de son exercice, et c'est
 * l'instantané de la ligne qui sait le nommer comme la séance l'a vécu.
 */
export function HistoryCoachConclusions({
  workoutId,
  names,
}: {
  workoutId: string;
  names: ReadonlyMap<string, string>;
}) {
  const rows = useLiveQuery(() => listRecommendationsForWorkout(workoutId), [workoutId]);

  if (rows === undefined || rows.length === 0) return null;

  return (
    <section>
      <SectionTitle>{t('history.detailCoach')}</SectionTitle>
      <Card>
        {rows.map((row) => (
          <CoachCard
            key={row.id}
            signal={recommendationAsSignal(row)}
            tone={row.status === 'pending' && row.nextLoadKg !== undefined ? 'objective' : 'signal'}
            variant="row"
            exerciseName={names.get(row.exerciseId) ?? t('history.deletedExercise')}
            statusLabel={statusLabel(row.status)}
            {...(row.resolvedAt === undefined
              ? {}
              : { dateLabel: shortDate.format(row.resolvedAt) })}
          />
        ))}
      </Card>
    </section>
  );
}
