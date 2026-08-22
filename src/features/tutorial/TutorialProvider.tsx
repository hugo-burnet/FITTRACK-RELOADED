import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { primeAnnouncer } from '@/audio/announce';
import { textOf } from '@/audio/cues';
import type { AnnouncerMode } from '@/audio/announcer';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { t, type TranslationKey } from '@/i18n/fr';
import { applyAnnouncerMode, loadAnnouncerMode } from '@/stores/announcer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { ActionSheet, Button, Sheet } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';
import { TutorialContext, type TutorialControls } from './tutorialContext';
import { TutorialMissionCoach } from './TutorialMissionCoach';
import { contextualMissionsForPath } from './tutorialMissions';
import { playTutorialNarration, stopTutorialNarration } from './tutorialNarration';
import {
  contextualTutorial,
  FULL_TUTORIAL,
  TUTORIAL_TOPIC_LABEL_KEYS,
  TUTORIAL_VOICE_CHOICE_CLIP,
  tutorialTopicForPath,
  type TutorialStep,
} from './tutorialScript';
import { loadTutorialState } from './tutorialStore';
import type { TutorialCompletion } from './tutorialTypes';
import { useTutorialMissions } from './useTutorialMissions';
import { isWorkoutAudioBusy } from './workoutAudioBusy';

type TourKind = 'full' | 'contextual';
type Phase = 'idle' | 'prompt' | 'help' | 'tour' | 'voice-choice' | 'activation';

function TutorialOverlay({
  step,
  index,
  count,
  pathname,
  narrationActive,
  onPrevious,
  onNext,
  onSkip,
}: {
  step: TutorialStep;
  index: number;
  count: number;
  pathname: string;
  narrationActive: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [expanded, setExpanded] = useState(true);
  const userToggled = useRef(false);

  useEffect(() => {
    if (!narrationActive || userToggled.current) return;
    const timer = window.setTimeout(() => setExpanded(false), 1_800);
    return () => window.clearTimeout(timer);
  }, [narrationActive, step.id]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(`[data-tutorial-${step.target}]`);
      setRect(target?.getBoundingClientRect() ?? null);
    };
    frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [pathname, step]);

  const inset = 6;
  const focus =
    rect === null
      ? null
      : {
          top: Math.max(0, rect.top - inset),
          left: Math.max(0, rect.left - inset),
          right: Math.min(window.innerWidth, rect.right + inset),
          bottom: Math.min(window.innerHeight, rect.bottom + inset),
        };
  const scrim = 'bg-black/65';

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label={t('tutorial.tourLabel')}
    >
      {focus === null ? (
        <div className={`absolute inset-0 ${scrim}`} />
      ) : (
        <>
          <div className={`absolute inset-x-0 top-0 ${scrim}`} style={{ height: focus.top }} />
          <div
            className={`absolute left-0 ${scrim}`}
            style={{ top: focus.top, width: focus.left, height: focus.bottom - focus.top }}
          />
          <div
            className={`absolute right-0 ${scrim}`}
            style={{
              top: focus.top,
              width: window.innerWidth - focus.right,
              height: focus.bottom - focus.top,
            }}
          />
          <div className={`absolute inset-x-0 bottom-0 ${scrim}`} style={{ top: focus.bottom }} />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[1.25rem] border border-[var(--accent-ink)]
              shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-ink)_35%,transparent)]
              transition-[top,left,width,height] duration-[var(--dur-2)] ease-[var(--ease-mech)]"
            style={{
              top: focus.top,
              left: focus.left,
              width: focus.right - focus.left,
              height: focus.bottom - focus.top,
            }}
          />
          <div
            aria-hidden="true"
            className="absolute"
            style={{
              top: focus.top,
              left: focus.left,
              width: focus.right - focus.left,
              height: focus.bottom - focus.top,
            }}
          />
        </>
      )}

      <section
        className="safe-bottom absolute right-4 bottom-[4.5rem] left-4 mx-auto max-w-[34rem]
          max-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-[var(--border)]
          bg-[var(--surface-1)]
          shadow-[0_18px_48px_rgba(0,0,0,0.45)] transition-[max-height]
          duration-[var(--dur-2)] ease-[var(--ease-mech)]"
      >
        <div className="flex gap-1 px-4 pt-3" aria-hidden="true">
          {Array.from({ length: count }, (_, position) => (
            <span
              key={position}
              className={`h-[3px] flex-1 rounded-full ${
                position <= index ? 'bg-[var(--accent-ink)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="label-xs font-semibold text-[var(--accent-ink)]">
                {t('tutorial.stepCounter', {
                  index: String(index + 1).padStart(2, '0'),
                  count: String(count).padStart(2, '0'),
                })}
              </p>
              <h2 className="mt-1 truncate text-base font-semibold text-[var(--text-1)]">
                {step.id === 'intro'
                  ? t('tutorial.introTitle')
                  : t(TUTORIAL_TOPIC_LABEL_KEYS[step.topic])}
              </h2>
            </div>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls="tutorial-transcript"
              onClick={() => {
                userToggled.current = true;
                setExpanded((current) => !current);
              }}
              className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-2 text-sm
                font-semibold text-[var(--text-2)] active:bg-[var(--surface-2)]"
            >
              {t(expanded ? 'tutorial.collapseText' : 'tutorial.readText')}
              <ChevronDownIcon
                aria-hidden="true"
                className={`transition-transform duration-[var(--dur-2)] ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          <p className="mt-2 text-sm leading-snug text-[var(--text-2)]" aria-live="polite">
            {t(step.summaryKey)}
          </p>

          <div
            id="tutorial-transcript"
            aria-hidden={!expanded}
            className={`grid transition-[grid-template-rows,opacity] duration-[var(--dur-2)]
              ease-[var(--ease-mech)] ${
                expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
          >
            <div className="overflow-hidden">
              <div className="max-h-[42dvh] overflow-y-auto">
                <p
                  className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed
                  text-[var(--text-2)]"
                >
                  {textOf(step.clip)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center border-t border-[var(--border)] px-2 py-1">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-12 px-3 text-sm font-semibold text-[var(--text-2)]"
          >
            {t('tutorial.skip')}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            disabled={index === 0}
            onClick={onPrevious}
            className="min-h-12 px-3 text-sm font-semibold text-[var(--text-2)] disabled:opacity-30"
          >
            {t('tutorial.previous')}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="min-h-12 px-3 text-sm font-semibold text-[var(--accent-ink)]"
          >
            {t(index === count - 1 ? 'tutorial.finish' : 'tutorial.next')}
          </button>
        </div>
      </section>
    </div>
  );
}

const AUDIO_OPTIONS: { mode: AnnouncerMode; labelKey: TranslationKey; hintKey: TranslationKey }[] =
  [
    { mode: 'voice', labelKey: 'tutorial.modeVoice', hintKey: 'tutorial.modeVoiceHint' },
    { mode: 'sounds', labelKey: 'tutorial.modeSounds', hintKey: 'tutorial.modeSoundsHint' },
    { mode: 'silence', labelKey: 'tutorial.modeSilence', hintKey: 'tutorial.modeSilenceHint' },
  ];

export function TutorialProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [phase, setPhase] = useState<Phase>(() =>
    loadTutorialState().orientation === null ? 'prompt' : 'idle',
  );
  const [steps, setSteps] = useState<readonly TutorialStep[]>(FULL_TUTORIAL);
  const [index, setIndex] = useState(0);
  const [kind, setKind] = useState<TourKind>('full');
  const [completion, setCompletion] = useState<TutorialCompletion>('completed');
  const [narrationActive, setNarrationActive] = useState(false);
  const topic = tutorialTopicForPath(pathname);
  const activeWorkout = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const hasActiveWorkout = activeWorkout === undefined ? null : activeWorkout !== null;
  const missionFacts = useMemo(() => ({ hasActiveWorkout }), [hasActiveWorkout]);
  const missions = useTutorialMissions(pathname, navigate, missionFacts);
  const pacer = useRepPacer();
  const rest = useRestTimer();
  // Opening the help sheet renders this again, so expired wall-clock timers
  // cease blocking immediately even if their store identity was never cleared.
  const workoutAudioBusy = isWorkoutAudioBusy(pacer, rest);

  const showVoiceChoice = useCallback((result: TutorialCompletion) => {
    primeAnnouncer();
    stopTutorialNarration();
    setNarrationActive(false);
    setCompletion(result);
    setPhase('voice-choice');
  }, []);

  const finishCurrent = useCallback(() => {
    stopTutorialNarration();
    if (kind === 'full') showVoiceChoice('completed');
    else setPhase('idle');
  }, [kind, showVoiceChoice]);

  const next = useCallback(() => {
    setNarrationActive(false);
    if (index >= steps.length - 1) finishCurrent();
    else setIndex((current) => current + 1);
  }, [finishCurrent, index, steps.length]);

  useEffect(() => {
    if (phase !== 'tour') return;
    const step = steps[index];
    if (step?.route !== undefined && pathname !== step.route) navigate(step.route);
  }, [index, navigate, pathname, phase, steps]);

  useEffect(() => {
    if (phase !== 'tour') return;
    const step = steps[index];
    if (step === undefined) return;
    let cancelled = false;
    let timer: number | undefined;
    const ended = () => {
      if (!cancelled) {
        setNarrationActive(false);
        timer = window.setTimeout(next, 650);
      }
    };
    void playTutorialNarration(step.clip, ended).then((started) => {
      if (cancelled) return;
      setNarrationActive(started);
      if (!started) timer = window.setTimeout(next, step.fallbackMs);
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      stopTutorialNarration();
    };
  }, [index, next, phase, steps]);

  useEffect(() => {
    if (phase !== 'voice-choice') return;
    void playTutorialNarration(TUTORIAL_VOICE_CHOICE_CLIP, () => undefined);
    return stopTutorialNarration;
  }, [phase]);

  const startFull = () => {
    primeAnnouncer();
    setNarrationActive(false);
    setSteps(FULL_TUTORIAL);
    setIndex(0);
    setKind('full');
    setCompletion('completed');
    setPhase('tour');
  };

  const startContextual = () => {
    primeAnnouncer();
    setNarrationActive(false);
    setSteps(contextualTutorial(topic));
    setIndex(0);
    setKind('contextual');
    setPhase('tour');
  };

  const skipTour = () => {
    setNarrationActive(false);
    if (kind === 'full') showVoiceChoice('skipped');
    else {
      stopTutorialNarration();
      setPhase('idle');
    }
  };

  const chooseAudio = (mode: AnnouncerMode) => {
    stopTutorialNarration();
    applyAnnouncerMode(mode);
    const firstRun = missions.state.orientation === null;
    missions.setOrientation(completion);
    setPhase(firstRun ? 'activation' : 'idle');
    navigate('/', { replace: true });
  };

  const controls = useMemo<TutorialControls>(
    () => ({
      openHelp: () => phase === 'idle' && setPhase('help'),
      startMission: missions.start,
      offerMission: missions.offer,
      report: missions.report,
    }),
    [missions.offer, missions.report, missions.start, phase],
  );
  const current = steps[index];
  // Every mode has a row here, so the fallback never runs — it is what lets
  // the reading below be a plain value rather than an optional one.
  const currentMode = loadAnnouncerMode();
  const currentModeOption =
    AUDIO_OPTIONS.find((option) => option.mode === currentMode) ?? AUDIO_OPTIONS[0]!;

  return (
    <TutorialContext.Provider value={controls}>
      {children}

      <Sheet
        open={phase === 'prompt'}
        onClose={() => showVoiceChoice('skipped')}
        title={t('tutorial.tourLabel')}
      >
        <p className="text-base leading-relaxed text-[var(--text-1)]">{t('tutorial.promptBody')}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
          {t('tutorial.promptReplay')}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primary" size="lg" fullWidth onClick={startFull}>
            {t('tutorial.start')}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={() => showVoiceChoice('skipped')}>
            {t('tutorial.skip')}
          </Button>
        </div>
      </Sheet>

      <ActionSheet
        open={phase === 'help'}
        onClose={() => setPhase('idle')}
        title={t('tutorial.helpTitle')}
        actions={[
          ...contextualMissionsForPath(pathname, missions.state, missionFacts)
            .slice(0, 3)
            .map((mission) => ({
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
        onClose={() => chooseAudio(loadAnnouncerMode())}
        title={t('tutorial.voiceChoiceTitle')}
      >
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {textOf(TUTORIAL_VOICE_CHOICE_CLIP)}
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
        open={phase === 'activation'}
        onClose={() => setPhase('idle')}
        title={t('tutorial.activation.title')}
      >
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('tutorial.activation.body')}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={missionFacts.hasActiveWorkout !== false}
            onClick={() => {
              if (missions.chooseActivation('template')) setPhase('idle');
            }}
          >
            {t('tutorial.activation.template')}
          </Button>
          <Button
            size="lg"
            fullWidth
            disabled={missionFacts.hasActiveWorkout !== false}
            onClick={() => {
              if (missions.chooseActivation('blank')) setPhase('idle');
            }}
          >
            {t('tutorial.activation.blank')}
          </Button>
          <Button variant="ghost" size="lg" fullWidth onClick={() => setPhase('idle')}>
            {t('tutorial.activation.later')}
          </Button>
        </div>
      </Sheet>

      {missions.activeMission !== null && phase === 'idle' && (
        <TutorialMissionCoach
          mission={missions.activeMission}
          stepIndex={missions.state.activeStepIndex}
          onDismiss={missions.dismiss}
        />
      )}

      {phase === 'tour' && current !== undefined && (
        <TutorialOverlay
          key={`${kind}:${String(index)}:${current.id}`}
          step={current}
          index={index}
          count={steps.length}
          pathname={pathname}
          narrationActive={narrationActive}
          onPrevious={() => {
            setNarrationActive(false);
            setIndex((position) => Math.max(0, position - 1));
          }}
          onNext={next}
          onSkip={skipTour}
        />
      )}
    </TutorialContext.Provider>
  );
}
