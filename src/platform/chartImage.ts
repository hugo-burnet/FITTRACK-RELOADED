/**
 * Getting a **chart** out of the app — the third door, next to `share.ts`
 * (text) and `saveFile.ts` (a file of text).
 *
 * Three problems separate an on-screen chart from a shareable image, and each
 * one is solved here rather than at the call site:
 *
 * 1. **The colours are variables.** Every mark is painted with
 *    `var(--accent-data)`, resolved by the stylesheet of the page. An `<svg>`
 *    loaded into an `<img>` is a document of its own, with no stylesheet and
 *    therefore no variables: unresolved, everything renders black on black.
 *    So the styles the browser actually computed are read off the live nodes
 *    and written back as attributes on the copy.
 * 2. **A chart alone says nothing.** Twelve bars with no title, no unit and no
 *    date is a picture nobody can read back in three months. The image is
 *    composed: a title, a reading, the chart, and the day it was exported.
 * 3. **Transparency.** A PNG with no background is unreadable in half the apps
 *    it lands in — the chart is drawn for a dark theme and pasted onto white.
 *    The surface colour is painted first, always.
 *
 * The rasterizing itself (`<img>` + `<canvas>`) is the one part no test can
 * reach under jsdom, so it is kept to a handful of lines and everything that
 * can be decided as a string is decided as a string.
 */

/** The paints an exported image needs, read off the live theme by the caller. */
export interface ChartImagePalette {
  background: string;
  ink: string;
  muted: string;
}

export interface ChartImageContent {
  title: string;
  /** The reading under the title — the value the chart is currently showing. */
  subtitle?: string;
  /** « Exporté le 22 août 2026 », at the foot. */
  footer: string;
}

/** The attributes an `<img>`-loaded SVG cannot inherit from the page. */
const PAINTED_PROPERTIES = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
] as const;

const PADDING = 24;
const TITLE_HEIGHT = 30;
const SUBTITLE_HEIGHT = 24;
const FOOTER_HEIGHT = 28;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The chart's own box, from its `viewBox` — never from `getBoundingClientRect`.
 *
 * The rectangle on screen depends on the phone; the viewBox is the drawing's
 * own coordinate system, which is what the copy has to be laid out in.
 */
export function chartViewBox(svg: SVGSVGElement): { width: number; height: number } {
  const [, , width, height] = (svg.getAttribute('viewBox') ?? '')
    .split(/[\s,]+/)
    .map(Number);

  return Number.isFinite(width) && Number.isFinite(height) && width! > 0 && height! > 0
    ? { width: width!, height: height! }
    : { width: 300, height: 120 };
}

/**
 * A copy of the chart with every computed paint written down.
 *
 * Walked in parallel — original and clone, same order — because a clone has no
 * computed style of its own until it is in a document, and putting it in one
 * to read it back is a layout the phone would pay for.
 */
export function inlineChartPaints(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];

  originals.forEach((original, index) => {
    const copy = copies[index];
    if (copy === undefined || !(original instanceof Element)) return;

    const computed = getComputedStyle(original);
    for (const property of PAINTED_PROPERTIES) {
      const value = computed.getPropertyValue(property).trim();
      // `none`, `0` and `1` are meaningful; an empty string is jsdom or a
      // property the element does not carry, and writing it would paint black.
      if (value === '') continue;
      copy.setAttribute(property, value);
    }
  });

  return clone;
}

/**
 * The whole image, as one self-contained SVG document.
 *
 * A string rather than a DOM tree: this is what gets rasterized, what a test
 * can read, and what makes the composition — title, chart, date — reviewable
 * without a screenshot.
 */
export function composeChartImage(
  chart: string,
  box: { width: number; height: number },
  content: ChartImageContent,
  palette: ChartImagePalette,
): { markup: string; width: number; height: number } {
  const subtitleHeight = content.subtitle === undefined ? 0 : SUBTITLE_HEIGHT;
  const width = box.width + PADDING * 2;
  const height =
    box.height + PADDING * 2 + TITLE_HEIGHT + subtitleHeight + FOOTER_HEIGHT;
  const chartTop = PADDING + TITLE_HEIGHT + subtitleHeight;

  const subtitle =
    content.subtitle === undefined
      ? ''
      : `<text x="${PADDING}" y="${PADDING + TITLE_HEIGHT}" font-family="system-ui, sans-serif" font-size="14" fill="${palette.muted}">${escapeXml(content.subtitle)}</text>`;

  return {
    width,
    height,
    markup: [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="${width}" height="${height}" fill="${palette.background}"/>`,
      `<text x="${PADDING}" y="${PADDING + 16}" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="${palette.ink}">${escapeXml(content.title)}</text>`,
      subtitle,
      `<g transform="translate(${PADDING} ${chartTop})">${chart}</g>`,
      `<text x="${PADDING}" y="${height - PADDING + 6}" font-family="system-ui, sans-serif" font-size="12" fill="${palette.muted}">${escapeXml(content.footer)}</text>`,
      '</svg>',
    ].join(''),
  };
}

/** `fittrack-volume-2026-08-22.png` — the day it was exported, in local time. */
export function chartImageFileName(slug: string, at: number): string {
  const local = new Date(at - new Date(at).getTimezoneOffset() * 60_000);
  return `fittrack-${slug}-${local.toISOString().slice(0, 10)}.png`;
}

/**
 * The one part that needs a browser: SVG string → PNG bytes.
 *
 * Twice the size, because the destination is a phone screen and a 300-pixel
 * chart pasted into a conversation is a blurred chart.
 */
export async function rasterizeSvg(
  markup: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.width = width;
  image.height = height;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('SVG image failed to load'));
    image.src = source;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D context unavailable');
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('Canvas produced no image'));
      else resolve(blob);
    }, 'image/png');
  });
}

/** The whole road, from the chart on screen to the bytes of a PNG. */
export async function chartPngBlob(
  svg: SVGSVGElement,
  content: ChartImageContent,
  palette: ChartImagePalette,
): Promise<Blob> {
  const box = chartViewBox(svg);
  const painted = inlineChartPaints(svg);
  // The copy is laid out inside the composition, so it drops its own size and
  // keeps only its coordinate system.
  painted.removeAttribute('style');
  painted.setAttribute('width', String(box.width));
  painted.setAttribute('height', String(box.height));

  const { markup, width, height } = composeChartImage(
    new XMLSerializer().serializeToString(painted),
    box,
    content,
    palette,
  );

  return rasterizeSvg(markup, width, height);
}
