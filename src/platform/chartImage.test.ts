import { describe, expect, it } from 'vitest';
import {
  chartImageFileName,
  chartViewBox,
  composeChartImage,
  inlineChartPaints,
} from './chartImage';

const PALETTE = { background: '#12110f', ink: '#f5f3f0', muted: '#a8a29a' };

function svgFrom(markup: string): SVGSVGElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  document.body.append(container);
  return container.querySelector('svg')!;
}

describe('chartViewBox', () => {
  it('reads the drawing’s own coordinate system, not the screen', () => {
    expect(chartViewBox(svgFrom('<svg viewBox="-6 -6 312 132"></svg>'))).toEqual({
      width: 312,
      height: 132,
    });
  });

  it('falls back on the standard box rather than on zero', () => {
    expect(chartViewBox(svgFrom('<svg></svg>'))).toEqual({ width: 300, height: 120 });
    expect(chartViewBox(svgFrom('<svg viewBox="0 0 0 0"></svg>'))).toEqual({
      width: 300,
      height: 120,
    });
  });
});

describe('inlineChartPaints', () => {
  it('writes the computed paint onto the copy, so the image is not black on black', () => {
    const svg = svgFrom('<svg viewBox="0 0 10 10"><rect style="fill: rgb(168, 90, 32)"/></svg>');

    const copy = inlineChartPaints(svg);

    expect(copy.querySelector('rect')?.getAttribute('fill')).toBe('rgb(168, 90, 32)');
  });

  it('leaves the chart on screen untouched', () => {
    const svg = svgFrom('<svg viewBox="0 0 10 10"><rect style="fill: rgb(1, 2, 3)"/></svg>');

    inlineChartPaints(svg);

    expect(svg.querySelector('rect')?.getAttribute('fill')).toBeNull();
  });
});

describe('composeChartImage', () => {
  const compose = (subtitle?: string) =>
    composeChartImage(
      '<svg viewBox="0 0 300 120"><rect fill="#a85a20"/></svg>',
      { width: 300, height: 120 },
      {
        title: 'Volume d’entraînement',
        ...(subtitle === undefined ? {} : { subtitle }),
        footer: 'Exporté le 22 août 2026',
      },
      PALETTE,
    );

  it('paints the background first: a transparent PNG is unreadable half the time', () => {
    const { markup, width, height } = compose();

    expect(markup).toContain(`<rect width="${width}" height="${height}" fill="#12110f"/>`);
    expect(markup.indexOf('fill="#12110f"')).toBeLessThan(markup.indexOf('#a85a20'));
  });

  it('carries the title, the reading and the date, so the image reads alone', () => {
    const { markup } = compose('Total · 12 000 kg');

    expect(markup).toContain('Volume d’entraînement');
    expect(markup).toContain('Total · 12 000 kg');
    expect(markup).toContain('Exporté le 22 août 2026');
  });

  it('gives the chart room without a subtitle it does not have', () => {
    expect(compose().height).toBeLessThan(compose('Total · 12 000 kg').height);
  });

  it('escapes the text rather than letting a name break the document', () => {
    const { markup } = composeChartImage(
      '',
      { width: 10, height: 10 },
      { title: 'Tirage <barre> & "prise"', footer: '' },
      PALETTE,
    );

    expect(markup).toContain('Tirage &lt;barre&gt; &amp; &quot;prise&quot;');
    expect(markup).not.toContain('<barre>');
  });
});

describe('chartImageFileName', () => {
  it('names the file after the chart and the local day', () => {
    expect(chartImageFileName('volume', new Date(2026, 7, 22, 23, 30).getTime())).toBe(
      'fittrack-volume-2026-08-22.png',
    );
  });
});
