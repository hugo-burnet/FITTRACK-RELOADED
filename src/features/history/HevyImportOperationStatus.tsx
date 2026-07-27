import { useEffect, useRef } from 'react';
import { t } from '@/i18n/fr';
import { Card } from '@/ui';

export function HevyImportOperationStatus({
  kind,
}: {
  kind: 'working' | 'failed';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const failed = kind === 'failed';

  useEffect(() => {
    if (failed) ref.current?.focus();
  }, [failed]);

  return (
    <div
      ref={ref}
      role={failed ? 'alert' : 'status'}
      tabIndex={failed ? -1 : undefined}
      className="outline-none"
    >
      <Card padded>
        <p
          className={`text-sm ${
            failed
              ? 'text-[var(--danger-ink)]'
              : 'font-semibold text-[var(--text-1)]'
          }`}
        >
          {t(failed ? 'history.importFailed' : 'history.importWorking')}
        </p>
      </Card>
    </div>
  );
}
