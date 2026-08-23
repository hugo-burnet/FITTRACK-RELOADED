# policies/ — décisions normatives propres à FitTrack

Cet espace contient ce que **FitTrack décide**, par opposition à ce que le corpus **établit**.

## La distinction, en une phrase chacune

```text
KB      : quelles dimensions faut-il observer, et comment les interpréter prudemment ?
POLICY  : quelle conduite conservatrice FitTrack applique-t-il ?
RUNTIME : que rapporte cet utilisateur, à cette date, avec cette charge ?
```

Une politique FitTrack ne doit jamais être présentée comme une vérité scientifique ou médicale. Ce n'est
pas une consigne de rédaction : `product-safety-policy.schema.json` et `output-policy.schema.json` fixent
`knowledgeType` à la constante `PRODUCT_POLICY` et `presentedAsMedicalTruth` à la constante `false`. Une
politique qui prétendrait au statut médical est refusée par le schéma, et le cas est testé
(`INV-CASE-12`).

## Pourquoi une politique n'a pas de provenance de corpus

Les entités de `curated/` doivent porter au moins un lien vers un fragment. Les politiques, non — et c'est
délibéré. Exiger une provenance de corpus pour un choix produit obligerait à lui fabriquer une source
scientifique, ce qui est exactement l'inverse du but.

Une politique porte donc :

- `decision` — qui a décidé, quand, et pourquoi ;
- `informedByClaimRefs` et `informedBySourceRefs` — ce qui a éclairé la décision, sans la fonder ;
- `corpusContextFragmentRefs` — les passages qu'on a lus avant de trancher ;
- `divergesFromCorpus` et, le cas échéant, `divergenceRationale`.

## Le cas d'école du corpus

Le seuil de douleur est l'exemple que la base clinique traite elle-même. Elle constate que « 0–3/10 » est
une règle pratique conservatrice fréquente mais **non un seuil clinique universel validé**, que le
protocole publié le mieux documenté utilise 5/10 sur des populations tendineuses spécifiques, et elle
autorise explicitement le produit à retenir le garde-fou plus prudent — **à condition de le nommer
politique de sécurité et non vérité médicale**.

`policy.safety.pain-guardrail.0001` applique cette condition à la lettre, y compris
`divergesFromCorpus: true` et le `userFacingFraming` qui dit à l'utilisateur que la consigne de son
professionnel de santé prime sur celle de l'application.

## Où sont les instances

Les trois politiques de cette phase — deux `ProductSafetyPolicy` et une `OutputPolicy` — vivent dans
`fixtures/golden-set/40-policies-runtime-governance.json`, avec le reste du golden set. Elles y sont
validées à chaque exécution de `npm run validate`.

Elles ne sont **pas dupliquées ici** : deux copies d'une même politique divergeraient, et une politique de
sécurité qui existe en deux versions contradictoires est pire qu'une politique absente. Dans la KB de
production, `policies/` est l'emplacement de stockage ; dans ce paquet de contrat, le golden set l'est,
parce qu'il est le seul emplacement que les tests parcourent.

## Politiques à écrire avant la mise en service

Ces décisions sont identifiées mais pas encore prises. Les lister vaut mieux que de les laisser se prendre
implicitement dans le code.

| Sujet | Question ouverte |
|---|---|
| Affichage des conflits de preuve | Un `EvidenceConflict` marqué `mustBeSurfacedToUser` doit-il interrompre le flux, ou se présenter comme une note ? |
| Seuil de silence du coach | À partir de quand le produit choisit-il de ne rien dire plutôt que de signaler une variation non significative ? |
| Ancienneté des sources | Que fait le produit d'une règle appuyée sur une source signalée ancienne par le corpus lui-même ? |
| Consignes de professionnel non vérifiables | Jusqu'où une `ClinicianInstruction` rapportée mais non vérifiée bloque-t-elle une progression ? |
