import { t } from '@/i18n/fr';
import {
  Card,
  Input,
  NumberInput,
  Textarea,
} from '@/ui';
import type { HistoryWorkoutDraft } from './historyDraft';

type Props = {
  draft: HistoryWorkoutDraft;
  dateValue: string;
  timeValue: string;
  onDraftChange: (draft: HistoryWorkoutDraft) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

export function HistoryWorkoutFields({
  draft,
  dateValue,
  timeValue,
  onDraftChange,
  onDateChange,
  onTimeChange,
}: Props) {
  return (
    <Card padded>
      <div className="flex flex-col gap-5">
        <Input
          label={t('history.editName')}
          value={draft.name}
          onChange={(event) =>
            onDraftChange({ ...draft, name: event.target.value })
          }
        />
        <Textarea
          label={t('history.editNotes')}
          rows={3}
          value={draft.notes ?? ''}
          onChange={(event) =>
            onDraftChange({
              ...draft,
              notes: event.target.value === '' ? undefined : event.target.value,
            })
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('history.editDate')}
            type="date"
            value={dateValue}
            onChange={(event) => onDateChange(event.target.value)}
          />
          <Input
            label={t('history.editStart')}
            type="time"
            value={timeValue}
            onChange={(event) => onTimeChange(event.target.value)}
          />
        </div>
        <div>
          <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
            {t('history.editDuration')}
          </p>
          <NumberInput
            value={Math.round((draft.durationSeconds / 60) * 10) / 10}
            onChange={(minutes) =>
              onDraftChange({
                ...draft,
                durationSeconds: Math.max(0, Math.round((minutes ?? 0) * 60)),
              })
            }
            step={1}
            max={Number.MAX_SAFE_INTEGER}
            suffix={t('history.editDurationUnit')}
            focusTone="neutral"
            aria-label={t('history.editDuration')}
          />
        </div>
      </div>
    </Card>
  );
}
