/// <reference types="vite/client" />
// Types for `virtual:pwa-register/react`, the module vite-plugin-pwa creates at
// build time. Without this line the import resolves at runtime and fails to
// typecheck, which reads like a missing dependency rather than a missing
// reference.
/// <reference types="vite-plugin-pwa/client" />

// Injected by `vite.config.ts` (`define`) from the `version` field of `package.json`. Read it
// through `APP_VERSION` in `src/app/version.ts`, never directly.
declare const __APP_VERSION__: string;
