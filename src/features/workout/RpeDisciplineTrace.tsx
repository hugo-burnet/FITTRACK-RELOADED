import { t } from '@/i18n/fr';
import { Card, SectionTitle } from '@/ui';
import { rpeDisciplineTraceLines } from './rpeDisciplineCopy';

/**
 * La traçabilité du protocole RPE : ce qui a été constaté, corrigé ou dérogé dans une séance. Rien
 * quand rien n'a jamais été constaté — une séance sans dépassement n'a pas à le dire.
 */
export function RpeDisciplineTrace({ events }: { events: unknown }) {
  const lines = rpeDisciplineTraceLines(events);
  if (lines.length === 0) return null;
  return (
    <section data-part="rpe-discipline-trace">
      <SectionTitle>{t('rpeDiscipline.traceTitle')}</SectionTitle>
      <Card padded>
        <ul className="flex flex-col gap-1">
          {lines.map((line, index) => (
            <li
              key={index}
              className="metric text-sm leading-relaxed text-[var(--text-2)] [overflow-wrap:anywhere]"
            >
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
