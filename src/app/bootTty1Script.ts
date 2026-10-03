import { t, tAll, type PoolKey } from '@/i18n/fr';

/**
 * L'ouverture TTY1, tirée au sort : un démarrage de machine en sept parties — chargeur, noyau,
 * services, vérifications, interlude DOS, une fonction de l'app attendue comme un service, puis
 * l'invite. Ce module est **pur** : il ne lit ni l'horloge, ni `navigator`, ni la base. Tout ce qui
 * varie lui est donné (`random`, `facts`), ce qui le rend rejouable à l'identique en test.
 *
 * Il rend une liste de lignes datées (`at`, en millisecondes depuis le montage de l'écran) que
 * `BootTty1Console.tsx` pose au fil d'une horloge. Une console défile : les anciennes lignes sortent par le
 * haut, et c'est ce que des délais CSS sur des lignes déjà présentes ne savent pas faire.
 */

/**
 * La durée de l'ouverture, et elle ne dépend pas du tirage : le tirage change le contenu et la
 * cadence, jamais le temps d'attente. Celui qui lance l'app sait ce que ça lui coûte.
 */
export const TTY1_BOOT_MS = 4650;

/** La frappe d'une commande. `tty1.css` le répète (`calc(var(--chars) * 16ms)`) ; un test les tient. */
export const TYPING_MS_PER_CHAR = 16;

/** La première ligne se pose sous le logo qui s'enfile, pas avant. */
const START_MS = 400;
/** Où la fonction de la porte se met à attendre. Tout ce qui précède s'étale entre `START_MS` et là. */
const GATE_AT_MS = 3150;
/** Combien de temps la porte attend avant d'être validée. */
const GATE_WAIT_MS = 500;
/**
 * Ce que tient une ligne sur un téléphone de 360 px en police de 16 px (chasse de 8 px, 328 px
 * utiles). Une ligne plus longue se replierait sur deux rangs : un défaut cosmétique, pas une
 * erreur, mais la porte, dont le résultat vient du code, s'y tient.
 */
const MAX_LINE_CHARS = 41;
/** `[*     ] ` : l'animation d'attente et ses crochets, devant le texte de la porte. */
const SPINNER_CHARS = 9;
const TARGET_GAP_MS = 120;
const PROMPT_GAP_MS = 130;
const MOTTO_GAP_MS = 60;

export interface BootProbe {
  /** Le nom d'une fonction de l'app, suivi de ses parenthèses : `estimateOneRepMax()`. */
  call: string;
  /** Ce qu'elle a rendu pour de bon, mis en forme : `116.7 kg`. */
  result: string;
}

export interface BootFacts {
  /** Epoch en millisecondes : l'horloge de la machine et les dates du listing DOS. */
  now: number;
  version: string;
  catalogueSize: number;
  restSeconds: number;
  deloadPercent: number;
  barbellKg: number;
  plateSizes: number;
  warmupSteps: number;
  /** Absents quand l'appareil ne les dit pas : la ligne qui les cite est alors écartée. */
  cores?: number;
  screen?: { width: number; height: number };
  online?: boolean;
  /** Les fonctions de l'app qui ont pu être appelées. Aucune : l'ouverture se passe de porte. */
  probes: readonly BootProbe[];
}

export type BootLine =
  /** Une ligne ; son niveau (`[ OK ]`…) et son horodatage sont reconnus à l'affichage. */
  | { at: number; kind: 'text'; text: string }
  | { at: number; kind: 'command'; prompt: string; text: string }
  | { at: number; kind: 'comment'; text: string }
  /** La fonction en attente (animée), puis la même ligne remplacée par sa validation à `doneAt`. */
  | { at: number; kind: 'gate'; waiting: string; done: string; doneAt: number };

export interface BootScript {
  lines: readonly BootLine[];
  durationMs: number;
}

/**
 * Un tirage reproductible (mulberry32). `Math.random` suffit en production ; les tests et
 * `?bootSeed=` en développement ont besoin de rejouer un démarrage précis.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;
type Params = Record<string, string | number | undefined>;

/**
 * Remplit les `{nom}` d'un modèle. Un modèle dont une valeur manque n'est pas affiché à moitié : il
 * n'existe pas, et le tirage se fait parmi ceux qui restent.
 */
function fill(template: string, params: Params): string | undefined {
  let complete = true;
  const line = template.replace(/\{(\w+)\}/g, (_placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) complete = false;
    return String(value ?? '');
  });

  return complete ? line : undefined;
}

function entries(key: PoolKey, params: Params): string[] {
  return tAll(key).flatMap((template) => {
    const line = fill(template, params);
    return line === undefined ? [] : [line];
  });
}

/** `count` éléments distincts, dans un ordre tiré — moins s'il n'y en a pas assez. */
function pickMany<T>(random: Random, list: readonly T[], count: number): T[] {
  const pool = [...list];
  const picked: T[] = [];

  while (picked.length < count && pool.length > 0) {
    // `min` : un tirage qui rendrait 1 — il ne le doit pas, mais une doublure de test le fait — ne
    // doit pas viser une case qui n'existe pas et boucler pour toujours.
    const [item] = pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1);
    if (item !== undefined) picked.push(item);
  }

  return picked;
}

const between = (random: Random, low: number, high: number) =>
  low + Math.floor(random() * (high - low + 1));

const pad2 = (value: number) => String(value).padStart(2, '0');

/** `41,216` : les milliers séparés par une virgule, comme DOS les écrivait. */
const grouped = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Une étape du tirage : ce qu'on pose, et le temps qu'elle laisse après la précédente. */
interface Step {
  line: { kind: 'text'; text: string } | { kind: 'command'; prompt: string; text: string };
  /** Le battement avant elle, **extensible** : la disposition l'étire ou le resserre pour tenir le temps. */
  gap: number;
  /** Ce qui ne s'étire pas : le temps de finir de taper la commande qui précède. */
  hold?: number;
}

const text = (line: string, gap: number, hold?: number): Step => ({
  line: { kind: 'text', text: line },
  gap,
  ...(hold === undefined ? {} : { hold }),
});

const typingMs = (command: string) => command.length * TYPING_MS_PER_CHAR;

function drawLoader(random: Random): Step[] {
  const flavor = pickMany(random, entries('boot.tty1.flavors', {}), 1)[0] ?? '';

  return [
    text(t('boot.tty1.grubTitle'), 0),
    text(t('boot.tty1.grubEntry'), 80),
    text(t('boot.tty1.grubKernel', { flavor }), 80),
    text(t('boot.tty1.grubInitrd'), 80),
  ];
}

/** `[    0.04]` : l'horodatage du noyau, qui ne fait que croître. */
const stamp = (seconds: number) => `[${seconds.toFixed(2).padStart(8)}]`;

function drawKernel(random: Random, params: Params): Step[] {
  const bodies = [
    t('boot.tty1.clock', { date: params['date'] ?? '', time: params['time'] ?? '' }),
    ...pickMany(random, entries('boot.tty1.facts', params), 4),
  ];

  let seconds = 0;
  return bodies.map((body) => {
    seconds += between(random, 2, 9) / 100;
    return text(`${stamp(seconds)} ${body}`, 100);
  });
}

/**
 * Les quatre lignes de la console rare, toujours là et dans leur ordre, entre lesquelles quatre
 * autres s'intercalent : deux réussies, une avertie, une en échec. L'ordre des quatre d'origine est
 * ce qui fait reconnaître la console ; leur voisinage, lui, change.
 */
function drawServices(random: Random, params: Params): Step[] {
  const signature = [
    t('boot.consoleQuadriceps'),
    t('boot.consoleCore'),
    t('boot.consoleEgo'),
    t('boot.consoleExcuses'),
  ];
  const extras = pickMany(
    random,
    [
      ...pickMany(random, entries('boot.tty1.ok', params), 2),
      ...pickMany(random, entries('boot.tty1.warn', params), 1),
      ...pickMany(random, entries('boot.tty1.fail', params), 1),
    ],
    4,
  );

  const total = signature.length + extras.length;
  const extraSlots = new Set(
    pickMany(
      random,
      Array.from({ length: total }, (_, slot) => slot),
      extras.length,
    ),
  );

  return Array.from({ length: total }, (_, slot) =>
    text((extraSlots.has(slot) ? extras.shift() : signature.shift()) ?? '', 110),
  ).filter((step) => step.line.text !== '');
}

function drawChecks(random: Random, params: Params): Step[] {
  return pickMany(random, entries('boot.tty1.checks', params), 3).map((line) => text(line, 160));
}

/** `10-03-26   2:07p` : la date et l'heure d'un fichier, au format de MS-DOS. */
function dosStamp(now: number): string {
  const date = new Date(now);
  const hours = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;

  return (
    `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getFullYear() % 100)}` +
    `  ${String(hours).padStart(2)}:${pad2(date.getMinutes())}${date.getHours() < 12 ? 'a' : 'p'}`
  );
}

function drawListing(random: Random, params: Params, now: number): string[] {
  const names = pickMany(random, entries('boot.tty1.dosFiles', params), between(random, 3, 4)).map(
    (name) => {
      const [stem = '', extension = ''] = name.split('.');
      return { stem, extension, size: between(random, 1_000, 99_999) };
    },
  );
  const bytes = names.reduce((sum, file) => sum + file.size, 0);
  const summary = `${String(names.length).padStart(10)} ${t('boot.tty1.dosFileCount')}${grouped(
    bytes,
  ).padStart(15)} ${t('boot.tty1.dosBytes')}`;
  const serial = `${between(random, 0x1000, 0xffff).toString(16)}-${between(random, 0x1000, 0xffff).toString(16)}`;

  return [
    t('boot.tty1.dosVolume'),
    t('boot.tty1.dosSerial', { serial: serial.toUpperCase() }),
    '',
    t('boot.tty1.dosDirectory', { path: t('boot.tty1.dosPathRoot') }),
    '',
    ...names.map(
      (file) =>
        `${file.stem.padEnd(8)} ${file.extension.padEnd(3)} ${grouped(file.size).padStart(9)} ${dosStamp(now)}`,
    ),
    summary,
    t('boot.tty1.dosTotalListed'),
    summary,
    `${grouped(between(random, 8_000_000, 9_900_000)).padStart(25)} ${t('boot.tty1.dosBytesFree')}`,
  ];
}

/**
 * Une commande de DOS et sa sortie, après l'annonce du service qui la rend possible. `dir /s` une
 * fois sur deux — c'est elle qu'on reconnaît —, `ver` ou `mem` le reste du temps.
 */
function drawInterlude(random: Random, params: Params, facts: BootFacts): Step[] {
  const roll = random();
  const [command, output] =
    roll < 0.5
      ? [t('boot.tty1.dosDirCommand'), drawListing(random, params, facts.now)]
      : roll < 0.75
        ? [t('boot.tty1.dosVerCommand'), [t('boot.tty1.dosVersion', { version: facts.version })]]
        : [t('boot.tty1.dosMemCommand'), [t('boot.tty1.dosMemTotal'), t('boot.tty1.dosMemJoke')]];

  return [
    text(t('boot.tty1.dosIntro'), 120),
    { line: { kind: 'command', prompt: t('boot.tty1.dosPrompt'), text: command }, gap: 220 },
    ...output.map((line, index) =>
      text(line, 50, index === 0 ? typingMs(command) + 40 : undefined),
    ),
  ];
}

/**
 * Pose les étapes libres entre `START_MS` et `GATE_AT_MS`. Les battements s'étirent ou se
 * resserrent d'un même facteur pour que la porte tombe toujours au même instant ; les `hold` — la
 * frappe d'une commande — ne bougent pas, parce qu'une sortie ne peut pas précéder la fin de la
 * commande qui la produit.
 */
function place(steps: readonly Step[]): number[] {
  const later = steps.slice(1);
  const flexible = later.reduce((sum, step) => sum + step.gap, 0) + 200;
  const fixed = later.reduce((sum, step) => sum + (step.hold ?? 0), 0);
  const scale = (GATE_AT_MS - START_MS - fixed) / flexible;

  let at = START_MS;
  return steps.map((step, index) => {
    if (index > 0) at += step.gap * scale + (step.hold ?? 0);
    return Math.round(at);
  });
}

export function buildBootScript(random: Random, facts: BootFacts): BootScript {
  const date = new Date(facts.now);
  const params: Params = {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
    cores: facts.cores,
    width: facts.screen?.width,
    height: facts.screen?.height,
    network:
      facts.online === undefined
        ? undefined
        : t(facts.online ? 'boot.tty1.networkOnline' : 'boot.tty1.networkOffline'),
    catalogue: facts.catalogueSize,
    rest: facts.restSeconds,
    deload: facts.deloadPercent,
    bar: facts.barbellKg,
    plateSizes: facts.plateSizes,
    warmupSteps: facts.warmupSteps,
    version: facts.version,
  };

  const steps = [
    ...drawLoader(random),
    ...drawKernel(random, params),
    ...drawServices(random, params),
    ...drawChecks(random, params),
    ...drawInterlude(random, params, facts),
  ];
  const times = place(steps);

  const lines: BootLine[] = steps.map((step, index) => ({ ...step.line, at: times[index] ?? 0 }));

  // Une fonction dont la ligne ne tiendrait pas n'est pas tirée : son résultat vient du code, pas
  // de `fr.ts`, et personne ne l'a mesuré contre la largeur d'un téléphone.
  const fitting = facts.probes.filter(
    (candidate) =>
      SPINNER_CHARS + t('boot.tty1.gateWaiting', { call: candidate.call }).length <=
        MAX_LINE_CHARS &&
      t('boot.tty1.gateDone', { call: candidate.call, result: candidate.result }).length <=
        MAX_LINE_CHARS,
  );
  const probe = pickMany(random, fitting, 1)[0];
  if (probe !== undefined) {
    lines.push({
      at: GATE_AT_MS,
      kind: 'gate',
      waiting: t('boot.tty1.gateWaiting', { call: probe.call }),
      done: t('boot.tty1.gateDone', { call: probe.call, result: probe.result }),
      doneAt: GATE_AT_MS + GATE_WAIT_MS,
    });
  }

  const targetAt = GATE_AT_MS + GATE_WAIT_MS + TARGET_GAP_MS;
  const promptAt = targetAt + PROMPT_GAP_MS;
  const command = t('boot.consoleCommand');

  lines.push(
    { at: targetAt, kind: 'text', text: t('boot.tty1.target') },
    { at: promptAt, kind: 'command', prompt: t('boot.consolePrompt'), text: command },
    {
      at: promptAt + typingMs(command) + MOTTO_GAP_MS,
      kind: 'comment',
      text: `# ${t('app.tagline')}`,
    },
  );

  return { lines, durationMs: TTY1_BOOT_MS };
}
