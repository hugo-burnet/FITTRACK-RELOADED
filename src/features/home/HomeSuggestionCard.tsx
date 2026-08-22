import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeDashboardData, SuggestedRoutine } from '@/data/repositories/home';
import { startWorkoutFromRoutine } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { routineSummaryLine } from '@/features/routines/summary';
import { Button, Card } from '@/ui';
import { FolderSwitchIcon } from '@/ui/icons';
import {
  HomeRoutineContextSheet,
  routineContextOptionLabel,
} from './HomeRoutineContextSheet';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

const startOfLocalDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/**
 * « il y a 3 jours » plutôt qu'une date : la question posée devant cette carte
 * est *ça fait combien de temps*, pas *quel jour c'était*. Au-delà d'un mois le
 * compte de jours ne veut plus rien dire et la date reprend la main.
 *
 * Comparaison de minuits locaux et non de millisecondes : une séance d'hier
 * 22 h reste « hier » à 8 h ce matin, et le passage à l'heure d'hiver ne
 * fabrique pas un jour de plus.
 */
function lastPerformedLabel(lastPerformedAt: number | null): string {
  if (lastPerformedAt === null) return t('home.neverPerformed');

  const days = Math.round(
    (startOfLocalDay(Date.now()) - startOfLocalDay(lastPerformedAt)) / 86_400_000,
  );

  if (days <= 0) return t('home.lastToday');
  if (days === 1) return t('home.lastYesterday');
  if (days < 30) return t('home.lastDays', { count: days });
  return t('home.lastDate', { date: dateFormatter.format(lastPerformedAt) });
}

interface Props {
  suggestion: SuggestedRoutine | null;
  /** Distingue « aucune routine » de « rien à suggérer », deux vides différents. */
  routineCount: number;
  /** Aucune séance ne s'ouvre tant qu'une autre tourne — la barre du bas y ramène. */
  disabled: boolean;
  routineContext: HomeDashboardData['routineContext'];
}

/**
 * La carte principale de l'accueil : quelle routine lancer, et le bouton pour
 * la lancer.
 *
 * Le choix vient de `pickSuggestedRoutine` — la routine réalisée le moins
 * récemment — et la règle est écrite sous le titre. La routine n'est jamais
 * modifiée par cet écran : proposer, c'est tout ce que fait cette carte.
 */
export function HomeSuggestionCard({
  suggestion,
  routineCount,
  disabled,
  routineContext,
}: Props) {
  const navigate = useNavigate();
  const [contextSheetOpen, setContextSheetOpen] = useState(false);

  useEffect(() => {
    if (routineContext.required) setContextSheetOpen(true);
  }, [routineContext.required]);

  const selectedContext = routineContext.options.find(
    (option) => option.value === routineContext.selected,
  );
  const hasFolderPicker = routineContext.options.length > 0;
  const selectedFolderIsEmpty = selectedContext?.routineCount === 0;

  const start = (routineId: string) => {
    void startWorkoutFromRoutine(routineId).then(() => navigate('/workout'));
  };

  const contextHeader = (
    <div className="flex min-h-12 items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="label-xs font-semibold text-[var(--text-2)]">
          {t('home.suggestionSection')}
        </p>
        {hasFolderPicker && (
          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-1)]">
            {selectedContext === undefined
              ? t('home.chooseRoutineFolder')
              : routineContextOptionLabel(selectedContext)}
          </p>
        )}
      </div>

      {hasFolderPicker && (
        <button
          type="button"
          aria-label={t('home.changeRoutineFolder')}
          onClick={() => setContextSheetOpen(true)}
          className="flex size-12 shrink-0 items-center justify-center rounded-xl
            text-[var(--text-2)] transition-colors duration-[var(--dur-1)]
            active:bg-[var(--surface-2)]"
        >
          <FolderSwitchIcon />
        </button>
      )}
    </div>
  );

  return (
    /* Le nom de la section est passé *dans* la carte, en sur-titre.
       Au-dessus, il coûtait ses 32 px et laissait le bouton « Lancer » sous la
       ligne de flottaison une fois le corps installé en tête d'écran ; dedans,
       il se lit exactement pareil et la carte redevient un seul objet. */
    <section>
      <Card padded>
        {suggestion === null || routineCount === 0 ? (
          <div className="space-y-4">
            {contextHeader}
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {selectedFolderIsEmpty
                ? t('home.emptyRoutineFolder')
                : routineContext.required
                  ? t('home.chooseRoutineFolder')
                  : t('home.noRoutines')}
            </p>
            {!selectedFolderIsEmpty && !routineContext.required && (
              <Button variant="secondary" fullWidth onClick={() => void navigate('/routines')}>
                {t('home.createRoutine')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {contextHeader}
            <div>
              <h3 className="mt-1 truncate text-lg font-semibold text-[var(--text-1)]">
                {suggestion.name}
              </h3>
              {/* Le contenu et l'ancienneté sur une ligne : deux fragments de
                  quatre mots, qui tenaient deux lignes pleines chacun. */}
              <p className="mt-1 text-sm text-[var(--text-2)]">
                {routineSummaryLine(suggestion.exerciseCount, suggestion.setCount)}
                {' · '}
                {lastPerformedLabel(suggestion.lastPerformedAt)}
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={disabled}
              aria-label={t('home.startRoutine', { name: suggestion.name })}
              onClick={() => start(suggestion.routineId)}
            >
              {t('routines.start')}
            </Button>

            {/* La règle, écrite sous le bouton : une suggestion qu'on ne peut pas
                expliquer en une phrase est une suggestion qu'on ignore. */}
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t('home.suggestionRule')}
            </p>
          </div>
        )}
      </Card>

      <HomeRoutineContextSheet
        open={contextSheetOpen}
        value={routineContext.selected}
        options={routineContext.options}
        onClose={() => setContextSheetOpen(false)}
      />
    </section>
  );
}
