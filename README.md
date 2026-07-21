# FitTrack

Application personnelle de suivi de musculation. Local-first, hors-ligne, sans compte.

**En ligne :** https://hugo-burnet.github.io/FITTRACK-RELOADED/

## Développement

```bash
npm install
npm run dev
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (typecheck inclus) |
| `npm run test:run` | Tests unitaires, une passe |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

> Le serveur de dev sert l'app sous `/FITTRACK-RELOADED/` (le `base` de `vite.config.ts`
> correspond au nom du dépôt GitHub). Ouvre http://localhost:5173/FITTRACK-RELOADED/.

## Déploiement

Chaque push sur `master` déclenche `.github/workflows/deploy.yml` : typecheck, tests, build,
puis publication sur GitHub Pages. Un typecheck ou un test en échec bloque la mise en ligne.

- Conventions : `CLAUDE.md`
- Feuille de route : `docs/plans/00-ROADMAP.md`
- Architecture : `docs/plans/01-ARCHITECTURE.md`
- Avancement : `PROGRESS.md`
