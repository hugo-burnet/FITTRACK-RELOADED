import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import type { TutorialMission } from './tutorialMissions';

export function TutorialMissionCoach({
  mission,
  stepIndex,
  onDismiss,
}: {
  mission: TutorialMission;
  stepIndex: number;
  onDismiss: () => void;
}) {
  const step = mission.steps[stepIndex];
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (step === undefined) return;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(`[data-tutorial-id="${step.targetId}"]`);
      setRect(target?.getBoundingClientRect() ?? null);
      target?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  if (step === undefined) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[65]" aria-live="polite">
      {rect !== null && (
        <span
          aria-hidden="true"
          className="absolute rounded-2xl ring-2 ring-[var(--accent-ink)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={{
            top: Math.max(0, rect.top - 6),
            left: Math.max(0, rect.left - 6),
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <section
        role="region"
        aria-label={t('tutorial.mission.label')}
        className={`pointer-events-auto safe-bottom absolute right-4 left-4 mx-auto max-w-[34rem] rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)] ${
          rect !== null && rect.top > window.innerHeight / 2 ? 'top-[5rem]' : 'bottom-[4.5rem]'
        }`}
      >
        <p className="label-xs font-semibold text-[var(--accent-ink)]">
          {t('tutorial.mission.counter', {
            index: stepIndex + 1,
            count: mission.steps.length,
          })}
        </p>
        <h2 className="mt-1 text-base font-semibold text-[var(--text-1)]">{t(mission.titleKey)}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-1)]">
          {t(step.instructionKey)}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">{t(step.detailKey)}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 min-h-12 px-2 text-sm font-semibold text-[var(--text-2)]"
        >
          {t('tutorial.mission.dismiss')}
        </button>
      </section>
    </div>
  );
}
