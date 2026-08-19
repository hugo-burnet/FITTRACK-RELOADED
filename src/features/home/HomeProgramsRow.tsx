import { useNavigate } from 'react-router-dom';
import type { HomeProgramProjection } from '@/data/repositories/home';
import { t } from '@/i18n/fr';
import { Card, ListRow } from '@/ui';
import { ChevronRightIcon, ProgramIcon } from '@/ui/icons';

interface Props {
  /** Le bloc actif tel que l'accueil le lit déjà, ou `null` quand aucun ne tourne. */
  program: HomeProgramProjection | null;
}

/**
 * La porte des blocs, à demeure.
 *
 * Elle vivait en tête de l'onglet Routines, au-dessus de la bibliothèque, où
 * elle n'avait rien à faire : composer une séance type et planifier huit
 * semaines sont deux gestes différents, faits à deux moments différents. Elle
 * est ici, et dans les deux modes — la carte au-dessus répond « quoi
 * aujourd'hui », cette ligne répond « et mes autres blocs ».
 *
 * Elle ne lit rien : le bloc actif lui est passé, celui que l'accueil affiche
 * déjà. Deux lectures du même bloc sur un même écran, ce sont deux occasions de
 * ne pas dire la même chose.
 */
export function HomeProgramsRow({ program }: Props) {
  const navigate = useNavigate();

  return (
    // `section` comme tous les blocs de cet écran : ils forment un rythme, et
    // celui-ci s'y insère au lieu de flotter entre deux.
    <section>
      <Card>
        <ListRow
          title={t('program.listTitle')}
          // Rien du tout quand un bloc tourne : la carte juste au-dessus le nomme
          // déjà, et deux fois le même nom à 16 px d'écart se lit comme une
          // erreur d'affichage. Cette ligne n'a plus qu'un rôle — ouvrir la
          // liste — et un seul état à annoncer : celui où il n'y a rien à
          // ouvrir.
          subtitle={program === null ? t('home.programsNone') : undefined}
          leading={<ProgramIcon />}
          trailing={<ChevronRightIcon />}
          onClick={() => void navigate('/programs')}
        />
      </Card>
    </section>
  );
}
