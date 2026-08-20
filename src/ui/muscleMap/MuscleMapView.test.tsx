import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MuscleMap } from './MuscleMapView';

describe('MuscleMap', () => {
  it('nomme le muscle touché au lieu de laisser deviner la coordonnée', () => {
    const onSelectMuscle = vi.fn();
    const { container } = render(<MuscleMap highlight={{}} onSelectMuscle={onSelectMuscle} />);

    const path = container.querySelector('path[data-muscle="pectoralis_major"]');
    expect(path).not.toBeNull();
    fireEvent.click(path!);

    expect(onSelectMuscle).toHaveBeenCalledWith('pectoralis_major');
  });

  it('reste inerte quand personne n’écoute', () => {
    // Le corps est une lecture sur la plupart des écrans qui l'affichent : sans
    // gestionnaire, un pouce égaré ne doit rien déclencher — ni erreur, ni rien.
    const { container } = render(<MuscleMap highlight={{ chest: 1 }} />);

    const path = container.querySelector('path[data-muscle="pectoralis_major"]');
    expect(() => fireEvent.click(path!)).not.toThrow();
  });

  it('ignore le fond : la silhouette n’est pas un muscle', () => {
    const onSelectMuscle = vi.fn();
    const { container } = render(<MuscleMap highlight={{}} onSelectMuscle={onSelectMuscle} />);

    const silhouette = container.querySelector('path.silhouette');
    if (silhouette !== null) fireEvent.click(silhouette);

    expect(onSelectMuscle).not.toHaveBeenCalled();
  });

  it('suit le gestionnaire courant, pas celui de la première frame', () => {
    // La carte est construite une fois par vue ; un gestionnaire capturé à la
    // construction ferait parler le dessin à un état vieux d'une session.
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender } = render(<MuscleMap highlight={{}} onSelectMuscle={first} />);

    rerender(<MuscleMap highlight={{}} onSelectMuscle={second} />);
    fireEvent.click(container.querySelector('path[data-muscle="quadriceps"]')!);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('quadriceps');
  });
});
