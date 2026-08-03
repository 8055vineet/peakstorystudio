import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreatedDraftBanner from '../CreatedDraftBanner.jsx';

describe('CreatedDraftBanner', () => {
  it('names the created record and offers publish and dismiss', () => {
    const onPublish = vi.fn();
    const onDismiss = vi.fn();
    render(<CreatedDraftBanner label="A Palace Wedding" onPublish={onPublish} onDismiss={onDismiss} publishing={false} />);

    expect(screen.getByRole('status')).toHaveTextContent('Saved as draft — publish when ready: A Palace Wedding');
    fireEvent.click(screen.getByRole('button', { name: /publish now/i }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /keep as draft/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('disables and relabels the publish button while publishing', () => {
    render(<CreatedDraftBanner label="" onPublish={vi.fn()} onDismiss={vi.fn()} publishing />);
    const button = screen.getByRole('button', { name: /publishing…/i });
    expect(button).toBeDisabled();
  });
});
