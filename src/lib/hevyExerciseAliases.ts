export const HEVY_EXERCISE_SUGGESTION_SLUG_BY_KEY: Readonly<
  Record<string, string>
> = Object.freeze({
  'abduction hanche|other': 'hip-abduction-machine',
  'adduction hanche|other': 'hip-adduction-machine',
  'chest pres|machine': 'machine-chest-press',
  'curl bicep|dumbbell': 'dumbbell-curl',
  'curl marteau|dumbbell': 'hammer-curl',
  'dead hang|other': 'dead-hang',
  'developpe couche|dumbbell': 'dumbbell-bench-press',
  'developpe debout centree|cable': 'pallof-press',
  'developpe couche incline|dumbbell': 'dumbbell-incline-bench-press',
  'elevation laterale|cable': 'cable-lateral-raise',
  'extension dos hyperextension lestee|other':
    'weighted-back-extension',
  'extension jambe|other': 'leg-extension',
  'extension tricep corde|other': 'cable-triceps-pushdown-rope',
  'hip thrust|dumbbell': 'dumbbell-hip-thrust',
  'kickback|cable': 'cable-glute-kickback',
  'leg curl assi|other': 'seated-leg-curl',
  'planche|other': 'plank',
  'planche laterale|other': 'side-plank',
  'presse cuisse horizontal|other': 'leg-press',
  'presse epaule assi|machine': 'machine-shoulder-press',
  // Idem : aucune rotation externe n'existait, et « poulie » suffisait à le
  // faire atterrir sur un crunch à la poulie haute.
  'rotation externe|cable': 'cable-external-rotation',
  'tirage bas iso lateral|other': 'seated-cable-row',
  'tirage poitrine|cable': 'lat-pulldown',
  'tirage ver visage|other': 'face-pull',
});
