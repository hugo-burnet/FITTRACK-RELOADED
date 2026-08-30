# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> L'historique détaillé vit dans `docs/progress/`.

**Dernière mise à jour :** 2026-08-30 (**ouverture simplifiée + terminal GRUB** — la barre se
charge sans chute, sol, poussière ni secousse ; les deux phrases apparaissent successivement puis
le rideau révèle l'accueil. Tous les 14 à 28 jours environ, un terminal noir à écriture blanche
remplace les phrases. Typecheck vert, **232 fichiers / 2 455 tests** verts, build vert.
**Checkpoint téléphone : cold start, puis le terminal noir.**). Le 2026-08-29 (**les paliers** —
56 seuils acquis à vie, table Dexie `milestones`. **Checkpoint : Progression › Paliers, et la
carte d'accueil.**).

## Archives

| Fichier | Contenu |
| --- | --- |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, versions, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |

## Checkpoints téléphone encore dus

1. **Ouverture** — fermer l'app, la relancer à froid : plaques, deux phrases, accueil. Puis forcer
   le terminal (clé `fittrack.bootEasterEggAfter` due) : écran noir, glyphes blancs, comme GRUB.
2. **Paliers** — Progression › Paliers (état vide puis historique), carte d'accueil après une
   séance qui en franchit un, thème clair.
3. **Tutoriel** — sélecteur de guidage à quatre modes, série unilatérale menée jusqu'au bout.

## Ouverture simplifiée et console rare (2026-08-30)

### Ce qui change

- La barre conserve uniquement son chargement de plaques. La chute, la compression, la secousse,
  le sol et la poussière sont supprimés.
- « Progressive Overload » apparaît, puis « Production was the gym » 180 ms plus tard ; le rideau
  fond ensuite vers l'accueil.
- Une date stockée localement programme, sans serveur, une variante rare tous les 14 à 28 jours.
  Elle affiche quatre logs sur un terminal **noir / blanc** (comme GRUB, hors thème de l'app),
  laisse clignoter le curseur, écrit `progressive_overload = true`, puis révèle directement
  l'accueil. La première installation ne la déclenche jamais immédiatement. La clé
  `fittrack.bootEasterEggAfter` est hors sauvegarde (`fittrack:`). Une séance active qui saute le
  rideau ne consomme pas cette date.
- Le mode mouvement réduit remplace glitch, frappe et clignotement par des fondus ou des états
  statiques.

### Vérifications

- Cycle TDD du sélecteur rare, du saut séance active, des deux scènes et du contrat GRUB :
  **17 tests ciblés verts**.
- `npm run typecheck` : vert.
- `npm run test:run` : **232 fichiers, 2 455 tests, tous verts**.
- `npm run build` : vert, artefact du wiki à jour et PWA générée.

## Les paliers (2026-08-29)

Branche `claude/secret-vivre-vieux-01bl4s`. Point de départ : « le secret pour vivre vieux c'est
vivre heureux », et l'envie de **valoriser la progression sans la transformer en jeu**.

### La décision de fond

`HomeScreen.tsx` avait déjà supprimé la série de semaines consécutives — « un compteur qu'on lit
une fois et qu'on perd en se blessant ». Les paliers sont l'inverse exact de ce compteur : des
seuils **acquis à vie**, qu'aucune pause, aucune blessure et aucun mois d'arrêt ne reprennent.

Le mot est **palier**, pas « jalon » : `records.subtitle` emploie déjà « jalon » pour les marques
du rail des records. Deux mots pour deux choses — un record est relatif à soi et tombe toutes les
trois semaines, un palier est un seuil écrit à l'avance qu'on ne franchit qu'une fois.

### Ce qui est livré

**Le catalogue** — `src/lib/milestones/catalogue.ts`, 56 seuils écrits à la main. Six mouvements de
force (développé, squat, soulevé de terre, militaire, hip thrust, rowing), les portes qui s'ouvrent
(première traction, premiers dips, pistol squat, gainage, suspension), la paire d'haltères, et
surtout les paliers de **pratique** : séances, semaines actives cumulées, années, tonnage. Un test
plafonne la liste à 60 : le jour où quelqu'un veut en ajouter un, il devra en retirer un autre.

**Le moteur** — pur, sans état, relit tout l'historique à chaque appel. C'est ce qui fait qu'un
import de dix ans rend ses paliers **à leurs vraies dates**, et qu'une séance corrigée ne laisse
pas un palier faux derrière elle.

**La rétrospective** — `pickRetrospective` rend `undefined` presque tous les jours, et c'est sa
raison d'être. Cinq âges seulement (1, 2, 3, 5, 10 ans), une fenêtre d'une semaine, une carte à la
fois, acquittée pour toujours.

**La table `milestones`** (schéma Dexie 12, aucun `upgrade()`). Le rattrapage se fait au démarrage
dans `initializePersistentData`, où il peut échouer sans empêcher l'app de s'ouvrir.

### Les trois décisions anti-spam

1. **Le rattrapage initial entre acquitté.** Dix ans d'historique franchissent quarante paliers
   d'un coup ; quarante célébrations simultanées n'en valent aucune. Ils sont consultables et
   silencieux, et les anniversaires les retrouveront un par un.
2. **Aucune notification.** Le canal de la barre d'état est pris par les records et les rappels.
   Un palier se lit très bien en rentrant sur l'accueil — ce qui arrive une seconde après avoir
   enregistré la séance qui l'a franchi.
3. **Une carte au maximum sur l'accueil.** Un palier neuf et un anniversaire peuvent coïncider ;
   le neuf passe devant.

### Sur les badges : aucune image, aucune génération

Le jeton est un disque SVG dessiné en code, et **son contenu est le chiffre** — `100`, `1`, `52`.
Une image générée demanderait un réseau et une clé (règles n° 2 et n° 3) ; un jeu d'images acheté
coûterait ce que l'enquête du 2026-07-22 a chiffré. Et un trophée doré aurait fait de la pratique
un jeu, ce que le projet a déjà refusé une fois.

L'accent vert est réservé au palier **qui vient de tomber** : la charte le garde pour les séries
validées et les records, et un mur de jetons verts ne distinguerait plus rien.

### Deux dettes soldées au passage

`HistoricalExercise` gagne `slug` et retrouve `isUnilateral`. Le drapeau en était sorti faute de
lecteur ; il en a un maintenant — le palier de la paire d'haltères, qui n'existe que si les deux
mains travaillent en même temps. La règle est inchangée : un champ reste dans la projection tant
qu'un écran s'en sert.

### Ce qui n'est pas fait

L'écran des paliers ne montre **que l'acquis**, jamais ce qui manque : une liste grisée de tout ce
qu'on n'a pas encore fait transformerait la pratique en liste de courses. Les paliers de charge ne
comptent que les exercices du catalogue — un exercice personnel n'a pas de slug, et « 100 kg au
développé couché » ne veut rien dire si n'importe quelle ligne peut s'appeler ainsi. La paire
d'haltères, elle, n'a pas cette restriction : un rack ne se falsifie pas en tapant un nom.

### Checkpoint téléphone

1. **Progression › Paliers** — base vierge : l'état vide doit dire « Rien encore, et c'est normal »
   sans lister d'objectifs. Après un historique importé : les jetons groupés en quatre rayons,
   dates lisibles, aucun débordement horizontal.
2. **Une séance qui franchit un palier** — enregistrer, atterrir sur l'accueil, vérifier que la
   carte est en tête, en vert, avec la phrase « Acquis pour de bon ». Fermer, rouvrir l'app : elle
   ne doit **jamais** revenir.
3. **Thème clair** — le jeton accent (vert acide sur encre) et le jeton neutre doivent rester
   lisibles tous les deux.
