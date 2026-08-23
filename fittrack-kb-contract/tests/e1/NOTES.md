# E1 — notes de contrat, non corrigées

Ces écarts n'ont pas été « réparés » dans les schemas, fixtures ou fragments :
l'extracteur s'aligne sur le fichier réel et laisse le contrat tel quel.

## `frag.f1.0003` est une ligne séparatrice

`fragments/fragment-spec.json` déclare `frag.f1.0003` comme `table_row` à la
ligne 63 de F1. Cette ligne est `|---|---|---|---|---|---|---|---|---|`.
E1 ignore les séparateurs, donc **aucun candidat** n'est produit pour ce
fragment. Le golden set le conserve.

## Apostrophe du `rawStatement` golden vs corpus

Le corpus F1 L54 écrit `d’hypertrophie` (U+2019). La claim golden
`claim.training.volume.0001` écrit `d'hypertrophie` (apostrophe ASCII).
E1 conserve l'octet du corpus. La fixture n'a pas été retouchée.

## E1 n'est pas E2

Les cellules « Confiance », « Population », « Limites », « Ce qu'on ne peut
PAS conclure » sont copiées brutes. Elles ne sont pas projetées sur les six
axes épistémiques. C'est le travail d'E2.

## `unmapped_table_row`

Les tableaux de vocabulaire (niveaux de confiance, types de preuve) et le
tableau « schéma de données » de F2 n'ont pas de `kind` évident dans le
catalogue. E1 les extrait quand même, avec `targetKind: unmapped_table_row`,
plutôt que de les déguiser en claims.

## Fragments E1 vs golden set

Les lignes recollent un `frag.f1.*` / `frag.f2.*` seulement si le fragment
golden a **exactement** la même ligne de début et de fin. `frag.f2.0020`
couvre L370–L371 : E1 extrait une candidate par ligne physique et lui
donne un `frag.e1f1.NNNN` / `frag.e1f2.NNNN`, sans élargir le golden set.

Ces identifiants techniques ne sont **pas** ajoutés à `fragments.json`.
