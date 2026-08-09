# FitTrack Android / Capacitor Design

**Date:** 2026-08-09

**Status:** Approved for implementation planning

**Scope:** Lot 10 — Android packaging, reliable rest notifications, persistent workout notification, Android navigation, system bars, CI APK, and installation documentation.

## Goal

Produce an Android APK that preserves FitTrack's local-first behavior and makes the rest timer reliable when the screen is locked or the app is backgrounded. The APK must be installable without the Play Store, update without erasing the user's IndexedDB data, and remain behaviorally identical to the PWA outside Android-specific capabilities.

## Decisions

- Use Capacitor 8 and its official Android runtime.
- Use only official Capacitor APIs: `@capacitor/app`, `@capacitor/local-notifications`, and the `SystemBars` API bundled with `@capacitor/core`.
- Use the Android application id `com.fittrack.app` and the display name `FitTrack`.
- Support Android 7 / API 24 and newer, which is Capacitor 8's supported floor.
- Keep `createHashRouter`; no route or persistence model changes are required for the native container.
- Do not add a Kotlin foreground service. Official local notifications already provide scheduled delivery, Doze support, and Android's non-dismissible `ongoing` flag.
- Produce a sideloadable, stably signed debug APK in GitHub Actions. Play Store publication and release bundles are outside this lot.
- Reuse the current FitTrack artwork. No new brand or UI direction is introduced.
- After the Android feature has a passing, committed baseline, perform a separate behavior-preserving cleanup of verbose and obsolete source comments before the final build.

## Native Project and Builds

Capacitor owns a committed `android/` project generated from the web application. `capacitor.config.ts` points `webDir` at `dist`, fixes portrait orientation through Android resources, configures `SystemBars` for modern edge-to-edge insets, and configures the notification icon and accent color.

The existing GitHub Pages build and the Android build require different asset bases:

- the web build keeps `/FITTRACK-RELOADED/`;
- the Android build uses the embedded application root.

`vite.config.ts` therefore derives the base from the Vite mode. The normal `npm run build` remains the GitHub Pages build. A dedicated Android build script uses the native mode, emits root-relative/relative embedded assets as required by Capacitor, and synchronizes `dist` into `android/app/src/main/assets/public`.

The PWA service worker is disabled for the native build. The APK already contains every asset and is inherently offline; registering a service worker against Capacitor's local origin would add a second update/cache mechanism with no benefit. The PWA build and its prompt-based update behavior remain unchanged.

## Module Boundaries

Android behavior is isolated under `src/platform/`. Components and repositories never import a native plugin directly.

### Native environment

A small environment module answers whether the app is running on Android through Capacitor. Every exported operation is a safe no-op on the web. Native failures are caught at this boundary so a notification or system-bar failure can never block completing a set, saving a workout, or starting the UI.

### Notification gateway

One notification gateway owns:

- permission checks and the Android 13+ permission request;
- creation of the two Android notification channels;
- the fixed integer notification ids;
- scheduling/cancelling the rest alarm;
- showing/removing the active-workout notification;
- reconciliation after app launch or resume.

Calls that replace notification state are serialized. If two sets are validated quickly, operations occur as cancel A → schedule A → cancel A → schedule B, leaving only the latest rest alarm regardless of asynchronous plugin timing.

No notification copy is hard-coded in the gateway. Titles and bodies live in `src/i18n/fr.ts` like every other user-facing string.

### React bridge

A headless bridge mounted inside the router observes two existing sources of truth:

- `getActiveWorkout()` through Dexie's live query;
- `useRestTimer` through its Zustand subscription.

The bridge renders no visible UI. It translates current application state into desired native notification state. The workout database and the timer store remain independent of Capacitor and retain their current tests and browser behavior.

### Android back navigation

A router-aware bridge subscribes to Capacitor's Android `backButton` event.

- When WebView history has a valid previous entry, it navigates back once.
- When the app was opened directly on a nested route, a deterministic parent-route map is used: workout children → `/workout`, workout → `/`, routine editor → `/routines`, history children → `/history`, analytics details → `/analytics`, exercise children → `/exercises`, settings diagnostic → `/settings`, and settings → `/`.
- On the five tab roots and the home route, back exits the app.

This prevents Android back from closing FitTrack from the workout screen while still following the platform convention at genuine navigation roots.

### System bars and safe areas

Capacitor 8's `SystemBars` API is used instead of the legacy status-bar overlay behavior. It supplies `--safe-area-inset-*` fallbacks needed by Android WebViews and styles both system bars for the selected FitTrack theme.

The current `safe-top`, `safe-bottom`, and `sheet-bottom` utilities are updated to prefer the injected CSS variables and fall back to `env(safe-area-inset-*)`. `applyTheme()` also requests the corresponding native system-bar icon style. On the web this request is a no-op.

## Notification Behavior

### Permission and channels

When the first active workout is observed on Android, FitTrack checks notification permission and requests it if needed. Refusal does not interrupt the workout. The in-app Web Audio/vibration behavior remains the foreground fallback, and `docs/ANDROID.md` explains how to re-enable notifications in Android settings.

Two channels are created once:

1. `fittrack-workout`: low importance, silent, for the active workout.
2. `fittrack-rest`: high importance, default system notification sound and vibration, for rest completion.

Channel identifiers are stable because Android retains channel settings across app updates.

### Active workout

While a workout row has status `active`, FitTrack displays one immediate Android notification:

- title: the workout name, falling back to the existing empty-workout label;
- body: a short instruction that tapping returns to the workout;
- `ongoing: true` and `autoCancel: false`;
- silent workout channel.

Finishing or discarding the workout removes this notification and cancels any pending rest alarm. On cold start and app resume, the bridge re-reads IndexedDB and restores or removes notification state. A process kill therefore does not lose the workout notification, and stale notifications are cleaned up on the next reconciliation.

### Rest completion

When the Zustand timer has a set id and a future `endsAt`, FitTrack schedules one notification at that wall-clock instant on the rest channel. It uses `allowWhileIdle` so it can fire during Doze. The Android manifest declares `SCHEDULE_EXACT_ALARM`, and FitTrack checks the corresponding special-app setting before relying on exact delivery. If it is disabled, the native gateway can open Android's alarm setting from an explicit permission step; FitTrack does not claim the calendar/alarm-clock-only `USE_EXACT_ALARM` permission.

Starting another rest replaces the scheduled notification. Stopping the rest, uncompleting its set, deleting its exercise, finishing the workout, or discarding the workout cancels it. The existing browser timeout continues to animate the rail. At the deadline it produces Web Audio/vibration only when no native rest notification was armed, preventing two simultaneous alerts in the Android foreground while preserving the browser fallback after permission denial or scheduling failure.

If Android exact alarms have been disabled, FitTrack still schedules the notification through the plugin rather than failing the set action. Delivery may then be inexact, and the installation guide tells the user which Android setting to check during the phone checkpoint.

## Android Resources

- Adaptive launcher and splash resources are generated from the committed 512 px FitTrack icons.
- A dedicated monochrome `ic_stat_fittrack` vector is used for the notification status icon.
- The notification accent uses FitTrack's orange accent.
- Splash and system backgrounds use the dark default surface (`#12110f`) to avoid a flash before the first frame.
- Portrait orientation is enforced by the Android activity configuration, matching the PWA manifest.

## Stable Signing and Versioning

Every installable update must use the same signing key. Relying on GitHub's ephemeral default debug keystore would eventually produce an APK that Android refuses to install over the previous build, forcing an uninstall and destroying local data.

A project-specific personal keystore is generated once and stored only as base64 plus passwords in GitHub Actions secrets. It is never committed and never copied into the APK. The workflow reconstructs it in the runner's temporary directory, signs the debug variant, and deletes it with the runner.

The workflow supplies `github.run_number` as Android's monotonically increasing `versionCode`; `package.json` supplies `versionName`. This allows each downloaded APK to update the previous installation in place.

If signing secrets are missing, the workflow fails before Gradle with a clear setup message instead of silently creating a disposable key.

## Source Comment Cleanup

The cleanup covers executable source and configuration touched or exercised by the application, including `src/`, root TypeScript configuration, build configuration, workflow files, and the committed Android project. It does not shorten user documentation merely to reduce line count.

The cleanup removes:

- comments that restate the following line;
- chronological implementation stories and references to earlier failed versions;
- phone-feedback narratives once the resulting invariant is clear in the code;
- multi-paragraph explanations that can be reduced to one precise sentence;
- stale lot references that no longer help a maintainer understand the current contract.

It retains, in concise English:

- non-obvious business rules and invariants;
- browser or Android platform traps that the code deliberately works around;
- data-loss, offline, security, accessibility, and licensing constraints;
- public API documentation whose contract is not obvious from its types;
- test comments that explain why a case exists rather than what the assertion says.

This is a refactoring-only change: no executable tokens, exported APIs, user-facing strings, snapshots, or assertions are intentionally changed. Mutation testing is not meaningful for comment-only edits, so the preservation evidence is the passing pre-cleanup baseline, a separate baseline commit, a diff review showing comment/whitespace-only changes, and the full post-cleanup gates. The cleanup receives its own commit and is completed before the final Android compilation.

## GitHub Actions

`.github/workflows/android.yml` runs on pushes to `master` and on manual dispatch. It:

1. checks out the repository;
2. installs Node 22 dependencies with `npm ci`;
3. runs typecheck and the unit suite;
4. runs lint and builds/synchronizes the Android web assets;
5. configures JDK 21 and Gradle caching;
6. reconstructs the stable signing keystore from repository secrets;
7. runs the committed Gradle wrapper to assemble the signed debug APK;
8. uploads the APK as an artifact named `fittrack-android-debug`.

The existing Pages workflow remains independent and unchanged except for any shared script name required by the Vite mode split.

## Error Handling

- Native APIs are never called when Capacitor reports a web platform.
- Permission denial and plugin failures are contained and reported to the console without rejecting workout actions.
- Notification synchronization is idempotent: repeated active-workout or rest states converge on the same fixed notification ids.
- App launch and resume both reconcile notifications from IndexedDB, cleaning up native state after crashes or interrupted transitions.
- A rest deadline in the past is cancelled, never rescheduled.
- Native notification actions carry no workout data; IndexedDB remains the only source of truth.

## Testing

### Unit and integration

- Test web no-op behavior without loading native APIs.
- Test channel creation and permission granted, denied, and plugin-error paths with plugin mocks.
- Test rest scheduling uses the exact `endsAt`, fixed id, rest channel, and `allowWhileIdle`.
- Test replacement and cancellation ordering, including rapid consecutive rests.
- Test active-workout notification creation, restoration, and cleanup.
- Test the route-parent fallback table and root-exit decision as pure functions.
- Test foreground alert selection so a successfully armed native notification suppresses the duplicate Web Audio alert while failure preserves it.
- Keep the existing rest timer and workout integration suites green.

### Build gates

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- Android-mode Vite build and Capacitor sync
- Review the comment-cleanup diff and confirm it changes comments/whitespace only.
- `android/gradlew.bat assembleDebug` locally when an Android SDK is available, otherwise the identical Gradle command in GitHub Actions is the authoritative native build gate.

### Manual phone checkpoint

1. Download and install the GitHub Actions APK.
2. Confirm the FitTrack icon and splash screen.
3. Start a workout and confirm the persistent notification.
4. Validate a set, lock the screen, and confirm the rest notification sounds at the deadline.
5. Replace and cancel a rest and confirm no stale alarm fires.
6. Verify Android back from workout details, workout, tabs, and the home root.
7. Install the next workflow APK over the first without uninstalling and confirm all local history remains.
8. Enable airplane mode, kill FitTrack, reopen it, and confirm the complete app and active workout remain available.

## Documentation

`docs/ANDROID.md` documents artifact download, sideload permission, notification and exact-alarm settings, upgrade-in-place rules, troubleshooting, and the phone checkpoint. It explicitly warns never to uninstall FitTrack as an update procedure because IndexedDB is local application data; export JSON/CSV remains the recovery path before any destructive operation.

## Out of Scope

- Play Store publication, AAB release, and public production signing.
- iOS packaging.
- A custom Kotlin foreground service.
- Notification action buttons or a live-updating elapsed-time notification.
- Health Connect, widgets, reminders, and all later roadmap lots.
