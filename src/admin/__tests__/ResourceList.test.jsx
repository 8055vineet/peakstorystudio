import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: ResourceList } = await import('../ResourceList.jsx');

// A fixture config, not one of the five real content tables — proves
// ResourceList is generic rather than accidentally shaped around
// testimonials. Deliberately includes a `date`-typed listColumn so the
// same test file also covers formatDateOnly reuse for display.
const CONFIG = {
  key: 'widgets',
  label: 'Widgets',
  table: 'widgets',
  columns: ['id', 'name', 'category', 'launch_date', 'sort_order', 'status'],
  defaultSort: 'sort_order',
  listColumns: [
    { name: 'name', label: 'Name' },
    { name: 'category', label: 'Category' },
    { name: 'launchDate', label: 'Launch Date' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'category', label: 'Category', type: 'text', required: false },
    { name: 'launchDate', label: 'Launch Date', type: 'date', required: false },
    { name: 'sortOrder', label: 'Order', type: 'number', required: false },
  ],
};

const ITEMS = [
  {
    id: 'w-1', name: 'Alpha', category: 'A', launchDate: '2026-01-05', sortOrder: 0, status: 'draft',
  },
  {
    id: 'w-2', name: 'Beta', category: 'B', launchDate: '2026-02-10', sortOrder: 1, status: 'published',
  },
  {
    id: 'w-3', name: 'Gamma', category: 'C', launchDate: null, sortOrder: 2, status: 'draft',
  },
];

function baseProps(overrides = {}) {
  return {
    config: CONFIG,
    items: ITEMS,
    status: 'ready',
    error: null,
    onEdit: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onToggleStatus: vi.fn(),
    onReorder: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
}

describe('ResourceList', () => {
  it('renders one row per item, in listColumns order, using listColumns labels as headers', () => {
    render(<ResourceList {...baseProps()} />);

    const table = screen.getByRole('table');
    const headerCells = within(table).getAllByRole('columnheader').map((th) => th.textContent);
    expect(headerCells).toEqual(expect.arrayContaining(['Name', 'Category', 'Launch Date', 'Status']));

    const rows = within(table).getAllByRole('row');
    // One header row plus one per item.
    expect(rows).toHaveLength(ITEMS.length + 1);
    expect(within(rows[1]).getByText('Alpha')).toBeInTheDocument();
    expect(within(rows[1]).getByText('A')).toBeInTheDocument();
  });

  it('formats a date-typed listColumn with formatDateOnly rather than a raw ISO string', () => {
    render(<ResourceList {...baseProps()} />);

    expect(screen.getByText('Jan 5, 2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-01-05')).not.toBeInTheDocument();
  });

  it('shows a placeholder rather than blank for a null value', () => {
    render(<ResourceList {...baseProps()} />);

    const table = screen.getByRole('table');
    const gammaRow = within(table).getByText('Gamma').closest('tr');
    expect(within(gammaRow).getByText('—')).toBeInTheDocument();
  });

  it('the status toggle calls back with the opposite status', async () => {
    const onToggleStatus = vi.fn();
    const user = userEvent.setup();
    render(<ResourceList {...baseProps({ onToggleStatus })} />);

    const table = screen.getByRole('table');
    const alphaRow = within(table).getByText('Alpha').closest('tr');
    await user.click(within(alphaRow).getByRole('button', { name: /draft/i }));
    expect(onToggleStatus).toHaveBeenCalledWith('w-1', 'published');

    const betaRow = within(table).getByText('Beta').closest('tr');
    await user.click(within(betaRow).getByRole('button', { name: /published/i }));
    expect(onToggleStatus).toHaveBeenCalledWith('w-2', 'draft');
  });

  describe('reorder', () => {
    it('calls onReorder with the full new id order when a row moves down', async () => {
      const onReorder = vi.fn();
      const user = userEvent.setup();
      render(<ResourceList {...baseProps({ onReorder })} />);

      const table = screen.getByRole('table');
      const alphaRow = within(table).getByText('Alpha').closest('tr');
      await user.click(within(alphaRow).getByRole('button', { name: /move down/i }));

      expect(onReorder).toHaveBeenCalledWith(['w-2', 'w-1', 'w-3']);
    });

    it('calls onReorder with the full new id order when a row moves up', async () => {
      const onReorder = vi.fn();
      const user = userEvent.setup();
      render(<ResourceList {...baseProps({ onReorder })} />);

      const table = screen.getByRole('table');
      const gammaRow = within(table).getByText('Gamma').closest('tr');
      await user.click(within(gammaRow).getByRole('button', { name: /move up/i }));

      expect(onReorder).toHaveBeenCalledWith(['w-1', 'w-3', 'w-2']);
    });

    it('disables moving the first row up and the last row down', () => {
      render(<ResourceList {...baseProps()} />);

      const table = screen.getByRole('table');
      const alphaRow = within(table).getByText('Alpha').closest('tr');
      const gammaRow = within(table).getByText('Gamma').closest('tr');

      expect(within(alphaRow).getByRole('button', { name: /move up/i })).toBeDisabled();
      expect(within(gammaRow).getByRole('button', { name: /move down/i })).toBeDisabled();
    });

    it('renders rows ordered by config.defaultSort even if `items` arrives unsorted', () => {
      const shuffled = [ITEMS[2], ITEMS[0], ITEMS[1]];
      render(<ResourceList {...baseProps({ items: shuffled })} />);

      const table = screen.getByRole('table');
      const rows = within(table).getAllByRole('row').slice(1); // drop header
      expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
    });
  });

  describe('delete', () => {
    let confirmSpy;

    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm');
    });

    afterEach(() => {
      confirmSpy.mockRestore();
    });

    it('asks for confirmation and does nothing if declined', async () => {
      confirmSpy.mockReturnValue(false);
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(<ResourceList {...baseProps({ onDelete })} />);

      const table = screen.getByRole('table');
      const alphaRow = within(table).getByText('Alpha').closest('tr');
      await user.click(within(alphaRow).getByRole('button', { name: /delete/i }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(onDelete).not.toHaveBeenCalled();
    });

    it('deletes the item once confirmation is accepted', async () => {
      confirmSpy.mockReturnValue(true);
      const onDelete = vi.fn();
      const user = userEvent.setup();
      render(<ResourceList {...baseProps({ onDelete })} />);

      const table = screen.getByRole('table');
      const alphaRow = within(table).getByText('Alpha').closest('tr');
      await user.click(within(alphaRow).getByRole('button', { name: /delete/i }));

      expect(onDelete).toHaveBeenCalledWith('w-1');
    });
  });

  it('calls onCreate when "Add New" is used', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<ResourceList {...baseProps({ onCreate })} />);

    await user.click(screen.getByRole('button', { name: /add new/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('calls onEdit with the full item when a row is edited', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<ResourceList {...baseProps({ onEdit })} />);

    const table = screen.getByRole('table');
    const betaRow = within(table).getByText('Beta').closest('tr');
    await user.click(within(betaRow).getByRole('button', { name: /^edit$/i }));

    expect(onEdit).toHaveBeenCalledWith(ITEMS[1]);
  });

  it('shows a distinct load-error state with a retry control — not the empty state', () => {
    render(<ResourceList {...baseProps({
      items: [], status: 'error', error: new Error('permission denied'),
    })}
    />);

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // A broken screen must never read as "no content yet" — the studio
    // needs to be able to tell its own site is actually empty apart from
    // this screen having failed to load it.
    expect(screen.queryByText(/no widgets yet/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the retry control is clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ResourceList {...baseProps({
      items: [], status: 'error', error: new Error('boom'), onRetry,
    })}
    />);

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('still shows the error state even if items happen to be non-empty', () => {
    // Mirrors LeadsTable/MediaPicker: useResource keeps the last known-good
    // list around through a failed reload, so status must win over items.
    render(<ResourceList {...baseProps({ status: 'error', error: new Error('boom') })} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows a loading state when status is loading and no items are held yet', () => {
    render(<ResourceList {...baseProps({ items: [], status: 'loading' })} />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows a distinct empty state when there are no items — not the error state', () => {
    render(<ResourceList {...baseProps({ items: [], status: 'ready' })} />);

    expect(screen.getByText(/no widgets yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('thumbnail column', () => {
  const THUMB_CONFIG = {
    ...CONFIG,
    thumbnailColumn: 'media_id',
  };
  // `/images/...` passes through mediaUrl() untouched — no env stubbing.
  const THUMB_ITEMS = [
    { ...ITEMS[0], thumbnailPath: '/images/test/alpha.jpg' },
    { ...ITEMS[1], thumbnailPath: null },
  ];

  it('renders a leading photo cell per row when the config declares thumbnailColumn', () => {
    const { container } = render(
      <ResourceList {...baseProps({ config: THUMB_CONFIG, items: THUMB_ITEMS })} />,
    );
    const images = container.querySelectorAll('tbody img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toBe('/images/test/alpha.jpg');
    // The null-path row still gets its (empty) cell so columns line up.
    expect(container.querySelectorAll('tbody tr')[0].querySelectorAll('td')).toHaveLength(
      container.querySelectorAll('tbody tr')[1].querySelectorAll('td').length,
    );
  });

  it('renders no photo column at all without thumbnailColumn (testimonials)', () => {
    const { container } = render(<ResourceList {...baseProps()} />);
    expect(container.querySelectorAll('tbody img')).toHaveLength(0);
  });
});
