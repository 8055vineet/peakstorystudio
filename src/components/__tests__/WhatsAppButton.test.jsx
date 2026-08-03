import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('WhatsAppButton', () => {
  beforeEach(() => vi.resetModules());

  it('links to wa.me with the confirmed studio number and an encoded message', async () => {
    const { default: WhatsAppButton } = await import('../WhatsAppButton.jsx');
    render(<WhatsAppButton message="Hello there" />);

    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/918881621021?text=Hello%20there');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders nothing should the number ever be unset again', async () => {
    vi.doMock('../../data/contact', () => ({ WHATSAPP_NUMBER: '' }));
    const { default: WhatsAppButton } = await import('../WhatsAppButton.jsx');
    const { container } = render(<WhatsAppButton />);
    expect(container).toBeEmptyDOMElement();
    vi.doUnmock('../../data/contact');
  });
});
