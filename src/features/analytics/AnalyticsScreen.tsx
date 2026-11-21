import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { useExerciseLinks } from '@/app/useExerciseLinks';
import { Screen } from '@/app/Screen';
import { listVolumeLow } from '@/data/repositories/coachVolume';
import { getActiveProgramProjection } from '@/data/repositories/home';
import { listMeasurementTypes } from '@/data/repositories/measurements';
import { listMilestones } from '@/data/repositories/milestones';
import { listRecordTimeline } from '@/data/repositories/personalRecords';
import { getCoachVolumeBounds, getWeeklyTrainingGoalHistory } from '@/data/repositories/settings';
import { phaseLabel } from '@/features/programs/weekReading';
import { volumeLowLine } from '@/features/settings/volumeText';
import { t } from '@/i18n/fr';
import {
  measurementChangeReading,
  measurementReading,
  measurementUnitLabel,
  muscleLabel,
  recordValue,
  weeklyVolumeReading,
} from '@/i18n/labels';
import {
  programEndDate,
  splitReading,
  weekSessions,
  weekTonnage,
  weightChange,
} from '@/lib/analytics/dashboard';
import { weeklyVolumeBuckets } from '@/lib/analytics/volume';
import { weeklySessionCounts } from '@/lib/analytics/weeks';
import { Card, ListRow, SectionTitle, Sparkline, Tile, TileGrid } from '@/ui';
import { formatNumber } from '@/ui/numberField';
import { latestRecordLine } from './progressionText';
import { useHistoricalPeriod } from './useHistoricalPeriod';

const BODY_WEIGHT_TYPE = 'body_weight';

const endFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/**
 * Le tableau de bord : des chiffres à lire, chacun ouvre l'écran qui les détaille (DESIGN.md › « Tuile ou
 * ligne »). Trois groupes de tuiles, puis la ligne du rapport mensuel.
 *
 * **Une seule semaine.** Le tonnage et les séances viennent de `weeklyVolumeBuckets` et `weeklySessionCounts`
 * — les fonctions des écrans Volume et Séances par semaine, qui rangent une séance dans la semaine de **son**
 * fuseau (`weekStartOf`) — sur la même lecture de tout l'historique. La tuile et la page disent le même nombre.
 *
 * Sans séance terminée, ce qui n'a de sens qu'avec un historique (tonnage, séances, muscles, rapport) n'est
 * pas offert, comme avant : les écrans qu'ouvraient ces lignes n'auraient eu que douze barres à zéro.
 * Les records, les paliers et le poids n'en demandent aucune : leurs écrans savent dire pourquoi ils sont vides.
 */
export function AnalyticsScreen() {
  const navigate = useAppNavigate();
  // Lu une fois : les bornes ne glissent pas sous la lecture à minuit.
  const [openedAt] = useState(() => Date.now());
  const history = useHistoricalPeriod('all', openedAt);
  const goals = useLiveQuery(getWeeklyTrainingGoalHistory, []);
  const program = useLiveQuery(() => getActiveProgramProjection(), []);
  const timeline = useLiveQuery(() => listRecordTimeline(), []);
  const hasPage = useExerciseLinks();
  const milestones = useLiveQuery(() => listMilestones(), []);
  const lows = useLiveQuery(async () => {
    try {
      return await listVolumeLow();
    } catch {
      // Une requête vive qui rejette remplacerait tout l'écran par l'écran d'erreur : sans lecture, 0.
      return [];
    }
  }, []);
  const bounds = useLiveQuery(() => getCoachVolumeBounds(), []);
  const measured = useLiveQuery(() => listMeasurementTypes(), []);

  // Sans plancher réglé, « 0 » laisserait croire que tout va bien : il n'y a rien qu'on surveille.
  const floorsSet =
    bounds === undefined
      ? undefined
      : Object.values(bounds).some((entry) => entry.floor !== undefined);

  const data = history.data;
  const hasHistory = data === undefined ? undefined : data.workouts.length > 0;

  const tonnage =
    data === undefined
      ? undefined
      : weekTonnage(weeklyVolumeBuckets(data.workouts, data.bounds, data.hasEarlierHistory));
  const sessions =
    data === undefined || goals === undefined
      ? undefined
      : weekSessions(
          weeklySessionCounts(
            data.workouts.map((workout) => ({
              startedAt: workout.startedAt,
              ...(workout.timezoneOffsetMinutes === undefined
                ? {}
                : { timezoneOffsetMinutes: workout.timezoneOffsetMinutes }),
            })),
            data.bounds,
            goals,
            data.hasEarlierHistory,
          ),
        );

  const latestRecord = timeline?.[0];
  const body = measured?.find((entry) => entry.type === BODY_WEIGHT_TYPE);
  const bodyChange =
    body === undefined ? undefined : weightChange(body.latest.value, body.previous?.value);

  const showWeek = hasHistory !== false || (program !== undefined && program !== null);

  return (
    // Plus de flèche de retour : cet écran est la racine d'un onglet, et une flèche sur une racine
    // d'onglet promet un ailleurs qui n'existe pas.
    <Screen title={t('analytics.title')}>
      <div className="space-y-7">
        {showWeek && (
          <TileGrid title={t('analytics.weekSection')}>
            {hasHistory !== false && (
              <Tile
                key="tonnage"
                size="G"
                label={t('analytics.tonnageLabel')}
                value={
                  tonnage === undefined
                    ? undefined
                    : tonnage === null
                      ? null
                      : splitReading(weeklyVolumeReading(tonnage.current, 'tonnage'))
                }
                detail={
                  tonnage
                    ? // Le nombre réel de semaines : trois semaines d'historique, une moyenne sur trois.
                      t(
                        tonnage.averageWeeks === 1
                          ? 'analytics.tonnageDetailOne'
                          : 'analytics.tonnageDetail',
                        {
                          weeks: tonnage.averageWeeks,
                          average: weeklyVolumeReading(tonnage.average, 'tonnage'),
                        },
                      )
                    : undefined
                }
                hint={t('analytics.tonnageHint')}
                onClick={() => void navigate('/analytics/volume')}
              >
                {/* La semaine en cours n'est pas finie : son segment est en pointillé. */}
                {tonnage ? <Sparkline values={tonnage.series} partialLast /> : null}
              </Tile>
            )}
            {hasHistory !== false && (
              <Tile
                key="sessions"
                // Toujours `L` : une `S` seule sur sa rangée (G, S, puis le programme en `L`) s'étirerait
                // sur deux colonnes pour un seul chiffre. Le `detail` dit ce que le chiffre ne dit pas.
                size="L"
                label={t('analytics.sessionsLabel')}
                value={
                  sessions === undefined
                    ? undefined
                    : sessions === null
                      ? null
                      : sessions.goal === null
                        ? { value: String(sessions.done), caption: t('analytics.sessionsCaption') }
                        : {
                            value: `${sessions.done} / ${sessions.goal}`,
                            caption: t('analytics.sessionsCaption'),
                            spoken: t('analytics.sessionsSpoken', {
                              done: sessions.done,
                              goal: sessions.goal,
                            }),
                          }
                }
                {...(sessions === undefined || sessions === null
                  ? {}
                  : {
                      detail:
                        sessions.goal === null
                          ? t('analytics.sessionsNoGoal')
                          : sessions.streak === 0
                            ? t('analytics.streakNone')
                            : t(
                                sessions.streak === 1
                                  ? 'analytics.streakLineOne'
                                  : 'analytics.streakLineMany',
                                {
                                  weeks: sessions.streak,
                                },
                              ),
                    })}
                hint={t('analytics.sessionsHint')}
                onClick={() => void navigate('/analytics/weekly')}
              />
            )}
            {program !== undefined && program !== null && (
              <Tile
                key="program"
                size="L"
                label={t('analytics.programLabel')}
                value={
                  program.week === null
                    ? null
                    : {
                        value: t('analytics.programValue', {
                          current: program.week.weekIndex + 1,
                          total: program.durationWeeks,
                        }),
                        spoken: t('home.programWeek', {
                          current: program.week.weekIndex + 1,
                          total: program.durationWeeks,
                        }),
                      }
                }
                detail={
                  program.week === null
                    ? t('analytics.programDetailNoWeek', {
                        name: program.programName,
                        date: endFormatter.format(
                          programEndDate(program.startsAt, program.durationWeeks),
                        ),
                      })
                    : t('analytics.programDetail', {
                        name: program.programName,
                        phase: phaseLabel(program.week.phase),
                        level: program.week.loadIndex,
                        date: endFormatter.format(
                          programEndDate(program.startsAt, program.durationWeeks),
                        ),
                      })
                }
                hint={t('analytics.programHint')}
                onClick={() => void navigate(`/programs/${program.programId}`)}
              />
            )}
          </TileGrid>
        )}

        <TileGrid title={t('analytics.recordsSection')}>
          <Tile
            key="latest"
            size="L"
            label={t('analytics.latestRecordLabel')}
            value={
              timeline === undefined
                ? undefined
                : latestRecord === undefined
                  ? null
                  : splitReading(recordValue(latestRecord.record))
            }
            {...(latestRecord === undefined ? {} : { detail: latestRecordLine(latestRecord) })}
            hint={t('analytics.latestRecordHint')}
            onClick={() =>
              void navigate(
                latestRecord === undefined
                  ? '/analytics/records'
                  : hasPage(latestRecord.record.exerciseId)
                    ? `/exercises/${latestRecord.record.exerciseId}`
                    : // Exercice supprimé : sa fiche n'existe plus, la séance du record, si.
                      `/history/${latestRecord.record.workoutId}`,
              )
            }
          />
          <Tile
            key="records"
            size="S"
            label={t('analytics.recordsCountLabel')}
            value={timeline === undefined ? undefined : { value: String(timeline.length) }}
            hint={t('analytics.recordsCountHint')}
            onClick={() => void navigate('/analytics/records?vue=chronologie')}
          />
          <Tile
            key="milestones"
            size="S"
            label={t('analytics.milestonesLabel')}
            value={milestones === undefined ? undefined : { value: String(milestones.length) }}
            hint={t('analytics.milestonesHint')}
            onClick={() => void navigate('/analytics/milestones')}
          />
        </TileGrid>

        <TileGrid title={t('analytics.bodySection')}>
          {hasHistory !== false && (
            <Tile
              key="floor"
              size="L"
              label={t('analytics.floorLabel')}
              value={
                lows === undefined || floorsSet === undefined
                  ? undefined
                  : floorsSet
                    ? { value: String(lows.length) }
                    : null
              }
              {...(floorsSet === false
                ? { detail: t('analytics.floorUnset') }
                : lows === undefined
                  ? {}
                  : lows.length === 0
                    ? { detail: t('analytics.floorClear') }
                    : {
                        detail:
                          lows.length === 1
                            ? volumeLowLine(lows[0]!)
                            : t('analytics.floorMany', {
                                muscles: lows.map((low) => muscleLabel(low.muscle)).join(', '),
                              }),
                      })}
              hint={floorsSet === false ? t('analytics.floorUnsetHint') : t('analytics.floorHint')}
              // Les planchers se règlent et se lisent dans Volume par muscle ; la répartition par
              // muscle (`/analytics/muscles`) ne parle pas de plancher.
              onClick={() => void navigate('/settings/volume')}
            />
          )}
          <Tile
            key="weight"
            size="L"
            label={t('analytics.weightLabel')}
            value={
              measured === undefined
                ? undefined
                : body === undefined
                  ? null
                  : {
                      value: formatNumber(Math.round(body.latest.value * 100) / 100),
                      unit: measurementUnitLabel(body.latest.unit),
                    }
            }
            {...(body === undefined || bodyChange === undefined || body.previous === undefined
              ? {}
              : {
                  detail: t('analytics.weightDetail', {
                    change: measurementChangeReading(bodyChange, body.unit),
                    previous: measurementReading(body.previous.value, body.unit),
                  }),
                })}
            hint={t('analytics.weightHint')}
            onClick={() => void navigate('/analytics/measurements')}
          />
        </TileGrid>

        {hasHistory !== false && (
          <section>
            <SectionTitle>{t('analytics.reviewsSection')}</SectionTitle>
            <Card>
              <ListRow
                title={t('monthly.link')}
                subtitle={t('monthly.subtitle')}
                onClick={() => void navigate('/analytics/months')}
              />
            </Card>
          </section>
        )}
      </div>
    </Screen>
  );
}
