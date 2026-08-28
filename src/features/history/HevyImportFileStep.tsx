import { useRef } from 'react';
import type { HevyCsvIssue, HevyCsvIssueCode } from '@/lib/hevyCsv';
import { t, type TranslationKey } from '@/i18n/fr';
import { Button, Card } from '@/ui';

const issueKeys: Record<HevyCsvIssueCode, TranslationKey> = {
  empty_file: 'history.importErrorEmptyFile',
  malformed_csv: 'history.importErrorMalformedCsv',
  missing_header: 'history.importErrorMissingHeader',
  unexpected_header: 'history.importErrorUnexpectedHeader',
  required_value: 'history.importErrorRequiredValue',
  invalid_date: 'history.importErrorInvalidDate',
  invalid_number: 'history.importErrorInvalidNumber',
  invalid_set_type: 'history.importErrorInvalidSetType',
  invalid_measurement: 'history.importErrorInvalidMeasurement',
  invalid_workout_range: 'history.importErrorWorkoutRange',
  duplicate_set_index: 'history.importErrorDuplicateSet',
};

function issueMessage(issue: HevyCsvIssue): string {
  return t(issueKeys[issue.code], {
    field: issue.field ?? '',
    value: issue.value ?? '',
  });
}

export function HevyImportFileStep({
  issues,
  message,
  onSelect,
}: {
  issues: readonly HevyCsvIssue[];
  message?: string;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6">
      <Card padded>
        <h2 className="text-lg font-semibold text-[var(--text-1)]">
          {t('history.importChooseTitle')}
        </h2>
        <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[var(--text-2)]">
          {t('history.importChooseBody')}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) onSelect(file);
            event.target.value = '';
          }}
        />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-5"
          tutorialId="hevy-choose-file"
          onClick={() => inputRef.current?.click()}
        >
          {t('history.importChooseFile')}
        </Button>
      </Card>

      {(message !== undefined || issues.length > 0) && (
        <section aria-labelledby="hevy-errors-title">
          <h2
            id="hevy-errors-title"
            className="mb-3 text-lg font-semibold text-[var(--danger-ink)]"
          >
            {t('history.importErrorsTitle')}
          </h2>
          <Card>
            {message !== undefined && (
              <p className="px-4 py-4 text-sm text-[var(--text-1)]">
                {message}
              </p>
            )}
            {issues.map((issue, index) => (
              <div
                key={`${issue.line}-${issue.code}-${index}`}
                className="border-b border-[var(--border)] px-4 py-3 last:border-b-0"
              >
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  {t('history.importErrorLine', { line: issue.line })}
                </p>
                <p className="mt-1 text-sm text-[var(--text-2)]">
                  {issueMessage(issue)}
                </p>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
