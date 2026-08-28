import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import { hudPlacement } from './tutorialHudPosition';

/** Au bout de ce délai, une cible absente cesse d'être une attente et devient une impasse. */
const STUCK_AFTER_MS = 6_000;

export interface TutorialHudProps {
  /** Le rectangle réel de l'ancre, mesuré en amont — jamais recalculé ici. */
  targetRect: DOMRect | null;
  /**
   * L'étape désigne une commande qui n'est pas encore là.
   *
   * Différent de `targetRect === null` : un chapitre peut parler de l'écran
   * entier et n'avoir rien à encadrer. Ici, il y a bien quelque chose à
   * montrer, et on ne le trouve pas — le panneau se tait alors au lieu de lire
   * une consigne devant un bouton absent.
   */
  awaitingTarget?: boolean;
  index: number;
  count: number;
  label: string;
  title: string;
  instruction: string;
  detail: string;
  /** Une phrase de plus quand l'écran décrit ne peut pas être ouvert. */
  notice?: string;
  advanceKind: 'manual' | 'event';
  dismissLabel: string;
  onContinue: () => void;
  onDismiss: () => void;
  onRetry?: () => void;
}

/**
 * Le panneau unique du tutoriel : visite, campagne et missions.
 *
 * Il y en avait deux, qui ne se ressemblaient pas et ne tenaient pas les mêmes
 * promesses. Celui de la visite ouvrait sa transcription au montage et pouvait
 * couvrir 359 px sur 844 — la moitié de ce qu'il expliquait. Celui des missions
 * savait se placer à l'opposé de sa cible mais n'avait ni progression ni sortie
 * autre que « passer ».
 *
 * Une seule phrase visible, le détail replié, et une hauteur bornée à 28 % de
 * l'écran : ce qu'on lit doit tenir sous ce qu'on regarde.
 */
export function TutorialHud({
  targetRect,
  awaitingTarget = false,
  index,
  count,
  label,
  title,
  instruction,
  detail,
  notice,
  advanceKind,
  dismissLabel,
  onContinue,
  onDismiss,
  onRetry,
}: TutorialHudProps) {
  /*
   * Les deux états portent l'étape qui les a produits.
   *
   * Le détail se replie et le compteur d'impasse se remet à zéro **pendant le
   * rendu** de l'étape suivante, sans passer par un effet qui les corrigerait
   * après coup — c'est-à-dire sans une image où le détail de l'étape précédente
   * reste ouvert sous une consigne qui a changé. Même motif que
   * `useTutorialAnchor`.
   */
  const [opened, setOpened] = useState<string | null>(null);
  const [stuckOn, setStuckOn] = useState<string | null>(null);
  const expanded = opened === instruction;
  const stuck = awaitingTarget && stuckOn === instruction;

  useEffect(() => {
    if (!awaitingTarget) return;
    const timer = window.setTimeout(() => setStuckOn(instruction), STUCK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingTarget, instruction]);

  const placement = hudPlacement(targetRect, { height: window.innerHeight });
  const inset = 6;

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-live="polite">
      {targetRect !== null && (
        <span
          aria-hidden="true"
          className="absolute rounded-2xl ring-2 ring-[var(--accent-ink)]
            shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]
            transition-[top,left,width,height] duration-[var(--dur-2)] ease-[var(--ease-mech)]
            motion-reduce:transition-none"
          style={{
            top: Math.max(0, targetRect.top - inset),
            left: Math.max(0, targetRect.left - inset),
            width: targetRect.width + inset * 2,
            height: targetRect.height + inset * 2,
          }}
        />
      )}

      <section
        role="region"
        aria-label={label}
        data-placement={placement}
        className={`pointer-events-auto safe-bottom absolute right-3 left-3 mx-auto
          max-h-[28dvh] max-w-[34rem] overflow-hidden rounded-2xl border border-[var(--border)]
          bg-[var(--surface-1)] shadow-[0_18px_48px_rgba(0,0,0,0.45)] ${
            placement === 'top' ? 'top-[calc(env(safe-area-inset-top)+0.75rem)]' : 'bottom-[4.5rem]'
          }`}
      >
        {count > 1 && (
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
        )}

        <div className="px-4 pt-3 pb-2">
          <div className="flex items-baseline gap-2">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--text-1)]">
              {title}
            </h2>
            <span className="record-figure shrink-0 text-xs text-[var(--text-2)]">
              {t('tutorial.hud.counter', { index: index + 1, count })}
            </span>
          </div>

          {awaitingTarget ? (
            <p className="mt-2 text-sm leading-snug text-[var(--text-2)]">
              {t(stuck ? 'tutorial.hud.stuck' : 'tutorial.hud.loadingTarget')}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm leading-snug text-[var(--text-1)]">{instruction}</p>
              {notice !== undefined && (
                <p className="mt-2 text-xs leading-snug text-[var(--text-2)]">{notice}</p>
              )}
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="tutorial-hud-detail"
                onClick={() => setOpened(expanded ? null : instruction)}
                className="mt-1 min-h-12 text-sm font-semibold text-[var(--text-2)]"
              >
                {t(expanded ? 'tutorial.hud.hideDetail' : 'tutorial.hud.readDetail')}
              </button>
              <div
                id="tutorial-hud-detail"
                aria-hidden={!expanded}
                className={`grid transition-[grid-template-rows,opacity] duration-[var(--dur-2)]
                  ease-[var(--ease-mech)] motion-reduce:transition-none ${
                    expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
              >
                <div className="overflow-hidden">
                  <p className="pb-1 text-sm leading-relaxed text-[var(--text-2)]">{detail}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-[var(--border)] px-2 py-1">
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-12 px-3 text-sm font-semibold text-[var(--text-2)]"
          >
            {dismissLabel}
          </button>
          <span className="flex-1" />
          {awaitingTarget && stuck && onRetry !== undefined && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-12 px-3 text-sm font-semibold text-[var(--accent-ink)]"
            >
              {t('tutorial.hud.retry')}
            </button>
          )}
          {!awaitingTarget && advanceKind === 'manual' && (
            <button
              type="button"
              onClick={onContinue}
              className="min-h-12 px-3 text-sm font-semibold text-[var(--accent-ink)]"
            >
              {t('tutorial.hud.continue')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
