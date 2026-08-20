import type { RepPacer } from '@/stores/repPacer';
import type { RestTimer } from '@/stores/restTimer';

type PacerClock = Pick<RepPacer, 'setId' | 'reps' | 'repSeconds' | 'startedAt'>;
type RestClock = Pick<RestTimer, 'setId' | 'endsAt'>;

/**
 * Whether tutorial speech would collide with workout audio right now.
 *
 * Store identities can outlive their timers when the workout screen unmounts:
 * the wall-clock deadline, not a leftover `setId`, is the source of truth.
 */
export function isWorkoutAudioBusy(
  pacer: PacerClock,
  rest: RestClock,
  now = Date.now(),
): boolean {
  const restActive = rest.setId !== null && rest.endsAt > now;
  const paceEndsAt = pacer.startedAt + pacer.reps * pacer.repSeconds * 1_000;
  const pacerActive =
    pacer.setId !== null && pacer.reps > 0 && pacer.repSeconds > 0 && paceEndsAt > now;
  return restActive || pacerActive;
}
