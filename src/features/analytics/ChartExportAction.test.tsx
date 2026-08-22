import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { chartPngBlobMock, saveBlobFileMock } = vi.hoisted(() => ({
  chartPngBlobMock: vi.fn(),
  saveBlobFileMock: vi.fn(),
}));

vi.mock('@/platform/chartImage', async () => {
  const actual = await vi.importActual<typeof import('@/platform/chartImage')>(
    '@/platform/chartImage',
  );
  return { ...actual, chartPngBlob: chartPngBlobMock };
});

vi.mock('@/platform/saveFile', () => ({ saveBlobFile: saveBlobFileMock }));

import { ChartExportAction } from './ChartExportAction';

function renderAction(withChart = true) {
  const chartRef = createRef<HTMLDivElement>();
  render(
    <div>
      <div ref={chartRef}>
        {withChart && (
          <svg viewBox="0 0 300 120" role="img" aria-label="graphique">
            <rect />
          </svg>
        )}
      </div>
      <ChartExportAction
        chartRef={chartRef}
        slug="volume"
        title="Volume d’entraînement"
        subtitle="12 dernières semaines · Tonnage"
      />
    </div>,
  );
}

describe('ChartExportAction', () => {
  beforeEach(() => {
    chartPngBlobMock.mockReset().mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    saveBlobFileMock.mockReset().mockResolvedValue('downloaded');
  });

  it('carries the title, the reading and the day into the image', async () => {
    renderAction();

    await userEvent.click(screen.getByRole('button', { name: 'Exporter en image' }));

    const [, content] = chartPngBlobMock.mock.calls[0] as [
      SVGSVGElement,
      { title: string; subtitle?: string; footer: string },
    ];
    expect(content.title).toBe('Volume d’entraînement');
    expect(content.subtitle).toBe('12 dernières semaines · Tonnage');
    expect(content.footer).toMatch(/^FitTrack · exporté le /);
  });

  it('names the file after the chart, and says where it went', async () => {
    renderAction();

    await userEvent.click(screen.getByRole('button', { name: 'Exporter en image' }));

    const [[payload]] = saveBlobFileMock.mock.calls as [[{ name: string; title: string }]];
    expect(payload.name).toMatch(/^fittrack-volume-\d{4}-\d{2}-\d{2}\.png$/);
    expect(await screen.findByRole('status')).toHaveTextContent('Image téléchargée.');
  });

  it('stays silent when the share sheet is simply closed', async () => {
    saveBlobFileMock.mockResolvedValue('cancelled');
    renderAction();

    await userEvent.click(screen.getByRole('button', { name: 'Exporter en image' }));

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reports a rasterizing failure instead of pretending it worked', async () => {
    chartPngBlobMock.mockRejectedValue(new Error('canvas unavailable'));
    renderAction();

    await userEvent.click(screen.getByRole('button', { name: 'Exporter en image' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'L’image n’a pas pu être créée.',
    );
  });

  it('does nothing at all when there is no chart to export', async () => {
    renderAction(false);

    await userEvent.click(screen.getByRole('button', { name: 'Exporter en image' }));

    expect(chartPngBlobMock).not.toHaveBeenCalled();
    expect(saveBlobFileMock).not.toHaveBeenCalled();
  });
});
