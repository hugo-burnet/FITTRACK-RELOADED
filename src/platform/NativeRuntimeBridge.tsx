import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { useRestTimer } from '@/stores/restTimer';
import { androidBackDecision } from './androidBack';
import { isNativeAndroid } from './nativeEnvironment';
import { nativeNotifications } from './nativeNotifications';

export function NativeRuntimeBridge() {
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const rest = useRestTimer();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeRef = useRef(active);
  const restRef = useRef(rest);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    restRef.current = rest;
  }, [rest]);

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
      if (decision.kind === 'history') navigate(-1);
      else if (decision.kind === 'navigate') navigate(decision.to, { replace: true });
      else void App.exitApp();
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
