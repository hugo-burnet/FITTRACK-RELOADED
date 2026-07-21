# Lot 1 — Design system & coquille de l'application

**Objectif :** la charte visuelle, les primitives d'interface et la navigation. Tout le reste de
l'app s'empile là-dessus.

**Dépend de :** Lot 0.
**Budget :** 1 à 2 sessions.

## Le contexte d'usage dicte le design

Ce ne sont pas des préférences esthétiques, ce sont des contraintes fonctionnelles :

| Réalité | Conséquence de conception |
|---|---|
| Salle sombre, écran à bout de bras | Thème **sombre par défaut**, contraste élevé, corps de texte ≥ 16 px |
| Mains moites, une seule main libre | Cibles tactiles **≥ 48 px**, actions primaires **en bas** |
| Essoufflé entre deux séries | Zéro texte superflu, l'information utile en gros |
| Chiffres qui changent en permanence | **Chiffres tabulaires** — sinon « 100 → 97,5 » fait sauter la mise en page |
| Écran allumé 90 minutes | Fond quasi noir (économie d'écran OLED, moins agressif) |

**Direction visuelle :** noir profond, un seul accent vif (vert acide) réservé aux actions et aux
états « validé ». Pas de dégradés, pas d'ombres portées décoratives. L'interface doit s'effacer
derrière les chiffres.

---

## Tâche 1 — Jetons de design

**Fichiers :** modifier `src/index.css`

- [ ] **Étape 1.1 — Écrire les jetons**

```css
@import 'tailwindcss';

@theme {
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  /* Accent unique : actions primaires, séries validées, records */
  --color-accent: #c7f252;
  --color-accent-dim: #9dc22f;
  --color-accent-fg: #10160a;

  --color-danger: #ff5c5c;
  --color-warn: #ffb020;
}

:root {
  color-scheme: dark;
  --surface-0: #0a0a0b;   /* fond de page */
  --surface-1: #141416;   /* cartes, lignes de liste */
  --surface-2: #1e1e21;   /* champs de saisie, éléments surélevés */
  --border: #2a2a2e;
  --text-1: #f4f4f5;      /* texte principal */
  --text-2: #a1a1aa;      /* texte secondaire */
  --text-3: #71717a;      /* texte désactivé, valeurs précédentes */
}

:root[data-theme='light'] {
  color-scheme: light;
  --surface-0: #ffffff;
  --surface-1: #f4f4f5;
  --surface-2: #e4e4e7;
  --border: #d4d4d8;
  --text-1: #18181b;
  --text-2: #52525b;
  --text-3: #a1a1aa;
}

html, body, #root { height: 100%; }

body {
  margin: 0;
  background: var(--surface-0);
  color: var(--text-1);
  font-family: var(--font-sans);
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
}

/* Tout chiffre susceptible de changer utilise cette classe. */
.tabular { font-variant-numeric: tabular-nums; }

/* Respect des encoches et de la barre de gestes Android/iOS. */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
.safe-top { padding-top: env(safe-area-inset-top, 0px); }
```

- [ ] **Étape 1.2 — Vérifier** : `npm run dev`, le fond doit être quasi noir.

---

## Tâche 2 — Thème persistant

**Fichiers :** créer `src/stores/theme.ts`, `src/stores/theme.test.ts`

- [ ] **Étape 2.1 — Écrire le test d'abord**

```ts
// src/stores/theme.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, loadTheme, THEME_STORAGE_KEY } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('utilise le thème sombre par défaut', () => {
    expect(loadTheme()).toBe('dark');
  });

  it('mémorise le thème choisi', () => {
    applyTheme('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(loadTheme()).toBe('light');
  });

  it("pose l'attribut data-theme sur la racine du document", () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Étape 2.2 — Lancer le test** : `npm run test:run` → doit échouer (module introuvable).

- [ ] **Étape 2.3 — Implémenter `src/stores/theme.ts`**

```ts
export type Theme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'fittrack:theme';

export function loadTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}
```

> Le thème vit dans `localStorage`, pas dans IndexedDB : il doit être appliqué **avant** le premier
> rendu, et une lecture IndexedDB est asynchrone — l'app clignoterait en blanc à chaque démarrage.
> C'est la seule exception assumée à la règle « tout dans Dexie ».

- [ ] **Étape 2.4 — Relancer les tests** → 4 tests passent.
- [ ] **Étape 2.5 — Appliquer le thème au démarrage** dans `src/main.tsx`, avant `createRoot` :
      `applyTheme(loadTheme());`
- [ ] **Étape 2.6 — Commit** : `git commit -m "feat(lot-01): thème sombre/clair persistant"`

---

## Tâche 3 — Primitives d'interface

**Fichiers :** `src/ui/Button.tsx`, `Input.tsx`, `NumberInput.tsx`, `ListRow.tsx`, `Sheet.tsx`,
`EmptyState.tsx`, `index.ts`

**Interfaces produites** (les lots suivants s'appuient sur ces signatures exactes) :

```ts
type ButtonProps = { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'lg';
                     fullWidth?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>;
type NumberInputProps = { value: number | undefined; onChange: (v: number | undefined) => void;
                          step?: number; min?: number; max?: number; suffix?: string;
                          placeholder?: string; 'aria-label': string };
type SheetProps = { open: boolean; onClose: () => void; title: string; children: React.ReactNode };
```

- [ ] **Étape 3.1 — `Button.tsx`**

```tsx
import type { ButtonHTMLAttributes } from 'react';

type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANTS = {
  primary: 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] active:bg-[var(--color-accent-dim)]',
  secondary: 'bg-[var(--surface-2)] text-[var(--text-1)] active:brightness-125',
  ghost: 'bg-transparent text-[var(--text-2)] active:bg-[var(--surface-1)]',
  danger: 'bg-transparent text-[var(--color-danger)] active:bg-[var(--surface-1)]',
} as const;

export function Button({
  variant = 'secondary', size = 'md', fullWidth = false, className = '', ...rest
}: Props) {
  // min-h-12 = 48px : cible tactile minimale, non négociable.
  const sizes = size === 'lg' ? 'min-h-14 px-6 text-lg' : 'min-h-12 px-4 text-base';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold
        transition-[filter,background-color] disabled:opacity-40
        ${VARIANTS[variant]} ${sizes} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
}
```

- [ ] **Étape 3.2 — `NumberInput.tsx`** — **le composant le plus important de l'app.** Il sera
      utilisé des dizaines de fois par séance, avec les doigts moites.

```tsx
import { useEffect, useState } from 'react';

type Props = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  placeholder?: string;
  'aria-label': string;
};

const NUMERIC = /^\d*[.,]?\d*$/;

const parse = (raw: string): number | undefined => {
  if (raw === '') return undefined;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isNaN(parsed) ? undefined : parsed;
};

export function NumberInput({
  value, onChange, step = 2.5, min = 0, max = 9999, suffix, placeholder, ...aria
}: Props) {
  // Le champ garde sa propre chaîne de saisie : sans ça, "102," est reparsé en 102
  // et la virgule disparaît sous les doigts — décimale impossible à taper.
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));

  // Resynchronise seulement quand la valeur change réellement depuis l'extérieur
  // (pré-remplissage depuis la série précédente, boutons ±).
  useEffect(() => {
    if (parse(draft) !== value) setDraft(value === undefined ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleInput = (raw: string) => {
    if (!NUMERIC.test(raw)) return; // refuse lettres et séparateurs multiples
    setDraft(raw);
    onChange(parse(raw));
  };

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, (value ?? 0) + delta));
    onChange(Number(next.toFixed(2)));
  };

  return (
    <div className="flex items-stretch gap-1">
      <button type="button" aria-label="Diminuer" onClick={() => bump(-step)}
        className="min-h-12 w-12 rounded-lg bg-[var(--surface-2)] text-xl">−</button>

      <input
        type="text"
        inputMode="decimal"
        enterKeyHint="done"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={(e) => e.target.select()} // remplacer la valeur d'un geste, pas la corriger
        className="tabular min-h-12 w-full rounded-lg bg-[var(--surface-2)] text-center
                   text-xl font-semibold outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        {...aria}
      />
      {suffix && <span className="self-center px-1 text-sm text-[var(--text-3)]">{suffix}</span>}

      <button type="button" aria-label="Augmenter" onClick={() => bump(step)}
        className="min-h-12 w-12 rounded-lg bg-[var(--surface-2)] text-xl">+</button>
    </div>
  );
}
```

Cinq décisions volontaires, à ne pas « simplifier » plus tard :
- **Chaîne de saisie interne (`draft`)** : c'est le point critique. Un champ numérique piloté
  directement par un `number` ne peut pas représenter l'état intermédiaire `"102,"` — la virgule
  est avalée à la frappe et taper une décimale devient impossible. Bug classique, invisible en
  développement au clavier PC, exaspérant au quotidien sur téléphone.
- `type="text"` + `inputMode="decimal"` plutôt que `type="number"` : ce dernier affiche des flèches
  minuscules, gère mal la virgule et s'incrémente au scroll par accident.
- La **virgule est acceptée** puis convertie : un clavier français produit `,` et `Number(',')`
  vaut `NaN`.
- `onFocus` sélectionne tout : on remplace 100 par 105 en tapant, sans effacer caractère par caractère.
- Les boutons ± font 48 px : utilisables sans regarder.

- [ ] **Étape 3.3 — Écrire les tests du `NumberInput`**

Le composant est contrôlé : le tester avec une `value` figée ne prouverait rien, puisque React
réinitialiserait le champ à chaque frappe. Les tests passent donc par un harnais avec état, qui
reproduit l'usage réel.

```tsx
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberInput } from './NumberInput';

function Harness({ initial }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <>
      <NumberInput value={value} onChange={setValue} step={2.5} min={0} aria-label="Poids" />
      <output data-testid="value">{value === undefined ? 'vide' : value}</output>
    </>
  );
}

describe('NumberInput', () => {
  it('accepte la virgule comme séparateur décimal', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Poids'), '102,5');
    expect(screen.getByLabelText('Poids')).toHaveValue('102,5'); // la virgule reste affichée
    expect(screen.getByTestId('value')).toHaveTextContent('102.5'); // et vaut bien 102,5
  });

  it('accepte aussi le point', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Poids'), '102.5');
    expect(screen.getByTestId('value')).toHaveTextContent('102.5');
  });

  it('refuse les caractères non numériques', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Poids'), '10a0');
    expect(screen.getByLabelText('Poids')).toHaveValue('100');
  });

  it('incrémente du pas fourni', async () => {
    render(<Harness initial={100} />);
    await userEvent.click(screen.getByLabelText('Augmenter'));
    expect(screen.getByTestId('value')).toHaveTextContent('102.5');
    expect(screen.getByLabelText('Poids')).toHaveValue('102.5');
  });

  it('ne descend pas sous le minimum', async () => {
    render(<Harness initial={0} />);
    await userEvent.click(screen.getByLabelText('Diminuer'));
    expect(screen.getByTestId('value')).toHaveTextContent('0');
  });

  it('se vide proprement', async () => {
    render(<Harness initial={100} />);
    await userEvent.clear(screen.getByLabelText('Poids'));
    expect(screen.getByTestId('value')).toHaveTextContent('vide');
  });
});
```

> Le premier test est le garde-fou du projet : il échoue si quelqu'un « simplifie » le composant en
> retirant l'état `draft`. C'est précisément le bug qu'on veut empêcher de revenir.

- [ ] **Étape 3.4 — Créer `Input.tsx`, `ListRow.tsx`, `Sheet.tsx`, `EmptyState.tsx`** sur le même
      modèle (hauteur minimale 48 px, jetons CSS, aucune couleur en dur hors des variables).
      `Sheet` = panneau qui monte du bas, avec fermeture au geste vers le bas et à l'appui sur
      l'arrière-plan — c'est le conteneur de tous les sélecteurs de l'app.
- [ ] **Étape 3.5 — `src/ui/index.ts`** réexporte tout.
- [ ] **Étape 3.6 — Tests verts + commit** : `git commit -m "feat(lot-01): primitives d'interface"`

---

## Tâche 4 — Navigation et coquille

**Fichiers :** `src/router.tsx`, `src/app/AppShell.tsx`, `src/app/BottomNav.tsx`,
`src/app/ErrorBoundary.tsx`, 5 écrans vides dans `src/features/*/`

- [ ] **Étape 4.1 — Créer les 5 écrans placeholder**, chacun avec un `<h1>` et un `EmptyState` :
      `features/home/HomeScreen.tsx`, `features/routines/RoutinesScreen.tsx`,
      `features/history/HistoryScreen.tsx`, `features/exercises/ExercisesScreen.tsx`,
      `features/settings/SettingsScreen.tsx`.

- [ ] **Étape 4.2 — `src/router.tsx`**

```tsx
import { createHashRouter } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { HomeScreen } from './features/home/HomeScreen';
// … autres imports

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'routines', element: <RoutinesScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'exercises', element: <ExercisesScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
    ],
  },
]);
```

⚠️ **`createHashRouter`, pas `createBrowserRouter`** — cf. ADR-003. Utiliser le second produit des
404 sur GitHub Pages dès qu'on recharge une page profonde.

- [ ] **Étape 4.3 — `BottomNav.tsx`** : 5 onglets (Accueil, Routines, Historique, Exercices,
      Réglages), `<nav>` fixé en bas avec `safe-bottom`, onglet actif en `--color-accent`,
      chaque cible ≥ 56 px de haut, `aria-current="page"` sur l'actif.

- [ ] **Étape 4.4 — `AppShell.tsx`** : `<Outlet />` dans une zone scrollable + `<BottomNav />`
      fixe. Le contenu doit avoir un `padding-bottom` égal à la hauteur de la barre, sinon le
      dernier élément de chaque liste est masqué — vérifier en descendant tout en bas d'une liste.

- [ ] **Étape 4.5 — `ErrorBoundary.tsx`** : capture les erreurs de rendu et affiche un écran de
      repli avec un bouton « Recharger ». Sur une app installée, une erreur non capturée donne un
      écran blanc sans console accessible : indispensable.

- [ ] **Étape 4.6 — Brancher le routeur** dans `main.tsx` (`<RouterProvider router={router} />`),
      supprimer `App.tsx` et `App.test.tsx`.

- [ ] **Étape 4.7 — Vérifier, commiter, pousser**

```bash
npm run typecheck && npm run test:run && npm run build
git add -A && git commit -m "feat(lot-01): navigation et coquille applicative" && git push
```

---

## Tâche 5 — Textes centralisés

- [ ] **Étape 5.1 — Créer `src/i18n/fr.ts`** avec un objet imbriqué de toutes les chaînes déjà
      écrites, et un helper `t(key)`. Remplacer toutes les chaînes en dur des écrans.
- [ ] **Étape 5.2 — Mettre à jour `PROGRESS.md`, commiter, pousser.**

---

## ✅ Checkpoint utilisateur

Sur ton téléphone, à l'URL GitHub Pages :

- [ ] Les 5 onglets du bas fonctionnent, l'onglet actif est visuellement évident.
- [ ] **Ça ressemble à une application, pas à un site** : pas de zoom au double-tap, pas de
      rebond « pull to refresh », les cibles se touchent sans viser.
- [ ] La bascule clair/sombre marche et survit à un rechargement.
- [ ] Tu descends tout en bas d'un écran : rien n'est caché derrière la barre de navigation.
- [ ] Tu tapes un poids à virgule dans le composant de démonstration : `102,5` est accepté.

Quand c'est validé : **Lot 2**.
