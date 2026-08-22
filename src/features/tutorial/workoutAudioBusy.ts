import type { HoldTimer } from '@/stores/holdTimer';
import type { RepPacer } from '@/stores/repPacer';
import type { RestTimer } from '@/stores/restTimer';

type PacerClock = Pick<RepPacer, 'setId' | 'reps' | 'repSeconds' | 'startedAt'>;
type RestClock = Pick<RestTimer, 'setId' | 'endsAt'>;
type HoldClock = Pick<HoldTimer, 'setId'>;

/**
 * Whether tutorial speech would collide with workout audio right now.
 *
 * Store identities can outlive their timers when the workout screen unmounts:
 * the wall-clock deadline, not a leftover `setId`, is the source of truth.
 *
 * **Le chrono de maintien fait exception, et il ne peut pas en aller autrement.**
 * Un gainage n'a pas d'échéance : il s'arrête quand celui qui tient relâche, et
 * rien ne sait quand. Il n'y a donc pas d'instant à comparer à l'horloge, et la
 * présence du set est le seul signal disponible. Ce qu'un `setId` oublié
 * coûterait est couvert ailleurs : l'écran de séance arrête le chrono dès que sa
 * série disparaît.
 */
export function isWorkoutAudioBusy(
  pacer: PacerClock,
  rest: RestClock,
  hold: HoldClock,
  now = Date.now(),
): boolean {
  const restActive = rest.setId !== null && rest.endsAt > now;
  const paceEndsAt = pacer.startedAt + pacer.reps * pacer.repSeconds * 1_000;
  const pacerActive =
    pacer.setId !== null && pacer.reps > 0 && pacer.repSeconds > 0 && paceEndsAt > now;
  return restActive || pacerActive || hold.setId !== null;
}
