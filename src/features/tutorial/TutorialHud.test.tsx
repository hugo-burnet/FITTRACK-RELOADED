import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialHud, type TutorialHudProps } from './TutorialHud';

const boxAt = (top: number, height = 48): DOMRect =>
  ({
    top,
    right: 116,
    bottom: top + height,
    left: 16,
    width: 100,
    height,
    x: 16,
    y: top,
    toJSON: () => ({}),
  }) satisfies DOMRect;

const base: TutorialHudProps = {
  targetRect: null,
  index: 0,
  count: 1,
  label: 'Mission guidée',
  title: 'Découverte',
  instruction: 'Ouvre Planifier.',
  detail: 'Tu y trouveras tes routines.',
  advanceKind: 'event',
  dismissLabel: 'Passer cette mission',
  onContinue: vi.fn(),
  onDismiss: vi.fn(),
};

describe('TutorialHud', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ne rend Continuer que pour une étape manuelle', () => {
    const { rerender } = render(<TutorialHud {...base} advanceKind="event" />);
    expect(screen.queryByRole('button', { name: 'Continuer' })).toBeNull();

    rerender(<TutorialHud {...base} advanceKind="manual" />);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeVisible();
  });

  /*
   * Le détail est une réponse à une question qu'on ne pose pas encore. Ouvert
   * au montage, il poussait la consigne hors du panneau — et le panneau, lui,
   * couvrait la commande dont il parle.
   */
  it('replie le détail par défaut, même sans voix pour le porter', () => {
    render(<TutorialHud {...base} />);

    const toggle = screen.getByRole('button', { name: 'Lire le détail' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Ouvre Planifier.')).toBeVisible();
  });

  it('ouvre et referme le détail sur demande', async () => {
    render(<TutorialHud {...base} />);

    await userEvent.click(screen.getByRole('button', { name: 'Lire le détail' }));
    expect(screen.getByRole('button', { name: 'Masquer le détail' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Tu y trouveras tes routines.')).toBeVisible();
  });

  it('se pose à l’opposé de la cible', () => {
    vi.stubGlobal('innerHeight', 844);
    const { rerender } = render(<TutorialHud {...base} targetRect={boxAt(96)} />);
    expect(screen.getByRole('region', { name: 'Mission guidée' })).toHaveAttribute(
      'data-placement',
      'bottom',
    );

    rerender(<TutorialHud {...base} targetRect={boxAt(700)} />);
    expect(screen.getByRole('region', { name: 'Mission guidée' })).toHaveAttribute(
      'data-placement',
      'top',
    );
  });

  it('laisse la cible cliquable sous son cadre', async () => {
    const clicked = vi.fn();
    render(
      <>
        <button type="button" onClick={clicked}>
          Créer
        </button>
        <TutorialHud {...base} targetRect={boxAt(96)} />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));

    expect(clicked).toHaveBeenCalledOnce();
    expect(screen.getByRole('region', { name: 'Mission guidée' })).toHaveClass(
      'pointer-events-auto',
    );
  });

  /*
   * Une cible qui n'arrive pas est une impasse, pas une attente infinie. Le
   * panneau ne lit alors aucune consigne — il dirait « appuie sur ce bouton »
   * devant un écran qui n'en a pas — et finit par proposer une sortie.
   */
  it('se tait quand la commande décrite n’est pas là, puis propose une issue', async () => {
    vi.useFakeTimers();
    try {
      const retry = vi.fn();
      render(<TutorialHud {...base} awaitingTarget onRetry={retry} />);

      expect(screen.queryByText('Ouvre Planifier.')).toBeNull();
      expect(screen.getByText('Recherche de la commande sur cet écran…')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000);
      });

      expect(screen.getByText('La commande n’est pas apparue sur cet écran.')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Passer cette mission' })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it('n’affiche la progression que lorsqu’il y a plusieurs étapes', () => {
    const { rerender, container } = render(<TutorialHud {...base} count={1} />);
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(0);
    expect(screen.getByText('1 / 1')).toBeVisible();

    rerender(<TutorialHud {...base} count={3} index={1} />);
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(3);
    expect(screen.getByText('2 / 3')).toBeVisible();
  });
});
