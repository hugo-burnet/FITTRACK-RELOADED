import { useState } from 'react';
import { normalizeSearch } from '@/data/repositories/exercises';
import type { Exercise } from '@/data/types';
import type { HevyExerciseResolution } from '@/data/repositories/hevyImport';
import { t } from '@/i18n/fr';
import { Button, Input, Sheet } from '@/ui';
import {
  customResolutionFor,
  type HevyMappingDraftRow,
} from './hevyImportDraft';

export function HevyExerciseMappingSheet({
  row,
  exercises,
  onClose,
  onSelect,
}: {
  row: HevyMappingDraftRow | null;
  exercises: readonly Exercise[];
  onClose: () => void;
  onSelect: (resolution: HevyExerciseResolution) => void;
}) {
  const [search, setSearch] = useState('');
  const close = () => {
    setSearch('');
    onClose();
  };
  const select = (resolution: HevyExerciseResolution) => {
    setSearch('');
    onSelect(resolution);
  };

  const needle = normalizeSearch(search);
  const filtered = exercises.filter((exercise) =>
    normalizeSearch(exercise.name).includes(needle),
  );

  return (
    <Sheet
      open={row !== null}
      onClose={close}
      title={row?.source.sourceTitle ?? t('history.importChooseExercise')}
    >
      {row !== null && (
        <div className="space-y-4">
          {row.suggestion !== undefined && (
            <Button
              variant="primary"
              fullWidth
              onClick={() =>
                select({
                  kind: 'existing',
                  exerciseId: row.suggestion!.id,
                })
              }
            >
              {t('history.importUseSuggestion')} · {row.suggestion.name}
            </Button>
          )}

          <Input
            label={t('history.importExerciseSearch')}
            labelHidden
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={search}
            placeholder={t('history.editExerciseSearchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="-mx-5 border-y border-[var(--border)]">
            {filtered.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--text-2)]">
                {t('history.importNoExercise')}
              </p>
            ) : (
              filtered.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() =>
                    select({
                      kind: 'existing',
                      exerciseId: exercise.id,
                    })
                  }
                  className="flex min-h-14 w-full items-center border-b border-[var(--border)]
                    px-5 py-3 text-left text-base text-[var(--text-1)]
                    last:border-b-0 active:bg-[var(--surface-2)]"
                >
                  {exercise.name}
                </button>
              ))
            )}
          </div>

          <Button
            variant="secondary"
            fullWidth
            onClick={() => select(customResolutionFor(row.source))}
          >
            {t('history.importCreateCustom', {
              name: row.source.sourceTitle,
            })}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
