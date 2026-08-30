import { useAppNavigate } from '@/app/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { listMilestones } from '@/data/repositories/milestones';
import { t } from '@/i18n/fr';
import type { MilestoneGroup } from '@/lib/milestones/types';
import { Card, EmptyState, SectionTitle } from '@/ui';
import { MilestoneToken } from './MilestoneToken';
import { milestoneReading, type MilestoneReading } from './milestoneCopy';

const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** L'ordre de lecture des rayons, et non un classement : aucun ne vaut plus. */
const GROUPS: MilestoneGroup[] = ['strength', 'gateway', 'practice', 'volume'];

interface Line extends MilestoneReading {
  id: string;
  achievedAt: number;
}

/**
 * Le mur des paliers — et uniquement ce qui est acquis.
 *
 * **Rien de ce qui manque n'est montré, et c'est une décision.** Une liste
 * grisée de tout ce qu'on n'a pas encore fait transformerait la pratique en
 * liste de courses, avec en tête « Soulevé de terre à 220 kg » que la plupart
 * des gens ne franchiront jamais. On lit ici ce qu'on a fait ; ce qui vient
 * arrive sans prévenir, ce qui est exactement la façon dont ça arrive vraiment.
 *
 * L'écran ne calcule rien : la projection est écrite en base à la fin de chaque
 * séance, donc il n'y a ici ni moteur, ni relecture de l'historique.
 */
export function MilestonesScreen() {
  const navigate = useAppNavigate();
  const rows = useLiveQuery(listMilestones, []);

  const lines: Line[] = (rows ?? []).flatMap((row) => {
    const reading = milestoneReading(row.definitionId, row.value);
    // Un palier retiré du catalogue garde sa ligne en base mais n'a plus de
    // phrase : le sauter vaut mieux qu'afficher son identifiant.
    return reading === undefined ? [] : [{ ...reading, id: row.id, achievedAt: row.achievedAt }];
  });

  return (
    <Screen title={t('milestone.title')} onBack={() => void navigate(-1)}>
      {rows !== undefined && lines.length === 0 ? (
        <EmptyState title={t('milestone.emptyTitle')} body={t('milestone.emptyBody')} />
      ) : (
        <div className="space-y-7">
          {GROUPS.map((group) => {
            const inGroup = lines.filter((line) => line.group === group);
            if (inGroup.length === 0) return null;

            return (
              <section key={group}>
                <SectionTitle>{t(`milestone.group.${group}` as const)}</SectionTitle>
                <Card>
                  {inGroup.map((line) => (
                    <div
                      key={line.id}
                      className="flex min-h-16 items-center gap-3 border-b border-[var(--border)]
                        px-4 py-3 last:border-b-0"
                    >
                      <MilestoneToken value={line.token} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-[var(--text-1)]">{line.title}</p>
                        <p className="mt-0.5 text-sm text-[var(--text-2)]">
                          {/* La date d'abord, parce que c'est elle qu'on relit :
                              un palier est un souvenir daté, pas une statistique. */}
                          {t('milestone.achievedOn', { date: longDate.format(line.achievedAt) })}
                          {line.reached !== undefined && ` · ${line.reached}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
