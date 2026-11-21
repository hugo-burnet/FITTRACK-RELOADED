import type { ExerciseCurrentRecords } from '@/data/repositories/currentRecords';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import { t } from '@/i18n/fr';
import { exerciseDisplayName, recordContext, recordLabel, recordValue } from '@/i18n/labels';
import { Card, ListRow } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';

type Props = {
  groups: readonly ExerciseCurrentRecords[];
  onOpenExercise: (exerciseId: string) => void;
  /** Faux pour un exercice supprimé : il garde ses records, plus sa page. */
  canOpenExercise?: (exerciseId: string) => boolean;
  onOpenRecord: (entry: RecordTimelineEntry) => void;
};

const shortDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * « C'est quoi mon max ? » — par exercice, les seuls records encore debout.
 *
 * Une `Card` par exercice : son nom en tête de carte mène à la fiche, chaque
 * ligne dessous porte la valeur à droite et mène à la séance qui l'a établie.
 * La date reste en sous-titre : savoir que le 62,5 kg date de trois mois dit
 * déjà s'il est à battre.
 */
export function CurrentRecords({
  groups,
  onOpenExercise,
  canOpenExercise = () => true,
  onOpenRecord,
}: Props) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const name = exerciseDisplayName(group.exerciseName, group.isUnilateral);
        return (
          <Card key={group.exerciseId}>
            <ListRow
              title={name}
              {...(canOpenExercise(group.exerciseId)
                ? {
                    ariaLabel: t('records.openExercise', { exercise: name }),
                    onClick: () => onOpenExercise(group.exerciseId),
                    trailing: <ChevronRightIcon />,
                  }
                : {})}
            />
            {group.entries.map((entry) => {
              const context = recordContext(entry.record);
              const date = shortDate(entry.record.achievedAt);
              const value = recordValue(entry.record);
              return (
                <ListRow
                  key={entry.record.id}
                  title={recordLabel(entry.record.type)}
                  subtitle={context ? `${context} · ${date}` : date}
                  ariaLabel={t('records.openMark', {
                    exercise: name,
                    category: recordLabel(entry.record.type),
                    value,
                    date,
                  })}
                  onClick={() => onOpenRecord(entry)}
                  trailing={
                    <span className="record-figure text-base font-semibold text-[var(--text-1)]">
                      {value}
                    </span>
                  }
                />
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}
