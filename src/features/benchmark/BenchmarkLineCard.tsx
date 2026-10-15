import { t } from '@/i18n/fr';
import type { BenchmarkLine } from '@/lib/benchmark';
import { Card, Toggle } from '@/ui';
import {
  changedReading,
  holdReading,
  oneRepMaxReading,
  planReading,
  proposalMark,
  pyramidReading,
  roughReading,
  routineReading,
  testedReading,
  withoutLoadReading,
  zoneNoteReading,
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
  const plan = planReading(line);
  const hold = holdReading(line);
  const pyramid = pyramidReading(line);
  const routine = routineReading(line);
  const changed = changedReading(line);
  const withoutLoad = withoutLoadReading(line);
  const zone = zoneReading(line);
  const rough = roughReading(line);
  const zoneNote = line.proposal === undefined ? undefined : zoneNoteReading(line.proposal);

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
        {line.verdict === 'calibrated' && plan !== undefined && (
          <div>
            <p className="text-base font-semibold text-[var(--accent-ink)]">{plan}</p>
            {hold !== undefined && <p className="text-sm text-[var(--text-2)]">{hold}</p>}
            {pyramid !== undefined && <p className="text-sm text-[var(--text-2)]">{pyramid}</p>}
          </div>
        )}
        {rough !== undefined && (
          <p className="text-sm leading-relaxed text-[var(--text-1)]">{rough}</p>
        )}
        {routine !== undefined && <p className="text-sm text-[var(--text-2)]">{routine}</p>}
        {changed !== undefined && (
          <p className="text-sm leading-relaxed text-[var(--text-1)]">{changed}</p>
        )}
        {withoutLoad !== undefined && (
          <p className="text-sm leading-relaxed text-[var(--text-2)]">{withoutLoad}</p>
        )}

        {line.proposal !== undefined && (
          <div className="border-t border-[var(--border)] pt-2">
            <div className="flex items-center justify-between gap-3">
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
            {zoneNote !== undefined && (
              <p className="mt-1 text-sm text-[var(--text-2)]">{zoneNote}</p>
            )}
          </div>
        )}
      </section>
    </Card>
  );
}
