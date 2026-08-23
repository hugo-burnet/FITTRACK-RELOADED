# E3 — occurrences, pas des publications

E3 répond à : où le corpus contient un lien Markdown, sous quelle forme, à quel endroit.

Il ne répond pas à : quelle publication c'est. `resolvesToSourceRef` est toujours `null`.
Aucun auteur, année, DOI, PMID ou `documentType` n'est déduit du label.

## Distinctions du contrat

| Concept | Ce que c'est |
|---|---|
| Lien Markdown | `[label](url)` dans une cellule |
| CitationOccurrence | ce lien à **cet** endroit (fragment + offsets) |
| Source | publication, métadonnées facultatives |
| Source curated | Source approuvée, hors E3 |

Deux occurrences identiques (même URL, même label) en deux fragments restent deux occurrences. INV-009 interdit la fusion automatique.

## Liens internes

`[voir §5](#x)` produit une occurrence `linkKind: internal`, `resolutionStatus: unresolved`, plus un diagnostic. Ce n'est pas une citation bibliographique.

## URL nues

Le contrat E3 vise les liens Markdown. Les URL sans `[]()` ne sont pas scannées.

## Statut de résolution

- URL `http(s)` → `partial` (localisateur présent, pas de métadonnées).
- Lien interne / schéma autre → `unresolved`.
- Jamais `resolved` : aucun identifiant bibliographique fort n'est établi ici.
