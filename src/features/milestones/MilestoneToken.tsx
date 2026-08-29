/**
 * Le jeton d'un palier : un disque, et le chiffre dedans.
 *
 * **Ni médaille, ni coupe, ni image.** Trois raisons, dans cet ordre : une
 * illustration générée demanderait un réseau et une clé d'API (règles n° 2 et
 * n° 3), un jeu d'images acheté coûterait ce que l'enquête du 2026-07-22 a
 * chiffré, et surtout un trophée en toc aurait transformé la pratique en jeu —
 * ce que l'accueil a explicitement refusé en supprimant son compteur de
 * semaines. Le chiffre se reconnaît d'un coup d'œil et se raconte ; un ruban
 * doré ne se raconte pas.
 *
 * **L'accent est réservé à ce qui vient de tomber.** La charte le garde pour les
 * séries validées et les records, et `RecordNote` s'en autorise pour la même
 * raison. Un mur de paliers tout en vert acide ne distinguerait plus rien : la
 * liste est donc neutre, et seule la célébration porte la couleur.
 *
 * La taille du texte suit le nombre de caractères plutôt que le disque : « 1 »
 * et « 5000 » vivent dans le même cercle de 48 px, et laisser la police fixe
 * aurait fait déborder le second.
 */
export function MilestoneToken({
  value,
  tone = 'neutral',
  size = 'md',
}: {
  value: string;
  tone?: 'neutral' | 'accent';
  size?: 'md' | 'lg';
}) {
  const box = size === 'lg' ? 'h-14 w-14' : 'h-12 w-12';
  const scale =
    value.length >= 4 ? 'text-sm' : value.length === 3 ? 'text-base' : 'text-lg';
  const skin =
    tone === 'accent'
      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
      : 'bg-[var(--surface-2)] text-[var(--text-1)]';

  return (
    // aria-hidden : le chiffre est déjà dans le titre juste à côté, en toutes
    // lettres et avec son unité. Le lecteur d'écran dirait « 100, Développé
    // couché à 100 kg » sans rien apprendre à personne.
    <span
      aria-hidden="true"
      className={`metric flex shrink-0 items-center justify-center rounded-full font-semibold
        tabular-nums ${box} ${scale} ${skin}`}
    >
      {value}
    </span>
  );
}
