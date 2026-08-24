# candidates/

Extractions non approuvées. Un candidat n'est pas une entité de la KB.

E1 (`tools/extract-e1.mjs`) écrit `e1-table-rows.json`.
E2 (`tools/extract-e2.mjs`) écrit `e2-projections.json` sans modifier E1.
E3 (`tools/extract-e3.mjs`) écrit `e3-occurrences.json` sans modifier E1/E2.
E4 (`tools/extract-e4.mjs`) écrit `e4-paths.json` sans modifier E1/E2/E3.
E5-P0 (`tools/extract-e5-p0.mjs`) écrit les fragments de prose F2/F3, leurs
occurrences de citation, les diagnostics de couverture et un manifest golden
non annoté, sans modifier E1/E2/E3/E4 et sans appeler de modèle.
Régénérer ces fichiers n'écrase jamais `curated/`.

Deux propriétés de cet espace comptent pour la suite :

- Un candidat n'a **pas d'identifiant métier**. Il en reçoit un du registre au moment de l'approbation ;
  un candidat rejeté ne consomme donc aucun identifiant et le registre ne se remplit pas de fantômes.
- Régénérer les candidats n'écrase jamais `curated/`. C'est ce qui rend l'extraction rejouable sans risque
  pour la source de vérité.
