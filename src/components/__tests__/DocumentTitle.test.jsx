import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DocumentTitle from '../DocumentTitle';

const renderAt = (path, props = {}) =>
  render(<MemoryRouter initialEntries={[path]}><DocumentTitle {...props} /></MemoryRouter>);

describe('DocumentTitle', () => {
  it('keeps the full studio title on Home', () => {
    renderAt('/');
    expect(document.title).toBe('PEAK STORY STUDIO | Fine Art Wedding Photography & Cinematic Films');
  });

  it('names the section first and the studio last on every other page', () => {
    renderAt('/gallery');
    expect(document.title).toBe('Gallery | Peak Story Studio');
  });

  it('uses the collection title on a More page', () => {
    renderAt('/more/travels', { morePages: [{ slug: 'travels', title: 'Travels' }] });
    expect(document.title).toBe('Travels | Peak Story Studio');
  });

  it('labels an unknown route as not found', () => {
    renderAt('/nope');
    expect(document.title).toBe('Page not found | Peak Story Studio');
  });
});
