import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PetalsBackground from '../PetalsBackground';

describe('PetalsBackground', () => {
  it('renders a fixed, non-interactive, aria-hidden layer of petals', () => {
    const { getByTestId } = render(<PetalsBackground />);
    const layer = getByTestId('petals-background');
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer.className).toContain('pointer-events-none');
    expect(layer.className).toContain('z-0');
    expect(layer.querySelectorAll('.petal')).toHaveLength(20);
  });

  it('randomizes petals but keeps every one inside sane bounds', () => {
    const { getByTestId } = render(<PetalsBackground />);
    for (const petal of getByTestId('petals-background').querySelectorAll('.petal')) {
      const left = parseFloat(petal.style.left);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(99);
      expect(parseFloat(petal.style.width)).toBeGreaterThan(0);
    }
  });
});
