import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BOOT_HOLD_MS, BootScreen } from './Boot';

const stylesheet = readFileSync('src/index.css', 'utf8');

/** Le bloc d'ouverture, du commentaire d'en-tête jusqu'au composant suivant. */
const bootStyles = stylesheet.slice(
  stylesheet.indexOf(" * L'ouverture de l'app."),
  stylesheet.indexOf('/*\n * Le passage d\'un écran à l\'autre.'),
);

const reducedMotion = stylesheet.slice(
  stylesheet.indexOf('@media (prefers-reduced-motion: reduce)'),
  stylesheet.indexOf('/* A deliberately quiet effort rail.'),
);

describe('BootScreen', () => {
  /**
   * Le chargement de la barre est la partie qui marche, et la seule qui reste.
   * Les coordonnées sont celles de `public/icon.svg` : c'est le logo qu'on
   * anime, pas un dessin qui lui ressemble.
   */
  it('charge la barre en deux paires de plaques, sur les coordonnées du logo', () => {
    const { container } = render(<BootScreen />);

    expect(container.querySelector('.boot-rail')).not.toBeNull();

    const plates = [...container.querySelectorAll('.boot-plate')];
    expect(plates.map((plate) => plate.getAttribute('d'))).toEqual([
      'M6.5 8.5v7',
      'M17.5 8.5v7',
      'M3.5 10.5v3',
      'M20.5 10.5v3',
    ]);

    // Deux gestes, pas un effet répété : les deux paires ne partent pas
    // ensemble et ne viennent pas d'aussi loin.
    const delays = plates.map((plate) => plate.getAttribute('style'));
    expect(delays[0]).toContain('--boot-delay: 640ms');
    expect(delays[2]).toContain('--boot-delay: 940ms');
    expect(delays[0]).toContain('--boot-travel: 8px');
    expect(delays[2]).toContain('--boot-travel: 5px');
  });

  /**
   * Le troisième temps est parti, et c'est le sujet du changement.
   *
   * La barre tombait, s'écrasait, secouait l'écran et levait de la poussière :
   * quatre couches sur la même frame pour un seul événement, sur un dessin qui
   * fait quatre traits. Ce test existe pour qu'aucune d'elles ne revienne par
   * accident — le silence après le chargement **est** la fonctionnalité.
   */
  it('ne dessine plus aucune couche de choc', () => {
    const { container } = render(<BootScreen />);

    for (const selector of ['.boot-impact', '.boot-barbell', '.boot-dust', '.boot-ground']) {
      expect(container.querySelector(selector), selector).toBeNull();
    }
    expect(container.querySelectorAll('circle')).toHaveLength(0);
  });

  it('ne garde ni chute, ni secousse, ni poussière dans la feuille de style', () => {
    for (const name of [
      'boot-drop',
      'boot-impact-shake',
      'boot-dust-l',
      'boot-dust-r',
      'boot-dust-fade',
    ]) {
      expect(stylesheet, name).not.toContain(name);
    }
  });

  /**
   * Une fois la dernière plaque posée, le dessin ne rebouge plus. C'est ce que
   * `pop` sur le principe trahissait déjà : un geste de plus après le geste.
   * Aucune règle de la séquence d'entrée ne doit viser la barre ou son cadre.
   */
  it('laisse la barre immobile après le chargement', () => {
    const entryRules = [...bootStyles.matchAll(/\.boot\[data-phase='in'\] ([^{]+){([^}]*)}/g)];
    const animated = entryRules
      .filter(([, , body]) => /animation:/.test(body ?? ''))
      .map(([, selector]) => (selector ?? '').trim());

    expect(animated).toEqual([
      '.boot-rail',
      '.boot-mark',
      '.boot-plate--l',
      '.boot-plate--r',
      '.boot-principle',
      '.boot-tagline',
    ]);
  });

  /**
   * Le seul événement qui reste est typographique. S'il redevenait spatial —
   * un `transform`, une échelle — on aurait remplacé une chute par un sursaut,
   * ce qui est le défaut qu'on corrige.
   */
  it('ferme la séquence sur un geste typographique, pas sur un déplacement', () => {
    expect(bootStyles).toMatch(
      /\.boot\[data-phase='in'\] \.boot-principle\s*{[^}]*animation: boot-track-in /s,
    );

    const trackIn = bootStyles.slice(
      bootStyles.indexOf('@keyframes boot-track-in'),
      bootStyles.indexOf('@keyframes boot-curtain'),
    );

    expect(trackIn).toContain('letter-spacing:');
    expect(trackIn).not.toContain('transform:');
    expect(trackIn).not.toContain('scale');
  });

  /**
   * L'interlettrage ajoute son blanc **après** la dernière lettre : sans un
   * `text-indent` qui le suit exactement, la ligne dérive vers la gauche
   * pendant tout le resserrement au lieu de rester sur son axe. Le défaut est
   * connu — la règle statique de `.boot-principle` le corrigeait déjà — et
   * l'animation le ferait revenir, en mouvement, si elle l'oubliait.
   */
  it('garde le principe sur son axe pendant le resserrement', () => {
    const trackIn = bootStyles.slice(
      bootStyles.indexOf('@keyframes boot-track-in'),
      bootStyles.indexOf('@keyframes boot-curtain'),
    );

    const frames = [...trackIn.matchAll(/(from|to)\s*{([^}]*)}/g)].map(([, at, body]) => ({
      at,
      spacing: /letter-spacing:\s*([\d.]+)em/.exec(body ?? '')?.[1],
      indent: /text-indent:\s*([\d.]+)em/.exec(body ?? '')?.[1],
    }));

    expect(frames).toHaveLength(2);
    for (const frame of frames) {
      expect(frame.indent, `text-indent à « ${frame.at ?? ''} »`).toBe(frame.spacing);
    }

    // L'arrivée doit être l'état statique de `.boot-principle`, sinon le mot
    // finit à un interlettrage que la feuille de style ne déclare nulle part.
    expect(frames[1]?.spacing).toBe('0.3');
    expect(bootStyles).toMatch(/\.boot-principle\s*{[^}]*letter-spacing:\s*0\.3em;/s);

    // Le départ est un plafond mesuré : au-delà de 0,6 em, « Progressive
    // Overload » passe à deux lignes sur un écran de 320 px, puis revient à
    // une seule au milieu de l'animation — et le bloc centré saute de 5,5 px.
    expect(Number(frames[0]?.spacing)).toBeLessThanOrEqual(0.6);
    expect(bootStyles).toMatch(/\.boot-principle\s*{[^}]*white-space:\s*nowrap;/s);
  });

  /**
   * `BOOT_HOLD_MS` n'est pas une mesure mais une durée choisie : elle doit
   * couvrir la séquence en entier, sinon le rideau se lève sur une signature
   * encore en train d'apparaître.
   */
  it('lève le rideau après la fin de la dernière animation', () => {
    // Les quatre règles à délai littéral : le manchon, le nom, le principe et
    // la signature. Les plaques n'y sont pas, et c'est normal — leur délai est
    // un `var(--boot-delay)` que le composant écrit sur chaque trait ; elles se
    // posent de toute façon à 1 240 ms, bien avant la dernière ligne de texte.
    const timings = [...bootStyles.matchAll(/animation: \S+ (\d+)ms [^;]*?(\d+)ms both;/g)].map(
      ([, duration, delay]) => Number(duration) + Number(delay),
    );

    expect(timings).toHaveLength(4);
    expect(Math.max(...timings)).toBeLessThanOrEqual(BOOT_HOLD_MS);
  });

  it('rend la séquence en opacité seule en mouvement réduit', () => {
    expect(reducedMotion).toMatch(
      /\.boot\[data-phase='in'\] \.boot-rail,[^{]*{[^}]*animation-name: boot-fade !important;/s,
    );
    // Le principe est dans cette liste : `boot-fade` ne déclare aucun
    // `letter-spacing`, donc le resserrement disparaît avec le reste.
    expect(reducedMotion).toMatch(/\.boot\[data-phase='in'\] \.boot-principle,/);
    expect(reducedMotion).not.toContain('boot-dust');
    expect(reducedMotion).not.toContain('boot-barbell');
  });
});
