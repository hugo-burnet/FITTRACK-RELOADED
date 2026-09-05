import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { primeAnnouncer } from '@/audio/announce';
import { textOf } from '@/audio/cues';
import { guidancePolicy, type AnnouncerMode } from '@/audio/announcer';
import { countCompletedWorkouts } from '@/data/repositories/history';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { t, type TranslationKey } from '@/i18n/fr';
import { applyAnnouncerMode, loadAnnouncerMode } from '@/stores/announcer';
import { loadEffortPrompt } from '@/stores/effortPrompt';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { ActionSheet, Button, Sheet } from '@/ui';
import { TutorialContext, type TutorialControls } from './tutorialContext';
import { TutorialHud } from './TutorialHud';
import { TutorialMissionCoach } from './TutorialMissionCoach';
import { contextualMissionsForPath } from './tutorialMissions';
import { playTutorialNarration, stopTutorialNarration } from './tutorialNarration';
import {
  contextualTutorial,
  FULL_TUTORIAL,
  spotlightSelector,
  TUTORIAL_TOPIC_LABEL_KEYS,
  tutorialTopicForPath,
  type TutorialStep,
} from './tutorialScript';
import { loadTutorialState } from './tutorialStore';
import type { TutorialCompletion } from './tutorialTypes';
import { useTutorialAnchor } from './useTutorialAnchor';
import { useTutorialMissions } from './useTutorialMissions';
import { isWorkoutAudioBusy } from './workoutAudioBusy';

type TourKind = 'full' | 'contextual';
type Phase = 'idle' | 'prompt' | 'help' | 'tour' | 'voice-choice' | 'campaign';

const AUDIO_OPTIONS: { mode: AnnouncerMode; labelKey: TranslationKey; hintKey: TranslationKey }[] =
  [
    { mode: 'voice', labelKey: 'tutorial.modeVoice', hintKey: 'tutorial.modeVoiceHint' },
    {
      mode: 'voice-only',
      labelKey: 'tutorial.modeVoiceOnly',
      hintKey: 'tutorial.modeVoiceOnlyHint',
    },
    { mode: 'sounds', labelKey: 'tutorial.modeSounds', hintKey: 'tutorial.modeSoundsHint' },
    { mode: 'silence', labelKey: 'tutorial.modeSilence', hintKey: 'tutorial.modeSilenceHint' },
  ];

export function TutorialProvider({ children }: { children: ReactNode }) {
  const navigate = useAppNavigate();
  const { pathname } = useLocation();
  const [phase, setPhase] = useState<Phase>(() =>
    loadTutorialState().orientation === null ? 'prompt' : 'idle',
  );
  const [steps, setSteps] = useState<readonly TutorialStep[]>(FULL_TUTORIAL);
  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<TourKind>('full');
  const [completion, setCompletion] = useState<TutorialCompletion>('completed');
  const current = steps[index];
  // Mesurée en continu : la route du chapitre vient d’être demandée, et l’écran
  // qu’elle amène — chargé paresseusement, rempli par Dexie — n’existe pas
  // encore à la première image.
  const tourRect = useTutorialAnchor(
    phase === 'tour' && current !== undefined ? spotlightSelector(current.spotlight) : null,
  );
  const topic = tutorialTopicForPath(pathname);
  const activeWorkout = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const hasActiveWorkout = activeWorkout === undefined ? null : activeWorkout !== null;
  /*
   * Une mission d'historique n'a rien à proposer devant un historique vide.
   *
   * Le compte est demandé plutôt que la liste : c'est la seule chose à en
   * savoir ici, et l'aide s'ouvre sur n'importe quel écran — y compris pendant
   * une séance, où lire tout l'historique pour afficher trois entrées de menu
   * serait payé à chaque écriture.
   */
  const completedWorkouts = useLiveQuery(countCompletedWorkouts);
  /*
   * Le mode d'annonce, suivi et non relu à l'aveugle.
   *
   * Il était lu au rendu, comme la bande d'effort, au motif qu'il ne change que
   * depuis les Réglages. C'est vrai, et c'est précisément le problème : les
   * missions des Réglages parlent de commandes que ce mode fait apparaître et
   * disparaître, et elles se jouent sur cet écran-là. Le suivre est ce qui
   * permet à une mission de se retirer quand sa commande s'en va.
   */
  const [announcerMode, setAnnouncerMode] = useState<AnnouncerMode>(loadAnnouncerMode);
  const missionFacts = useMemo(
    () => ({
      hasActiveWorkout,
      hasHistory: completedWorkouts === undefined ? null : completedWorkouts > 0,
      // Lue au rendu et non observée : elle ne change que depuis les Réglages,
      // donc jamais pendant qu'une aide de page est ouverte ailleurs.
      hasEffortPrompt: loadEffortPrompt(),
      hasRepPacing: guidancePolicy(announcerMode).repPacing,
      hasAudibleGuidance: announcerMode !== 'silence',
    }),
    [announcerMode, completedWorkouts, hasActiveWorkout],
  );
  const missions = useTutorialMissions(pathname, navigate, missionFacts);
  const pacer = useRepPacer();
  const rest = useRestTimer();
  const hold = useHoldTimer();
  // Opening the help sheet renders this again, so expired wall-clock timers
  // cease blocking immediately even if their store identity was never cleared.
  const workoutAudioBusy = isWorkoutAudioBusy(pacer, rest, hold);

  /** Le mode appliqué **et** retenu : les gardes des missions le relisent. */
  const applyMode = useCallback((mode: AnnouncerMode) => {
    applyAnnouncerMode(mode);
    setAnnouncerMode(mode);
  }, []);

  const showVoiceChoice = useCallback((result: TutorialCompletion) => {
    primeAnnouncer();
    stopTutorialNarration();
    setCompletion(result);
    setPhase('voice-choice');
  }, []);

  const finishCurrent = useCallback(() => {
    stopTutorialNarration();
    if (kind === 'full') showVoiceChoice('completed');
    else setPhase('idle');
  }, [kind, showVoiceChoice]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) finishCurrent();
    else setIndex((current) => current + 1);
  }, [finishCurrent, index, steps.length]);

  useEffect(() => {
    if (phase !== 'tour') return;
    const step = steps[index];
    if (step?.route !== undefined && pathname !== step.route) navigate(step.route);
  }, [index, navigate, pathname, phase, steps]);

  /*
   * La voix accompagne le chapitre ; elle ne le fait plus avancer.
   *
   * L'ancienne visite enchaînait sur la fin du clip, ou sur un minuteur de
   * secours quand il n'y avait pas de clip. Le rythme appartenait alors à
   * l'enregistrement : lire lentement, relire une phrase, regarder ce qui est
   * encadré, et l'écran avait déjà changé. Un chapitre se termine désormais
   * parce qu'on appuie sur « Suivant » — et la fin du clip ne fait que
   * refermer la transcription.
   */
  useEffect(() => {
    if (phase !== 'tour') return;
    const step = steps[index];
    if (step === undefined) return;
    void playTutorialNarration(step.clip, () => undefined);
    return stopTutorialNarration;
  }, [index, phase, steps]);

  const startFull = () => {
    primeAnnouncer();
    setSteps(FULL_TUTORIAL);
    setIndex(0);
    setKind('full');
    setCompletion('completed');
    setPhase('tour');
  };

  const startContextual = () => {
    primeAnnouncer();
    setSteps(contextualTutorial(topic));
    setIndex(0);
    setKind('contextual');
    setPhase('tour');
  };

  const skipTour = () => {
    if (kind === 'full') showVoiceChoice('skipped');
    else {
      stopTutorialNarration();
      setPhase('idle');
    }
  };

  const chooseAudio = (mode: AnnouncerMode) => {
    stopTutorialNarration();
    applyMode(mode);
    missions.setOrientation(completion);
    setPhase('idle');
    navigate('/', { replace: true });
  };

  const dismissWelcome = () => {
    stopTutorialNarration();
    applyMode('silence');
    missions.setOrientation('skipped');
    setPhase('idle');
  };

  const reportToMissions = missions.report;
  const controls = useMemo<TutorialControls>(
    () => ({
      openHelp: () => phase === 'idle' && setPhase('help'),
      startMission: missions.start,
      offerMission: missions.offer,
      report: (event) => {
        // Le mode traverse ici parce que les gardes en dépendent : c'est le
        // seul endroit qui voit le changement au moment où il a lieu.
        if (event.type === 'announcer-mode-changed') setAnnouncerMode(event.mode);
        reportToMissions(event);
      },
    }),
    [missions.offer, missions.start, phase, reportToMissions],
  );
  // Every mode has a row here, so the fallback never runs — it is what lets
  // the reading below be a plain value rather than an optional one.
  const currentModeOption =
    AUDIO_OPTIONS.find((option) => option.mode === announcerMode) ?? AUDIO_OPTIONS[0]!;

  return (
    <TutorialContext.Provider value={controls}>
      {children}

      <Sheet
        open={phase === 'prompt'}
        onClose={dismissWelcome}
        title={t('tutorial.audioWelcomeTitle')}
      >
        <p className="text-base leading-relaxed text-[var(--text-1)]">{t('tutorial.promptBody')}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
          {t('tutorial.promptReplay')}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              applyMode('voice');
              startFull();
            }}
          >
            {t('tutorial.startWithVoice')}
          </Button>
          <Button
            size="lg"
            fullWidth
            onClick={() => {
              applyMode('silence');
              startFull();
            }}
          >
            {t('tutorial.startWithoutVoice')}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={dismissWelcome}>
            {t('tutorial.skip')}
          </Button>
        </div>
      </Sheet>

      <ActionSheet
        open={phase === 'help'}
        onClose={() => setPhase('idle')}
        title={t('tutorial.helpTitle')}
        actions={[
          {
            label: t('tutorial.campaign.title'),
            onSelect: () => setPhase('campaign'),
          },
          /*
           * Toutes, et non les trois premières. Le plafond était une garde
           * contre une feuille trop longue, mais `contextualMissionsForPath`
           * filtre déjà dur — zone, disponibilité, joignabilité, et les
           * missions faites disparaissent — donc la liste est courte par
           * construction et raccourcit à l'usage. Ce qu'il coûtait est pire que
           * ce qu'il évitait : une quatrième mission sur une même zone
           * existait sans qu'aucun écran ne sache la proposer. La feuille
           * défile déjà (`Sheet` : max-h-[88%] overflow-y-auto).
           */
          ...contextualMissionsForPath(pathname, missions.state, missionFacts).map((mission) => ({
            label: t(mission.titleKey),
            onSelect: () => missions.start(mission.id),
          })),
          {
            label: t('tutorial.explainPage', { topic: t(TUTORIAL_TOPIC_LABEL_KEYS[topic]) }),
            hint: workoutAudioBusy ? t('tutorial.busyHint') : t('tutorial.explainDuration'),
            disabled: workoutAudioBusy,
            onSelect: startContextual,
          },
          {
            label: t('tutorial.restartFull'),
            hint: workoutAudioBusy ? t('tutorial.busyHint') : t('tutorial.fullDuration'),
            disabled: workoutAudioBusy,
            onSelect: startFull,
          },
        ]}
      />

      <Sheet
        open={phase === 'voice-choice'}
        onClose={() => chooseAudio(announcerMode)}
        title={t('tutorial.voiceChoiceTitle')}
      >
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('tutorial.audioChoiceBody')}
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl bg-[var(--surface-2)]">
          {AUDIO_OPTIONS.map(({ mode, labelKey, hintKey }) => (
            <button
              key={mode}
              type="button"
              onClick={() => chooseAudio(mode)}
              className="flex min-h-16 w-full flex-col justify-center border-b border-[var(--border)]
                px-4 py-3 text-left last:border-b-0 active:bg-[var(--surface-1)]"
            >
              <span className="font-semibold text-[var(--text-1)]">{t(labelKey)}</span>
              <span className="mt-0.5 text-sm text-[var(--text-2)]">{t(hintKey)}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[var(--text-2)]">
          {t('tutorial.currentMode', { mode: t(currentModeOption.labelKey) })}
        </p>
      </Sheet>

      <Sheet
        open={phase === 'campaign'}
        onClose={() => setPhase('idle')}
        title={t('tutorial.campaign.title')}
      >
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('tutorial.campaign.body')}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={missionFacts.hasActiveWorkout !== false}
            onClick={() => {
              if (missions.startCampaign()) setPhase('idle');
            }}
          >
            {t('tutorial.campaign.start')}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={() => {
              missions.postponeCampaign();
              setPhase('idle');
            }}
          >
            {t('tutorial.campaign.later')}
          </Button>
        </div>
      </Sheet>

      {/* Jamais ailleurs que sur l'écran de l'étape : une consigne lue devant
          une page qui ne la contient pas ne s'explique pas, elle s'endure. Sur
          la bonne page mais sans la commande, le panneau attend au lieu de
          parler — c'est `awaitingTarget`. */}
      {missions.activeMission !== null && missions.onStepScreen && phase === 'idle' && (
        <TutorialMissionCoach
          mission={missions.activeMission}
          stepIndex={missions.state.activeStepIndex}
          rect={missions.anchorRect}
          awaitingTarget={!missions.stepReady}
          onContinue={missions.advanceManually}
          onDismiss={missions.dismiss}
          onRetry={missions.retryStep}
        />
      )}

      {phase === 'tour' && current !== undefined && (
        <TutorialHud
          key={`${kind}:${String(index)}:${current.id}`}
          targetRect={tourRect}
          index={index}
          count={steps.length}
          label={t('tutorial.tourLabel')}
          title={
            current.id === 'intro'
              ? t('tutorial.introTitle')
              : t(TUTORIAL_TOPIC_LABEL_KEYS[current.topic])
          }
          instruction={t(current.summaryKey)}
          detail={textOf(current.clip) ?? ''}
          notice={current.offScreen === true ? t('tutorial.offScreenNotice') : undefined}
          advanceKind="manual"
          dismissLabel={t('tutorial.skip')}
          onContinue={next}
          onDismiss={skipTour}
        />
      )}
    </TutorialContext.Provider>
  );
}
