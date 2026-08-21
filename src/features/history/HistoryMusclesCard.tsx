import { useState } from 'react';
import { t } from '@/i18n/fr';
import { Card, SectionTitle } from '@/ui';
import { MuscleMap, type MuscleHighlight, type MuscleId } from '@/ui/muscleMap';
import { MuscleExercisesSheet } from '@/features/exercises/MuscleExercisesSheet';

/**
 * Le corps d'une séance passée, et le doigt qui le lit.
 *
 * **Le même geste que sur l'accueil, et c'est tout l'intérêt.** Un dessin qui
 * répond au doigt sur un écran et pas sur l'autre apprend surtout à ne plus
 * essayer. Ici la question posée en touchant un muscle est plus naturelle
 * encore qu'à l'accueil : on relit une séance, on voit une région restée
 * sombre, et on veut savoir par quoi la travailler la prochaine fois.
 *
 * La feuille appartient au catalogue (`MuscleExercisesSheet`) : elle ne sait
 * rien de la séance ouverte derrière elle et répond avec les exercices du
 * catalogue, exactement comme depuis l'accueil. Une liste tirée de la séance
 * elle-même dirait ce qu'on vient déjà de lire dix lignes plus bas.
 */
export function HistoryMusclesCard({ highlight }: { highlight: MuscleHighlight }) {
  /**
   * Le muscle touché survit à la fermeture de la feuille : le vider ferait
   * retomber le titre sur son libellé de repli pendant l'animation de sortie.
   * Même découpage qu'à l'accueil.
   */
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section>
      <SectionTitle>{t('history.detailMuscles')}</SectionTitle>
      <Card padded>
        {/* Plus décoratif depuis qu'il se touche : le dessin porte son libellé,
            au lieu d'être caché aux lecteurs d'écran comme sur les écrans où il
            ne fait que doubler un texte voisin. */}
        <MuscleMap
          highlight={highlight}
          label={t('history.detailMusclesLabel')}
          onSelectMuscle={(id) => {
            setSelected(id);
            setSheetOpen(true);
          }}
        />
        {/* Un corps humain ne ressemble pas à un bouton : la ligne le dit à sa
            place, une fois, sans habiller le dessin de chrome. */}
        <p className="pt-2 text-center text-xs text-[var(--text-2)]">{t('muscleSheet.tapHint')}</p>
      </Card>

      <MuscleExercisesSheet
        open={sheetOpen}
        muscle={selected}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  );
}
