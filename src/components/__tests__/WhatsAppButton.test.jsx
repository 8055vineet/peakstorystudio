import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('WhatsAppButton', () => {
  beforeEach(() => vi.resetModules());

  it('renders nothing when no number is configured', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '');
    const { default: WhatsAppButton } = await import('../WhatsAppButton.jsx');
    const { container } = render(<WhatsAppButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to wa.me with the number and an encoded message', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '919820037027');
    const { default: WhatsAppButton } = await import('../WhatsAppButton.jsx');
    render(<WhatsAppButton message="Hello there" />);

    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/919820037027?text=Hello%20there');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
