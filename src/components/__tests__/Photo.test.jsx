import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Photo from '../Photo';

describe('Photo', () => {
  it('renders a real image when the source resolves', () => {
    render(<Photo src="/images/a.jpg" alt="A couple" className="aspect-square" loading="lazy" />);
    const img = screen.getByAltText('A couple');
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/images/a.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.className).toContain('aspect-square');
  });

  it('renders a same-sized placeholder instead of a broken image when the source is empty', () => {
    render(<Photo src="" alt="A couple" className="aspect-square w-full" />);
    expect(screen.queryByRole('img')).toBeNull();
    const placeholder = screen.getByTestId('photo-placeholder');
    // The caller's sizing classes carry over, so the layout keeps its shape.
    expect(placeholder.className).toContain('aspect-square');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
  });

  it('passes stored dimensions through as width/height so the browser reserves the space before the bytes arrive', () => {
    render(<Photo src="/images/a.jpg" alt="A couple" width={2000} height={765} />);
    const img = screen.getByAltText('A couple');
    expect(img).toHaveAttribute('width', '2000');
    expect(img).toHaveAttribute('height', '765');
  });

  it('gives the placeholder the same aspect ratio the photograph would have had', () => {
    render(<Photo src="" width={2000} height={765} className="w-full" />);
    expect(screen.getByTestId('photo-placeholder').style.getPropertyValue('aspect-ratio')).toBe('2000 / 765');
  });

  it('leaves the placeholder unsized when no dimensions are known', () => {
    render(<Photo src="" className="w-full" />);
    expect(screen.getByTestId('photo-placeholder').style.getPropertyValue('aspect-ratio')).toBe('');
  });

  it('treats a null or undefined source the same way', () => {
    const { rerender } = render(<Photo src={null} className="h-10" />);
    expect(screen.getByTestId('photo-placeholder')).toBeInTheDocument();
    rerender(<Photo src={undefined} className="h-10" />);
    expect(screen.getByTestId('photo-placeholder')).toBeInTheDocument();
  });
});
