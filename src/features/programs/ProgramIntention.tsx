import { Link } from 'react-router-dom';
import type { ProgramWeek } from '@/data/types';
import { t } from '@/i18n/fr';
import { Card, SectionTitle } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import { coachReadingKeys } from './coachReading';
import { phaseEvidenceFor } from './phaseEvidence';
import { WEEK_ROW_CLASS } from './programRowStyle';
import { loadRuleReading, weekLine } from './weekReading';

/**
 * L'intention de la semaine : ce qu'elle fait aux charges prescrites, puis ce
 * qu'elle change au coach. Les deux effets sont distincts — le niveau règle les
 * charges avant la séance, la phase règle ce que le coach propose après — et
 * c'est pourquoi la fiche les écrit l'un sous l'autre au lieu d'en faire un seul.
 */
export function ProgramIntention({
  week,
  nextWeek,
}: {
  week: ProgramWeek;
  nextWeek: ProgramWeek | undefined;
}) {
  const evidence = phaseEvidenceFor(week.phase);
  return (
    <section>
      <SectionTitle>{t('program.intentionTitle')}</SectionTitle>
      <Card>
        <div
          className={`flex flex-col gap-2 p-4 ${evidence === null ? '' : 'border-b border-[var(--border)]'}`}
        >
          <p
            className={`metric text-lg leading-7 font-semibold ${
              week.phase === 'deload' ? 'text-[var(--accent-ink)]' : 'text-[var(--text-1)]'
            }`}
          >
            {weekLine(week)}
          </p>
          <p className="text-base text-[var(--text-1)]">{loadRuleReading(week)}</p>
          <p className="text-sm text-[var(--text-2)]">{t('program.loadRule.hint')}</p>
          {week.notes && <p className="text-sm text-[var(--text-2)]">{week.notes}</p>}
          <hr className="mt-2 mb-1 border-[var(--border)]" />
          <h3 className="label-xs font-semibold text-[var(--text-2)]">
            {t('program.detailCoachTitle')}
          </h3>
          {coachReadingKeys(week.phase, nextWeek?.phase).map((key) => (
            <p key={key} className="text-base text-[var(--text-1)]">
              {t(key)}
            </p>
          ))}
        </div>
        {/* Ce que la littérature dit de la phase traversée. L'app savait planifier
            une décharge, le corpus savait ce qu'on en sait — sans qu'aucun des
            deux ne mentionne l'autre. Le lien n'apparaît que si une section traite
            vraiment la phase : en proposer une vaguement voisine apprendrait au
            lecteur que le lien ment. */}
        {evidence !== null && (
          <Link
            viewTransition
            to={evidence.href}
            className={`${WEEK_ROW_CLASS} text-[var(--text-1)]`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base">{t('program.evidenceLink')}</span>
              <span className="mt-0.5 block text-sm text-[var(--text-2)]">
                {t(
                  evidence.count === 1 ? 'program.evidenceCountOne' : 'program.evidenceCountMany',
                  { count: evidence.count, section: evidence.title },
                )}
              </span>
            </span>
            <span className="shrink-0 text-[var(--text-2)]">
              <ChevronRightIcon />
            </span>
          </Link>
        )}
      </Card>
    </section>
  );
}
