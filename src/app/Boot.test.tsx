import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BootScreen } from './Boot';

describe('BootScreen', () => {
  it('exposes the layered scene used for the ground impact', () => {
    const { container } = render(<BootScreen />);

    expect(container.querySelector('.boot-impact')).not.toBeNull();
    expect(container.querySelector('.boot-barbell')).not.toBeNull();
    expect(container.querySelector('.boot-ground')).not.toBeNull();
    expect(container.querySelectorAll('.boot-dust')).toHaveLength(2);
  });

  it('builds the dust from lightweight vector particles', () => {
    const { container } = render(<BootScreen />);

    expect(container.querySelectorAll('.boot-dust circle')).toHaveLength(6);
  });

  it('keeps reduced-motion dust opacity-only', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const reducedMotion = stylesheet.slice(
      stylesheet.indexOf('@media (prefers-reduced-motion: reduce)'),
      stylesheet.indexOf('/* A deliberately quiet effort rail.'),
    );
    const dustFade = stylesheet.slice(
      stylesheet.indexOf('@keyframes boot-dust-fade'),
      stylesheet.indexOf('@keyframes boot-rack'),
    );

    expect(reducedMotion).toContain('animation-name: boot-dust-fade !important;');
    expect(reducedMotion).toMatch(
      /\.boot\[data-phase='in'\] \.boot-ground,[^{]*{[^}]*animation-name: boot-fade !important;/s,
    );
    expect(reducedMotion).toMatch(
      /\.boot\[data-phase='in'\] \.boot-impact,[^}]*\.boot-barbell\s*{[^}]*animation: none !important;/s,
    );
    expect(dustFade).toContain('opacity:');
    expect(dustFade).not.toContain('transform:');
  });

  it('keeps transient layers stable when the exit curtain remounts', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const bootStyles = stylesheet.slice(stylesheet.indexOf(" * L'ouverture de l'app."));

    expect(bootStyles).toMatch(/\.boot-dust\s*{[^}]*opacity:\s*0;/s);
    expect(bootStyles).toMatch(
      /\.boot-ground\s*{(?=[^}]*opacity:\s*0\.28;)(?=[^}]*transform:\s*scaleX\(0\.94\);)[^}]*}/s,
    );
  });

  /**
   * Le point de contact, et non le milieu de la barre.
   *
   * Les deux grandes plaques — `x = 6.5` et son miroir `17.5` — descendent à
   * `y = 15.5`, et leur terminaison ronde de 2 unités les fait franchir la ligne
   * de sol. Ce sont elles qui touchent : le manchon s'arrête à `y = 13` et les
   * petites plaques à `14.5`, tous deux en l'air. Une poussière qui part du
   * centre de la barre montre donc un choc là où rien ne heurte.
   */
  it('fait naître la poussière aux deux points de contact, pas au centre de la barre', () => {
    const { container } = render(<BootScreen />);
    const CONTACT_X = [6.5, 17.5];

    const circles = [...container.querySelectorAll('.boot-dust circle')];
    expect(circles).toHaveLength(6);

    for (const circle of circles) {
      const cx = Number(circle.getAttribute('cx'));
      const nearest = Math.min(...CONTACT_X.map((contact) => Math.abs(cx - contact)));
      expect(nearest, `particule à cx=${String(cx)}`).toBeLessThanOrEqual(1.5);
    }
  });

  it('pose la poussière sur la ligne de sol, et la lit dans le dessin', () => {
    const { container } = render(<BootScreen />);

    // Lue sur place plutôt que recopiée : le jour où le sol bouge, ce test
    // suit au lieu de réclamer une valeur qu'on aurait oublié de changer.
    const ground = container.querySelector('.boot-ground')?.getAttribute('d') ?? '';
    const groundY = Number(/^M[\d.]+ ([\d.]+)H/.exec(ground)?.[1]);
    expect(groundY).toBeGreaterThan(0);

    for (const circle of container.querySelectorAll('.boot-dust circle')) {
      const cy = Number(circle.getAttribute('cy'));
      expect(Math.abs(cy - groundY), `particule à cy=${String(cy)}`).toBeLessThanOrEqual(0.7);
    }
  });

  /**
   * Le geste que l'utilisateur a demandé : on soulève, on lâche, ça rebondit.
   *
   * L'élévation dit que la barre est tenue avant de tomber — sans elle, la
   * chute part d'une position que rien n'explique. Le rebond dit qu'elle est
   * lourde et qu'elle retombe, pas qu'elle se colle au sol.
   */
  it('soulève la barre avant la chute, et la fait rebondir après le choc', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const drop = stylesheet.slice(
      stylesheet.indexOf('@keyframes boot-drop'),
      stylesheet.indexOf('@keyframes boot-impact-shake'),
    );

    const frames = [...drop.matchAll(/([\d.]+)%\s*{([^}]*)}/g)].map(([, at, body]) => ({
      at: Number(at ?? ''),
      lift: Number(/translateY\((-?[\d.]+)px\)/.exec(body ?? '')?.[1] ?? 0),
    }));

    const IMPACT = 53.333;
    expect(frames.some((frame) => frame.at < IMPACT && frame.lift < 0)).toBe(true);
    expect(frames.some((frame) => frame.at > IMPACT && frame.lift < 0)).toBe(true);
    // Le rebond reste plus petit que l'élévation : une barre chargée ne remonte
    // pas d'où elle vient.
    const lift = Math.min(...frames.filter((f) => f.at < IMPACT).map((f) => f.lift));
    const bounce = Math.min(...frames.filter((f) => f.at > IMPACT).map((f) => f.lift));
    expect(bounce).toBeGreaterThan(lift);
  });

  it('starts the impact layers on the barbell contact frame', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const bootStyles = stylesheet.slice(stylesheet.indexOf(" * L'ouverture de l'app."));

    expect(bootStyles).toMatch(
      /@keyframes boot-drop\s*{.*?53\.333%\s*{[^}]*translateY\(0\) scaleX\(1\.06\) scaleY\(0\.82\)/s,
    );

    for (const animationName of [
      'boot-impact-shake',
      'boot-ground-reveal',
      'boot-dust-l',
      'boot-dust-r',
      'pop',
    ]) {
      expect(bootStyles).toMatch(new RegExp(`animation: ${animationName} [^;]* 1600ms both;`));
    }
  });
});
