import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  deleteArchivedWorkout,
  getArchivedWorkoutDetail,
} from '@/data/repositories/history';
import { t } from '@/i18n/fr';
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
  const detail = useLiveQuery(
    () => getArchivedWorkoutDetail(workoutId),
    [workoutId],
  );

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
        <HistoryWorkoutDetail detail={detail} />
      </div>

      <ActionSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={t('history.detailActions')}
        actions={[
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
