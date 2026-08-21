/**
 * L'en-tête que partagent les quatre cartes d'analyse : ce qu'on lit à gauche,
 * le chiffre qu'on lit à droite.
 *
 * **Il existe parce que « kg » passait à la ligne.** Les deux textes étaient
 * posés dans un `flex justify-between`, et sur un téléphone de 375 px
 * « 19 313,5 kg » en `text-3xl` ne laissait plus la place à « Semaine du
 * 17 août 2026 » : le chiffre se cassait entre sa valeur et son unité, une ligne
 * plus bas, pendant que l'intitulé se coupait en deux. Une lecture chiffrée est
 * un mot, pas deux — et le lot n'a rien à gagner à séparer un nombre de son
 * unité.
 *
 * Deux règles, donc, et elles suffisent :
 *
 * - **la valeur ne se coupe jamais** (`whitespace-nowrap`) ;
 * - **la ligne se dédouble avant de se serrer** (`flex-wrap`). Quand les deux ne
 *   tiennent plus côte à côte, le chiffre descend d'une ligne, toujours calé à
 *   droite (`ml-auto`), et l'intitulé retrouve toute la largeur. Rien ne bouge
 *   sur les lectures courtes, qui restent sur une seule ligne comme avant.
 */
export function CardHeadline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="label-xs font-semibold text-[var(--text-2)]">{label}</span>
      <span
        className="metric ml-auto text-right text-3xl leading-none font-semibold
          whitespace-nowrap text-[var(--text-1)]"
      >
        {value}
      </span>
    </div>
  );
}
