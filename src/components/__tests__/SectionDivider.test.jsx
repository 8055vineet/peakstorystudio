import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SectionDivider from '../SectionDivider';

describe('SectionDivider', () => {
  it('applies the background colour to the wrapper and the wave colour to the path', () => {
    const { container } = render(
      <SectionDivider color="#faf9f6" bgColor="#ffffff" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveStyle({ backgroundColor: '#ffffff' });

    const path = container.querySelector('svg path');
    expect(path).toHaveAttribute('fill', '#faf9f6');
  });

  it('flips vertically only when the flip prop is set', () => {
    const { container: normal } = render(<SectionDivider />);
    expect(normal.firstChild).toHaveStyle({ transform: 'none' });

    const { container: flipped } = render(<SectionDivider flip />);
    expect(flipped.firstChild).toHaveStyle({ transform: 'scaleY(-1)' });
  });
});
