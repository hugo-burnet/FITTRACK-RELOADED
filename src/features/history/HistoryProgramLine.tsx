import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { getProgramHeader } from '@/data/repositories/programs';
import type { Workout } from '@/data/types';
import { t } from '@/i18n/fr';
import { phaseLabel } from '@/features/programs/weekReading';
import { Card, ListRow } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';

/**
 * La ligne de contexte d'une séance née d'un programme : « Semaine 2 / 6 · Progression » sous le nom du
 * programme, qui mène à sa fiche.
 *
 * Absente quand la séance n'a pas de programme. La phase est un instantané pris à la création : une séance
 * d'avant l'instantané n'en a pas, et la ligne se contente alors de la semaine. Un programme supprimé garde
 * sa ligne (la séance, elle, en vient bien) mais ne mène nulle part.
 */
export function HistoryProgramLine({ workout }: { workout: Workout }) {
  const navigate = useAppNavigate();
  const programId = workout.programId;
  // `null` = supprimé ; `undefined` = lecture en cours : on n'affiche rien plutôt qu'un « supprimé » qui saute.
  const header = useLiveQuery(
    () => (programId === undefined || programId === '' ? null : getProgramHeader(programId)),
    [programId],
  );

  if (programId === undefined || programId === '' || header === undefined) return null;

  const week = workout.programWeekIndex;
  const weekReading =
    week === undefined
      ? undefined
      : header === null
        ? t('history.programWeekOnly', { current: week + 1 })
        : t('program.progressWeek', { current: week + 1, total: header.durationWeeks });
  const subtitle = [
    weekReading,
    workout.programPhase === undefined ? undefined : phaseLabel(workout.programPhase),
  ]
    .filter((part): part is string => part !== undefined)
    .join(' · ');

  return (
    <Card>
      <ListRow
        title={header === null ? t('history.programDeleted') : header.name}
        {...(subtitle === '' ? {} : { subtitle })}
        {...(header === null
          ? {}
          : {
              onClick: () => void navigate(`/programs/${header.id}`),
              trailing: <ChevronRightIcon />,
            })}
      />
    </Card>
  );
}
