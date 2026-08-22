import { useEffect, useLayoutEffect, useRef } from 'react';
import { t } from '@/i18n/fr';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import type { TutorialMission } from './tutorialMissions';
import { playTutorialNarration, stopTutorialNarration } from './tutorialNarration';
import { useTutorialAnchor } from './useTutorialAnchor';
import { isWorkoutAudioBusy } from './workoutAudioBusy';

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
  const rect = useTutorialAnchor(
    step === undefined ? null : `[data-tutorial-id="${step.targetId}"]`,
  );

  /*
   * La consigne se dit une fois, en arrivant sur l'étape — et seulement si rien
   * ne parle déjà.
   *
   * `playTutorialNarration` ne passe pas par `planCue` : il ne connaît ni les
   * priorités ni les temps de silence, il joue. Or quatre missions se déroulent
   * pendant la séance, où le décompte du repos, la cadence et le chrono sont
   * calés sur l'horloge murale et ne se mettent pas en file d'attente. Une
   * consigne par-dessus un « trois, deux, un », c'est le décompte qu'on perd,
   * et c'est lui qui compte sous la barre. Le texte, lui, reste à l'écran —
   * exactement comme en mode Silence.
   *
   * L'occupation est lue dans une référence et non dans les dépendances :
   * l'effet ne doit se rejouer que sur l'étape. Une horloge qui démarre ensuite
   * n'interrompt pas une consigne déjà commencée, et une horloge qui s'arrête ne
   * déclenche pas après coup une consigne qu'on a laissé passer — même
   * discipline que le reste : jamais de rattrapage.
   */
  const pacer = useRepPacer();
  const rest = useRestTimer();
  const hold = useHoldTimer();
  const busy = isWorkoutAudioBusy(pacer, rest, hold);
  const busyRef = useRef(busy);
  // Écrit dans un effet de disposition et non pendant le rendu : les effets de
  // disposition passent tous avant les effets passifs, donc la référence est à
  // jour quand la narration décide. Même motif que `RestRail`.
  useLayoutEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const clipId = step?.clipId;
  useEffect(() => {
    if (clipId === undefined || busyRef.current) return;
    void playTutorialNarration(clipId, () => undefined);
    return () => stopTutorialNarration();
  }, [clipId]);

  /*
   * Amener la cible à l'écran une fois, en arrivant sur l'étape.
   *
   * Séparé de la mesure, qui tourne désormais en continu : faire défiler à
   * chaque mesure, c'est reprendre la main sur le doigt de l'utilisateur dès
   * qu'une carte se replie ailleurs dans la page.
   */
  const targetId = step?.targetId;
  useEffect(() => {
    if (targetId === undefined) return;
    const frame = requestAnimationFrame(() => {
      const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth';
      document
        .querySelector<HTMLElement>(`[data-tutorial-id="${targetId}"]`)
        ?.scrollIntoView?.({ block: 'nearest', behavior });
    });
    return () => cancelAnimationFrame(frame);
  }, [targetId]);

  if (step === undefined) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-live="polite">
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
          rect === null || rect.top > window.innerHeight / 2 ? 'top-[5rem]' : 'bottom-[4.5rem]'
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
