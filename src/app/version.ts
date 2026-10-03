/**
 * The number the app is built as: the `version` field of `package.json`, which the Android
 * workflow also hands to Gradle as the APK's `versionName`. `vite.config.ts` injects it at build
 * time, so a release bumps one number and no line of code can fall behind it.
 *
 * It is how a phone says whether the PWA and the APK are on the same build — the gap a fix
 * pushed after a tag opens. The only reader of `__APP_VERSION__`: a component or a test imports
 * this constant rather than the build-time global.
 */
export const APP_VERSION: string = __APP_VERSION__;
