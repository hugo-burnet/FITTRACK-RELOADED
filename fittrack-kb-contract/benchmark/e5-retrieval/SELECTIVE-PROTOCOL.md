# Protocole sélectif v1

Ce protocole remplace l’usage abusif du score top-1 comme mesure de couverture du corpus.
Il ne valide ni un modèle génératif ni un seuil avec les 30 questions historiques : celles-ci
forment désormais un jeu de développement contaminé par les choix antérieurs.

## 1. Questions indépendantes

Recueillir au moins 120 questions réalistes, une par ligne, sans regarder les résultats du
moteur. Elles doivent venir de pratiquants ou de scénarios rédigés avant toute nouvelle
itération de recherche.

```powershell
npm run benchmark:e5-selective:scaffold -- --input questions-nouvelles.txt
```

Le générateur refuse les doublons et les 30 questions déjà utilisées, puis produit trois
partitions déterministes d’au moins 40 questions :

- `DEV` sert à corriger les erreurs d’instrumentation et de recherche ;
- `CAL` sert une seule fois à choisir le seuil de refus ;
- `TEST` reste fermé jusqu’au gel du pipeline et donne le résultat publié.

Si un fichier reçu mélange volontairement anciennes et nouvelles questions, l’option
`--exclude-prior true` retire les anciennes tout en enregistrant leur nombre et leurs
identifiants dans le manifeste. Sans cette option explicite, le générateur s’arrête.

## 2. Couverture exhaustive

Deux personnes remplissent séparément `labels-annotator-a.json` et
`labels-annotator-b.json`. Pour chaque question elles indiquent :

- `ANSWERABLE` si le corpus contient tous les éléments nécessaires ;
- `UNANSWERABLE` s’il manque au moins un élément indispensable ;
- `AMBIGUOUS` si la question ne permet pas une décision stable ;
- tous les `supportingClaimIds`, pas seulement le premier résultat du moteur.

Les désaccords sont adjudiqués sans modifier les feuilles initiales. La couverture du corpus
est le nombre de questions `ANSWERABLE` divisé par le nombre de questions décidables. Elle
n’est donc jamais déduite d’un top-1.

## 3. Calibration et décision

Le pipeline est gelé avant d’ouvrir `TEST` : versions et empreintes des corpus, questions,
modèles et réglages sont consignées dans le manifeste du run.

- Continuer la bifurcation si la couverture exhaustive dépasse 20 % sur les 120 questions.
- L’arrêter si elle reste sous 20 % après une correction d’instrument et un unique ajout de
  sources ciblé par les lacunes observées.
- Ne réintroduire une formulation générative qu’après un test plus large comptant au moins
  100 réponses acceptées, avec borne basse à 95 % de fidélité ≥ 95 %, couverture utile ≥ 50 %
  et zéro erreur dangereuse.

Tant qu’aucun profil CAL/TEST n’est validé, l’application reste en mode `UNCALIBRATED` : elle
peut montrer des candidats lexicaux et leur provenance, mais ne les appelle pas « réponse ».
