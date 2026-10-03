# TTY1 : un skin à débloquer, une ouverture complète

**Date :** 2026-10-03

**Statut :** à implémenter. Le comportement est celui demandé le 2026-10-03 ; les choix d’exécution
que la demande ne tranchait pas sont dans « Décisions retenues », avec leur coût si l’on change d’avis.

**Périmètre :** le déblocage du thème TTY1, sa révélation dans la console rare, et l’ouverture TTY1,
qui devient une séquence de démarrage complète.

**Prérequis :** `docs/design/specs/2026-10-03-skin-tty1-design.md` (le thème et son ouverture de
2 180 ms, que cette spec remplace pour la partie « L’ouverture »), et
`docs/design/specs/2026-08-30-boot-simple-reveal-design.md` pour la console rare.

## Objectif

Deux choses, demandées ensemble :

1. **TTY1 n’est plus offert, il se gagne.** Il se débloque la première fois que la console rare de
   l’écran de chargement joue jusqu’au bout. Une app utilisée depuis plus d’un mois l’a forcément
   déjà vue : elle est débloquée d’office.
2. **Une fois TTY1 actif, l’ouverture est un vrai démarrage de machine**, plus longue et plus
   complète que la console actuelle : GRUB, le noyau, systemd, des vérifications de disque, une
   sortie de `dir /s`, des faits sur l’app, et une fonction de l’app qui s’affiche sans explication
   et dont la validation lance l’app. Chaque lancement en tire une version différente.

## Décisions retenues

1. **L’option reste visible tant qu’elle est verrouillée.** Elle s’affiche grisée avec un cadenas et
   une phrase énigmatique (« Garde un œil sur l’écran de chargement »). Elle ne dit pas comment se
   débloquer : la console rare reste une surprise, mais l’utilisateur sait qu’il y a quelque chose à
   trouver. Cacher l’option jusqu’au déblocage coûte une condition dans `SettingsScreen` ; la phrase
   et le cadenas disparaissent avec.
2. **Le déblocage se mémorise dans `localStorage`**, clé `fittrack.tty1Unlocked`, pas dans Dexie. Il
   se lit avant le premier rendu, comme le thème et la date de la surprise, et ne concerne que
   l’appareil. Une base restaurée sur un autre appareil débloque quand même, par l’ancienneté (voir 4).
3. **Trois chemins mènent au déblocage**, du plus précis au plus large :
   - la console rare a joué **jusqu’au bout** (pas coupée par une séance en cours) ;
   - la première utilisation de l’app date de **plus de 30 jours**. Le seuil est supérieur au plus long
     délai de la surprise (28 jours) : au-delà, la console était forcément due. Une série d’ouvertures
     toujours sautées par une séance en cours ne doit pas verrouiller TTY1 pour toujours ;
   - le thème mémorisé **est déjà** `tty1`. La v2.8.0 l’a livré ouvert : le retirer à qui l’utilise
     serait une régression. Ce chemin ne sert qu’une fois, à la première lecture après la mise à jour.
4. **La première utilisation, c’est la plus ancienne `createdAt` d’un exercice.** Le catalogue est
   semé au premier lancement avec `newEntity`, donc cette date est celle de l’installation ; une base
   restaurée garde les dates d’origine. Les exercices supprimés comptent : une suppression ne rajeunit
   pas l’app. Aucun champ ni index nouveau, la lecture se fait une fois par démarrage et seulement tant
   que TTY1 est verrouillé.
5. **La révélation est dite par la console elle-même**, pas par une bannière : sous la commande
   `progressive_overload = true`, deux lignes (`[ OK ] tty1.skin unlocked`, puis
   `# Réglages > Apparence`). Elle n’a lieu que si TTY1 était verrouillé **au moment où la console
   est choisie**. La console dure 1 400 ms de plus ce jour-là. Un déblocage silencieux ne serait jamais
   découvert : l’option apparaîtrait dans Réglages sans que personne y retourne.
6. **Le script de l’ouverture est tiré une fois, au démarrage, et passé à l’écran.** `BootScreen` est
   démonté puis remonté en `BootCurtain` quand le routeur arrive : un tirage dans le composant
   donnerait deux démarrages différents l’un après l’autre. `main.tsx` tire, les deux composants
   rendent le même script.
7. **La durée est fixe, 4 650 ms, quel que soit le tirage.** Le tirage change le contenu et la
   cadence, pas le temps d’attente : l’utilisateur sait ce que coûte un lancement, et la tenue
   (`BOOT_HOLD_MS.tty1`) reste une constante comme pour les deux autres ouvertures. Le générateur
   répartit ses lignes sur cette durée au lieu de la subir.
8. **Les lignes se posent par le temps réel, pas par des délais CSS.** Une console défile : les
   anciennes lignes sortent par le haut. Avec toutes les lignes déjà dans la page et des délais
   d’apparition, la pile occuperait sa hauteur finale dès la première image et rien ne défilerait. Le
   composant ajoute donc ses lignes au fil de l’horloge, et la phase de sortie les montre toutes d’un
   coup, sans rien rejouer.
9. **Les faits de l’app sont vrais.** Le catalogue compte ce qu’il compte, le repos par défaut dure ce
   qu’il dure, et la fonction qui valide l’ouverture est appelée pour de bon : son résultat est celui
   de la bibliothèque. Une phrase codée en dur (« 1 247 exercices ») serait fausse à la prochaine
   mise à jour du catalogue ; un chiffre lu dans le code ne se périme pas.
10. **Toucher l’écran saute l’ouverture TTY1, et elle seule.** Un démarrage de cinq secondes à chaque
    lancement est exactement ce que la règle n° 5 (une main, en sueur) interdit. La surprise rare et
    l’ouverture normale ne se sautent pas : elles sont rares ou courtes. *Ce choix n’était pas dans la
    demande* ; le retirer coûte un écouteur dans `main.tsx` et une ligne de texte. Un saut ne
    consomme rien et ne débloque rien.
11. **En mouvement réduit, tout est affiché d’emblée et l’attente retombe à celle de l’ouverture
    normale (2 180 ms).** Un écran fixe de près de cinq secondes n’apporte rien à qui a demandé moins
    d’animation.

## Ce qui ne change pas

- La console rare des autres thèmes : mêmes quatre lignes, même invite, même commande, même durée de
  3 360 ms. Elle ne gagne que les deux lignes de révélation, une seule fois.
- Le calendrier de la surprise (14 à 28 jours), son report à la fin d’une ouverture complète, et sa
  mise en veille tant que TTY1 est actif.
- L’ouverture normale (2 180 ms) et le saut automatique par une séance en cours, pour toutes les
  ouvertures.
- Le thème lui-même : jetons, police, formes. Seul l’écran d’ouverture et le sélecteur changent.
- Le hors-ligne, l’absence de secret, l’absence de table nouvelle. Le déblocage n’appelle aucun réseau.
- Une préférence stockée de thème `tty1` reste valide : elle s’applique avant le premier rendu, comme
  avant.

## Comportement utilisateur

### Le déblocage

| Situation au démarrage | TTY1 |
|---|---|
| Installation neuve, jamais vue la console rare, moins de 30 jours | verrouillé |
| La console rare vient de jouer jusqu’au bout | **débloqué**, et le dit |
| Installation de plus de 30 jours | débloqué, sans cérémonie |
| Le thème mémorisé est `tty1` (mise à jour depuis la v2.8.0) | débloqué, sans cérémonie |
| La console rare a été coupée par une séance en cours | inchangé, elle rejouera |
| `localStorage` indisponible | verrouillé (et l’ouverture reste la normale) |

Une fois débloqué, TTY1 ne se reverrouille jamais.

### Les Réglages

Le sélecteur garde ses trois options. Verrouillée, la troisième :

- affiche un cadenas devant « TTY1 », en gris ;
- ne se choisit pas (`aria-disabled`) ; son toucher ne fait rien ;
- est décrite par une phrase sous le sélecteur : « TTY1 est verrouillé. Garde un œil sur l’écran de
  chargement. »

Débloquée, elle est celle d’aujourd’hui.

### La révélation

La première fois que la console rare joue jusqu’au bout alors que TTY1 est verrouillé, elle ajoute
sous la commande tapée :

```
root@fittrack:~# progressive_overload = true█
[ OK ] tty1.skin unlocked
# Réglages > Apparence
```

La première ligne se pose 100 ms après la fin de la frappe, la seconde 160 ms plus tard ; l’écran
tient ensuite 1,3 s. Le déblocage est écrit à la fin de l’ouverture, pas au début : tuer l’app pendant
la console ne le consomme pas, et la console rejoue au prochain lancement.

### L’ouverture TTY1

Le logo, le nom et la ligne de version restent en haut. La console occupe le reste de l’écran, **ancrée
en bas** : chaque ligne se pose sous la précédente et les plus anciennes sortent par le haut, comme sur
une console. Elle se compose, dans cet ordre, de sept parties. Les lignes sont celles d’un tirage
possible ; tout ce qui est variable est dit dans le tableau qui suit.

```
GNU GRUB  version 2.12
Booting 'FitTrack GNU/Linux'
Loading Linux 6.1.0-biceps ...
Loading initial ramdisk ...
[    0.00] rtc: 2026-10-03 14:07:11
[    0.04] cpu: 8 cores online
[    0.09] idb: 1247 exercises mounted
[    0.15] net: offline, as designed
[    0.21] rest: 120 s default timer
[ OK ] Started rest_timer.service
[ OK ] quadriceps.service active
[ OK ] Mounted /gains (rw, relatime)
[ OK ] core.stability mounted
[ WARN ] ego-lifting detected
[ OK ] Reached target Offline First
[ FAIL ] leg_day.service: not found
[ FAIL ] excuses.mount: permission denied
fsck.idb: /gains clean, 1247 files
smartctl: biceps PASSED
memtest86: 5x5 passed
[ OK ] Started dosemu.service
C:\FITTRACK> dir /s
 Volume in drive C is GAINS
 Volume Serial Number is 1D07-F17E

 Directory of C:\FITTRACK

SQUAT    EXE    41,216 10-03-26  2:07p
PLATES   DAT     2,048 10-03-26  2:07p
BENCH    EXE    38,912 10-03-26  2:07p
         3 file(s)         82,176 bytes
[*     ] Starting estimateOneRepMax()...
[ OK ] estimateOneRepMax() = 116.7 kg
[ OK ] Reached target Gym.
root@fittrack:~# progressive_overload = true█
# Production was the gym
```

| Partie | Contenu | Ce qui varie à chaque lancement |
|---|---|---|
| Chargeur | quatre lignes de GRUB | le nom du noyau (`6.1.0-biceps`, `-deadlift`, `-squat`…) |
| Noyau | l’heure de la machine, puis quatre faits sur l’app et l’appareil | lesquels, parmi une douzaine ; les horodatages |
| Services | les quatre lignes de la console rare, toujours présentes et dans leur ordre, entre lesquelles s’intercalent quatre lignes tirées | lesquelles et où : deux `OK`, un `WARN`, un `FAIL` |
| Vérifications | trois lignes de type `fsck`, `smartctl`, `memtest` | lesquelles, parmi une dizaine |
| Interlude DOS | une commande saisie et sa sortie | `dir /s` une fois sur deux (noms, tailles et numéro de série tirés), sinon `ver` ou `mem` |
| Porte | une fonction réelle de l’app attendue (animation d’attente), puis validée avec son résultat | laquelle, parmi six |
| Fin | la cible atteinte, l’invite, la commande tapée, la devise | rien |

La porte est le cœur de la séquence : une fonction de l’app s’affiche comme un service qu’on attendrait,
sans que rien n’explique pourquoi, et c’est sa validation (`[ OK ]`) qui lance l’app. Les six sont
`estimateOneRepMax`, `computePlateLoad`, `calculateWarmupSets`, `calculateDeloadWeight`, `formatRest`
et `setVolume`, avec chacune ses arguments fixes et son résultat réel.

**Rythme.** Les lignes courent de 400 ms à 3 150 ms, à une cadence moyenne d’une ligne toutes les
80 ms, plus lente aux vérifications et rapide dans une liste de fichiers. La porte attend 500 ms,
validée à 3 650 ms ; l’invite se pose à 3 900 ms, la commande se tape en 400 ms, la devise suit à
4 350 ms, et l’écran tient jusqu’à 4 650 ms. Un tirage trop dense ne s’accélère pas au-delà d’un
plancher de 35 ms par ligne : il en perd, plutôt que de devenir illisible.

**Largeur.** Aucune ligne ne dépasse 41 caractères, ce que tient un téléphone de 360 px en police 16 px
(chasse de 8 px, 328 px utiles). Une ligne plus longue se replierait sur deux rangs : un défaut
cosmétique, pas une erreur, mais un test garde la limite.

**Sauter.** Toucher l’écran pendant l’ouverture TTY1 la coupe. Une ligne discrète en bas le dit :
« Touche l’écran pour passer. » Le rideau montre alors la console complète et s’efface en 320 ms,
comme après une séance en cours.

## Architecture

### Le déblocage

`src/stores/skinUnlock.ts`, sans React et sans Dexie, comme `stores/theme.ts` :

- `TTY1_UNLOCK_KEY = 'fittrack.tty1Unlocked'` ;
- `isTty1Unlocked(storage)`, `unlockTty1(storage)` : lecture et écriture, qui avalent toute exception
  du stockage (le stockage est un confort, le démarrage doit aboutir) ;
- `unlockTty1IfSeasoned(storage, firstUseAt, now)` : débloque si `now - firstUseAt` dépasse
  `SEASONED_AFTER_DAYS = 30` ;
- `unlockTty1IfInUse(storage, theme)` : débloque si le thème mémorisé est `tty1`.

Le stockage est celui de `bootEasterEgg.ts` (`getBootStorage`), pour que « bloqué » se dise une fois.
`bootEasterEgg.ts` exporte `BOOT_EASTER_EGG_MAX_DELAY_DAYS` (28) : un test exige
`SEASONED_AFTER_DAYS > BOOT_EASTER_EGG_MAX_DELAY_DAYS`, pour que le seuil ne soit jamais abaissé sous
la surprise sans que la suite le dise.

`src/data/repositories/firstUse.ts` expose `getFirstUseAt()`, la plus petite `createdAt` des
exercices, `undefined` si la table est vide. Un composant n’importe jamais `db` : `main.tsx` passe par
ce dépôt.

### La révélation

`BootConsole` reçoit `unlocking`. Les deux lignes viennent après l’invite (rangs 6 et 7 de
`.boot-console-log`), ce qui laisse intactes les règles `nth-child(1..4)` des quatre premières. Elles
portent la classe `boot-console-line` : la règle de mouvement réduit qui les coupe existe déjà.

`BOOT_HOLD_MS` ne change pas ; la tenue prolongée est `BOOT_HOLD_MS.console + UNLOCK_REVEAL_EXTRA_MS`,
calculée par une fonction (`bootHoldMs`) que `main.tsx` appelle, et que les tests lisent.

`main.tsx` décide de la révélation **avant** de monter quoi que ce soit : `variant === 'console'` et
`!isTty1Unlocked`. Elle n’est pas rediscutée plus tard, même si l’ancienneté débloque entre-temps.

### Le script de l’ouverture

Trois modules, du plus pur au plus branché :

- `src/i18n/fr.ts` porte tous les textes sous `boot.tty1.*`, en nœuds de chaînes (le dictionnaire n’a
  pas de tableaux). Une fonction `tAll(nœud)` y énumère les chaînes d’un nœud dont toutes les feuilles
  sont des chaînes : les listes se lisent et se complètent à un seul endroit, sans seconde liste de
  clés à tenir d’accord. Les placeholders sont ceux de `t()`.
- `src/app/bootTty1Script.ts`, **pur** : `buildBootScript(random, facts)` rend `{ lines, durationMs }`.
  Il ne lit ni l’horloge, ni `navigator`, ni la base : tout ce qui est variable lui est donné. Une ligne
  dont un placeholder n’a pas de valeur (pas de `cores` sur un navigateur qui ne le dit pas) est écartée
  du tirage, pas affichée à moitié.
- `src/app/bootFacts.ts`, **branché** : `readBootFacts(now)` lit les constantes de la bibliothèque
  (`DEFAULT_REST_SECONDS`, `DELOAD_PERCENT`, `DEFAULT_BARBELL_KG`, `CATALOGUE_SIZE`), l’appareil
  (`hardwareConcurrency`, `screen`, `onLine`) et exécute les six fonctions de la porte, chacune dans un
  `try` : un échec retire la fonction du tirage, il ne casse pas l’ouverture.

Une ligne du script est l’un de quatre genres :

| Genre | Rendu |
|---|---|
| `text` | une ligne, avec son niveau `[ OK ]`/`[ WARN ]`/`[ FAIL ]` et son horodatage reconnus à l’affichage |
| `command` | une invite, une commande qui se tape, un curseur tant que c’est la dernière ligne |
| `comment` | une ligne grise commençant par `#` |
| `gate` | la fonction en attente (animation), puis la même ligne remplacée par sa validation |

Chaque ligne porte `at`, le moment de son apparition en millisecondes depuis le montage ; `gate`
porte aussi `doneAt`. `durationMs` vaut `BOOT_HOLD_MS.tty1` et un test vérifie, sur plusieurs centaines
de tirages, que la dernière ligne tient dedans.

`seededRandom(seed)`, exporté par le même module, donne un tirage reproductible : les tests le
fournissent, et le paramètre d’URL de développement `?bootSeed=` aussi.

### Le rendu

`BootScreen` reçoit `script`. Sans lui (un test, une démonstration), il retombe sur le script d’une
graine fixe : jamais un tirage pendant le rendu.

- Un crochet d’horloge programme un `setTimeout` par instant distinct du script et en tient la valeur
  courante ; les lignes dont `at` est dépassé sont rendues. `exiting`, le mouvement réduit et le saut
  donnent la valeur finale d’emblée et ne programment rien.
- Le conteneur est une colonne ancrée en bas (`justify-content: flex-end`), sans défilement ni barre,
  et son bord haut s’estompe sur une ligne et demie pour qu’aucune ligne ne soit coupée net.
- L’animation d’attente de la porte est faite de `transform` et de `steps()`, sans `content` animé :
  les WebView Android plus anciennes ne l’animent pas.
- La frappe d’une commande lit sa longueur dans `--chars`, au lieu d’un `27ch` écrit en dur : la même
  règle sert `progressive_overload = true` et `dir /s`.
- Les règles de l’ouverture TTY1 restent dans `src/styles/tty1.css`, avec le reste du thème. Les délais
  par `nth-child` de la console fixe disparaissent : les lignes sont posées par l’horloge.

### Le saut

`holdBootOpening` reçoit un signal d’abandon facultatif. `main.tsx` en crée un pour l’ouverture TTY1
seulement et l’annule au premier `pointerdown` du document ; l’écouteur est retiré à la fin de
l’ouverture. Un saut est traité comme une séance en cours : l’attente se résout, `onFullOpening` ne
tourne pas.

### Le branchement

Dans `main.tsx`, dans cet ordre, avant le premier rendu : lecture du thème, déblocage par le thème,
choix de la variante, choix de la révélation, tirage du script (variante `tty1` seulement). Après
l’initialisation de la base : déblocage par l’ancienneté, dans son propre `try`. À la fin d’une
ouverture complète de la console rare : report de la surprise **et** déblocage.

Le paramètre `?boot=` de développement garde ses trois valeurs ; `?bootSeed=` fixe le tirage. Aucun des
deux n’existe en production.

## Limites connues

- **Un navigateur qui n’annonce pas ses cœurs ou son écran** (rare) perd la ligne correspondante. Les
  autres suffisent : le tirage compte quatre faits parmi douze.
- **Un téléphone très lent** peut décaler quelques lignes : elles se posent au prochain `setTimeout`
  disponible, jamais dans le désordre, et l’ordre est tout ce que la fonction de la porte promet. La
  durée de tenue, elle, ne bouge pas.
- **`navigator.onLine` ment parfois** (un réseau captif se dit en ligne). La ligne dit « online, not
  required » : elle reste vraie.
- **Le saut ne se découvre que par la ligne du bas.** Il n’y a pas d’autre indice.
- **Un déblocage par l’ancienneté arrive un lancement trop tard pour la révélation** si la console rare
  se présente le même jour : l’option est alors ouverte sans cérémonie. C’est voulu — la décision de
  révéler est prise avant la lecture de la base, qui est asynchrone.
- **La graine d’un lancement n’est pas conservée** : une ouverture ne se rejoue pas à l’identique, sauf
  par `?bootSeed=` en développement.

## Vérification

Du TDD sur ce qui a une logique :

- le déblocage : clé, lecture, écriture, stockage bloqué ou qui lève, ancienneté au jour près (29, 30,
  31 jours), grandfathering, seuil supérieur à la surprise ;
- `getFirstUseAt` : plus petite date, exercices supprimés compris, table vide ;
- les Réglages : option verrouillée (désactivée, cadenas, phrase), toucher sans effet, option
  débloquée inchangée ;
- la console rare : deux lignes de plus si et seulement si `unlocking`, quatre sinon ; tenue
  prolongée ; déblocage et report seulement à la fin d’une ouverture complète ;
- `tAll` : ordre, nœuds invalides, placeholders ;
- le générateur : déterminisme à graine égale, tirages différents à graine différente, les quatre
  lignes de la console rare présentes et dans l’ordre, la porte juste avant la fin, aucune ligne
  au-delà de 41 caractères sur plusieurs centaines de graines, durée tenue, ordre des `at`, lignes sans
  valeur écartées, `dir /s` sans date ni taille fausses ;
- les faits : chaque fonction de la porte rend un résultat, une fonction qui lève est écartée ;
- le rendu : lignes posées par l’horloge (temporisateurs simulés), défilement par le bas, sortie
  complète d’emblée, mouvement réduit, curseur sur la dernière commande seulement, saut ;
- `holdBootOpening` : signal d’abandon.

L’affichage se vérifie à l’œil, captures de Chromium à 390 × 844 et 360 × 740, à plusieurs instants de
l’ouverture, avec une graine fixe, puis en mouvement réduit.

Le checkpoint manuel se fait sur téléphone : choisir Sombre sur une installation neuve et constater la
troisième option verrouillée ; sur l’installation existante, constater que TTY1 reste disponible ;
choisir TTY1, quitter l’app et la rouvrir plusieurs fois (les sept parties, un contenu différent à
chaque fois), toucher l’écran pour sauter, lancer une séance et rouvrir l’app (aucune ouverture).

## Hors périmètre

- Une ouverture TTY1 qui attend vraiment la base : la porte n’est pas le signal de fin de
  l’initialisation. La base est prête en quelques dizaines de millisecondes sur un démarrage à chaud,
  très en deçà des 3 650 ms de la porte.
- Un son d’ouverture, une trame CRT, un défilement fluide au pixel : l’écran se redessine par lignes,
  comme une console.
- Débloquer autre chose que TTY1 : le mécanisme est celui d’un seul skin.
- Reverrouiller TTY1, ou un moyen de rejouer la révélation hors du mode développement.
- Afficher dans la console des chiffres tirés de la base (nombre de séances, de records) : elle est
  tirée avant que la base ne réponde.
- Traduire les textes de la console : ce sont des messages de système, en anglais comme les quatre
  lignes d’origine. Seule la ligne de saut et la ligne d’indication de la révélation sont du français.
