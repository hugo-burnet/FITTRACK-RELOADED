# FitTrack Android / Capacitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a stably signed, sideloadable Android APK whose rest alarm works with the screen locked, while preserving FitTrack's PWA and local-first behavior.

**Architecture:** Keep IndexedDB and Zustand as the existing sources of truth and add thin native adapters under `src/platform/`. A headless React bridge reconciles workout/timer state with official Capacitor notifications, system bars, and Android back navigation. GitHub Actions builds the committed Android project with a stable secret-backed signing key.

**Tech Stack:** Vite 8, React 19, TypeScript 6 strict, Capacitor 8, `@capacitor/app`, `@capacitor/local-notifications`, Capacitor `SystemBars`, Vitest, Gradle, GitHub Actions.

## Global Constraints

- All functionality remains fully usable offline and without an account.
- Components never import `db`; native bridges read data through repositories.
- User-facing copy remains in `src/i18n/fr.ts`; code and comments remain in English.
- No artificial quota, secret in the repository, or destructive update path is introduced.
- A live workout continues to persist each set immediately through the existing repositories.
- Use `createHashRouter`; GitHub Pages and Capacitor must both keep working.
- The Android application id is `com.fittrack.app`; the app name is `FitTrack`.
- Android support starts at API 24.
- The final APK is built only after the separate source-comment cleanup commit.

---

### Task 1: Establish the verified baseline and add Capacitor-aware build modes

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `capacitor.config.ts`
- Create: `src/platform/nativeEnvironment.ts`
- Test: `src/platform/nativeEnvironment.test.ts`

**Interfaces:**
- Produces: `isNativeAndroid(): boolean`
- Produces: `npm run build:android:web` and `npm run android:sync`
- Preserves: `npm run build` with `/FITTRACK-RELOADED/` as its asset base

- [ ] **Step 1: Run and record the pre-change preservation baseline**

Run:

```powershell
npm run typecheck
npm run test:run
npm run build
```

Expected: all three commands exit 0. This is proportionate baseline evidence before changing build configuration.

- [ ] **Step 2: Write the failing native-environment test**

Create `src/platform/nativeEnvironment.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isNativePlatform = vi.fn();
const getPlatform = vi.fn();

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform, getPlatform },
}));

describe('isNativeAndroid', () => {
  beforeEach(() => {
    isNativePlatform.mockReset();
    getPlatform.mockReset();
  });

  it('is true only inside the native Android container', async () => {
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('android');
    const { isNativeAndroid } = await import('./nativeEnvironment');

    expect(isNativeAndroid()).toBe(true);
  });

  it('is false in the browser and on other native platforms', async () => {
    const { isNativeAndroid } = await import('./nativeEnvironment');
    isNativePlatform.mockReturnValue(false);
    getPlatform.mockReturnValue('web');
    expect(isNativeAndroid()).toBe(false);

    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    expect(isNativeAndroid()).toBe(false);
  });
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npm run test:run -- src/platform/nativeEnvironment.test.ts`

Expected: FAIL because `src/platform/nativeEnvironment.ts` does not exist.

- [ ] **Step 4: Install the official Capacitor 8 packages**

Run:

```powershell
npm install @capacitor/core@^8 @capacitor/app@^8 @capacitor/local-notifications@^8
npm install --save-dev @capacitor/cli@^8 @capacitor/android@^8 @capacitor/assets@^3
```

Expected: `package.json` and `package-lock.json` contain one compatible Capacitor 8 dependency family.

- [ ] **Step 5: Implement the native environment seam**

Create `src/platform/nativeEnvironment.ts`:

```ts
import { Capacitor } from '@capacitor/core';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
```

Run: `npm run test:run -- src/platform/nativeEnvironment.test.ts`

Expected: 2 tests pass.

- [ ] **Step 6: Add separate web and Android build scripts**

Add these scripts to `package.json`:

```json
"build:android:web": "tsc -b && vite build --mode android",
"android:sync": "npm run build:android:web && cap sync android"
```

Convert the existing export to `defineConfig(({ mode }) => {` and return the current configuration object from that function. Retain the current React, Tailwind, PWA manifest, Workbox, alias, and Vitest properties; make only the mode-dependent substitutions below:

```ts
const isAndroid = mode === 'android';
const base = isAndroid ? './' : '/FITTRACK-RELOADED/';
```

Use `base` for Vite, manifest `start_url`/`scope`, and Workbox `navigateFallback`. Set `disable: isAndroid` on `VitePWA` so the virtual module still resolves while the native bundle gets no service worker.

- [ ] **Step 7: Add Capacitor configuration**

Create `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fittrack.app',
  appName: 'FitTrack',
  webDir: 'dist',
  backgroundColor: '#12110f',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_fittrack',
      iconColor: '#ff8a3d',
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
    },
  },
};

export default config;
```

- [ ] **Step 8: Verify both asset bases**

Run `npm run build`, then verify:

```powershell
Select-String -Path 'dist\index.html' -Pattern '/FITTRACK-RELOADED/assets/'
```

Expected: at least one match.

Run `npm run build:android:web`, then verify:

```powershell
if (Select-String -Path 'dist\index.html' -Pattern '/FITTRACK-RELOADED/') { exit 1 }
if (Test-Path 'dist\sw.js') { exit 1 }
```

Expected: exit 0; native assets are relative and no service worker is emitted.

- [ ] **Step 9: Commit the build foundation**

```powershell
git add -- package.json package-lock.json vite.config.ts capacitor.config.ts src/platform/nativeEnvironment.ts src/platform/nativeEnvironment.test.ts
git commit -m "feat(lot-10): préparer le build Capacitor"
```

---

### Task 2: Build the native notification gateway in TDD

**Files:**
- Create: `src/platform/nativeNotifications.ts`
- Test: `src/platform/nativeNotifications.test.ts`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces: `createNativeNotificationGateway(plugin, isAndroid, onError)`
- Produces singleton: `nativeNotifications`
- Produces methods: `reconcileWorkout(name: string | null)`, `reconcileRest(rest: RestTimer)`, `clearAll()`, `isRestAlertArmed()`
- Consumes: `RestTimer` from `src/stores/restTimer.ts`

- [ ] **Step 1: Add French notification copy**

Add the following object beside `workout` in `src/i18n/fr.ts`:

```ts
androidNotification: {
  workoutChannel: 'Séance en cours',
  workoutChannelDescription: 'Affiche la séance active dans les notifications.',
  restChannel: 'Minuteur de repos',
  restChannelDescription: 'Sonne quand le temps de repos est terminé.',
  workoutBody: 'Touche pour revenir à la séance.',
  restTitle: 'Repos terminé',
  restBody: 'La prochaine série peut commencer.',
},
```

- [ ] **Step 2: Write gateway tests for the web no-op and permission paths**

In `src/platform/nativeNotifications.test.ts`, define a typed fake with spies for `checkPermissions`, `requestPermissions`, `checkExactNotificationSetting`, `changeExactNotificationSetting`, `createChannel`, `schedule`, and `cancel`. Add tests proving:

```ts
it('does not call the plugin outside native Android');
it('requests display permission before creating notifications');
it('does not schedule when display permission remains denied');
it('opens the exact-alarm setting once when exact alarms are denied');
it('contains plugin failures and reports them through onError');
```

The fake's success defaults are:

```ts
checkPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
checkExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
changeExactNotificationSetting: vi.fn().mockResolvedValue({ exact_alarm: 'granted' }),
createChannel: vi.fn().mockResolvedValue(undefined),
schedule: vi.fn().mockResolvedValue({ notifications: [] }),
cancel: vi.fn().mockResolvedValue(undefined),
```

- [ ] **Step 3: Run the gateway tests and verify RED**

Run: `npm run test:run -- src/platform/nativeNotifications.test.ts`

Expected: FAIL because the gateway module does not exist.

- [ ] **Step 4: Define the narrow plugin port and stable constants**

In `src/platform/nativeNotifications.ts`, define the structural port as:

```ts
type NotificationPlugin = Pick<
  typeof LocalNotifications,
  | 'checkPermissions'
  | 'requestPermissions'
  | 'checkExactNotificationSetting'
  | 'changeExactNotificationSetting'
  | 'createChannel'
  | 'schedule'
  | 'cancel'
>;
```

Add:

```ts
export const WORKOUT_NOTIFICATION_ID = 41001;
export const REST_NOTIFICATION_ID = 41002;
export const WORKOUT_CHANNEL_ID = 'fittrack-workout';
export const REST_CHANNEL_ID = 'fittrack-rest';
```

The workout channel uses importance `2`, visibility `0`, vibration `false`. The rest channel uses importance `4`, visibility `1`, vibration `true`. Omit a custom sound so Android uses the user's system notification sound.

- [ ] **Step 5: Implement permission/channel initialization**

Implement a lazily cached `ensureReady()` inside `createNativeNotificationGateway`. It must:

1. return `false` immediately when `isAndroid()` is false;
2. check display permission and request it only when needed;
3. return `false` when permission is not granted;
4. create both stable channels;
5. check exact-alarm permission;
6. call `changeExactNotificationSetting()` at most once per process when denied;
7. catch errors, call `onError(error)`, and return `false`.

Reset the cached promise after a rejected/false initialization so a later app resume can recover after settings change.

- [ ] **Step 6: Write workout notification tests**

Add tests proving:

```ts
it('shows one silent ongoing notification for an active workout');
it('uses the free-workout fallback when the name is empty');
it('removes the ongoing and rest notifications when no workout is active');
it('is idempotent for repeated active workout reconciliation');
```

Assert the scheduled workout object contains:

```ts
{
  id: WORKOUT_NOTIFICATION_ID,
  title: 'Lower A',
  body: t('androidNotification.workoutBody'),
  channelId: WORKOUT_CHANNEL_ID,
  ongoing: true,
  autoCancel: false,
}
```

- [ ] **Step 7: Write rest scheduling and race tests**

Use fake timers and add tests proving:

```ts
it('schedules the rest at endsAt with allowWhileIdle');
it('cancels a future rest when the timer stops');
it('does not dismiss an already delivered rest when the grace period clears the store');
it('serializes rapid replacement so the newest rest wins');
it('marks native alert armed only after schedule succeeds');
it('leaves the web fallback enabled when scheduling fails');
```

Assert the rest notification contains:

```ts
{
  id: REST_NOTIFICATION_ID,
  title: t('androidNotification.restTitle'),
  body: t('androidNotification.restBody'),
  channelId: REST_CHANNEL_ID,
  schedule: { at: new Date(endsAt), allowWhileIdle: true },
  autoCancel: true,
}
```

- [ ] **Step 8: Implement serialized reconciliation**

Use a private promise queue initialized with `Promise.resolve()`. Every public mutating method appends its operation with both success and failure handlers so one plugin rejection cannot poison later operations. Track `lastRestEndsAt` and `restAlertArmed`:

- cancel before scheduling a replacement;
- cancel on idle only when `lastRestEndsAt > Date.now()`;
- do not cancel a delivered notification after the deadline;
- `clearAll()` always cancels both fixed ids and clears the tracked state.

Export the production singleton with `LocalNotifications`, `isNativeAndroid`, and `console.error`.

- [ ] **Step 9: Run the gateway suite and typecheck**

Run:

```powershell
npm run test:run -- src/platform/nativeNotifications.test.ts
npm run typecheck
```

Expected: all notification tests pass; TypeScript reports zero errors.

- [ ] **Step 10: Commit the notification gateway**

```powershell
git add -- src/platform/nativeNotifications.ts src/platform/nativeNotifications.test.ts src/i18n/fr.ts
git commit -m "feat(lot-10): programmer les notifications Android"
```

---

### Task 3: Reconcile native notifications with workout and rest state

**Files:**
- Create: `src/platform/NativeRuntimeBridge.tsx`
- Test: `src/platform/NativeRuntimeBridge.test.tsx`
- Create: `src/features/workout/restAlert.ts`
- Test: `src/features/workout/restAlert.test.ts`
- Modify: `src/features/workout/RestRail.tsx`
- Modify: `src/app/AppShell.tsx`

**Interfaces:**
- Consumes: `getActiveWorkout()`, `useRestTimer`, `nativeNotifications`
- Produces: `<NativeRuntimeBridge />`
- Produces: `signalRestFinished(isNativeArmed, play, buzz): void`

- [ ] **Step 1: Write the foreground alert selection test**

Create `src/features/workout/restAlert.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { signalRestFinished } from './restAlert';

describe('signalRestFinished', () => {
  it('uses Web Audio and vibration when no native alert is armed', () => {
    const play = vi.fn();
    const buzz = vi.fn();
    signalRestFinished(() => false, play, buzz);
    expect(play).toHaveBeenCalledOnce();
    expect(buzz).toHaveBeenCalledOnce();
  });

  it('does not duplicate a successfully armed native alert', () => {
    const play = vi.fn();
    const buzz = vi.fn();
    signalRestFinished(() => true, play, buzz);
    expect(play).not.toHaveBeenCalled();
    expect(buzz).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the alert test and verify RED**

Run: `npm run test:run -- src/features/workout/restAlert.test.ts`

Expected: FAIL because `restAlert.ts` does not exist.

- [ ] **Step 3: Implement and connect the alert selector**

Create `restAlert.ts` with the tested dependency-injected function and a production wrapper using `nativeNotifications.isRestAlertArmed()`, `playChime`, and `buzzRestOver`. Replace the two direct calls in `RestRail`'s deadline timeout with the wrapper.

- [ ] **Step 4: Write bridge tests with mocked state sources**

Mock `dexie-react-hooks`, `getActiveWorkout`, `useRestTimer`, `nativeNotifications`, and `@capacitor/app`. Add tests proving:

```ts
it('reconciles the active workout name');
it('reconciles the full rest timer state');
it('clears notifications when the workout ends');
it('reconciles again when Android resumes');
it('removes only the listener handles it registered on unmount');
```

The bridge must render `null`; tests use Testing Library's `render` and `waitFor`.

- [ ] **Step 5: Run the bridge test and verify RED**

Run: `npm run test:run -- src/platform/NativeRuntimeBridge.test.tsx`

Expected: FAIL because the bridge does not exist.

- [ ] **Step 6: Implement the headless bridge**

Use `useLiveQuery(async () => (await getActiveWorkout()) ?? null)` and `useRestTimer()`. Keep latest workout/rest values in refs for the App `appStateChange` listener. Effects call:

```ts
void nativeNotifications.reconcileWorkout(active?.name ?? null);
void nativeNotifications.reconcileRest(rest);
```

On `appStateChange` with `isActive: true`, call both again. Store each returned listener handle and remove that handle during cleanup; never call a plugin-wide `removeAllListeners()`.

- [ ] **Step 7: Mount the bridge once**

Add `<NativeRuntimeBridge />` as the first child of `AppShell`'s root container, before `<main>`. It renders nothing and therefore does not alter layout.

- [ ] **Step 8: Verify the integration**

Run:

```powershell
npm run test:run -- src/features/workout/restAlert.test.ts src/platform/NativeRuntimeBridge.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx
npm run typecheck
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 9: Commit the runtime reconciliation**

```powershell
git add -- src/platform/NativeRuntimeBridge.tsx src/platform/NativeRuntimeBridge.test.tsx src/features/workout/restAlert.ts src/features/workout/restAlert.test.ts src/features/workout/RestRail.tsx src/app/AppShell.tsx
git commit -m "feat(lot-10): relier la séance aux notifications natives"
```

---

### Task 4: Handle Android back navigation deterministically

**Files:**
- Create: `src/platform/androidBack.ts`
- Test: `src/platform/androidBack.test.ts`
- Modify: `src/platform/NativeRuntimeBridge.tsx`
- Modify: `src/platform/NativeRuntimeBridge.test.tsx`

**Interfaces:**
- Produces: `androidBackDecision(pathname: string, canGoBack: boolean): BackDecision`
- Consumes: React Router `useLocation`/`useNavigate` and Capacitor `App`

- [ ] **Step 1: Write the pure route-decision table tests**

Create table-driven tests covering:

```ts
['/workout/add', '/workout'],
['/workout/finish', '/workout'],
['/workout', '/'],
['/routines/routine-1/add', '/routines/routine-1'],
['/routines/routine-1', '/routines'],
['/history/import', '/history'],
['/history/workout-1/edit', '/history'],
['/history/workout-1', '/history'],
['/analytics/weekly', '/analytics'],
['/analytics/exercises/exercise-1', '/analytics'],
['/exercises/new', '/exercises'],
['/exercises/exercise-1/edit', '/exercises'],
['/exercises/exercise-1', '/exercises'],
['/settings/debug', '/settings'],
['/settings', '/'],
```

Also prove `canGoBack: true` returns `{ kind: 'history' }`, and `/`, `/routines`, `/history`, `/analytics`, `/exercises` with no history return `{ kind: 'exit' }`.

- [ ] **Step 2: Run the decision tests and verify RED**

Run: `npm run test:run -- src/platform/androidBack.test.ts`

Expected: FAIL because `androidBack.ts` does not exist.

- [ ] **Step 3: Implement the pure decision function**

Use exact route checks before dynamic regular expressions. Define:

```ts
export type BackDecision =
  | { kind: 'history' }
  | { kind: 'navigate'; to: string }
  | { kind: 'exit' };
```

Unknown nested routes fall back to `/`; unknown root routes exit only when no deterministic parent exists.

- [ ] **Step 4: Add the Capacitor back listener to the bridge**

In `NativeRuntimeBridge`, subscribe only on native Android. On each event:

- `history` → `navigate(-1)`;
- `navigate` → `navigate(to, { replace: true })`;
- `exit` → `void App.exitApp()`.

Keep the current pathname in a ref so the listener is registered once, not on every navigation.

- [ ] **Step 5: Extend the bridge test**

Trigger the captured `backButton` listener with both `{ canGoBack: true }` and `{ canGoBack: false }`. Assert `navigate(-1)`, deterministic fallback navigation, and `App.exitApp()` at a tab root.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm run test:run -- src/platform/androidBack.test.ts src/platform/NativeRuntimeBridge.test.tsx
npm run typecheck
```

Then:

```powershell
git add -- src/platform/androidBack.ts src/platform/androidBack.test.ts src/platform/NativeRuntimeBridge.tsx src/platform/NativeRuntimeBridge.test.tsx
git commit -m "feat(lot-10): gérer le retour Android"
```

---

### Task 5: Integrate modern system bars and safe-area fallbacks

**Files:**
- Create: `src/platform/systemBars.ts`
- Test: `src/platform/systemBars.test.ts`
- Modify: `src/stores/theme.ts`
- Modify: `src/stores/theme.test.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `syncSystemBars(theme: Theme): Promise<void>`
- Consumes: Capacitor 8 `SystemBars` and `isNativeAndroid()`

- [ ] **Step 1: Write the native system-bar tests**

Mock `@capacitor/core` and `isNativeAndroid`. Prove:

```ts
it('does nothing on the web');
it('uses SystemBarsStyle.Dark for FitTrack dark theme');
it('uses SystemBarsStyle.Light for FitTrack light theme');
it('contains native failures');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:run -- src/platform/systemBars.test.ts`

Expected: FAIL because `systemBars.ts` does not exist.

- [ ] **Step 3: Implement system-bar synchronization**

Create `systemBars.ts` that returns immediately off Android, calls `SystemBars.setStyle`, and catches/logs errors. Use the Capacitor 8 enum values rather than raw strings.

- [ ] **Step 4: Extend the theme test before changing theme code**

Mock `syncSystemBars` in `theme.test.ts`. Add assertions that `applyTheme('light')` and `applyTheme('dark')` forward the selected theme. Run the test and verify it fails before wiring the call.

- [ ] **Step 5: Wire theme changes and safe-area CSS**

At the end of `applyTheme`, call `void syncSystemBars(theme)`. Change utilities to:

```css
padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
padding-bottom: calc(
  var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)) + 1.75rem
);
```

Keep one declaration in each utility so Tailwind precedence remains unchanged.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm run test:run -- src/platform/systemBars.test.ts src/stores/theme.test.ts
npm run typecheck
npm run build
```

Then:

```powershell
git add -- src/platform/systemBars.ts src/platform/systemBars.test.ts src/stores/theme.ts src/stores/theme.test.ts src/index.css
git commit -m "feat(lot-10): adapter les barres système Android"
```

---

### Task 6: Generate and configure the committed Android project

**Files:**
- Modify: `.gitignore`
- Create: `assets/logo.svg`
- Create/modify: `android/**` generated by Capacitor
- Modify: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/res/drawable/ic_stat_fittrack.xml`
- Modify: `android/app/build.gradle`

**Interfaces:**
- Consumes: `dist/` from `npm run build:android:web`
- Produces: Gradle debug APK project with stable external signing inputs

- [ ] **Step 1: Stop ignoring the Android platform**

Remove only `android/` from `.gitignore`; retain `ios/`. Add `.secrets/` and `*.jks` so the signing backup cannot be committed accidentally.

- [ ] **Step 2: Create the vector source for native assets**

Create `assets/logo.svg` as a transparent 1024×1024 SVG containing the five orange barbell strokes from `BarbellIcon`, centered with enough adaptive-icon safe-zone padding. Do not include a rounded-square background; `@capacitor/assets` supplies `#12110f`.

- [ ] **Step 3: Generate the Android platform**

Run:

```powershell
npm run build:android:web
npx cap add android
npx @capacitor/assets generate --android --assetPath assets --iconBackgroundColor '#12110f' --iconBackgroundColorDark '#12110f' --splashBackgroundColor '#12110f' --splashBackgroundColorDark '#12110f'
npx cap sync android
```

Expected: `android/` exists, plugins are listed during sync, and launcher/splash mipmaps are generated.

- [ ] **Step 4: Configure permissions and portrait behavior**

Add before `<application>` in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

Add `android:screenOrientation="portrait"` to `MainActivity`. Do not add network-dependent or broad storage permissions.

- [ ] **Step 5: Add the monochrome notification icon**

Create `ic_stat_fittrack.xml` as a 24dp Android vector with a white barbell path on a transparent background. Use only solid white path data so Android can tint it correctly in the status bar.

- [ ] **Step 6: Add stable external signing and monotonic versioning**

In `android/app/build.gradle`, read:

```groovy
def fittrackVersionCode = (project.findProperty('fittrackVersionCode') ?: '1').toInteger()
def fittrackVersionName = project.findProperty('fittrackVersionName') ?: '0.1.0'
def fittrackKeystoreFile = System.getenv('FITTRACK_KEYSTORE_FILE')
def fittrackKeystorePassword = System.getenv('FITTRACK_KEYSTORE_PASSWORD')
def fittrackKeyAlias = System.getenv('FITTRACK_KEY_ALIAS')
def fittrackKeyPassword = System.getenv('FITTRACK_KEY_PASSWORD')
```

Use the version variables in `defaultConfig`. Create `signingConfigs.fittrack` only when all four signing inputs are present, and apply it to `buildTypes.debug`. Leave a local unsigned/default-debug path available when the environment variables are absent; CI performs the strict missing-secret check before Gradle.

- [ ] **Step 7: Verify native configuration without compiling**

Run:

```powershell
npm run android:sync
Select-String -Path 'android\app\src\main\AndroidManifest.xml' -Pattern 'SCHEDULE_EXACT_ALARM|screenOrientation="portrait"'
Test-Path 'android\app\src\main\res\drawable\ic_stat_fittrack.xml'
git check-ignore 'android\app\build.gradle'
```

Expected: sync exits 0, both manifest settings are found, the icon exists, and `git check-ignore` prints nothing/returns non-zero because Android is tracked.

- [ ] **Step 8: Commit the native project**

```powershell
git add -- .gitignore assets/logo.svg android
git commit -m "feat(lot-10): ajouter le projet Android"
```

---

### Task 7: Add the signed APK workflow and installation guide

**Files:**
- Create: `.github/workflows/android.yml`
- Create: `docs/ANDROID.md`
- Modify: `README.md`

**Interfaces:**
- Consumes GitHub secrets: `FITTRACK_ANDROID_KEYSTORE_BASE64`, `FITTRACK_ANDROID_KEYSTORE_PASSWORD`, `FITTRACK_ANDROID_KEY_ALIAS`, `FITTRACK_ANDROID_KEY_PASSWORD`
- Produces artifact: `fittrack-android-debug`

- [ ] **Step 1: Create the CI workflow**

Add `.github/workflows/android.yml` with `push` on `master` and `workflow_dispatch`. Use:

- `actions/checkout@v4`;
- `actions/setup-node@v4` with Node 22 and npm cache;
- `actions/setup-java@v4` with Temurin 21 and Gradle cache;
- `npm ci`;
- lint, typecheck, and unit tests;
- `npm run android:sync`;
- a bash secret-validation/keystore decode step writing to `$RUNNER_TEMP/fittrack.jks`;
- `android/gradlew assembleDebug -PfittrackVersionCode=${{ github.run_number }} -PfittrackVersionName=$(node -p "require('./package.json').version")` from the repository root;
- signing environment variables passed only to the Gradle step;
- `actions/upload-artifact@v4` with `android/app/build/outputs/apk/debug/app-debug.apk`, artifact name `fittrack-android-debug`, and a 30-day retention.

Use `permissions: contents: read`. Never print secret values or the decoded key.

- [ ] **Step 2: Write the signing and sideload guide**

Create `docs/ANDROID.md` with exact sections for:

1. generating one JKS under ignored `.secrets/` using JDK 21 `keytool`;
2. backing up the JKS and credentials outside the repository;
3. base64 encoding it and creating the four GitHub Actions secrets;
4. downloading the workflow artifact;
5. enabling “install unknown apps” for the file/browser source;
6. installing updates over the existing app without uninstalling;
7. granting notifications and “Alarms & reminders” access;
8. troubleshooting signature mismatch, denied notifications, delayed alarms, and Android Private Space;
9. the eight-step phone checkpoint from the approved design.

State prominently: uninstalling FitTrack erases its local IndexedDB; export JSON/CSV before any destructive recovery action.

- [ ] **Step 3: Link the Android guide from README**

Add one concise Android installation link beside the existing PWA installation documentation. Do not add a Play Store badge or imply store distribution.

- [ ] **Step 4: Validate workflow and docs formatting**

Run:

```powershell
npx prettier --check '.github/workflows/android.yml' 'docs/ANDROID.md' 'README.md'
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit CI and documentation**

```powershell
git add -- .github/workflows/android.yml docs/ANDROID.md README.md
git commit -m "ci(lot-10): produire l'APK Android signé"
```

---

### Task 8: Verify and commit the complete pre-cleanup feature baseline

**Files:**
- No planned source changes

**Interfaces:**
- Produces: a clean, passing commit boundary before comment-only refactoring

- [ ] **Step 1: Run all web gates**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: four exit codes 0; record the Vitest file/test count.

- [ ] **Step 2: Run the native asset gate**

Run:

```powershell
npm run android:sync
if (Select-String -Path 'dist\index.html' -Pattern '/FITTRACK-RELOADED/') { exit 1 }
if (Test-Path 'dist\sw.js') { exit 1 }
```

Expected: exit 0.

- [ ] **Step 3: Confirm the baseline boundary is committed and clean**

Run:

```powershell
git status --short
git log -1 --oneline
```

Expected: no status entries. If verification required a source fix, implement it in TDD, rerun the relevant gates, and commit it before continuing. Record the baseline commit id for the comment cleanup.

---

### Task 9: Remove verbose and obsolete source comments without changing behavior

**Files:**
- Modify comments only: `src/**/*.{ts,tsx}`
- Modify comments only: `vite.config.ts`
- Modify comments only: `capacitor.config.ts`
- Modify comments only: `eslint.config.js`
- Modify comments only: `scripts/*.mjs`
- Modify comments only: `.github/workflows/*.yml`
- Modify comments only: `android/**/*.gradle`, `android/**/*.java`, `android/**/*.xml`

**Interfaces:**
- Preserves every executable token, exported API, test assertion, UI string, selector, and configuration value
- Produces shorter English comments limited to non-obvious contracts and hazards

- [ ] **Step 1: Inventory source comments**

Run:

```powershell
rg -n '/\*\*|/\*|//|\{\/\*|<!--|# ' src vite.config.ts capacitor.config.ts eslint.config.js scripts .github/workflows android
```

Review every match. Exclude generated Gradle-wrapper scripts and third-party notices from editorial changes.

- [ ] **Step 2: Apply the deletion rules file by file**

Use `apply_patch` only. Delete comments that restate code, narrate chronology, quote old phone feedback, describe rejected implementations, or repeat a lot number. Reduce retained explanations to the shortest sentence that preserves one of these facts:

- a business invariant;
- an offline/data-loss/security/licensing constraint;
- a browser/Android compatibility trap;
- an accessibility reason not visible from types;
- why a test case exists.

Do not edit documentation prose in `docs/`, translation values in `fr.ts`, or code to make a comment easier to remove.

- [ ] **Step 3: Review the cleanup as a comment-only refactor**

Run:

```powershell
git diff --check
git diff --stat
git diff --unified=0
```

Inspect every hunk. Each removed/added line must be a comment delimiter, comment text, or whitespace belonging only to a comment. Revert any executable-token change with `apply_patch`.

Mutation testing is explicitly N/A because comments do not enter the executable program. Preservation evidence is the committed Task 8 baseline plus the full tests before and after this task.

- [ ] **Step 4: Run preservation gates before committing**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: identical behavior and four exit codes 0.

- [ ] **Step 5: Commit the cleanup separately**

```powershell
git add -- src vite.config.ts capacitor.config.ts eslint.config.js scripts .github/workflows android
git diff --cached --check
git commit -m "refactor: raccourcir les commentaires du code"
```

---

### Task 10: Configure stable signing, compile the final APK, and close Lot 10

**Files:**
- Modify: `PROGRESS.md`
- Local ignored secret: `.secrets/fittrack-android.jks`

**Interfaces:**
- Produces: GitHub artifact `fittrack-android-debug`
- Produces: completed Lot 10 entry and manual phone checkpoint

- [ ] **Step 1: Create and back up the stable signing identity**

Install a JDK 21 only if `keytool` is unavailable. Generate `.secrets/fittrack-android.jks` once with alias `fittrack` and strong random store/key passwords. Copy the JKS and credentials to a user-controlled backup location before relying on it. Never add either file to Git.

- [ ] **Step 2: Configure the four GitHub Actions secrets**

Base64-encode the JKS without line breaks and set:

```text
FITTRACK_ANDROID_KEYSTORE_BASE64
FITTRACK_ANDROID_KEYSTORE_PASSWORD
FITTRACK_ANDROID_KEY_ALIAS=fittrack
FITTRACK_ANDROID_KEY_PASSWORD
```

Confirm through GitHub's repository settings that all four names exist; values must remain masked.

- [ ] **Step 3: Update project progress before the final gates**

Prepend a dated Lot 10 entry to `PROGRESS.md` covering Capacitor packaging, native rest alarms, ongoing workout notification, back navigation, safe areas, stable signing, CI artifact, test counts, known exact-alarm permission behavior, and the phone checkpoint. Mention the separate comment cleanup commit and that no behavior changed in it.

- [ ] **Step 4: Run the final local gates after all source changes**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run android:sync
git diff --check
```

Expected: every command exits 0. This is the final local evidence after the comment cleanup.

- [ ] **Step 5: Commit progress**

```powershell
git add -- PROGRESS.md
git diff --cached --check
git commit -m "docs(lot-10): consigner l'application Android"
```

- [ ] **Step 6: Push only with user authorization and wait for Android CI**

Push `master` to `origin` after explicit authorization. Open the triggered `Android APK` workflow and wait for its final conclusion. Do not claim the APK exists from a queued or partially green workflow.

Expected: lint, typecheck, tests, Android sync, Gradle `assembleDebug`, and artifact upload all succeed.

- [ ] **Step 7: Download and identify the final artifact**

Download `fittrack-android-debug`, verify the ZIP contains `app-debug.apk`, and report its exact local path and SHA-256:

```powershell
Get-FileHash -Algorithm SHA256 '<downloaded-app-debug.apk>'
```

- [ ] **Step 8: Hand off the phone checkpoint**

Ask the user to install the APK and verify, in order:

1. launcher icon and splash;
2. persistent notification during a workout;
3. rest alarm with screen locked;
4. replacement/cancellation of rest alarms;
5. Android back navigation;
6. airplane-mode cold start;
7. install the next APK over the first without uninstalling and confirm history remains.

The lot is complete only after automated gates are green and the user has the APK. The locked-screen and upgrade-in-place checks remain explicitly manual until confirmed on the physical phone.
