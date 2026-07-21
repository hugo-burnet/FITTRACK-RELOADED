# Lot 0 — Bootstrap & déploiement continu

> **Pour l'agent :** exécute ce plan étape par étape. Coche les cases au fur et à mesure.
> Ne passe pas à l'étape suivante tant que la commande de vérification de l'étape courante n'a pas
> le résultat attendu.

**Objectif :** un site React vide, en ligne sur GitHub Pages, redéployé à chaque push.

**Pourquoi déployer avant de coder :** la chaîne de livraison (chemin de base, build, permissions
GitHub Actions) est la source d'erreurs la plus pénible du projet. La valider sur un « Hello »
prend 20 minutes ; la déboguer par-dessus 5 000 lignes de code en prend trois heures.

**Budget :** 1 session.

## Contraintes globales

- Node ≥ 20 (la machine a Node 24.18 — OK).
- TypeScript en mode `strict`.
- Pas de commande interactive : ce plan crée les fichiers explicitement plutôt que de lancer
  `npm create vite`, dont les invites bloquent un shell non interactif.
- Le nom du dépôt est **`fittrack`**. Il apparaît dans `base` de `vite.config.ts`. Si tu choisis
  un autre nom, c'est le **seul** endroit à changer.

---

## Tâche 1 — Squelette du projet

**Fichiers :** `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`,
`index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Étape 1.1 — Créer `package.json`**

```json
{
  "name": "fittrack",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Étape 1.2 — Installer les dépendances**

```bash
npm install react react-dom react-router-dom dexie dexie-react-hooks zustand date-fns
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom \
  tailwindcss @tailwindcss/vite \
  vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  fake-indexeddb
```

Attendu : `node_modules/` créé, `package-lock.json` généré, aucune erreur `ERESOLVE`.

> **Note Tailwind v4 :** la v4 s'installe comme **plugin Vite** (`@tailwindcss/vite`) et se
> configure en CSS, sans `tailwind.config.js` ni `postcss.config.js`. Si la version installée
> réclame encore `npx tailwindcss init`, c'est que npm a résolu une v3 : vérifie avec
> `npm ls tailwindcss` et suis la documentation de la version réellement installée.

- [ ] **Étape 1.3 — Créer `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Doit correspondre au nom du dépôt GitHub, slashes inclus.
  base: '/fittrack/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Étape 1.4 — Créer `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "vite.config.ts"]
}
```

`noUncheckedIndexedAccess` rendra `arr[0]` de type `T | undefined`. C'est volontairement strict :
sur une app qui manipule en permanence des listes de séries, ça évite une classe entière de
plantages en pleine séance.

> ⚠️ L'alias `@/*` doit aussi être déclaré côté Vite, sinon il compile mais ne s'exécute pas.
> Ajoute dans `vite.config.ts` :
> ```ts
> resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
> ```

- [ ] **Étape 1.5 — Créer `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
    <meta name="theme-color" content="#0a0a0b" />
    <title>FitTrack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`maximum-scale=1, user-scalable=no` évite le zoom involontaire quand on tape vite sur les champs
de saisie pendant une séance. `viewport-fit=cover` prépare la gestion des encoches.

- [ ] **Étape 1.6 — Créer `src/index.css`**

```css
@import 'tailwindcss';

html, body, #root { height: 100%; }
body {
  margin: 0;
  overscroll-behavior-y: none; /* pas de "pull to refresh" en pleine séance */
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Étape 1.7 — Créer `src/App.tsx`**

```tsx
export default function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 bg-neutral-950 text-neutral-50">
      <h1 className="text-3xl font-bold">FitTrack</h1>
      <p className="text-sm text-neutral-400">Lot 0 — déploiement opérationnel</p>
    </main>
  );
}
```

- [ ] **Étape 1.8 — Créer `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Élément racine #root introuvable');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Étape 1.9 — Vérifier `.gitignore`**

Le fichier existe déjà (créé avec les documents de planification). Vérifier qu'il contient bien :

```
node_modules
dist
dist-ssr
coverage
*.local
.DS_Store
.env
.env.*
!.env.example

# Plateformes natives générées par Capacitor (Lot 10)
android/
ios/

# Configuration locale de l'agent : réinstallable, sans valeur pour le projet
.claude/
```

`android/` est ignoré car Capacitor le régénère depuis `dist/` — le commiter reviendrait à
versionner un artefact de build de plusieurs milliers de fichiers.

- [ ] **Étape 1.10 — Vérifier que le build passe**

```bash
npm run typecheck && npm run build
```

Attendu : `dist/index.html` et `dist/assets/*` créés, aucune erreur TypeScript.

---

## Tâche 2 — Harnais de test

**Fichiers :** `src/test/setup.ts`, `src/App.test.tsx`

- [ ] **Étape 2.1 — Créer `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Étape 2.2 — Écrire le test de fumée `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it("affiche le nom de l'application", () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'FitTrack' })).toBeInTheDocument();
  });
});
```

- [ ] **Étape 2.3 — Lancer les tests**

```bash
npm run test:run
```

Attendu : `1 passed`. Si l'erreur est `describe is not defined`, c'est que `globals: true` manque
dans `vite.config.ts`. Si c'est `toBeInTheDocument is not a function`, c'est `setupFiles` qui n'est
pas pris en compte.

- [ ] **Étape 2.4 — Premier commit**

```bash
git add -A
git commit -m "chore: bootstrap Vite + React + TS + Tailwind + Vitest"
```

---

## Tâche 3 — Dépôt GitHub

⚠️ `gh` (CLI GitHub) n'est **pas installé** sur cette machine. Ces étapes sont **manuelles** et
c'est à l'utilisateur de les faire. L'agent doit s'arrêter ici et les lui demander.

- [ ] **Étape 3.1 — Créer le dépôt** sur https://github.com/new
  - Nom : `fittrack`
  - Visibilité : **Public**.
    > GitHub Pages sur un dépôt **privé** nécessite un abonnement GitHub Pro. L'app ne contient
    > aucun secret (les données restent sur l'appareil), donc public est sans risque ici.
  - Ne cocher **ni** README, **ni** .gitignore, **ni** licence (le dossier local a déjà son contenu).

- [ ] **Étape 3.2 — Relier et pousser**

```bash
git remote add origin https://github.com/<TON-PSEUDO>/fittrack.git
git branch -M master
git push -u origin master
```

- [ ] **Étape 3.3 — Activer GitHub Pages**
  - Dépôt → **Settings** → **Pages**
  - **Source : GitHub Actions** (⚠️ **pas** « Deploy from a branch » — c'est l'erreur classique,
    le workflow échouera sinon avec une erreur de permissions).

---

## Tâche 4 — Déploiement automatique

**Fichiers :** `.github/workflows/deploy.yml`

- [ ] **Étape 4.1 — Créer le workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test:run
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Les trois `permissions` sont obligatoires. Le job échoue avec une erreur d'authentification opaque
si `id-token: write` manque.

Le build fait échouer le déploiement si le typecheck ou les tests cassent : c'est le garde-fou qui
empêche de mettre en ligne une version non fonctionnelle.

> Si les versions d'actions ci-dessus sont refusées comme obsolètes, prendre les versions majeures
> courantes indiquées sur la page du Marketplace, et le noter dans `PROGRESS.md`.

- [ ] **Étape 4.2 — Commiter et pousser**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: déploiement automatique sur GitHub Pages"
git push
```

- [ ] **Étape 4.3 — Vérifier l'exécution**

Onglet **Actions** du dépôt. Attendu : les deux jobs `build` puis `deploy` en vert, et une URL
`https://<TON-PSEUDO>.github.io/fittrack/` affichée dans le job `deploy`.

**Si la page est blanche avec des erreurs 404 sur les fichiers `assets/`** : `base` dans
`vite.config.ts` ne correspond pas au nom du dépôt. C'est l'erreur n°1 de ce lot.

---

## Tâche 5 — Documentation d'amorçage

- [ ] **Étape 5.1 — Créer `README.md`**

```markdown
# FitTrack

Application personnelle de suivi de musculation. Local-first, hors-ligne, sans compte.

**En ligne :** https://<TON-PSEUDO>.github.io/fittrack/

## Développement

```bash
npm install
npm run dev
```

- Conventions : `CLAUDE.md`
- Feuille de route : `docs/plans/00-ROADMAP.md`
- Architecture : `docs/plans/01-ARCHITECTURE.md`
- Avancement : `PROGRESS.md`
```

- [ ] **Étape 5.2 — Mettre à jour `PROGRESS.md`** : Lot 0 ✅, noter l'URL réelle du site, le
      pseudo GitHub, et toute divergence rencontrée (versions d'actions, version de Tailwind).

- [ ] **Étape 5.3 — Commit final**

```bash
git add -A
git commit -m "docs: README et avancement du Lot 0"
git push
```

---

## ✅ Checkpoint utilisateur

À vérifier **toi-même**, sur ton téléphone :

- [ ] `https://<TON-PSEUDO>.github.io/fittrack/` s'ouvre et affiche « FitTrack » sur fond sombre.
- [ ] Tu changes le texte de `src/App.tsx`, tu commites, tu pushes → le site est à jour environ
      2 minutes plus tard (recharge en vidant le cache si besoin).
- [ ] L'onglet Actions est vert.

Quand ces trois points sont validés : **Lot 1**.
