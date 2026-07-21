/**
 * Every string the interface shows lives here — never inside a component.
 * ADR-007: no i18n library at V1, but the strings are already centralised so
 * adding English later is mechanical.
 *
 * Voice: second person singular, factual, no filler. The app is an instrument
 * used out of breath between two sets, not a companion.
 */
const fr = {
  app: {
    name: 'FitTrack',
  },

  nav: {
    label: 'Navigation principale',
    home: 'Accueil',
    routines: 'Routines',
    history: 'Historique',
    exercises: 'Exercices',
    settings: 'Réglages',
  },

  units: {
    workouts: 'séances',
    routines: 'routines',
    exercises: 'exercices',
    streakDays: 'jours d’affilée',
    kg: 'kg',
  },

  home: {
    title: 'Accueil',
    emptyBody: 'Le compteur démarre à ta première séance terminée.',
  },

  routines: {
    title: 'Routines',
    emptyBody:
      'Une routine, c’est ta séance type : les exercices, les séries et les charges visées.',
  },

  history: {
    title: 'Historique',
    emptyBody: 'Chaque séance terminée s’ajoute ici, et y reste. Aucune limite de durée.',
  },

  exercises: {
    title: 'Exercices',
    emptyBody: 'Le catalogue et tes exercices personnels apparaîtront ici.',
  },

  settings: {
    title: 'Réglages',

    appearanceSection: 'Apparence',
    theme: 'Thème',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeHint:
      'Sombre par défaut : une salle est mal éclairée et l’écran reste allumé une heure et demie.',

    inputSection: 'Saisie',
    demoTitle: 'Champ de charge',
    demoHint: 'Le champ utilisé pour chaque série. La virgule passe : essaie 102,5.',
    demoLabel: 'Poids d’essai',
    demoReadingLabel: 'valeur retenue',
    demoEmpty: '—',
    demoNote: 'Démonstration : rien n’est enregistré.',

    dataSection: 'Données',
    debugLink: 'Diagnostic',
    debugHint: 'Contenu de la base, stockage utilisé, réinitialisation.',
  },

  debug: {
    title: 'Diagnostic',
    back: 'Réglages',

    storageSection: 'Stockage',
    storageUsed: 'utilisé',
    storageQuota: 'sur {quota} Mo disponibles',
    storageUnit: 'Mo',
    storageUnavailable: 'Le navigateur ne donne pas d’estimation de stockage.',

    tablesSection: 'Tables',
    rows: 'lignes',

    recentSection: 'Derniers exercices modifiés',
    recentEmpty: 'Aucun exercice en base. Relance le seed.',

    actionsSection: 'Actions',
    reseed: 'Relancer le seed',
    reseedHint: 'Insère les exercices du catalogue absents de la base. N’écrase rien.',
    reseedDone: 'Seed terminé.',
    reset: 'Réinitialiser la base',
    resetHint:
      'Efface tes séances, tes routines et tes exercices personnalisés — définitivement. Le catalogue, lui, se réinstalle seul au prochain démarrage.',
    resetDone:
      'Base vidée. Le catalogue revient au prochain chargement ; tes séances et exercices personnalisés sont perdus.',
    confirm: 'Confirmer',
    cancel: 'Annuler',
    working: 'En cours…',
    failed: 'L’opération a échoué. Détail dans la console.',
  },

  boot: {
    loading: 'préparation de la base',
    seedFailed:
      'Le catalogue d’exercices n’a pas pu être chargé. Tes données sont intactes, le reste de l’app fonctionne.',
    dismiss: 'Masquer',
  },

  error: {
    title: 'Cet écran n’a pas pu s’afficher',
    body: 'Tes données sont intactes : elles vivent sur l’appareil, pas dans l’écran.',
    reload: 'Recharger',
  },
} satisfies Dictionary;

type Dictionary = { [key: string]: string | Dictionary };

/** Every dotted path that ends on a string, e.g. `'settings.themeDark'`. */
type LeafPath<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPath<T[K]>}`;
}[keyof T & string];

export type TranslationKey = LeafPath<typeof fr>;

/**
 * `t('settings.theme')`. Placeholders are written `{name}`:
 * `t('workout.setCount', { count: 3 })`.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const found = key
    .split('.')
    .reduce<string | Dictionary | undefined>(
      (node, part) => (typeof node === 'object' ? node[part] : undefined),
      fr,
    );

  // A missing key shows itself rather than an empty space: a blank button is
  // invisible in review, `settings.theme` is not.
  if (typeof found !== 'string') return key;
  if (!params) return found;

  return found.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}
