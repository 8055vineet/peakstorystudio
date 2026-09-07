import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CollectionPage from '../CollectionPage';

const renderAt = (slug, collections) =>
  render(
    <MemoryRouter initialEntries={[`/more/${slug}`]}>
      <Routes>
        <Route
          path="more/:slug"
          element={<CollectionPage collections={collections} loading={false} onOpenLightbox={vi.fn()} onOpenVideo={vi.fn()} />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('CollectionPage', () => {
  it('shows a quiet placeholder rather than a broken image for an unresolvable photo', () => {
    renderAt('travels', [{
      id: 'c-1', slug: 'travels', title: 'Travels', description: '',
      items: [{ id: 'i-1', url: '', videoEmbedUrl: null, caption: null }],
    }]);
    expect(screen.getByTestId('photo-placeholder')).toBeInTheDocument();
    expect(document.querySelector('img[src=""]')).toBeNull();
  });
});
