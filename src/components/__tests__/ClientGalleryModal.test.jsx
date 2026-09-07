import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render, screen, waitFor, act,
} from '@testing-library/react';

const getClientGalleries = vi.fn();
vi.mock('../../lib/queries/clientGalleries', () => ({
  getClientGalleries: (...args) => getClientGalleries(...args),
}));

const { default: ClientGalleryModal } = await import('../ClientGalleryModal.jsx');

const USER = { role: 'client', name: 'Pragya & Family', code: 'PSS-4K7Q2M' };
const GALLERIES = [
  {
    id: 'g-1', title: "Pragya's Wedding", coupleLabel: 'Pragya & Family', description: 'All 412 edited photographs', driveUrl: 'https://drive.google.com/drive/folders/abc',
  },
  {
    id: 'g-2', title: 'Haldi & Mehendi', coupleLabel: 'Pragya & Family', description: null, driveUrl: 'https://drive.google.com/drive/folders/def',
  },
];

beforeEach(() => {
  getClientGalleries.mockReset();
});

describe('ClientGalleryModal', () => {
  it('fetches the signed-in code and renders a Drive link per delivery, opening in a new tab', async () => {
    getClientGalleries.mockResolvedValue(GALLERIES);
    render(<ClientGalleryModal isOpen user={USER} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Pragya's Wedding")).toBeInTheDocument());
    expect(getClientGalleries).toHaveBeenCalledWith('PSS-4K7Q2M');
    expect(screen.getByText('All 412 edited photographs')).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: /open in google drive/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', 'https://drive.google.com/drive/folders/abc');
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(links[0].getAttribute('rel')).toContain('noreferrer');
  });

  it('shows the being-prepared empty state when the code unlocks nothing yet', async () => {
    getClientGalleries.mockResolvedValue([]);
    render(<ClientGalleryModal isOpen user={USER} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/being prepared/i)).toBeInTheDocument());
  });

  it('shows an error state with retry when the lookup fails', async () => {
    getClientGalleries.mockRejectedValueOnce(new Error('network down'));
    getClientGalleries.mockResolvedValueOnce(GALLERIES);
    render(<ClientGalleryModal isOpen user={USER} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i));
    screen.getByRole('button', { name: /retry/i }).click();
    await waitFor(() => expect(screen.getByText("Pragya's Wedding")).toBeInTheDocument());
  });

  it('does not leak an unhandled rejection when Retry fails again — the error state simply stays', async () => {
    getClientGalleries.mockRejectedValue(new Error('still down'));
    render(<ClientGalleryModal isOpen user={USER} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i));

    // useClientAccess.lookup rethrows after recording the error (AuthModal
    // needs the throw), so a Retry click that does not catch it surfaces as
    // an unhandled rejection. Node only reports one of those to whoever is
    // listening on `process` — vitest normally — so the runner's listeners
    // are parked for the duration of this test and a capturing one put in
    // their place, the same way ResourceForm.test.jsx captures a
    // window 'error' event to observe an uncaught throw directly.
    const runnerListeners = process.listeners('unhandledRejection');
    runnerListeners.forEach((listener) => process.off('unhandledRejection', listener));
    const leaked = [];
    const capture = (reason) => { leaked.push(reason); };
    process.on('unhandledRejection', capture);
    try {
      screen.getByRole('button', { name: /retry/i }).click();
      await waitFor(() => expect(getClientGalleries).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i));
      // 'unhandledRejection' fires once the microtask queue drains — give
      // it a macrotask so a leak has actually had the chance to surface.
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
    } finally {
      process.off('unhandledRejection', capture);
      runnerListeners.forEach((listener) => process.on('unhandledRejection', listener));
    }

    expect(leaked).toEqual([]);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders nothing when closed or with no user', () => {
    const { container } = render(<ClientGalleryModal isOpen={false} user={USER} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    const second = render(<ClientGalleryModal isOpen user={null} onClose={vi.fn()} />);
    expect(second.container.firstChild).toBeNull();
    expect(getClientGalleries).not.toHaveBeenCalled();
  });
});
