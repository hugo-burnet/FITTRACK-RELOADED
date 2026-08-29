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
