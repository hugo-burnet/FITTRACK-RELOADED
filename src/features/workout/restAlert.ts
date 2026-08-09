import { nativeNotifications } from '@/platform/nativeNotifications';
import { buzzRestOver, playChime } from './restChime';

export function signalRestFinished(
  isNativeArmed: () => boolean,
  play: () => void,
  buzz: () => void,
): void {
  if (isNativeArmed()) return;
  play();
  buzz();
}

export function signalRestFinishedOnCurrentPlatform(): void {
  signalRestFinished(nativeNotifications.isRestAlertArmed, playChime, buzzRestOver);
}
