import type { Equipment, MeasurementType, SetType } from '@/data/types';

/**
 * Le vocabulaire des jalons — ce que l'app reconnaît, et à quel titre.
 *
 * **Un jalon n'est pas un record.** Un record est relatif à soi et tombe dès
 * qu'on fait mieux : il y en a un nouveau toutes les trois semaines, et c'est
 * très bien. Un jalon est un seuil *écrit à l'avance*, absolu, qui ne se
 * franchit qu'une fois dans une vie de pratiquant. 102,5 kg au développé couché
 * est un record de plus ; les 100 kg franchis ce jour-là sont une porte.
 *
 * C'est la raison pour laquelle la liste est **écrite à la main** et pas
 * dérivée : un seuil généré tous les 5 kg produirait vingt « jalons » par an,
 * c'est-à-dire aucun. La rareté est la fonctionnalité.
 */
export type MilestoneKind =
  /** Une charge, en kilogrammes, sur un mouvement nommé. */
  | 'exercise_load'
  /** Des répétitions sur un mouvement au poids du corps — la porte s'ouvre à 1. */
  | 'exercise_reps'
  /** Des secondes tenues sur un mouvement chronométré. */
  | 'exercise_duration'
  /** Une paire d'haltères, quel que soit l'exercice qui les tient. */
  | 'dumbbell_pair'
  /** Des séances terminées, depuis toujours. */
  | 'session_count'
  /** Des semaines où l'on est venu — cumulées, jamais consécutives. */
  | 'active_weeks'
  /** Des années écoulées depuis la première séance, et encore là. */
  | 'training_years'
  /** Des kilos soulevés depuis toujours. */
  | 'lifetime_tonnage';

/**
 * Les quatre rayons de l'écran des jalons. Un ordre de lecture, pas une
 * hiérarchie : personne ne « vaut » plus qu'un autre.
 */
export type MilestoneGroup = 'strength' | 'gateway' | 'practice' | 'volume';

export interface MilestoneDefinition {
  /**
   * Identifiant stable, écrit une fois et **jamais renommé** : c'est lui qui est
   * en base, et le renommer effacerait un jalon acquis. Un seuil qu'on regrette
   * se retire de la liste ; il ne se réécrit pas.
   */
  id: string;
  kind: MilestoneKind;
  group: MilestoneGroup;
  /** Kilos, répétitions, secondes, séances, semaines ou années selon le genre. */
  threshold: number;
  /**
   * Les exercices du catalogue qui comptent, pour les genres qui en nomment un.
   *
   * Plusieurs, parce qu'un mouvement n'est pas un exercice : le soulevé de terre
   * conventionnel et le sumo sont le même jalon, et n'en faire qu'un des deux
   * punirait un choix de morphologie.
   *
   * **Des slugs, donc jamais un exercice personnel.** Un exercice créé à la main
   * n'a pas de slug, et c'est voulu : « 100 kg au développé couché » ne veut
   * rien dire si n'importe quelle ligne peut s'appeler ainsi. Le prix est réel
   * — qui refait sa propre fiche de développé couché ne déclenche rien — et il
   * est plus petit qu'un jalon qu'on peut s'offrir en tapant un nom.
   */
  slugs?: readonly string[];
  /** Clé i18n du sujet : « Développé couché », « Traction pronation »… */
  subjectKey?: string;
}

/**
 * Une série terminée, réduite à ce dont les jalons ont besoin.
 *
 * Le moteur ne lit jamais Dexie (§7 de l'architecture) et ne connaît ni les
 * instantanés, ni les côtés, ni les séries dégressives : le dépôt lui livre des
 * séries déjà qualifiées, déjà datées, déjà pesées.
 */
export interface MilestoneSet {
  workoutId: string;
  /** Instant de validation de la série. */
  performedAt: number;
  /** Absent pour un exercice personnel — cf. `slugs`. */
  slug?: string;
  /**
   * Matériel et mesure sont **facultatifs**, et aucune valeur de repli ne les
   * remplace. Une ligne d'une séance ancienne, dont l'exercice a disparu et qui
   * n'a jamais été instantanée, ne dit ni l'un ni l'autre — lui prêter
   * « haltères » ou « poids et répétitions » pour compléter la forme aurait
   * offert un palier à une ligne sur laquelle on ne sait rien.
   */
  equipment?: Equipment;
  measurementType?: MeasurementType;
  isUnilateral: boolean;
  setType: SetType;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  /**
   * Ce que la série a réellement déplacé, poids du corps compris — le même
   * calcul que le tonnage de la séance, fait en amont par `lib/volume`. Le
   * moteur ne refait pas cette arithmétique : deux implémentations du tonnage
   * dans l'app, c'est un chiffre qui finit par en contredire un autre.
   */
  tonnageKg: number;
}

/** Une séance terminée, réduite à sa date. */
export interface MilestoneSession {
  workoutId: string;
  startedAt: number;
}

export interface MilestoneInput {
  sets: readonly MilestoneSet[];
  sessions: readonly MilestoneSession[];
}

/** Un jalon franchi, avec la preuve de quand et par quoi. */
export interface EarnedMilestone {
  definitionId: string;
  achievedAt: number;
  workoutId: string;
  /**
   * La valeur qui a franchi le seuil, et non le seuil lui-même : on a passé les
   * 100 kg *à 102,5*, et c'est ce chiffre-là qu'on se rappelle.
   */
  value: number;
}
