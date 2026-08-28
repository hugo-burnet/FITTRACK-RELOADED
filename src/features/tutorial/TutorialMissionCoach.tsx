import { useEffect, useLayoutEffect, useRef } from 'react';
import { t } from '@/i18n/fr';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { TutorialHud } from './TutorialHud';
import type { TutorialMission } from './tutorialMissions';
import { playTutorialNarration, stopTutorialNarration } from './tutorialNarration';
import { isWorkoutAudioBusy } from './workoutAudioBusy';

/**
 * La mission en cours, portée par le panneau commun.
 *
 * Ce composant ne dessine plus rien : il ne garde que ce qui est propre à une
 * mission — dire la consigne une fois, et amener sa cible à l'écran.
 */
export function TutorialMissionCoach({
  mission,
  stepIndex,
  rect,
  awaitingTarget = false,
  onContinue,
  onDismiss,
  onRetry,
}: {
  mission: TutorialMission;
  stepIndex: number;
  /**
   * Mesurée par `useTutorialMissions`, pas ici.
   *
   * C'est la même mesure qui décide que l'étape est prête à parler et qui
   * place le cadre. En la refaisant, ce composant ouvrait un second observateur
   * sur le même élément — deux boucles d'images pour un seul rectangle, et deux
   * réponses possibles à « la cible est-elle là ? ».
   */
  rect: DOMRect | null;
  awaitingTarget?: boolean;
  onContinue: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
}) {
  const step = mission.steps[stepIndex];

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

  // Rien n'est dit tant que la commande décrite n'est pas là : ce serait une
  // consigne devant un écran qui ne la contient pas encore.
  const clipId = awaitingTarget ? undefined : step?.clipId;
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
    <TutorialHud
      targetRect={rect}
      awaitingTarget={awaitingTarget}
      index={stepIndex}
      count={mission.steps.length}
      label={t('tutorial.mission.label')}
      title={t(mission.titleKey)}
      instruction={t(step.instructionKey)}
      detail={t(step.detailKey)}
      advanceKind={step.advance.kind}
      dismissLabel={t('tutorial.mission.dismiss')}
      onContinue={onContinue}
      onDismiss={onDismiss}
      onRetry={onRetry}
    />
  );
}
