# candidates/

Extractions non approuvées. **Vide à ce stade** : la phase 2 définit le contrat des candidats
(`extraction-contract/extraction-candidate.schema.json`), elle ne lance pas l'extracteur.

Deux propriétés de cet espace comptent pour la suite :

- Un candidat n'a **pas d'identifiant métier**. Il en reçoit un du registre au moment de l'approbation ;
  un candidat rejeté ne consomme donc aucun identifiant et le registre ne se remplit pas de fantômes.
- Régénérer les candidats n'écrase jamais `curated/`. C'est ce qui rend l'extraction rejouable sans risque
  pour la source de vérité.
