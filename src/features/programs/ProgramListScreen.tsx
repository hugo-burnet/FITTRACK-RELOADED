import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { getActiveProgramProjection } from '@/data/repositories/home';
import type { HomeProgramProjection } from '@/data/repositories/home';
import { listPrograms } from '@/data/repositories/programs';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { ProgramHeroCard } from './ProgramHeroCard';
import type { ProgramStatus } from '@/data/types';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Button, EmptyState, HeaderAction, ListRow } from '@/ui';
import { ChevronRightIcon, PlusIcon } from '@/ui/icons';
import { PlanningTabs } from '@/features/planning/PlanningTabs';

type ProgramsQuery =
  | {
      status: 'ready';
      programs: Awaited<ReturnType<typeof listPrograms>>;
      hero: HomeProgramProjection | null;
      activeWorkoutExists: boolean;
    }
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

/** Everything the hero is not: drafts, finished blocks, and any active one it could not read. */
function otherPrograms(query: Extract<ProgramsQuery, { status: 'ready' }>) {
  return query.programs.filter(({ program }) => program.id !== query.hero?.programId);
}

export function ProgramListScreen() {
  const navigate = useAppNavigate();
  const query = useLiveQuery<ProgramsQuery>(async () => {
    try {
      const [programs, hero, active] = await Promise.all([
        listPrograms(),
        getActiveProgramProjection(),
        getActiveWorkout(),
      ]);
      // `getActiveWorkout` renvoie `undefined`, pas `null` : comparer à `null`
      // désactive « Démarrer » en permanence, sans que le type ne bronche.
      return { status: 'ready', programs, hero, activeWorkoutExists: active !== undefined };
    } catch {
      return { status: 'error' };
    }
  }, []);

  const goBack = () => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/');
  };

  return (
    <Screen
      title={t('program.listTitle')}
      onBack={goBack}
      action={
        <HeaderAction
          label={t('program.listCreate')}
          tutorialId="program-create"
          onClick={() => void navigate('/programs/new')}
        >
          <PlusIcon />
        </HeaderAction>
      }
    >
      <div className="mb-6">
        <PlanningTabs />
      </div>
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
      {/*
        Le bloc actif est le héros : c'est la seule ligne de cet écran qui
        demande une action aujourd'hui. Même carte que l'accueil, même
        projection — deux écrans qui classeraient le split chacun de leur côté,
        ce sont deux occasions de ne pas dire la même chose.
      */}
      {query?.status === 'ready' && query.hero !== null && (
        <div className="mb-6">
          <ProgramHeroCard
            program={query.hero}
            disabled={query.activeWorkoutExists}
            leadWith="block"
          />
        </div>
      )}
      {query?.status === 'ready' && otherPrograms(query).length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
          {otherPrograms(query).map(({ program }) => (
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
