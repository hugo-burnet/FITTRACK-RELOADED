import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  deleteArchivedWorkout,
  getArchivedWorkoutDetail,
} from '@/data/repositories/history';
import { listExportSources } from '@/data/repositories/exportQueries';
import { t } from '@/i18n/fr';
import { projectCoachExport } from '@/lib/export/projectCoachExport';
import { serializeMarkdown } from '@/lib/export/serializeMarkdown';
import { DEFAULT_EXPORT_OPTIONS } from '@/lib/export/types';
import { copyText, shareText, type ShareOutcome } from '@/platform/share';
import { ActionSheet, Card, ConfirmSheet, HeaderAction } from '@/ui';
import { MoreIcon } from '@/ui/icons';
import { HistoryWorkoutDetail } from './HistoryWorkoutDetail';

const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function HistoryDetailScreen() {
  const { workoutId = '' } = useParams();
  const navigate = useNavigate();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [shareOutcome, setShareOutcome] = useState<ShareOutcome | null>(null);
  const detail = useLiveQuery(
    () => getArchivedWorkoutDetail(workoutId),
    [workoutId],
  );

  // Serialised ahead of the tap, not on it. The system share sheet only opens
  // while the gesture is still "fresh"; an `await` on Dexie between the click
  // and `navigator.share` spends that credit and Android refuses to open it.
  // Derived from `listExportSources` rather than from `detail`, because the two
  // answer different questions — cf. the header of `exportQueries.ts`.
  const markdown = useLiveQuery(async () => {
    const scope = { kind: 'workout', workoutId } as const;
    const sources = await listExportSources(scope);
    if (sources.length === 0) return '';

    return serializeMarkdown(
      projectCoachExport(scope, sources, DEFAULT_EXPORT_OPTIONS, Date.now()),
    );
  }, [workoutId]);

  useEffect(() => {
    if (detail !== null) return;
    void navigate('/history', {
      replace: true,
      state: { historyNotice: 'missing' },
    });
  }, [detail, navigate]);

  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/history');
  };

  if (detail === undefined || detail === null) {
    return (
      <Screen title="" onBack={goBack}>
        <div aria-hidden="true" className="space-y-4">
          <div className="h-44 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
          <div className="h-52 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
        </div>
      </Screen>
    );
  }

  // 'shared' and 'cancelled' say nothing on purpose: the share sheet was visible
  // and its outcome is already known to whoever dismissed it. Announcing a
  // cancellation as an event teaches people to ignore the alert slot.
  const announce = (outcome: ShareOutcome) =>
    setShareOutcome(outcome === 'copied' || outcome === 'failed' ? outcome : null);

  const share = () => {
    setShareOutcome(null);
    void shareText({
      title: t('history.shareTitle', { name: detail.workout.name }),
      text: markdown ?? '',
    }).then(announce);
  };

  const copy = () => {
    setShareOutcome(null);
    void copyText(markdown ?? '').then(announce);
  };

  const deleteWorkout = () => {
    void deleteArchivedWorkout(detail.workout.id)
      .then(() => {
        navigate('/history', {
          replace: true,
          state: { historyNotice: 'deleted' },
        });
      })
      .catch(() => setDeleteFailed(true));
  };

  return (
    <Screen
      title={detail.workout.name}
      onBack={goBack}
      action={
        <HeaderAction
          label={t('history.detailActions')}
          onClick={() => setActionsOpen(true)}
        >
          <MoreIcon />
        </HeaderAction>
      }
    >
      <div className="space-y-4">
        {deleteFailed && (
          <div role="alert">
            <Card padded>
              <p className="text-sm leading-relaxed text-[var(--danger-ink)]">
                {t('history.deleteError')}
              </p>
            </Card>
          </div>
        )}
        {shareOutcome !== null && (
          <div role="status">
            <Card padded>
              <p
                className={`text-sm leading-relaxed ${
                  shareOutcome === 'failed'
                    ? 'text-[var(--danger-ink)]'
                    : 'text-[var(--text-2)]'
                }`}
              >
                {t(shareOutcome === 'failed' ? 'history.shareFailed' : 'history.shareCopied')}
              </p>
            </Card>
          </div>
        )}
        <HistoryWorkoutDetail detail={detail} />
      </div>

      <ActionSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={t('history.detailActions')}
        actions={[
          {
            label: t('history.share'),
            // Nothing to share until the serialisation has answered. Disabled
            // rather than hidden: an entry that appears a beat later moves the
            // two below it under a finger already on its way down.
            disabled: markdown === undefined || markdown === '',
            onSelect: share,
          },
          {
            label: t('history.shareCopy'),
            disabled: markdown === undefined || markdown === '',
            onSelect: copy,
          },
          {
            label: t('history.edit'),
            onSelect: () => {
              void navigate(`/history/${detail.workout.id}/edit`);
            },
          },
          {
            label: t('history.delete'),
            danger: true,
            onSelect: () => {
              setDeleteFailed(false);
              setConfirmingDelete(true);
            },
          },
        ]}
      />

      <ConfirmSheet
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={t('history.deleteTitle')}
        body={t('history.deleteBody', {
          name: detail.workout.name,
          date: longDate.format(detail.workout.startedAt),
        })}
        confirmLabel={t('history.deleteConfirm')}
        danger
        onConfirm={deleteWorkout}
      />
    </Screen>
  );
}
