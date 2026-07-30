import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LightboxModal from '../LightboxModal';

const photos = [
  { url: '/images/one.jpg', title: 'First Frame' },
  { url: '/images/two.jpg', title: 'Second Frame' },
];

describe('LightboxModal', () => {
  it('renders nothing when there is no active image', () => {
    const { container } = render(
      <LightboxModal activeImage="" activeIndex={0} imagesList={[]} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the active image with its title as alt text', () => {
    render(
      <LightboxModal activeImage="/images/one.jpg" activeIndex={0} imagesList={photos} onClose={vi.fn()} />
    );
    expect(screen.getByAltText('First Frame')).toBeInTheDocument();
  });

  it('shows the position counter when several images are supplied', () => {
    render(
      <LightboxModal activeImage="/images/one.jpg" activeIndex={0} imagesList={photos} onClose={vi.fn()} />
    );
    expect(screen.getByText('(1 / 2)')).toBeInTheDocument();
  });

  it('survives a prop change in both directions while staying mounted', () => {
    const onClose = vi.fn();
    const { rerender, container } = render(
      <LightboxModal activeImage="" activeIndex={0} imagesList={photos} onClose={onClose} />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <LightboxModal activeImage="/images/one.jpg" activeIndex={0} imagesList={photos} onClose={onClose} />
    );
    expect(screen.getByAltText('First Frame')).toBeInTheDocument();

    rerender(
      <LightboxModal activeImage="" activeIndex={0} imagesList={photos} onClose={onClose} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
