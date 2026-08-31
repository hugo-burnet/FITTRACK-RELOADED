import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'react-router-dom';
import { navigatingBack, useAppNavigate } from '@/app/navigation';
import { bootMilestones, getDomsFollowUp } from '@/data/repositories/milestones';
import { getNotificationPreferences } from '@/data/repositories/notificationSettings';
import type { NotificationPreferences } from '@/lib/notificationPreferences';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { useRestTimer } from '@/stores/restTimer';
import { androidBackDecision } from './androidBack';
import { isNativeAndroid } from './nativeEnvironment';
import { nativeNotifications } from './nativeNotifications';

function syncTimeBasedPaliers(): Promise<void> {
  return bootMilestones()
    .then(async () => {
      const followUp = await getDomsFollowUp();
      await nativeNotifications.reconcileDoms(followUp?.dueAt ?? null);
    })
    .catch(() => undefined);
}

export function NativeRuntimeBridge() {
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const preferences = useLiveQuery(getNotificationPreferences);
  const rest = useRestTimer();
  const { pathname } = useLocation();
  const navigate = useAppNavigate();
  const activeRef = useRef(active);
  const preferencesRef = useRef(preferences);
  const restRef = useRef(rest);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    restRef.current = rest;
  }, [rest]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (active === undefined) return;
    if (active === null) {
      void nativeNotifications.clearAll();
      return;
    }
    void nativeNotifications.reconcileWorkout(active.name);
  }, [active]);

  useEffect(() => {
    void nativeNotifications.reconcileRest(rest);
  }, [rest]);

  /**
   * The three switches and the reminder week, pushed down at every change.
   *
   * Keyed on the content and not on the object: `useLiveQuery` re-runs on any
   * write to `settings` — a plate list, a 1RM formula — and re-arming twelve
   * alarms because somebody changed a formula is churn the phone can feel.
   */
  const preferencesKey = preferences === undefined ? undefined : JSON.stringify(preferences);
  useEffect(() => {
    if (preferencesKey === undefined) return;
    void nativeNotifications.applyPreferences(
      JSON.parse(preferencesKey) as NotificationPreferences,
    );
  }, [preferencesKey]);

  useEffect(() => {
    void syncTimeBasedPaliers();
  }, []);

  useEffect(() => {
    let handle: PluginListenerHandle | undefined;
    let disposed = false;

    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      const currentActive = activeRef.current;
      if (currentActive === null) void nativeNotifications.clearAll();
      else if (currentActive !== undefined) {
        void nativeNotifications.reconcileWorkout(currentActive.name);
      }
      void nativeNotifications.reconcileRest(restRef.current);
      // The reminder horizon drains as the weeks go by. Coming back to the app
      // is the moment to refill it — and the only one the app is given.
      const currentPreferences = preferencesRef.current;
      if (currentPreferences !== undefined) {
        void nativeNotifications.applyPreferences(currentPreferences);
      }
      // Un cold start Android ne rejoue pas appStateChange : le mount effect
      // ci-dessus couvre l'ouverture, celui-ci la reprise.
      void syncTimeBasedPaliers();
    }).then((registered) => {
      if (disposed) void registered.remove();
      else handle = registered;
    });

    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, []);

  useEffect(() => {
    if (!isNativeAndroid()) return;
    let handle: PluginListenerHandle | undefined;
    let disposed = false;

    void App.addListener('backButton', ({ canGoBack }) => {
      const decision = androidBackDecision(pathnameRef.current, canGoBack);
      // Le bouton physique remonte, quelle que soit la forme que prend la
      // décision. `navigate(-1)` le déduirait du signe, mais le repli vers un
      // chemin, non : il partirait en marche avant, soit exactement le
      // contraire du geste qu'on vient de faire.
      if (decision.kind === 'history') {
        navigatingBack();
        navigate(-1);
      } else if (decision.kind === 'navigate') {
        navigatingBack();
        navigate(decision.to, { replace: true });
      } else {
        void App.exitApp();
      }
    }).then((registered) => {
      if (disposed) void registered.remove();
      else handle = registered;
    });

    return () => {
      disposed = true;
      void handle?.remove();
    };
  }, [navigate]);

  return null;
}
