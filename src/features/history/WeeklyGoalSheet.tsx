import { t } from '@/i18n/fr';
import { Button, NumberInput, Sheet } from '@/ui';

interface Props {
  open: boolean;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  onClose: () => void;
  onSave: () => void;
}

export function WeeklyGoalSheet({
  open,
  value,
  onChange,
  onClose,
  onSave,
}: Props) {
  const valid = value !== undefined && Number.isInteger(value) && value > 0;

  return (
    <Sheet open={open} onClose={onClose} title={t('history.goalSheetTitle')}>
      <div className="space-y-5 pb-2">
        <NumberInput
          value={value}
          onChange={onChange}
          min={1}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          integer
          aria-label={t('history.goalInput')}
        />
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!valid}
          onClick={onSave}
        >
          {t('history.goalSave')}
        </Button>
      </div>
    </Sheet>
  );
}
