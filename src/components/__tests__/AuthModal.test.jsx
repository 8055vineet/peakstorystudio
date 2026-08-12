import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getClientGalleries = vi.fn();
vi.mock('../../lib/queries/clientGalleries', () => ({
  getClientGalleries: (...args) => getClientGalleries(...args),
}));

const { default: AuthModal } = await import('../AuthModal.jsx');

beforeEach(() => {
  getClientGalleries.mockReset();
});

describe('AuthModal — client sign-in (real check)', () => {
  it('signs in when the code unlocks at least one delivery, handing up the code', async () => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    const onClose = vi.fn();
    getClientGalleries.mockResolvedValue([
      { id: 'g-1', title: "Pragya's Wedding", coupleLabel: 'Pragya & Family', driveUrl: 'https://drive.google.com/x' },
    ]);
    render(<AuthModal isOpen onClose={onClose} onLoginSuccess={onLoginSuccess} />);

    await user.type(screen.getByLabelText(/access code/i), 'PSS-4K7Q2M');
    await user.click(screen.getByRole('button', { name: /open my galleries/i }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith({
      role: 'client', name: 'Pragya & Family', code: 'PSS-4K7Q2M',
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('refuses an unrecognised code with a message, and never signs in', async () => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    getClientGalleries.mockResolvedValue([]);
    render(<AuthModal isOpen onClose={vi.fn()} onLoginSuccess={onLoginSuccess} />);

    await user.type(screen.getByLabelText(/access code/i), 'WRONG-99');
    await user.click(screen.getByRole('button', { name: /open my galleries/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not recognised/i));
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('rejects a too-short code before ever calling the server', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen onClose={vi.fn()} onLoginSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/access code/i), 'abc');
    await user.click(screen.getByRole('button', { name: /open my galleries/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 6 characters/i);
    expect(getClientGalleries).not.toHaveBeenCalled();
  });

  it('says "try again" — not "wrong code" — when the lookup itself fails', async () => {
    const user = userEvent.setup();
    getClientGalleries.mockRejectedValue(new Error('network down'));
    render(<AuthModal isOpen onClose={vi.fn()} onLoginSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/access code/i), 'PSS-4K7Q2M');
    await user.click(screen.getByRole('button', { name: /open my galleries/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i));
  });
});

describe('AuthModal — studio tab', () => {
  it('links to the real admin app instead of rendering a fake form', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen onClose={vi.fn()} onLoginSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /studio/i }));

    const link = screen.getByRole('link', { name: /open the studio dashboard/i });
    expect(link).toHaveAttribute('href', '/admin.html');
    // The old theatre is gone: no email/password fields pretending to check anything.
    expect(screen.queryByLabelText(/email/i)).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
});
