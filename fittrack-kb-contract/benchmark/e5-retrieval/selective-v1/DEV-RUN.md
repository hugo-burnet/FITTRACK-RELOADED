# Run DEV — baseline lexicale et hybride

Date : 2026-08-26

Partition : DEV uniquement (59 questions)

Modèle dense local : `bge-m3:latest`

Digest Ollama : `7907646426070047a77226ac3e684fbbe8410524f7b4a74d02837e43f2146bab`

## Intégrité

- 408 preuves uniques indexées ;
- 59 questions traitées ;
- 4 `claimId` distincts par question ;
- fusion BM25 + cosinus dense par RRF (`k = 60`) ;
- aucune génération de réponse ;
- aucune exécution ni inspection de CAL ou TEST ;
- empreinte du run hybride :
  `sha256:5aeb5705b008811860b44c323aeb3cb1ae5b87f1c615e2dcc96fd246367bea43`.

Le run hybride a duré 528 secondes. Son top-1 diffère de la baseline lexicale sur 43 des
59 questions. Sur 58 questions, le top-1 hybride figurait cependant déjà dans les 60 résultats
lexicaux : le dense reclasse surtout le pool lexical ; un seul top-1 est dense uniquement.

## Inspection DEV provisoire

Cette inspection cherche les pannes évidentes de l’instrument. Elle ne remplace pas les deux
annotations indépendantes et ne mesure pas la couverture du corpus.

Le pipeline retourne des preuves directement utiles sur plusieurs questions précises, par
exemple la leg extension et le genou, le rowing poitrine appuyée, l’overhead triceps, la presse
profonde et le bassin, ou machines contre poids libres.

Il échoue clairement sur plusieurs questions plus larges ou absentes du corpus : deload,
ordre biceps/dos, volume hebdomadaire, tempo excentrique, reprise après pause et priorité des
muscles. Dans ces cas, les quatre candidats peuvent rester hors sujet. La présence d’un résultat
ne peut donc pas servir de décision d’answerability.

## Décision

Le chemin technique passe, mais le pipeline ne passe pas encore un seuil de fiabilité produit.
Ne pas ouvrir CAL ni TEST.

Étape suivante : annoter DEV de façon exhaustive, distinguer les erreurs de recherche des trous
du corpus, puis effectuer l’unique correction autorisée avant de mesurer de nouveau DEV.

## Suite — ce que l’annotation a révisé

Cette étape suivante a été faite ; elle est consignée dans `DEV-ANNOTATION.md`. Elle corrige
deux affirmations de la section « Inspection DEV provisoire » ci-dessus.

D’abord, les six échecs cités (deload, ordre biceps/dos, volume hebdomadaire, tempo excentrique,
reprise après pause, priorité des muscles) ne sont pas des échecs du moteur : ce sont des
**lacunes du corpus**. Le corpus ne contient aucun contenu de programmation. Aucun réglage de
récupération ne les corrigera.

Ensuite, la couverture exhaustive du corpus est de **31/59 = 52,5 %**, très au-dessus du seuil
de continuation de 20 %. Sur les 31 questions répondables, le moteur en ratait 9 dont la réponse
était présente dans le corpus. Le pipeline sous-exploitait donc le corpus au lieu d’en atteindre
les limites.

Enfin, l’inspection provisoire notait que « la présence d’un résultat ne peut pas servir de
décision d’answerability ». C’est maintenant mesuré : le moteur renvoie quatre candidats pour
**28 des 28** questions auxquelles le corpus ne peut pas répondre.

La décision « ne pas ouvrir CAL ni TEST » reste valable, mais pour une raison différente de celle
écrite ici : ce n’est pas le corpus qui est trop pauvre, c’est le refus qui n’existe pas encore.
