# Coach — on ne monte qu'à RPE 8 au plus — design court

> 2026-11-21. Demande de l'utilisateur : « j'aurais voulu perso que la montée ne se fasse qu'à partir d'un
> RPE max de 8 », puis « go » sur la proposition ci-dessous. Premier morceau du lot F de
> `2026-11-20-coach-fiabilisation-design.md`.

## Pourquoi

À la salle, le coach proposait de monter après des séances dures : seule une **moyenne** de RPE de 9,5
ou plus bloquait la hausse, donc `8 · 9 · 10` montait encore. L'utilisateur veut monter seulement quand
chaque série de travail est restée à RPE 8 ou moins.

## La règle

- **Plafond atteint et une série jugée au-dessus de RPE 8 → pas de hausse.** Ni charge (cran, gros cran,
  remise dans la fourchette), ni série en plus. La carte garde le constat, sans charge : « Plafond tenu,
  mais à RPE 9 : on monte quand chaque série reste à 8 ou moins. Garde la charge. »
- **« Une série jugée »** : les séries de `judgedSets` — ni échauffement, ni dégressive, ni série allégée à
  dessein, **ni série à l'échec** (à 10 par construction : la compter interdirait toute hausse à qui
  finit à l'échec).
- **On lit le maximum des RPE saisis**, plus la moyenne. Une seule série à 9 suffit.
- **Sans aucun RPE saisi sur ces séries, rien ne change** : la hausse se propose comme avant. Bloquer
  faute de RPE punirait un oubli (l'historique de l'utilisateur en porte sur 83 % des séries).
- Remplace l'ancien seuil (moyenne ≥ 9,5) : tout ce qu'il bloquait, la nouvelle règle le bloque aussi
  dès qu'un RPE est saisi. La lecture de la consolidation, du plateau « à l'échec » et de la capacité
  (réserve du RPE moyen) ne change pas.

## Hors périmètre

Les sauts de charge eux-mêmes (remise dans la fourchette jusqu'à + 30 %) : la règle les bloque au-dessus
de RPE 8, elle ne les redimensionne pas. Le rejeu sur l'historique réel attend toujours la sauvegarde JSON.

## Approches

1. **Réutiliser le drapeau `ceiling_grinding`**, avec de nouvelles preuves (`max_rpe`, `increase_max_rpe`) —
   retenue : l'arbitrage, la voix et l'écran savent déjà qu'un plafond « arraché » ne propose rien, et les
   lignes déjà enregistrées (sans `max_rpe`) gardent leur ancien texte.
2. Un nouveau code de signal : demande un code de plus dans le journal, la situation, la sévérité et la
   sauvegarde, pour un même comportement. Écarté.
