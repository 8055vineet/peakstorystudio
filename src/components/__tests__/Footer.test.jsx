import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

const renderFooter = () => render(<MemoryRouter><Footer /></MemoryRouter>);

describe('Footer', () => {
  it('shows the real Lucknow contact details', () => {
    renderFooter();
    expect(screen.getByText(/2\/231 Vastu Khand, Gomtinagar, Lucknow, UP/)).toBeInTheDocument();
    expect(screen.getByText(/peakstorystudio@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByText(/\+91 8881621021/)).toBeInTheDocument();
  });

  it('links WhatsApp but leaves unset social networks unlinked', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href', expect.stringContaining('wa.me/918881621021'),
    );
    expect(screen.queryByRole('link', { name: /instagram/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /youtube/i })).toBeNull();
  });

  it('names the three service marks', () => {
    renderFooter();
    expect(screen.getByText(/wedding films/i)).toBeInTheDocument();
    expect(screen.getByText(/professional photography/i)).toBeInTheDocument();
    expect(screen.getByText(/online delivery/i)).toBeInTheDocument();
  });
});
