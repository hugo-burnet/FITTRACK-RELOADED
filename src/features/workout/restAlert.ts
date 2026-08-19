import { announce } from '@/audio/announce';
import { buzzRestOver } from '@/audio/haptics';
import { nativeNotifications } from '@/platform/nativeNotifications';

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
  signalRestFinished(
    nativeNotifications.isRestAlertArmed,
    () => void announce('rest-over'),
    buzzRestOver,
  );
}
