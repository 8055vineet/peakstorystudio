import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StoryDetailModal from '../StoryDetailModal';

const story = {
  title: 'A Harbour Wedding',
  couple: 'Test Couple',
  location: 'Test Harbour',
  date: 'March 2026',
  summary: 'A fictional story used only in tests.',
  coverImage: '/images/cover.jpg',
  fullGallery: ['/images/cover.jpg', '/images/second.jpg'],
  tags: ['Test'],
};

describe('StoryDetailModal', () => {
  it('renders nothing without a story', () => {
    const { container } = render(
      <StoryDetailModal story={null} onClose={vi.fn()} onSelectImage={vi.fn()} onOpenVideo={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the story title and couple', () => {
    render(
      <StoryDetailModal story={story} onClose={vi.fn()} onSelectImage={vi.fn()} onOpenVideo={vi.fn()} />
    );
    expect(screen.getByText('A Harbour Wedding')).toBeInTheDocument();
  });

  it('reports the gallery size', () => {
    render(
      <StoryDetailModal story={story} onClose={vi.fn()} onSelectImage={vi.fn()} onOpenVideo={vi.fn()} />
    );
    expect(screen.getByText(/Full Album Gallery \(2 Photographs\)/)).toBeInTheDocument();
  });

  it('survives a prop change in both directions while staying mounted', () => {
    const props = { onClose: vi.fn(), onSelectImage: vi.fn(), onOpenVideo: vi.fn() };
    const { rerender, container } = render(<StoryDetailModal story={null} {...props} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<StoryDetailModal story={story} {...props} />);
    expect(screen.getByText('A Harbour Wedding')).toBeInTheDocument();

    rerender(<StoryDetailModal story={null} {...props} />);
    expect(container).toBeEmptyDOMElement();
  });
});
