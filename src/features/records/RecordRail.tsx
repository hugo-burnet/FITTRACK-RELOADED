import { useEffect, useRef } from 'react';
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

function readingParts(value: string): { figure: string; unit?: string } {
  const separator = value.lastIndexOf(' ');
  return separator < 0
    ? { figure: value }
    : { figure: value.slice(0, separator), unit: value.slice(separator + 1) };
}

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
        const reading = readingParts(compactValue);
        const date = longDate(entry.record.achievedAt);
        const progress = gain ??
          (entry.previousValue === undefined ? t('records.firstMark') : undefined);
        const contextId = context ? `record-context-${entry.record.id}` : undefined;
        const progressId = progress ? `record-progress-${entry.record.id}` : undefined;
        const descriptionIds = [contextId, progressId].filter(Boolean).join(' ') || undefined;
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
              aria-describedby={descriptionIds}
              onClick={() => onOpen(entry)}
              className={`min-w-0 rounded-xl text-left
                transition-colors duration-[var(--dur-1)]
                ease-[var(--ease-mech)] active:bg-[var(--surface-1)]
                ${current ? 'min-h-32 px-1 pt-1 pb-3' : 'min-h-14 px-1 py-3'}`}
            >
              <span aria-hidden="true" className="sr-only">{compactValue}</span>
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
                  <span className="mt-4 flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="record-figure min-w-0 break-all text-[2.5rem] leading-none font-semibold">
                      {reading.figure}
                    </span>
                    {reading.unit && (
                      <span className="text-base font-semibold text-[var(--text-2)]">
                        {reading.unit}
                      </span>
                    )}
                    {assistanceQualifier && (
                      <span className="basis-full text-sm font-semibold text-[var(--text-2)]">
                        {assistanceQualifier}
                      </span>
                    )}
                  </span>
                  {(context || progress) && (
                    <span className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                      {context && (
                        <span id={contextId} className="text-[var(--text-2)]">
                          {context}
                        </span>
                      )}
                      {progress && (
                        <span
                          id={progressId}
                          className={`font-semibold ${gain ? 'text-[var(--accent-ink)]' : 'text-[var(--text-1)]'}`}
                        >
                          {progress}
                        </span>
                      )}
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
                      <span
                        id={contextId}
                        className="mt-1 block text-sm leading-snug text-[var(--text-2)]"
                      >
                        {context}
                      </span>
                    )}
                    {progress && (
                      <span
                        id={progressId}
                        className="mt-1 block text-sm font-semibold text-[var(--text-1)]"
                      >
                        {progress}
                      </span>
                    )}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-[var(--text-2)] min-[360px]:justify-end min-[360px]:text-right">
                    <span className="record-figure min-w-0 break-all text-xl leading-none font-semibold">
                      {reading.figure}
                    </span>
                    {reading.unit && <span className="text-sm font-semibold">{reading.unit}</span>}
                    {assistanceQualifier && (
                      <span className="basis-full text-sm leading-tight font-semibold">
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
