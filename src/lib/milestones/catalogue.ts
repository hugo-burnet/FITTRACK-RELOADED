import type { MilestoneDefinition } from './types';

/**
 * La liste. Écrite à la main, relue à voix haute, et courte exprès.
 *
 * **La règle qui a servi à trancher chaque ligne :** un jalon entre ici si, le
 * jour où il tombe, on a envie de le dire à quelqu'un. Pas « tu as progressé de
 * 2,5 kg » — c'est un record, l'app le dit déjà sous la série. Ici : la première
 * traction, les 100 kg au développé, la centième séance, dix ans de pratique.
 *
 * **Ce qui a été refusé, et pourquoi.**
 *
 * - *Des seuils tous les 10 kg.* Vingt notifications par an valent zéro. Les
 *   paliers sont espacés d'autant plus qu'ils sont hauts, parce que c'est ainsi
 *   que la progression ralentit : 60 puis 80 puis 100 au développé, mais 100
 *   puis 140 puis 180 au squat.
 * - *Un jalon par exercice du catalogue.* Cent soixante-quinze exercices, et
 *   « 40 kg à l'écarté poulie » ne veut rien dire pour personne. Six mouvements
 *   portent des chiffres qui se disent en salle sans avoir à les expliquer.
 * - *Tout ce qui se perd.* Aucune série de semaines d'affilée, aucun « niveau »
 *   qui redescend. C'est la raison d'être du module, et `HomeScreen` avait déjà
 *   tranché dans ce sens en supprimant le compteur de semaines consécutives :
 *   un chiffre qu'on perd en se blessant est une punition déguisée en jeu.
 * - *Un objectif à atteindre.* Un jalon n'est jamais annoncé avant d'être
 *   acquis. L'écran des jalons ne montre pas ce qui manque — transformer sa
 *   pratique en liste de courses est exactement le contraire de la valoriser.
 *
 * **Les seuils de charge sont ceux de la barre**, jamais d'une machine : 100 kg
 * à la presse à cuisses et 100 kg au squat ne sont pas le même événement, et
 * aucune table de conversion honnête n'existe entre deux machines de marques
 * différentes. La barre, elle, pèse le même poids partout.
 */
/**
 * Le sujet d'un jalon d'exercice, pour l'affichage.
 *
 * Une clé i18n par **famille**, et non le nom de l'exercice lu en base : un
 * jalon acquis en 2023 doit se relire en 2027 même si l'exercice a été renommé
 * ou supprimé. C'est le raisonnement des instantanés de séance, appliqué à une
 * liste qui, elle, tient dans le code.
 *
 * Déclarée **avant** le catalogue, et pas à côté de la fonction qui la lit : les
 * entrées sont construites à l'initialisation du module, donc une table posée
 * plus bas serait lue dans sa zone morte. Le catalogue ne se charge alors plus
 * du tout, et c'est toute l'app qui tombe avec lui.
 */
const SUBJECTS: Record<string, string> = {
  'barbell-bench-press': 'bench',
  'barbell-back-squat': 'squat',
  'conventional-deadlift': 'deadlift',
  'barbell-overhead-press': 'overhead',
  'barbell-hip-thrust': 'hipThrust',
  'barbell-row': 'row',
  'pull-up': 'pullUp',
  'chin-up': 'chinUp',
  'chest-dip': 'dip',
  'triceps-dip': 'dip',
  'pistol-squat': 'pistolSquat',
  plank: 'plank',
  'dead-hang': 'deadHang',
};

export const FIRST_SESSION_MILESTONE_ID = 'sessions-1';
export const FIRST_DOMS_MILESTONE_ID = 'doms-48';
export const FIRST_DOMS_HOURS = 48;

export const MILESTONES: readonly MilestoneDefinition[] = [
  // ── Force : six mouvements, des chiffres ronds ──────────────────────────────
  //
  // Les paliers du développé couché sont ceux qu'on entend en salle. 100 kg est
  // la porte ; 140 kg est déjà rare pour une pratique de loisir, et c'est le
  // dernier — un seuil que personne n'atteindra jamais n'encourage personne.
  load('bench-60', ['barbell-bench-press'], 60),
  load('bench-80', ['barbell-bench-press'], 80),
  load('bench-100', ['barbell-bench-press'], 100),
  load('bench-120', ['barbell-bench-press'], 120),
  load('bench-140', ['barbell-bench-press'], 140),

  // Le squat monte plus vite et plus haut que le développé : les paliers sont
  // espacés de 40 kg là où le développé l'est de 20.
  load('squat-60', ['barbell-back-squat'], 60),
  load('squat-100', ['barbell-back-squat'], 100),
  load('squat-140', ['barbell-back-squat'], 140),
  load('squat-180', ['barbell-back-squat'], 180),

  // Conventionnel et sumo comptent pour le même jalon. Le sumo n'est pas une
  // version facile du soulevé de terre, c'est une autre morphologie de hanche —
  // n'en reconnaître qu'un reviendrait à noter un fémur.
  load('deadlift-100', ['conventional-deadlift', 'sumo-deadlift'], 100),
  load('deadlift-140', ['conventional-deadlift', 'sumo-deadlift'], 140),
  load('deadlift-180', ['conventional-deadlift', 'sumo-deadlift'], 180),
  load('deadlift-220', ['conventional-deadlift', 'sumo-deadlift'], 220),

  // Le développé militaire est le mouvement où les chiffres restent petits toute
  // une vie : 80 kg au-dessus de la tête est un très haut niveau. Les paliers
  // sont à l'échelle du mouvement, pas à celle du squat.
  load('overhead-40', ['barbell-overhead-press', 'seated-barbell-press'], 40),
  load('overhead-60', ['barbell-overhead-press', 'seated-barbell-press'], 60),
  load('overhead-80', ['barbell-overhead-press', 'seated-barbell-press'], 80),

  // Le hip thrust encaisse des charges sans commune mesure avec le reste : ses
  // paliers commencent là où ceux du squat finissent. Le confondre avec un
  // mouvement de jambes aurait rendu ses seuils absurdes dans les deux sens.
  load('hipthrust-100', ['barbell-hip-thrust'], 100),
  load('hipthrust-150', ['barbell-hip-thrust'], 150),
  load('hipthrust-200', ['barbell-hip-thrust'], 200),

  // Le rowing barre inclut le Pendlay : même barre, même charge au sol, une
  // consigne de tempo qui les sépare et qui ne regarde pas un jalon de charge.
  load('row-60', ['barbell-row', 'pendlay-row'], 60),
  load('row-80', ['barbell-row', 'pendlay-row'], 80),
  load('row-100', ['barbell-row', 'pendlay-row'], 100),

  // ── Portes : ce qu'on ne pouvait pas faire, et qu'on fait ───────────────────
  //
  // La première traction est le jalon le plus demandé de toute la musculation,
  // et le seul de cette liste dont le seuil est 1. Pronation et supination sont
  // séparées : passer de l'une à l'autre est un vrai palier, pas un synonyme.
  reps('pullup-1', ['pull-up'], 1),
  reps('pullup-5', ['pull-up'], 5),
  reps('pullup-10', ['pull-up'], 10),
  reps('pullup-20', ['pull-up'], 20),
  reps('chinup-1', ['chin-up'], 1),

  // Les dips au poids du corps, buste droit ou penché : la porte est la même.
  reps('dip-1', ['chest-dip', 'triceps-dip'], 1),
  reps('dip-10', ['chest-dip', 'triceps-dip'], 10),

  // Le pistol squat n'a pas de palier au-dessus de 1 : la difficulté est
  // entièrement dans la première, le reste est de l'endurance.
  reps('pistol-1', ['pistol-squat'], 1),

  // Le gainage se compte en minutes tenues, jamais en répétitions. Cinq minutes
  // est le mur ; au-delà, la planche mesure l'ennui plus que le tronc.
  duration('plank-120', ['plank'], 120),
  duration('plank-300', ['plank'], 300),

  // La suspension : une minute est l'objectif de rééducation le plus cité pour
  // l'épaule, deux minutes est un poignet de grimpeur.
  duration('deadhang-60', ['dead-hang'], 60),
  duration('deadhang-120', ['dead-hang'], 120),

  // ── La paire d'haltères ─────────────────────────────────────────────────────
  //
  // Le seul jalon générique : n'importe quel exercice d'haltères tenu à deux
  // mains, parce que ce qui se raconte est le rack — « je suis passé aux 30 ».
  // Le nom du mouvement, lui, ne fait pas partie du souvenir.
  //
  // **La charge lue est celle d'un haltère, pas de la paire.** C'est la
  // convention de saisie de l'app comme de tout le reste du milieu : on inscrit
  // 30 pour deux haltères de 30. Le compter double afficherait « 60 kg » à qui
  // vient de prendre les 30, et le jalon perdrait son nom.
  dumbbells('dumbbell-20', 20),
  dumbbells('dumbbell-30', 30),
  dumbbells('dumbbell-40', 40),
  dumbbells('dumbbell-50', 50),

  // ── Pratique : ce que le temps donne, et que rien ne retire ─────────────────
  //
  // Le cœur du sujet. La première séance et les premières DOMS sont la porte ;
  // dix séances et la suite récompensent le fait d'être venu, ce qui est la
  // seule chose que tout le monde peut faire et la seule qui produit un
  // résultat à dix ans.
  practice(FIRST_SESSION_MILESTONE_ID, 'session_count', 1),
  practice(FIRST_DOMS_MILESTONE_ID, 'hours_since_first_session', FIRST_DOMS_HOURS),
  practice('sessions-10', 'session_count', 10),
  practice('sessions-50', 'session_count', 50),
  practice('sessions-100', 'session_count', 100),
  practice('sessions-250', 'session_count', 250),
  practice('sessions-500', 'session_count', 500),
  practice('sessions-1000', 'session_count', 1000),

  // Des semaines **cumulées**, pas consécutives : c'est l'anti-série. Six mois
  // d'arrêt pour une blessure ne retirent rien ; on reprend où l'on en était.
  // 52 se lit « un an de semaines », même étalées sur trois ans.
  practice('weeks-10', 'active_weeks', 10),
  practice('weeks-52', 'active_weeks', 52),
  practice('weeks-104', 'active_weeks', 104),
  practice('weeks-260', 'active_weeks', 260),

  // Des années depuis la première séance — acquises par la séance qui suit
  // l'anniversaire, jamais par le simple passage du temps. Un compte inactif ne
  // fête pas ses dix ans de musculation.
  practice('years-1', 'training_years', 1),
  practice('years-2', 'training_years', 2),
  practice('years-5', 'training_years', 5),
  practice('years-10', 'training_years', 10),

  // ── Volume : les chiffres qu'on ne peut pas se représenter ──────────────────
  //
  // En tonnes, parce que 100 000 kg ne veut rien dire et que 100 tonnes se voit.
  practice('tonnage-100', 'lifetime_tonnage', 100_000),
  practice('tonnage-500', 'lifetime_tonnage', 500_000),
  practice('tonnage-1000', 'lifetime_tonnage', 1_000_000),
  practice('tonnage-5000', 'lifetime_tonnage', 5_000_000),
];

function subjectKeyFor(slugs: readonly string[]): string {
  const key = SUBJECTS[slugs[0] ?? ''];
  // Une définition dont le premier slug n'a pas de sujet est une définition qui
  // s'afficherait sans nom. Le test du catalogue ferme cette classe entière.
  return key === undefined ? 'unknown' : `milestone.subject.${key}`;
}

function load(
  id: string,
  slugs: readonly string[],
  threshold: number,
): MilestoneDefinition {
  return {
    id,
    kind: 'exercise_load',
    group: 'strength',
    threshold,
    slugs,
    subjectKey: subjectKeyFor(slugs),
  };
}

function reps(id: string, slugs: readonly string[], threshold: number): MilestoneDefinition {
  return {
    id,
    kind: 'exercise_reps',
    group: 'gateway',
    threshold,
    slugs,
    subjectKey: subjectKeyFor(slugs),
  };
}

function duration(
  id: string,
  slugs: readonly string[],
  threshold: number,
): MilestoneDefinition {
  return {
    id,
    kind: 'exercise_duration',
    group: 'gateway',
    threshold,
    slugs,
    subjectKey: subjectKeyFor(slugs),
  };
}

function dumbbells(id: string, threshold: number): MilestoneDefinition {
  return { id, kind: 'dumbbell_pair', group: 'strength', threshold };
}

function practice(
  id: string,
  kind:
    | 'session_count'
    | 'active_weeks'
    | 'training_years'
    | 'lifetime_tonnage'
    | 'hours_since_first_session',
  threshold: number,
): MilestoneDefinition {
  return { id, kind, group: kind === 'lifetime_tonnage' ? 'volume' : 'practice', threshold };
}

const BY_ID = new Map(MILESTONES.map((definition) => [definition.id, definition]));

/** `undefined` pour un jalon retiré du catalogue : sa ligne en base survit. */
export function milestoneById(id: string): MilestoneDefinition | undefined {
  return BY_ID.get(id);
}
