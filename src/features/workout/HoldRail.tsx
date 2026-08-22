import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import { formatRest } from '@/lib/rest';
import type { HoldTimer } from '@/stores/holdTimer';
import { armHoldChrono } from './holdBeats';
import { fireCountdown } from './restCountdown';

/**
 * Le chrono du maintien en cours : il arme les repères, dit depuis combien de
 * temps on tient, et s'arrête avec la série.
 *
 * Monté avec la clé du set, comme la barre de repos et le métronome : la vie du
 * composant **est** celle du maintien, donc rien n'a à être annulé à la main
 * quand la série se termine ou qu'on relâche.
 *
 * Un relevé, pas une commande : il s'affiche dans le bouton de repli de
 * l'en-tête, et un bouton dans un bouton n'est pas valide. Arrêter, c'est le
 * carré à côté — cf. `WorkoutExerciseCard`.
 */
export function HoldRail({ hold }: { hold: HoldTimer & { setId: string } }) {
  useEffect(
    () => armHoldChrono(hold.startedAt),
    // Réarmé sur l'identité du maintien, jamais sur celle d'un callback.
    [hold.setId, hold.startedAt],
  );

  // Une préparation n'est pas un silence. Le 3–2–1 parlé n'est armé qu'à T−3
  // pour qu'il ne réserve pas la file vocale dix secondes trop tôt.
  useEffect(() => {
    const leadMs = hold.startedAt - Date.now();
    if (leadMs <= 0) return;
    const id = setTimeout(() => fireCountdown(hold.startedAt), Math.max(0, leadMs - 3_000));
    return () => clearTimeout(id);
  }, [hold.setId, hold.startedAt]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const leadSeconds = Math.max(0, Math.ceil((hold.startedAt - now) / 1_000));
  const heldSeconds = Math.max(0, Math.floor((now - hold.startedAt) / 1_000));

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--accent-ink)]">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--accent-ink)]" />
      <span className="tabular truncate">
        {leadSeconds > 0
          ? t('workout.pacePreparing', { seconds: leadSeconds })
          : t('workout.holdStatus', { time: formatRest(heldSeconds) })}
      </span>
    </span>
  );
}
