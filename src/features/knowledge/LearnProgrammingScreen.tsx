import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { t } from '@/i18n/fr';
import { articleHref } from './articleCatalogue';
import { KnowledgeScreenFrame } from './KnowledgeScreenFrame';
import { loadReadSteps, resolveLearningPath, saveReadSteps } from './learningPath';

/**
 * Le parcours « Apprendre à programmer ».
 *
 * Ce n'est pas un tutoriel à dérouler : chaque étape tient en une phrase, et on
 * ouvre l'article seulement si on veut le détail. Le but est qu'on puisse
 * construire un premier programme sans avoir lu les dix-neuf pages du Guide, et
 * sans avoir à deviner par où commencer.
 *
 * La case « lu » est une commodité de lecture, pas une donnée d'entraînement :
 * elle vit dans `localStorage` et son absence ne casse rien.
 */
export function LearnProgrammingScreen() {
  const navigate = useAppNavigate();
  const steps = resolveLearningPath();
  const [read, setRead] = useState<ReadonlySet<string>>(() => loadReadSteps());

  const toggle = (articleId: string) => {
    const next = new Set(read);
    if (next.has(articleId)) next.delete(articleId);
    else next.add(articleId);
    setRead(next);
    saveReadSteps(next);
  };

  const done = steps.filter((step) => read.has(step.article.articleId)).length;

  return (
    <KnowledgeScreenFrame
      title={t('learn.title')}
      onBack={() => void navigate('/knowledge')}
      action={
        <span className="record-figure text-sm text-[var(--text-2)]">
          {t('learn.progress', { done, total: steps.length })}
        </span>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl bg-[var(--accent-soft)] p-5">
          <p className="text-sm leading-6 text-[var(--text-1)]">{t('learn.intro')}</p>
        </section>

        <ol className="space-y-3">
          {steps.map((step, index) => {
            const isRead = read.has(step.article.articleId);
            return (
              <li key={step.article.articleId} className="rounded-2xl bg-[var(--surface-1)] p-5">
                <div className="flex items-baseline gap-3">
                  <span className="record-figure shrink-0 text-sm text-[var(--text-2)]">
                    {index + 1}
                  </span>
                  <h2 className="min-w-0 flex-1 text-base font-semibold leading-6 text-[var(--text-1)]">
                    {step.article.title}
                  </h2>
                </div>

                <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{step.reason}</p>

                <div className="mt-3 flex items-center gap-3">
                  {/* min-h-12 = 48 px : une cible tactile pour une main en sueur. */}
                  <Link
                    viewTransition
                    to={articleHref(step.article)}
                    className="flex min-h-12 flex-1 items-center gap-2 text-sm font-semibold
                      text-[var(--accent-ink)]"
                  >
                    {t('learn.readStep')}
                    <span aria-hidden="true">→</span>
                  </Link>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isRead}
                    aria-label={t('learn.markRead', { title: step.article.title })}
                    onClick={() => toggle(step.article.articleId)}
                    className={`flex min-h-12 shrink-0 items-center rounded-xl px-4 text-sm
                      font-semibold transition-colors duration-[var(--dur-1)]
                      ${
                        isRead
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-2)]'
                      }`}
                  >
                    {isRead ? t('learn.readDone') : t('learn.readTodo')}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <section className="border-t border-[var(--border)] px-1 pt-5">
          <h2 className="label-xs font-semibold text-[var(--text-2)]">{t('learn.limitTitle')}</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">{t('learn.limitBody')}</p>
        </section>
      </div>
    </KnowledgeScreenFrame>
  );
}
