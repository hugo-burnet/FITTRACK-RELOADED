# candidates/

Extractions non approuvées. Un candidat n'est pas une entité de la KB.

E1 (`tools/extract-e1.mjs`) écrit ici `e1-table-rows.json` et `e1-diagnostics.json`.
Régénérer ces fichiers n'écrase jamais `curated/`.

Deux propriétés de cet espace comptent pour la suite :

- Un candidat n'a **pas d'identifiant métier**. Il en reçoit un du registre au moment de l'approbation ;
  un candidat rejeté ne consomme donc aucun identifiant et le registre ne se remplit pas de fantômes.
- Régénérer les candidats n'écrase jamais `curated/`. C'est ce qui rend l'extraction rejouable sans risque
  pour la source de vérité.
