// GENERE PAR gen_fittrack.py - NE PAS EDITER A LA MAIN.
// Source : muscle_groups.py

/** Identifiants portes par l'attribut data-muscle du SVG. */
export const MUSCLE_IDS = [
  'erector_spinae',
  'rotator_cuff',
  'rhomboids',
  'neck',
  'hip_flexors',
  'serratus_anterior',
  'obliques',
  'rectus_abdominis',
  'latissimus_dorsi',
  'pectoralis_major',
  'trapezius_lower',
  'trapezius_upper',
  'deltoid_anterior',
  'deltoid_lateral',
  'deltoid_posterior',
  'biceps_brachii',
  'triceps_brachii',
  'forearm_flexors',
  'forearm_extensors',
  'gluteus_medius',
  'gluteus_maximus',
  'adductors',
  'quadriceps',
  'hamstrings',
  'calves',
  'tibialis_anterior',
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

export type MuscleView = 'front' | 'back';

/** Vues ou le groupe est dessine. Un groupe absent d'une vue n'y a
 *  simplement pas de path : ce n'est pas une erreur. */
export const MUSCLE_VIEWS: Record<MuscleId, MuscleView[]> = {
  erector_spinae: ['back'],
  rotator_cuff: ['back'],
  rhomboids: ['back'],
  neck: ['front', 'back'],
  hip_flexors: ['front'],
  serratus_anterior: ['front', 'back'],
  obliques: ['front', 'back'],
  rectus_abdominis: ['front'],
  latissimus_dorsi: ['back'],
  pectoralis_major: ['front'],
  trapezius_lower: ['back'],
  trapezius_upper: ['front', 'back'],
  deltoid_anterior: ['front'],
  deltoid_lateral: ['front', 'back'],
  deltoid_posterior: ['back'],
  biceps_brachii: ['front'],
  triceps_brachii: ['back'],
  forearm_flexors: ['front', 'back'],
  forearm_extensors: ['front', 'back'],
  gluteus_medius: ['back'],
  gluteus_maximus: ['back'],
  adductors: ['front', 'back'],
  quadriceps: ['front'],
  hamstrings: ['back'],
  calves: ['back'],
  tibialis_anterior: ['front'],
};

export const MUSCLE_LABELS: Record<MuscleId, string> = {
  erector_spinae: 'Erecteurs du rachis',
  rotator_cuff: 'Coiffe des rotateurs',
  rhomboids: 'Rhomboides',
  neck: 'Cou',
  hip_flexors: 'Flechisseurs de hanche',
  serratus_anterior: 'Grand dentele',
  obliques: 'Obliques',
  rectus_abdominis: 'Grand droit de l\'abdomen',
  latissimus_dorsi: 'Grand dorsal',
  pectoralis_major: 'Grand pectoral',
  trapezius_lower: 'Trapeze moyen et inferieur',
  trapezius_upper: 'Trapeze superieur',
  deltoid_anterior: 'Deltoide anterieur',
  deltoid_lateral: 'Deltoide lateral',
  deltoid_posterior: 'Deltoide posterieur',
  biceps_brachii: 'Biceps brachial',
  triceps_brachii: 'Triceps brachial',
  forearm_flexors: 'Flechisseurs de l\'avant-bras',
  forearm_extensors: 'Extenseurs de l\'avant-bras',
  gluteus_medius: 'Moyen fessier',
  gluteus_maximus: 'Grand fessier',
  adductors: 'Adducteurs',
  quadriceps: 'Quadriceps',
  hamstrings: 'Ischio-jambiers',
  calves: 'Mollets',
  tibialis_anterior: 'Jambier anterieur',
};

/** Ordre de dessin dans le SVG, du plus profond au plus superficiel.
 *  Utile pour remonter un path en tete de son groupe sans casser le
 *  reste de l'empilement. */
export const DRAW_ORDER: readonly MuscleId[] = MUSCLE_IDS;
