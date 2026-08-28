import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { getExercise } from '@/data/repositories/exercises';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { getOneRepMaxFormula } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { metricLabel, metricReading, periodLabel } from '@/i18n/labels';
import {
  availableMetrics,
  metricSeries,
  type MetricKey,
} from '@/lib/analytics/metrics';
import { PERIOD_KEYS, periodBounds, type PeriodKey } from '@/lib/analytics/periods';
import { toAnalyticsSessions } from '@/lib/analytics/sessions';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { ChartExportAction } from './ChartExportAction';
import { ProgressCard } from './ProgressCard';

/**
 * RF-41 — how one exercise has moved, in the metric its own measurement type
 * allows. Cf. `docs/superpowers/specs/2026-07-28-analytics-exercise-progress-design.md`.
 *
 * Every rule about *what counts* lives in `lib/analytics/` and every rule about
 * *what is read* lives in `listHistoricalWorkouts`; this screen orchestrates and
 * displays, which is all §7 of the architecture lets it do.
 */

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function ExerciseAnalyticsScreen() {
  const { exerciseId = '' } = useParams();
  const navigate = useAppNavigate();

  const [metricOpen, setMetricOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  /** Read once: the bounds must not slide under the reader at midnight. */
  const [openedAt] = useState(() => Date.now());

  /**
   * Keyed on the exercise, because **React Router does not remount on a param
   * change**: walking from one exercise's chart to another keeps this component
   * mounted, and with it a selection that belonged to somebody else's curve.
   * Found by driving it — the plank opened on 2 June because that is where the
   * bench press had been tapped.
   *
   * The period survives on purpose: it is the window you are reading in, not a
   * property of the exercise. The metric and the selection do not — one is
   * decided by the measurement type, the other points at a session that may not
   * even exist here. Same idiom as `ExerciseDetailScreen`'s draft.
   */
  const chartRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{
    exerciseId: string;
    period: PeriodKey;
    metricKey?: MetricKey;
    selectedIndex?: number;
  }>(() => ({ exerciseId, period: '12w' }));

  if (view.exerciseId !== exerciseId) setView({ exerciseId, period: view.period });

  const { period, metricKey, selectedIndex } = view;
  const setSelectedIndex = (index: number | undefined) =>
    setView((current) => ({ ...current, selectedIndex: index }));

  const exercise = useLiveQuery(async () => (await getExercise(exerciseId)) ?? null, [exerciseId]);
  const formula = useLiveQuery(() => getOneRepMaxFormula(), []);
  const sources = useLiveQuery(() => {
    const { from, to } = periodBounds(period, openedAt);
    return listHistoricalWorkouts({
      kind: 'exercise',
      exerciseId,
      from,
      to,
    });
  }, [exerciseId, period, openedAt]);

  if (exercise === null) {
    return (
      <Screen title={t('exercise.notFound')} onBack={() => void navigate(-1)}>
        <span />
      </Screen>
    );
  }

  const sessions = sources === undefined ? [] : toAnalyticsSessions(sources);

  /**
   * The metrics offered come from the **most recent session's** measurement
   * type, not the library's: this screen reads history, and the history is what
   * the snapshot preserved. An exercise retyped last week must not relabel the
   * months before it.
   */
  const type =
    [...sessions].reverse().find((session) => session.measurementType !== undefined)
      ?.measurementType ?? exercise?.measurementType;

  const metrics = availableMetrics(type);
  const metric = metrics.find((candidate) => candidate.key === metricKey) ?? metrics[0];
  const loading = exercise === undefined || sources === undefined || formula === undefined;
  const points =
    metric === undefined || formula === undefined ? [] : metricSeries(metric.key, sessions, formula);
  const selected = Math.min(selectedIndex ?? points.length - 1, points.length - 1);

  // The selection belongs to a point that may not exist in the new slice.
  const changePeriod = (next: PeriodKey) =>
    setView((current) => ({ ...current, period: next, selectedIndex: undefined }));

  return (
    <Screen title={exercise?.name ?? ''} onBack={() => void navigate(-1)}>
      <div className="space-y-7" aria-busy={loading}>
        {/* One filter row, above everything it scopes — never inside the chart
            card, where a control reads as part of the drawing. */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {metric !== undefined && (
            <FilterChip
              label={metricLabel(metric.key)}
              active={false}
              onClick={() => setMetricOpen(true)}
            />
          )}
          <FilterChip
            label={periodLabel(period)}
            active={false}
            onClick={() => setPeriodOpen(true)}
          />
        </div>

        {loading ? null : metric === undefined ? (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('analytics.noMetric')}</p>
          </Card>
        ) : points.length === 0 ? (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t('analytics.emptyPeriod')}
            </p>
            {period !== 'all' && (
              <button
                type="button"
                onClick={() => changePeriod('all')}
                className="mt-3 min-h-12 text-base font-semibold text-[var(--accent-ink)]"
              >
                {t('analytics.emptyPeriodAction')}
              </button>
            )}
          </Card>
        ) : (
          <div>
            <div ref={chartRef}>
              <ProgressCard
                metric={metric}
                points={points}
                selectedIndex={selected}
                onSelect={setSelectedIndex}
                stale={sources === undefined}
              />
            </div>
            <ChartExportAction
              chartRef={chartRef}
              slug="progression"
              title={exercise?.name ?? t('analytics.title')}
              subtitle={`${metricLabel(metric.key)} · ${periodLabel(period)}`}
            />
          </div>
        )}

        {/* The accessible table. Not a hidden twin of the chart: it is the same
            session list the exercise sheet already shows, and it holds every
            value, so nothing is reachable through the drawing alone. */}
        {points.length > 0 && metric !== undefined && (
          <section>
            <SectionTitle>{t('analytics.sessionsSection')}</SectionTitle>
            <Card>
              {[...points].reverse().map((point) => {
                const index = points.indexOf(point);
                return (
                  <ListRow
                    key={point.workoutId}
                    title={longDate(point.timestamp)}
                    onClick={() => setSelectedIndex(index)}
                    trailing={
                      <span
                        className={`metric text-base font-semibold ${
                          index === selected ? 'text-[var(--text-1)]' : 'text-[var(--text-2)]'
                        }`}
                      >
                        {metricReading(point.value, metric.unit, metric.key)}
                      </span>
                    }
                  />
                );
              })}
            </Card>
          </section>
        )}
      </div>

      {metric !== undefined && (
        <OptionSheet
          open={metricOpen}
          onClose={() => setMetricOpen(false)}
          title={t('analytics.metricSheetTitle')}
          value={metric.key}
          options={metrics.map((candidate) => ({
            value: candidate.key,
            label: metricLabel(candidate.key),
          }))}
          onSelect={(key) =>
            setView((current) => ({ ...current, metricKey: key, selectedIndex: undefined }))
          }
        />
      )}

      <OptionSheet
        open={periodOpen}
        onClose={() => setPeriodOpen(false)}
        title={t('analytics.periodSheetTitle')}
        value={period}
        options={PERIOD_KEYS.map((key) => ({ value: key, label: periodLabel(key) }))}
        onSelect={changePeriod}
      />
    </Screen>
  );
}
