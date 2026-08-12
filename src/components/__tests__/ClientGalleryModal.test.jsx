import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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

  it('renders nothing when closed or with no user', () => {
    const { container } = render(<ClientGalleryModal isOpen={false} user={USER} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    const second = render(<ClientGalleryModal isOpen user={null} onClose={vi.fn()} />);
    expect(second.container.firstChild).toBeNull();
    expect(getClientGalleries).not.toHaveBeenCalled();
  });
});
