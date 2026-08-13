import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';

export type ProgramEditorStep = 'basics' | 'split' | 'weeks';

const STEP_NUMBER: Record<ProgramEditorStep, number> = { basics: 1, split: 2, weeks: 3 };
const STEP_NAME: Record<ProgramEditorStep, TranslationKey> = {
  basics: 'program.stepBasics',
  split: 'program.stepSplit',
  weeks: 'program.stepWeeks',
};

/**
 * Creation only. Editing an existing block is a scroll, not a wizard: there is
 * no step to count once every section is already on screen.
 *
 * La phrase nomme déjà l'étape courante : répéter les trois noms en dessous,
 * c'est écrire « Semaines » deux fois. La progression se montre, elle ne se
 * relit pas — d'où le rail, le même trait d'accent que la liste des séances de
 * la semaine.
 */
export function ProgramStepNav({ step }: { step: ProgramEditorStep }) {
  const sentence = t('program.stepProgress', {
    current: STEP_NUMBER[step],
    name: t(STEP_NAME[step]),
  });

  return (
    <nav aria-label={sentence}>
      <p aria-current="step" className="text-sm font-semibold text-[var(--text-1)]">
        {sentence}
      </p>
      <ol aria-hidden="true" className="mt-2 flex gap-1.5">
        {([1, 2, 3] as const).map((n) => (
          <li
            key={n}
            className={`h-0.5 flex-1 rounded-full ${
              n <= STEP_NUMBER[step] ? 'bg-[var(--color-accent)]' : 'bg-[var(--border)]'
            }`}
          />
        ))}
      </ol>
    </nav>
  );
}
