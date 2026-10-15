import { t } from '@/i18n/fr';
import type { BenchmarkLine } from '@/lib/benchmark';
import { Card, Toggle } from '@/ui';
import {
  loadReading,
  oneRepMaxReading,
  proposalMark,
  roughReading,
  routineReading,
  testedReading,
  withoutLoadReading,
  zoneReading,
} from './benchmarkText';

/**
 * Un exercice du bilan : ce qui a été fait, ce qu'on en déduit, et — quand la
 * routine peut le recevoir — l'interrupteur qui dit si on l'y écrit.
 *
 * Aucune décision ici : tout vient de `benchmarkLine`, et la carte ne fait que
 * l'écrire. Le seul état est celui de l'interrupteur, qui appartient à l'écran
 * parce que c'est lui qui applique.
 */
export function BenchmarkLineCard({
  line,
  included,
  onToggle,
}: {
  line: BenchmarkLine;
  included: boolean;
  onToggle: () => void;
}) {
  const tested = testedReading(line);
  const routine = routineReading(line);
  const withoutLoad = withoutLoadReading(line);
  const zone = zoneReading(line);
  const rough = roughReading(line);

  return (
    <Card padded>
      <section aria-label={line.exerciseName} className="space-y-2">
        <h2 className="text-lg font-semibold text-[var(--text-1)]">{line.exerciseName}</h2>
        {tested !== undefined && (
          <p className="metric text-base text-[var(--text-1)]">
            {t('benchmark.done', { reading: tested })}
          </p>
        )}

        {zone !== undefined && <p className="text-sm text-[var(--text-2)]">{zone}</p>}
        {line.verdict === 'calibrated' && line.oneRepMax !== undefined && (
          <p className="text-sm text-[var(--text-2)]">
            {t('benchmark.oneRepMax', { value: oneRepMaxReading(line.oneRepMax) })}
          </p>
        )}
        {line.verdict === 'calibrated' && line.suggestedKg !== undefined && (
          <div>
            <p className="text-base font-semibold text-[var(--accent-ink)]">
              {t('benchmark.suggested', { value: loadReading(line.suggestedKg) })}
            </p>
            {line.referenceReps !== undefined && (
              <p className="text-sm text-[var(--text-2)]">
                {t('benchmark.suggestedBasis', { reps: line.referenceReps })}
              </p>
            )}
          </div>
        )}
        {rough !== undefined && (
          <p className="text-sm leading-relaxed text-[var(--text-1)]">{rough}</p>
        )}
        {routine !== undefined && <p className="text-sm text-[var(--text-2)]">{routine}</p>}
        {withoutLoad !== undefined && (
          <p className="text-sm leading-relaxed text-[var(--text-2)]">{withoutLoad}</p>
        )}

        {line.proposal !== undefined && (
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
            <p className="text-sm font-semibold text-[var(--text-1)]">
              {t('benchmark.toggleText')}
            </p>
            <Toggle
              label={t('benchmark.toggleLabel', { name: line.exerciseName })}
              mark={proposalMark(line.proposal)}
              checked={included}
              onChange={onToggle}
            />
          </div>
        )}
      </section>
    </Card>
  );
}
