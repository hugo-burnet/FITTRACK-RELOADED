import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { listRecordsForWorkout } from '@/data/repositories/personalRecords';
import type { RecordTimelineEntry } from '@/data/repositories/recordTimeline';
import { t } from '@/i18n/fr';
import { exerciseDisplayName, recordGain, recordLabel, recordValue } from '@/i18n/labels';
import { Card, ListRow, SectionTitle } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';

/** Les records d'une séance, regroupés par exercice dans l'ordre où la chronologie les rend. */
function groupByExercise(entries: readonly RecordTimelineEntry[]): RecordTimelineEntry[][] {
  const groups = new Map<string, RecordTimelineEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.record.exerciseId);
    if (group === undefined) groups.set(entry.record.exerciseId, [entry]);
    else group.push(entry);
  }
  return [...groups.values()];
}

/**
 * « Records de cette séance » : ce que la séance a battu, une carte par exercice, chaque ligne ouvrant la
 * page de l'exercice. Sans record, ni titre ni carte — une section vide n'a rien à dire.
 */
export function HistoryRecords({ workoutId }: { workoutId: string }) {
  const navigate = useAppNavigate();
  const entries = useLiveQuery(() => listRecordsForWorkout(workoutId), [workoutId]);

  if (entries === undefined || entries.length === 0) return null;

  return (
    <section>
      <SectionTitle>{t('history.detailRecords')}</SectionTitle>
      <div className="space-y-4">
        {groupByExercise(entries).map((group) => {
          const first = group[0]!;
          const exerciseId = first.record.exerciseId;
          return (
            <Card key={exerciseId}>
              <h3 className="border-b border-[var(--border)] px-4 py-3 text-base font-semibold text-[var(--text-1)]">
                {exerciseDisplayName(first.exerciseName, first.isUnilateral)}
              </h3>
              {group.map((entry) => {
                const gain = recordGain(entry.record, entry.previousValue);
                return (
                  <ListRow
                    key={entry.record.id}
                    title={recordLabel(entry.record.type)}
                    subtitle={[recordValue(entry.record), gain]
                      .filter((part): part is string => part !== undefined)
                      .join(' · ')}
                    onClick={() => void navigate(`/exercises/${exerciseId}`)}
                    trailing={<ChevronRightIcon />}
                  />
                );
              })}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
