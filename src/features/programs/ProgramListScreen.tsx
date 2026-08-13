import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { listPrograms } from '@/data/repositories/programs';
import type { ProgramStatus } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Button, EmptyState, HeaderAction, ListRow } from '@/ui';
import { ChevronRightIcon, PlusIcon } from '@/ui/icons';

type ProgramsQuery =
  | { status: 'ready'; programs: Awaited<ReturnType<typeof listPrograms>> }
  | { status: 'error' };

const STATUS_KEYS: Record<ProgramStatus, TranslationKey> = {
  draft: 'program.statusDraft',
  active: 'program.statusActive',
  completed: 'program.statusCompleted',
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function ProgramListScreen() {
  const navigate = useNavigate();
  const query = useLiveQuery<ProgramsQuery>(async () => {
    try {
      return { status: 'ready', programs: await listPrograms() };
    } catch {
      return { status: 'error' };
    }
  }, []);

  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/routines');
  };

  return (
    <Screen
      title={t('program.listTitle')}
      onBack={goBack}
      action={
        <HeaderAction label={t('program.listCreate')} onClick={() => void navigate('/programs/new')}>
          <PlusIcon />
        </HeaderAction>
      }
    >
      {query === undefined && <p className="text-[var(--text-2)]">{t('program.loading')}</p>}
      {query?.status === 'error' && (
        <p role="alert" className="text-[var(--danger-ink)]">
          {t('program.detailReadError')}
        </p>
      )}
      {query?.status === 'ready' && query.programs.length === 0 && (
        <EmptyState
          reading="0"
          unit={t('program.listTitle')}
          body={t('program.listEmpty')}
          action={
            <Button variant="primary" fullWidth onClick={() => void navigate('/programs/new')}>
              {t('program.listCreate')}
            </Button>
          }
        />
      )}
      {query?.status === 'ready' && query.programs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
          {query.programs.map(({ program }) => (
            <ListRow
              key={program.id}
              title={program.name}
              subtitle={t('program.listDuration', {
                count: program.durationWeeks,
                date: dateFormatter.format(program.startsAt),
              })}
              trailing={
                <span className="flex items-center gap-2">
                  <span className="text-sm">{t(STATUS_KEYS[program.status])}</span>
                  <ChevronRightIcon />
                </span>
              }
              onClick={() => void navigate(`/programs/${program.id}`)}
            />
          ))}
        </div>
      )}
    </Screen>
  );
}
