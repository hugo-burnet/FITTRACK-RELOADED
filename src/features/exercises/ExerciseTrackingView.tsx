import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { listRecommendationsForExercise } from '@/data/repositories/coachRecommendations';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { benchmarkIdsAmong } from '@/data/repositories/workoutKinds';
import { listCurrentRecordsForExercise } from '@/data/repositories/personalRecords';
import { getOneRepMaxFormula } from '@/data/repositories/settings';
import type { CoachRecommendation, Exercise, PersonalRecord } from '@/data/types';
import { t } from '@/i18n/fr';
import { metricLabel, metricReading, recordLabel, recordValue } from '@/i18n/labels';
import { availableMetrics, metricSeries } from '@/lib/analytics/metrics';
import { toAnalyticsSessions } from '@/lib/analytics/sessions';
import {
  exerciseSessions,
  lastTimeSession,
  lastTimeSummary,
  progressTrend,
  splitReading,
  type ExerciseSessionSummary,
} from '@/lib/exerciseTracking';
import { periodCovering } from '@/lib/analytics/periods';
import { measurementShape } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
import { CoachCard } from '@/features/workout/CoachCard';
import { recommendationAsSignal } from '@/features/workout/coachCopy';
import { Card, ListRow, SectionTitle, Sparkline, Tile, TileGrid } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import { topSetLabel } from './topSet';

/** Les points que la mini-courbe garde : assez pour une tendance, trop peu pour se lire comme un historique. */
const TREND_SIZE = 12;

const longDate = (epochMs: number): string =>
  new Date(epochMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** « lun. 16 nov. » — dans une phrase de tuile, l'année est inutile. */
const shortDate = (epochMs: number): string =>
  new Date(epochMs).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const setsLabel = (count: number): string =>
  count === 1 ? t('exercise.historySetCountOne') : t('exercise.historySetCount', { count });

function coachStatusLabel(status: CoachRecommendation['status']): string {
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
 * L'onglet Suivi de la fiche : de haut en bas, les repères, la courbe, la parole
 * du coach, les séances. Une section sans contenu n'est pas dessinée.
 *
 * Les séances (dernière fois, courbe, liste) viennent toutes d'une seule lecture,
 * `listHistoricalWorkouts` — cf. `lib/exerciseTracking`. Les records, eux, sont
 * la projection persistée : ce qu'une séance « vaut » n'est pas ce que le moteur
 * de records a retenu, et la page ne les recalcule pas.
 */
export function ExerciseTrackingView({ exercise }: { exercise: Exercise }) {
  const navigate = useAppNavigate();
  const reading = useLiveQuery(async () => {
    const workouts = await listHistoricalWorkouts({ kind: 'exercise', exerciseId: exercise.id });
    // Les séances test servent la courbe et la liste, pas « La dernière fois ».
    const benchmarks = await benchmarkIdsAmong(workouts.map((workout) => workout.workoutId));
    return { workouts, benchmarks };
  }, [exercise.id]);
  const history = reading?.workouts;
  const formula = useLiveQuery(() => getOneRepMaxFormula(), []);
  const records = useLiveQuery(() => listCurrentRecordsForExercise(exercise.id), [exercise.id]);
  const coachHistory = useLiveQuery(
    () => listRecommendationsForExercise(exercise.id),
    [exercise.id],
  );

  if (
    reading === undefined ||
    history === undefined ||
    formula === undefined ||
    records === undefined ||
    coachHistory === undefined
  ) {
    return <span />;
  }

  const sessions = exerciseSessions(history);
  const analyticsSessions = toAnalyticsSessions(history);
  // Comme la vue plein écran : le type de la dernière séance, que l'instantané a
  // gardé, avant celui de la bibliothèque d'aujourd'hui.
  const type =
    [...analyticsSessions].reverse().find((session) => session.measurementType !== undefined)
      ?.measurementType ?? exercise.measurementType;
  const metric = availableMetrics(type)[0];
  const trend =
    metric === undefined
      ? undefined
      : progressTrend(metricSeries(metric.key, analyticsSessions, formula), TREND_SIZE);

  const openWorkout = (workoutId: string) => void navigate(`/history/${workoutId}`);
  // La page parle de deux « meilleures séries » : la tuile suit le record (le plus
  // de poids × reps), les lignes suivent la série la plus lourde de chaque séance.
  // Les lignes disent laquelle, pour ne pas se contredire en silence.
  const openFullScreen = () => {
    const first = trend?.window[0];
    const period = first === undefined ? undefined : periodCovering(first.timestamp, Date.now());
    void navigate(
      `/analytics/exercises/${exercise.id}${period === undefined ? '' : `?periode=${period}`}`,
    );
  };
  const openRecords = () =>
    void navigate(`/analytics/records?exerciseId=${encodeURIComponent(exercise.id)}`);

  const latest = lastTimeSession(sessions, reading.benchmarks);
  const byType = new Map<PersonalRecord['type'], PersonalRecord>(
    records.map(({ record }) => [record.type, record]),
  );
  const maxWeight = byType.get('max_weight');
  const oneRepMax = byType.get('best_1rm');
  const bestSet = byType.get('max_volume_set');
  const otherRecords = records.filter(
    ({ record }) => !['max_weight', 'best_1rm', 'max_volume_set'].includes(record.type),
  );

  const lastTime = latest === undefined ? undefined : lastTimeTile(latest, type);
  const hasMarkers = lastTime !== undefined || records.length > 0;

  return (
    <>
      {hasMarkers && (
        <TileGrid title={t('exercise.markersSection')}>
          {lastTime !== undefined && (
            <Tile
              size="L"
              label={t('exercise.lastTime')}
              value={lastTime.value}
              detail={lastTime.detail}
              onClick={() => openWorkout(latest!.workoutId)}
              hint={t('exercise.seeWorkout')}
            />
          )}
          {maxWeight !== undefined && (
            <Tile
              size="S"
              label={recordLabel(maxWeight.type)}
              value={splitReading(recordValue(maxWeight))}
              onClick={openRecords}
              hint={t('exercise.recordsHint')}
            />
          )}
          {oneRepMax !== undefined && (
            <Tile
              size="S"
              label={recordLabel(oneRepMax.type)}
              value={splitReading(recordValue(oneRepMax))}
              onClick={openRecords}
              hint={t('exercise.recordsHint')}
            />
          )}
          {bestSet !== undefined && (
            <Tile
              size="L"
              label={t('exercise.bestSet')}
              /* Écrite poids × reps : le chiffre du record est un tonnage (640 kg)
                 qui se lirait comme une charge, il passe dans le détail — en kg,
                 pas dans `recordValue`, qui redit la série. */
              value={{
                value:
                  bestSet.weight !== undefined && bestSet.reps !== undefined
                    ? t('exercise.recordWeightReps', {
                        weight: bestSet.weight.toLocaleString('fr-FR'),
                        reps: bestSet.reps,
                      })
                    : recordValue(bestSet),
              }}
              detail={t('exercise.bestSetDetail', {
                volume: t('exercise.recordWeight', {
                  weight: (Math.round(bestSet.value * 100) / 100).toLocaleString('fr-FR'),
                }),
                date: shortDate(bestSet.achievedAt),
              })}
              onClick={openRecords}
              hint={t('exercise.recordsHint')}
            />
          )}
          {otherRecords.map(({ record }) => (
            <Tile
              key={record.id}
              size="S"
              label={recordLabel(record.type)}
              value={splitReading(recordValue(record))}
              onClick={openRecords}
              hint={t('exercise.recordsHint')}
            />
          ))}
        </TileGrid>
      )}

      {metric !== undefined && trend !== undefined && (
        <TileGrid title={t('exercise.progressionSection')}>
          <Tile
            size="G"
            label={
              trend.window.length === 1
                ? t('exercise.progressionLabelOne', { metric: metricLabel(metric.key) })
                : t('exercise.progressionLabel', {
                    metric: metricLabel(metric.key),
                    count: trend.window.length,
                  })
            }
            value={splitReading(metricReading(trend.last.value, metric.unit, metric.key))}
            detail={progressDetail(trend.delta, trend.since, metric.unit, metric.key)}
            onClick={openFullScreen}
            hint={t('exercise.progressionHint')}
          >
            <Sparkline values={trend.window.map((point) => point.value)} />
          </Tile>
        </TileGrid>
      )}

      {coachHistory.length > 0 && (
        <section>
          <SectionTitle>{t('exercise.coachSection')}</SectionTitle>
          <Card>
            {coachHistory.map((row) => (
              <CoachCard
                key={row.id}
                signal={recommendationAsSignal(row)}
                tone={
                  row.status === 'pending' && row.nextLoadKg !== undefined ? 'objective' : 'signal'
                }
                variant="row"
                dateLabel={longDate(row.recommendedAt)}
                statusLabel={coachStatusLabel(row.status)}
                onOpen={
                  row.sourceWorkoutId === undefined
                    ? undefined
                    : () => openWorkout(row.sourceWorkoutId!)
                }
              />
            ))}
          </Card>
        </section>
      )}

      {sessions.length > 0 ? (
        <section>
          <SectionTitle>{t('exercise.sessionsSection')}</SectionTitle>
          <Card>
            {sessions.map((session) => (
              <ListRow
                key={session.workoutId}
                title={longDate(session.startedAt)}
                // Séries de travail seulement : ce nombre et la série à côté
                // décrivent les mêmes séries.
                subtitle={sessionSubtitle(session.sets.filter(isWorkingSet).length, type)}
                onClick={() => openWorkout(session.workoutId)}
                trailing={
                  <span className="flex items-center gap-2">
                    {/* Tabulaire et à droite : la progression se lit en
                        descendant la colonne, pas série par série. */}
                    <span className="metric text-base font-semibold text-[var(--text-1)]">
                      {topSetLabel(session.sets, type)}
                    </span>
                    <ChevronRightIcon />
                  </span>
                }
              />
            ))}
          </Card>
        </section>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('exercise.historyEmpty')}</p>
      )}
    </>
  );
}

function lastTimeTile(session: ExerciseSessionSummary, type: Exercise['measurementType']) {
  const summary = lastTimeSummary(session.sets);
  const date = shortDate(session.startedAt);
  const sets = setsLabel(summary.setCount);

  // Sur une machine assistée, la charge est une aide : « 20 kg » se lirait comme
  // 20 kg soulevés.
  const assisted = measurementShape(type).weightRole === 'assist';

  if (summary.weight !== undefined) {
    return {
      value: {
        value: summary.weight.toLocaleString('fr-FR'),
        unit: assisted ? t('exercise.lastTimeAssistUnit') : t('units.kg'),
      },
      detail: t('exercise.lastTimeUniform', { sets, reps: summary.reps.join(' · '), date }),
    };
  }

  // Charges variées, ou ni charge ni reps (planche, course) : la meilleure série
  // est la seule lecture honnête d'un chiffre unique.
  return {
    value: {
      value: topSetLabel(session.sets, type) ?? '—',
      ...(assisted ? { unit: t('exercise.lastTimeAssistSuffix') } : {}),
    },
    detail: t('exercise.lastTimePlain', { sets, date }),
  };
}

/** « 3 séries · la plus lourde » — nomme la série que la ligne montre à droite. */
function sessionSubtitle(count: number, type: Exercise['measurementType']): string {
  const role = measurementShape(type).weightRole;
  if (role === undefined) return setsLabel(count);
  return t('exercise.sessionSubtitle', {
    sets: setsLabel(count),
    best: role === 'assist' ? t('exercise.topSetLeastAssisted') : t('exercise.topSetHeaviest'),
  });
}

function progressDetail(
  delta: number | undefined,
  since: number,
  unit: Parameters<typeof metricReading>[1],
  key: Parameters<typeof metricReading>[2],
): string | undefined {
  if (delta === undefined) return undefined;
  const date = shortDateNoWeekday(since);
  if (delta === 0) return t('exercise.progressionFlat', { date });
  const sign = delta > 0 ? '+' : '−';
  return t('exercise.progressionSince', {
    delta: `${sign}${metricReading(Math.abs(delta), unit, key)}`,
    date,
  });
}

/** « 19 oct. » — l'écart se dit depuis un jour, le jour de la semaine n'y apporte rien. */
const shortDateNoWeekday = (epochMs: number): string =>
  new Date(epochMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
