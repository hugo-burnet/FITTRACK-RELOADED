# La version de l'app dans l'en-tête — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** afficher le numéro de version de l'app en haut à droite de l'en-tête de chaque écran.

**Architecture :** `package.json` reste la source unique. `vite.config.ts` le publie en constante de
build, un module (`src/app/version.ts`) la lit, `Screen` l'affiche dans la marge haute de son en-tête.

**Tech Stack :** React 19 + TypeScript strict, Tailwind CSS v4, Vite 8, Vitest + Testing Library.

**Spec :** `docs/design/specs/2026-10-03-version-en-tete-design.md`

## Global Constraints

- Code et noms en **anglais**, interface en **français** : le format de l'étiquette vit dans
  `src/i18n/fr.ts`, jamais dans le composant.
- Aucune table, aucun index, aucune version de schéma, aucune requête réseau, aucune dépendance de plus.
- Le numéro n'est écrit nulle part à la main : ni dans le code, ni dans un test. Les tests le relisent
  dans `package.json`, sans quoi chaque release les casserait.
- L'en-tête ne gagne aucune hauteur et le `h1` garde le titre seul.
- À la fin : `npm run typecheck`, `npm run lint`, `npm run test:run` et `npm run build` verts.

---

### Task 1 : la constante de version

**Files:**

- Create: `src/app/version.ts`, `src/app/version.test.ts`
- Modify: `vite.config.ts`, `src/vite-env.d.ts`

**Interfaces:**

- Consumes: le champ `version` de `package.json`.
- Produces: `APP_VERSION: string`, qu'importent `Screen` et, plus tard, l'ouverture TTY1.

- [ ] **Step 1 : écrire le test qui échoue**

`src/app/version.test.ts` :

```ts
import { readFileSync } from 'node:fs';
import { APP_VERSION } from './version';

describe('APP_VERSION', () => {
  it('is the version package.json carries, the one the APK is built with', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

    expect(APP_VERSION).toBe(version);
  });

  it('is a plain major.minor.patch, with no prefix of its own', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2 : constater le rouge**

Run: `npx vitest run src/app/version.test.ts`

Expected: FAIL, `Failed to resolve import "./version"`.

- [ ] **Step 3 : la constante**

`vite.config.ts`, en tête (`readFileSync` s'ajoute aux imports) :

```ts
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };
```

et dans l'objet retourné par `defineConfig`, à côté de `base` :

```ts
    // The one number a release bumps. The Android workflow reads the same field for the APK's
    // versionName, so the header and the APK cannot say different things.
    define: { __APP_VERSION__: JSON.stringify(version) },
```

`src/vite-env.d.ts`, à la suite des références :

```ts
// Injected by `vite.config.ts` (`define`) from the `version` field of `package.json`. Read it
// through `APP_VERSION` in `src/app/version.ts`, never directly.
declare const __APP_VERSION__: string;
```

`src/app/version.ts` :

```ts
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
```

- [ ] **Step 4 : constater le vert**

Run: `npx vitest run src/app/version.test.ts && npm run typecheck`

Expected: PASS, typecheck sans sortie d'erreur.

- [ ] **Step 5 : commit**

```bash
git add -- vite.config.ts src/vite-env.d.ts src/app/version.ts src/app/version.test.ts
git commit -m "feat: la version de l'app, lue dans package.json"
```

### Task 2 : l'étiquette dans l'en-tête

**Files:**

- Create: `src/app/Screen.test.tsx`
- Modify: `src/app/Screen.tsx`, `src/i18n/fr.ts`

**Interfaces:**

- Consumes: `APP_VERSION` (Task 1), `t`.
- Produces: une étiquette `v{version}` dans le `<header>` de chaque `Screen`.

- [ ] **Step 1 : écrire le test qui échoue**

`src/app/Screen.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react';
import { t } from '@/i18n/fr';
import { Screen } from './Screen';
import { APP_VERSION } from './version';

describe('Screen', () => {
  it('shows the app version in its header', () => {
    render(
      <Screen title="Accueil">
        <p>contenu</p>
      </Screen>,
    );

    const version = screen.getByText(t('app.versionLabel', { version: APP_VERSION }));

    expect(version.closest('header')).toContainElement(
      screen.getByRole('heading', { level: 1, name: 'Accueil' }),
    );
  });

  it('leaves the title alone: the version is not part of the heading', () => {
    render(
      <Screen title="Pecs / triceps du lundi">
        <p>contenu</p>
      </Screen>,
    );

    // `name` is matched whole: a version written into the h1 would turn the title into
    // "Pecs / triceps du lundi v…", which is what a user-chosen name must never become.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Pecs / triceps du lundi' }),
    ).toBeInTheDocument();
  });

  it('is not something to press', () => {
    render(
      <Screen title="Accueil" onBack={() => {}}>
        <p>contenu</p>
      </Screen>,
    );

    const version = screen.getByText(t('app.versionLabel', { version: APP_VERSION }));

    expect(version.closest('button')).toBeNull();
  });
});
```

- [ ] **Step 2 : constater le rouge**

Run: `npx vitest run src/app/Screen.test.tsx`

Expected: FAIL, `Unable to find an element with the text: app.versionLabel` (la clé s'affiche
elle-même tant qu'elle n'existe pas).

- [ ] **Step 3 : le texte**

`src/i18n/fr.ts`, dans `app` :

```ts
    versionLabel: 'v{version}',
```

- [ ] **Step 4 : l'étiquette**

`src/app/Screen.tsx` : importer `APP_VERSION` depuis `./version`, rendre le `<header>` `relative` et
y poser, avant la flèche de retour :

```tsx
      <header className="relative flex min-h-16 shrink-0 items-center gap-2 px-4 pt-5 pb-4">
        {/* La version de l'app, dans la marge haute de l'en-tête (les 20 px de `pt-5`).
            Là, elle ne coûte pas un pixel de hauteur — ce qui compte sur la séance en
            direct — et elle ne se pose jamais à côté du titre : un second texte près
            d'un nom choisi par l'utilisateur se dispute les 375 px (la leçon du Lot 4,
            plus haut). Un relevé, pas une commande : rien à toucher. `text-2` et non
            `text-3`, parce que c'est un texte qu'on lit. */}
        <span className="pointer-events-none absolute top-1 right-4 text-xs tabular text-[var(--text-2)]">
          {t('app.versionLabel', { version: APP_VERSION })}
        </span>
```

- [ ] **Step 5 : constater le vert**

Run: `npx vitest run src/app/Screen.test.tsx` puis la suite entière : `npm run test:run`

Expected: PASS. Aucun test existant ne doit changer : si un test cherche un texte que l'étiquette
contient désormais, c'est lui qui était trop large.

- [ ] **Step 6 : vérifier à l'œil**

Run: `npm run dev`, ouvrir un écran à 390 puis 360 px, en sombre puis en clair, avec le tutoriel
écarté. L'étiquette est à droite, dans la marge, au-dessus des icônes ; le titre et les icônes sont
où ils étaient. Un titre long reste tronqué sur sa ligne ; la séance en direct n'a pas changé de hauteur.

- [ ] **Step 7 : les portes, puis le commit**

Run: `npm run typecheck && npm run lint && npm run test:run && npm run build`

```bash
git add -- src/app/Screen.tsx src/app/Screen.test.tsx src/i18n/fr.ts
git commit -m "feat: la version de l'app dans l'en-tête de chaque écran"
```
