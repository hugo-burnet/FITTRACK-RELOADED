import { useLiveQuery } from 'dexie-react-hooks';
import { getExercise } from '@/data/repositories/exercises';
import { t } from '@/i18n/fr';

/** The selected order stays inspectable across searches. */
export function SelectionReview({
  ids,
  onRemove,
}: {
  ids: string[];
  onRemove: (id: string) => void;
}) {
  const exercises = useLiveQuery(() => Promise.all(ids.map(getExercise)), [ids.join(',')]);
  if (ids.length === 0) return null;
  return (
    <details className="mb-4 rounded-2xl border border-[var(--border)] px-4">
      <summary className="min-h-12 cursor-pointer py-3 font-medium text-[var(--accent-ink)]">
        {t('picker.selection', { count: ids.length })}
      </summary>
      <ol className="pb-2">
        {ids.map((id, index) => (
          <li key={id} className="flex items-center gap-2 border-t border-[var(--border)]">
            <span className="tabular text-sm text-[var(--text-2)]">{index + 1}</span>
            <span className="min-w-0 flex-1 text-sm">
              {exercises?.[index]?.name ?? t('picker.loadingSelection')}
            </span>
            <button
              type="button"
              className="min-h-12 shrink-0 px-2 text-sm text-[var(--accent-ink)]"
              onClick={() => onRemove(id)}
              aria-label={t('picker.removeNamed', {
                name: exercises?.[index]?.name ?? String(index + 1),
              })}
            >
              {t('picker.remove')}
            </button>
          </li>
        ))}
      </ol>
    </details>
  );
}
