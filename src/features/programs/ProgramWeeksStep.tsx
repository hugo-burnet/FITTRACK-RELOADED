import { useState } from 'react';
import { PROGRAM_PHASES, type ProgramPhase } from '@/data/types';
import {
  MAX_LOAD_INDEX,
  MIN_LOAD_INDEX,
  PROGRAM_RECIPE_IDS,
  applyProgramRecipe,
  matchingProgramRecipe,
  type ProgramRecipeId,
} from '@/lib/programs';
import { t } from '@/i18n/fr';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { Button, ListRow, NumberInput, Sheet } from '@/ui';
import {
  LOAD_INDEX_PRESETS,
  PHASE_LABEL_KEYS,
  RECIPE_LABEL_KEYS,
  SUGGESTED_LOAD_INDEX,
  loadRuleReading,
  phaseLabel,
  weekLine,
} from './weekReading';

export interface ProgramWeekDraft {
  weekIndex: number;
  loadIndex: number;
  phase: ProgramPhase;
}

interface Props {
  weeks: ProgramWeekDraft[];
  onChange: (weeks: ProgramWeekDraft[]) => void;
  /** First week a recipe may rewrite. Anything before it is sealed and read-only. */
  effectiveFromWeekIndex?: number;
}

interface WeekEditor {
  index: number;
  week: ProgramWeekDraft;
}

export function ProgramWeeksStep({ weeks, onChange, effectiveFromWeekIndex = 0 }: Props) {
  const tutorial = useTutorialControls();
  const [editor, setEditor] = useState<WeekEditor | null>(null);
  // The weeks are the source of truth. Deriving the recipe is what makes an
  // already-prefilled draft look selected on first render, without persisting a
  // second state that could disagree with the trajectory below it.
  const recipe = matchingProgramRecipe(weeks, effectiveFromWeekIndex);

  const updateEditor = (changes: Partial<ProgramWeekDraft>) => {
    setEditor((current) =>
      current === null ? null : { ...current, week: { ...current.week, ...changes } },
    );
  };

  const setPhase = (phase: ProgramPhase) => {
    updateEditor({ phase, loadIndex: SUGGESTED_LOAD_INDEX[phase] });
  };

  const applyRecipe = (id: ProgramRecipeId) => {
    onChange(
      applyProgramRecipe(id, weeks.length, {
        existing: weeks,
        effectiveFromWeekIndex,
      }),
    );
    tutorial?.report({ type: 'program-recipe-applied', recipe: id });
  };

  const saveEditor = () => {
    if (editor === null) return;
    onChange(weeks.map((week, index) => (index === editor.index ? editor.week : week)));
    setEditor(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-[var(--text-2)]">{t('program.weeksIntro')}</p>

      <div className="flex flex-col gap-2">
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {t('program.recipeIntro')}
        </span>
        {/*
          Pas de FilterChip : son chevron promet un sélecteur, or ces boutons
          appliquent. Même traitement plein/creux que les niveaux de la feuille.
        */}
        <div className="flex gap-2" data-tutorial-id="program-recipe">
          {PROGRAM_RECIPE_IDS.map((id) => {
            const label = t(RECIPE_LABEL_KEYS[id]);
            const active = recipe === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                aria-label={t('program.recipeApply', { name: label })}
                onClick={() => applyRecipe(id)}
                className={`min-h-12 flex-1 rounded-xl px-2 text-sm font-semibold
                  transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                  ${
                    active
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : 'bg-[var(--surface-2)] text-[var(--text-1)]'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {/*
        La phase est ce qu'on cherche du regard, donc c'est le titre. Le numéro
        passe en tête de ligne, discret, et le niveau finit à droite comme toute
        lecture chiffrée de l'app. Une Décharge se signale sur ce chiffre, pas
        en repeignant le mot.

        Pas de phrase d'intention ici : une recette la met sur presque chaque
        ligne et la liste ne se scanne plus. Elle vit dans la feuille, au moment
        où on choisit la phase.
      */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
        {weeks.map((week, index) => {
          const number = index + 1;
          const deload = week.phase === 'deload';
          // Le passé se lit, il ne s'ouvre pas : une semaine scellée n'est pas
          // un bouton désactivé, c'est une ligne.
          const sealed = week.weekIndex < effectiveFromWeekIndex;
          return (
            <ListRow
              key={week.weekIndex}
              // À l'oreille, trois colonnes valent moins qu'une phrase : on garde
              // la lecture compacte `05 — 60 % · Décharge` comme nom prononcé.
              {...(sealed
                ? {}
                : {
                    ariaLabel: t('program.editWeekReading', {
                      number,
                      line: weekLine(week),
                    }),
                    tutorialId: index === 0 ? 'program-week-row' : undefined,
                    onClick: () => {
                      setEditor({ index, week: { ...week } });
                      tutorial?.report({
                        type: 'program-week-opened',
                        weekIndex: week.weekIndex,
                      });
                    },
                  })}
              leading={
                <span
                  className={`record-figure text-sm font-semibold ${sealed ? 'opacity-50' : ''}`}
                >
                  {String(number).padStart(2, '0')}
                </span>
              }
              title={phaseLabel(week.phase)}
              trailing={
                <span
                  className={`record-figure text-sm ${
                    deload ? 'font-semibold text-[var(--accent-ink)]' : ''
                  }`}
                >
                  {t('program.loadIndexPreset', { value: week.loadIndex })}
                </span>
              }
            />
          );
        })}
      </div>

      <Sheet
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={t('program.editWeekTitle', { number: (editor?.index ?? 0) + 1 })}
      >
        {editor && (
          <div className="flex flex-col gap-6 pb-5">
            <label className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.phaseLabel')}
              </span>
              <select
                aria-label={t('program.phaseLabel')}
                value={editor.week.phase}
                onChange={(event) => setPhase(event.target.value as ProgramPhase)}
                className="min-h-12 rounded-lg bg-[var(--surface-2)] px-4 text-base
                  text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]"
              >
                {PROGRAM_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {t(PHASE_LABEL_KEYS[phase])}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.loadIndexLabel')}
              </span>
              <div className="grid grid-cols-5 gap-2">
                {LOAD_INDEX_PRESETS.map((value) => {
                  const active = editor.week.loadIndex === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      aria-label={t('program.loadIndexPreset', { value })}
                      onClick={() => updateEditor({ loadIndex: value })}
                      className={`record-figure min-h-12 rounded-xl text-sm font-semibold
                        transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                        ${
                          active
                            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-1)]'
                        }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <NumberInput
                aria-label={t('program.loadIndexLabel')}
                value={editor.week.loadIndex}
                onChange={(loadIndex) => updateEditor({ loadIndex: loadIndex ?? 100 })}
                step={1}
                min={MIN_LOAD_INDEX}
                max={MAX_LOAD_INDEX}
                integer
                suffix="%"
              />
              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {t('program.loadRule.hint')}
              </p>
            </div>

            {/* La règle avant le bouton : on lit ce que le niveau qu'on vient
                de choisir va faire aux charges, pas ce qu'il pourrait vouloir
                dire. */}
            <p className="text-sm leading-relaxed text-[var(--text-1)]">
              {loadRuleReading(editor.week)}
            </p>

            <Button type="button" variant="primary" fullWidth onClick={saveEditor}>
              {t('program.saveWeek')}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
