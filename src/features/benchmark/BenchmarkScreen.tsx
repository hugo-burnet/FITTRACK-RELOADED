import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { applyBenchmarkProposals, loadBenchmarkReport } from '@/data/repositories/benchmark';
import { t } from '@/i18n/fr';
import type { BenchmarkLine } from '@/lib/benchmark';
import { ActionBand, Card } from '@/ui';
import { BenchmarkLineCard } from './BenchmarkLineCard';
import { appliedReading } from './benchmarkText';

/** Posé par l'écran de fin de séance : on arrive d'une séance qui vient d'être close, pas de l'historique. */
export interface BenchmarkLocationState {
  benchmarkFresh?: boolean;
}

const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Le bilan d'un benchmark : pour chaque exercice ce qui a été fait, la charge de
 * travail qu'on en déduit, et ce que la routine dirait si on l'y écrivait
 * (spec benchmark, §4).
 *
 * **Il se recalcule en direct** et ne retient aucun état d'« appliqué » : une
 * fois la routine écrite, sa cible égale la proposition et la ligne se lit « la
 * routine est déjà à ce niveau ». Les interrupteurs sont allumés au départ —
 * le bilan propose, mais le geste utile est d'accepter — et se décochent un à un,
 * sauf deux cas où le geste utile est de regarder d'abord : une estimation
 * approximative, et une routine qui a changé depuis le benchmark (ouvert des semaines
 * plus tard, le bilan proposait de ramener à 72,5 kg une routine qui avait progressé à 90).
 */
export function BenchmarkScreen() {
  const { workoutId = '' } = useParams();
  const navigate = useAppNavigate();
  const fresh = (useLocation().state as BenchmarkLocationState | null)?.benchmarkFresh === true;
  const report = useLiveQuery(() => loadBenchmarkReport(workoutId), [workoutId]);

  // Ce que la personne a retourné par rapport au défaut : allumé pour une charge fiable et à jour, éteint pour
  // une estimation approximative ou une routine qui a changé depuis. Retenir le retournement, et non l'état,
  // laisse le défaut à la ligne (`defaultIncluded`).
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [outcome, setOutcome] = useState<{ count: number } | 'failed' | null>(null);
  const applyingRef = useRef(false);

  // Venu de la séance qu'on vient d'enregistrer, la flèche ne ramène pas à une
  // séance qui n'existe plus ; venu de l'historique, elle y ramène.
  const leave = () => {
    if (fresh) void navigate('/', { replace: true });
    else if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) void navigate(-1);
    else void navigate('/history');
  };

  if (report === undefined) {
    return (
      <Screen title="" onBack={leave} showTutorialHelp={false}>
        <div aria-hidden="true" className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
        </div>
      </Screen>
    );
  }

  if (report === null) {
    return (
      <Screen title={t('benchmark.title')} onBack={leave} showTutorialHelp={false}>
        <div role="status">
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('benchmark.notFound')}</p>
          </Card>
        </div>
      </Screen>
    );
  }

  const lines = report.lines.filter((line) => line.verdict !== 'skipped');
  const defaultIncluded = (line: BenchmarkLine): boolean =>
    line.rough !== true && line.routineChanged !== true;
  const isIncluded = (line: BenchmarkLine): boolean =>
    line.proposal !== undefined &&
    defaultIncluded(line) !== flipped.has(line.proposal.routineExerciseId);
  const selected = lines.flatMap((line) =>
    line.proposal !== undefined && isIncluded(line) ? [line.proposal] : [],
  );
  const date = longDate.format(report.workout.startedAt);

  const toggle = (routineExerciseId: string) =>
    setFlipped((current) => {
      const next = new Set(current);
      if (!next.delete(routineExerciseId)) next.add(routineExerciseId);
      return next;
    });

  const apply = () => {
    if (selected.length === 0 || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setOutcome(null);
    void applyBenchmarkProposals(selected, report.workout.id)
      .then((count) => setOutcome({ count }))
      .catch(() => setOutcome('failed'))
      .finally(() => {
        applyingRef.current = false;
        setApplying(false);
      });
  };

  return (
    // Pas de « ? » : le didacticiel ne connaît pas cette route et la rangerait sous l'accueil — « Expliquer
    // cette page : Accueil », devant un bilan. Une aide qui parle d'un autre écran est pire que pas d'aide ;
    // le bilan dit lui-même ce qu'il fait (`benchmark.intro`).
    <Screen
      title={t('benchmark.title')}
      onBack={leave}
      showTutorialHelp={false}
      footer={
        <ActionBand
          label={
            applying
              ? t('benchmark.applying')
              : selected.length > 0
                ? t('benchmark.apply', { count: selected.length })
                : t('benchmark.close')
          }
          disabled={applying}
          onClick={selected.length > 0 ? apply : leave}
        />
      }
    >
      <div className="space-y-4">
        <Card padded>
          <div className="space-y-2">
            <p className="label-xs font-semibold text-[var(--text-2)]">
              {report.routineName === undefined
                ? t('benchmark.contextNoRoutine', { date })
                : t('benchmark.context', { routine: report.routineName, date })}
            </p>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('benchmark.intro')}</p>
          </div>
        </Card>

        {outcome !== null && (
          <div role={outcome === 'failed' ? 'alert' : 'status'}>
            <Card padded>
              <p
                className={`text-sm leading-relaxed ${
                  outcome === 'failed' ? 'text-[var(--danger-ink)]' : 'text-[var(--text-1)]'
                }`}
              >
                {outcome === 'failed' ? t('benchmark.applyFailed') : appliedReading(outcome.count)}
              </p>
            </Card>
          </div>
        )}

        {lines.map((line, index) => (
          <BenchmarkLineCard
            key={`${index}-${line.exerciseId}`}
            line={line}
            included={isIncluded(line)}
            onToggle={() => line.proposal !== undefined && toggle(line.proposal.routineExerciseId)}
          />
        ))}
      </div>
    </Screen>
  );
}
