import { useState, type RefObject } from 'react';
import { t, type TranslationKey } from '@/i18n/fr';
import {
  chartImageFileName,
  chartPngBlob,
  type ChartImagePalette,
} from '@/platform/chartImage';
import { saveBlobFile } from '@/platform/saveFile';
import type { SaveOutcome } from '@/platform/saveFile';
import { Button } from '@/ui';

/**
 * « Exporter en image » — RF-44's companion, and the answer to the one thing a
 * chart in a personal app cannot do: leave it.
 *
 * The button lives beside the chart rather than in the header: it acts on that
 * drawing, and a header action would have to explain which of the screen's
 * pictures it means. It reads the `<svg>` out of the container it is given
 * instead of receiving a ref threaded through three chart components — the
 * charts already agree on exactly one thing, that they render one `<svg>`, and
 * that is the contract used here.
 */

const OUTCOME_KEY = {
  shared: 'analytics.exportImageShared',
  downloaded: 'analytics.exportImageDownloaded',
  cancelled: 'analytics.exportImageCancelled',
  failed: 'analytics.exportImageFailed',
} as const satisfies Record<SaveOutcome, TranslationKey>;

/** The live theme, read once per export: the image follows what is on screen. */
function palette(): ChartImagePalette {
  const computed = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => {
    const value = computed.getPropertyValue(name).trim();
    return value === '' ? fallback : value;
  };

  return {
    background: read('--surface-1', '#1b1916'),
    ink: read('--text-1', '#f5f3f0'),
    muted: read('--text-2', '#a8a29a'),
  };
}

export function ChartExportAction({
  chartRef,
  slug,
  title,
  subtitle,
}: {
  chartRef: RefObject<HTMLElement | null>;
  /** The `volume` of `fittrack-volume-2026-08-22.png`. */
  slug: string;
  title: string;
  /** The reading the chart is showing, carried into the image. */
  subtitle?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);

  const exportImage = async (): Promise<void> => {
    const svg = chartRef.current?.querySelector('svg');
    if (!(svg instanceof SVGSVGElement)) return;

    setBusy(true);
    setOutcome(null);
    try {
      const at = Date.now();
      const blob = await chartPngBlob(
        svg,
        {
          title,
          ...(subtitle === undefined ? {} : { subtitle }),
          footer: t('analytics.exportImageFooter', {
            date: new Date(at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          }),
        },
        palette(),
      );
      setOutcome(await saveBlobFile({ name: chartImageFileName(slug, at), blob, title }));
    } catch {
      setOutcome('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <Button variant="ghost" disabled={busy} onClick={() => void exportImage()}>
        {t('analytics.exportImage')}
      </Button>
      {/* Une annulation n'est pas un échec, et n'a rien à dire : cf. `share.ts`. */}
      {outcome !== null && outcome !== 'cancelled' && (
        <p
          role="status"
          className={`mt-2 px-1 text-sm leading-relaxed ${
            outcome === 'failed' ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
          }`}
        >
          {t(OUTCOME_KEY[outcome])}
        </p>
      )}
    </div>
  );
}
