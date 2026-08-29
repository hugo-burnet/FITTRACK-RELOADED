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

  it('anchors both dust clouds to the ground line', () => {
    const { container } = render(<BootScreen />);
    const particleY = [...container.querySelectorAll<SVGCircleElement>('.boot-dust circle')].map(
      (particle) => Number(particle.getAttribute('cy')),
    );
    const stylesheet = readFileSync('src/index.css', 'utf8');

    expect(particleY).toHaveLength(6);
    expect(particleY.every((cy) => cy >= 15.9 && cy <= 16.2)).toBe(true);
    expect(stylesheet).toMatch(/\.boot-dust--l\s*{[^}]*transform-origin:\s*9\.65px 16\.2px;/s);
    expect(stylesheet).toMatch(/\.boot-dust--r\s*{[^}]*transform-origin:\s*14\.35px 16\.2px;/s);
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

  it('starts the contact effects on the barbell contact frame', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const bootStyles = stylesheet.slice(stylesheet.indexOf(" * L'ouverture de l'app."));

    expect(bootStyles).toMatch(
      /@keyframes boot-drop\s*{.*?53\.333%\s*{[^}]*translateY\(0\) scaleX\(1\.06\) scaleY\(0\.82\)/s,
    );

    for (const animationName of [
      'boot-ground-reveal',
      'boot-dust-l',
      'boot-dust-r',
      'pop',
    ]) {
      expect(bootStyles).toMatch(new RegExp(`animation: ${animationName} [^;]* 1600ms both;`));
    }
  });

  it('gives the barbell one small rebound after ground contact', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const drop = stylesheet.slice(
      stylesheet.indexOf('@keyframes boot-drop'),
      stylesheet.indexOf('@keyframes boot-impact-shake'),
    );

    expect(drop).toMatch(/53\.333%\s*{[^}]*translateY\(0\)/s);
    expect(drop).toMatch(/70%\s*{[^}]*translateY\(-2px\)/s);
    expect(drop).toMatch(/84%\s*{[^}]*translateY\(0\)/s);
  });

  it('starts the shake only after the barbell has touched the ground', () => {
    const stylesheet = readFileSync('src/index.css', 'utf8');
    const bootStyles = stylesheet.slice(stylesheet.indexOf(" * L'ouverture de l'app."));
    const shake = stylesheet.slice(
      stylesheet.indexOf('@keyframes boot-impact-shake'),
      stylesheet.indexOf('@keyframes boot-ground-reveal'),
    );

    expect(bootStyles).toMatch(/\.boot-barbell\s*{[^}]*transform-origin:\s*center 16\.2px;/s);
    expect(bootStyles).toMatch(/animation: boot-impact-shake 360ms linear 1640ms both;/);
    expect(shake).toMatch(/0%,\s*10%,\s*100%\s*{[^}]*transform:\s*none;/s);
  });
});
