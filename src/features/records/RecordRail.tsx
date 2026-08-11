import { useEffect, useRef, type CSSProperties } from 'react';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import { t } from '@/i18n/fr';
import { recordContext, recordGain, recordLabel, recordValue } from '@/i18n/labels';

type Props = {
  entries: readonly RecordTimelineEntry[];
  knownRecordIds: readonly string[];
  visibleKnownRecordIds: readonly string[];
  onOpen: (entry: RecordTimelineEntry) => void;
};

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

// Monospace glyphs are about 0.6em wide. A slightly conservative 0.65 factor
// keeps the complete, non-wrapping reading inside its query container even
// when page zoom leaves only a very narrow CSS viewport.
type RecordFitStyle = CSSProperties & {
  '--record-fit-size': string;
  '--record-max-size': string;
};

const fittedValueStyle = (value: string, maximumRem: number): RecordFitStyle => ({
  '--record-fit-size': `${100 / (Math.max(value.length, 1) * 0.65)}cqi`,
  '--record-max-size': `${maximumRem}rem`,
});

/**
 * A personal-record timeline drawn as the notched guide of a weight stack.
 *
 * The first event is not a KPI card placed above the history: it is the larger
 * head of the same rail. That keeps value, source, date and gain in one ordered
 * reading and makes the older marks feel like the path that produced it.
 */
export function RecordRail({ entries, knownRecordIds, visibleKnownRecordIds, onOpen }: Props) {
  const seenIds = useRef<Set<string> | null>(null);
  const pendingAnimationIds = useRef(new Set<string>());
  const nodes = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    const known = new Set(knownRecordIds);
    const visibleKnown = new Set(visibleKnownRecordIds);
    if (seenIds.current === null) {
      seenIds.current = known;
      return;
    }
    for (const id of known) {
      if (!seenIds.current.has(id) && visibleKnown.has(id)) {
        pendingAnimationIds.current.add(id);
      }
      seenIds.current.add(id);
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    for (const id of pendingAnimationIds.current) {
      if (!visibleKnown.has(id)) {
        pendingAnimationIds.current.delete(id);
        continue;
      }
      const node = nodes.current.get(id);
      if (node !== undefined) {
        if (!reduced && typeof node.animate === 'function') {
          node.animate(
            [
              { opacity: 0, transform: 'translateY(-6px) scale(0.98)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ],
            { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
          );
        }
        pendingAnimationIds.current.delete(id);
      }
    }
  }, [entries, knownRecordIds, visibleKnownRecordIds]);

  return (
    <ol
      className="relative isolate before:absolute before:top-4 before:bottom-7
        before:left-[1.0625rem] before:-z-10 before:w-px before:bg-[var(--border)]
        before:content-['']"
      aria-label={t('records.railLabel')}
    >
      {entries.map((entry, index) => {
        const current = index === 0;
        const context = recordContext(entry.record);
        const gain = recordGain(entry.record, entry.previousValue);
        const value = recordValue(entry.record);
        const assistanceQualifier =
          entry.record.type === 'min_assistance' ? t('records.assistanceQualifier') : undefined;
        const compactValue =
          assistanceQualifier === undefined
            ? value
            : value.replace(` ${assistanceQualifier}`, '');
        const date = longDate(entry.record.achievedAt);
        return (
          <li
            key={entry.record.id}
            ref={(node) => {
              if (node === null) nodes.current.delete(entry.record.id);
              else nodes.current.set(entry.record.id, node);
            }}
            data-record-id={entry.record.id}
            className={`grid grid-cols-[2.5rem_minmax(0,1fr)] ${current ? 'pb-9' : 'pb-3'}`}
          >
            <span className="relative flex justify-start pt-4" aria-hidden="true">
              <span
                className={
                  current
                    ? `relative h-5 w-9 rounded-[0.3rem] bg-[var(--color-accent)]
                      shadow-[0_0_0_3px_var(--surface-0)]`
                    : `mt-2 h-[3px] w-5 rounded-full bg-[var(--axis)]
                      shadow-[0_0_0_3px_var(--surface-0)]`
                }
              >
                {current && (
                  <span className="absolute inset-x-2 top-1/2 h-px bg-[var(--accent-on-fill)]/40" />
                )}
              </span>
            </span>

            <button
              type="button"
              aria-current={current ? 'true' : undefined}
              aria-label={t('records.openMark', {
                exercise: entry.exerciseName,
                category: recordLabel(entry.record.type),
                value,
                date,
              })}
              onClick={() => onOpen(entry)}
              className={`min-w-0 rounded-xl text-left [container-type:inline-size]
                transition-colors duration-[var(--dur-1)]
                ease-[var(--ease-mech)] active:bg-[var(--surface-1)]
                ${current ? 'min-h-32 px-1 pt-1 pb-3' : 'min-h-14 px-1 py-3'}`}
            >
              {current ? (
                <>
                  <span className="label-xs block font-semibold text-[var(--accent-ink)]">
                    {t('records.currentMark')}
                  </span>
                  <span className="mt-2 block break-words text-xl leading-tight font-semibold text-[var(--text-1)]">
                    {entry.exerciseName}
                  </span>
                  <span className="mt-1 block text-sm text-[var(--text-2)]">
                    {recordLabel(entry.record.type)} · {date}
                  </span>
                  <span className="mt-4 block max-w-full">
                    <span
                      className="record-figure record-fit block leading-none font-semibold whitespace-nowrap"
                      style={fittedValueStyle(compactValue, 2.5)}
                    >
                      {compactValue}
                    </span>
                    {assistanceQualifier && (
                      <span className="mt-1 block text-sm font-semibold text-[var(--text-2)]">
                        {assistanceQualifier}
                      </span>
                    )}
                  </span>
                  {(context || gain || entry.previousValue === undefined) && (
                    <span className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                      {context && <span className="text-[var(--text-2)]">{context}</span>}
                      {gain ? (
                        <span className="font-semibold text-[var(--accent-ink)]">{gain}</span>
                      ) : entry.previousValue === undefined ? (
                        <span className="font-semibold text-[var(--text-1)]">
                          {t('records.firstMark')}
                        </span>
                      ) : null}
                    </span>
                  )}
                </>
              ) : (
                <span className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto] min-[360px]:items-start">
                  <span className="min-w-0">
                    <span className="block break-words text-base leading-snug font-semibold text-[var(--text-2)]">
                      {entry.exerciseName}
                    </span>
                    <span className="mt-1 block text-sm leading-snug text-[var(--text-2)]">
                      {recordLabel(entry.record.type)} · {date}
                    </span>
                    {context && (
                      <span className="mt-1 block text-sm leading-snug text-[var(--text-2)]">
                        {context}
                      </span>
                    )}
                    {gain ? (
                      <span className="mt-1 block text-sm font-semibold text-[var(--text-1)]">
                        {gain}
                      </span>
                    ) : entry.previousValue === undefined ? (
                      <span className="mt-1 block text-sm font-semibold text-[var(--text-1)]">
                        {t('records.firstMark')}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[var(--text-2)] min-[360px]:text-right">
                    <span
                      className="record-figure record-fit block leading-none font-semibold whitespace-nowrap"
                      style={fittedValueStyle(compactValue, 1.25)}
                    >
                      {compactValue}
                    </span>
                    {assistanceQualifier && (
                      <span className="mt-1 block text-sm leading-tight font-semibold">
                        {assistanceQualifier}
                      </span>
                    )}
                  </span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
