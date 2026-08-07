import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { default: ManagedList } = await import('../ManagedList.jsx');

const ITEMS = [
  { id: 'a', name: 'Pre-Wedding', sortOrder: 0 },
  { id: 'b', name: 'Wedding', sortOrder: 1 },
];

function baseProps(overrides = {}) {
  return {
    title: 'Manage categories',
    itemNoun: 'category',
    items: ITEMS,
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onReorder: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe('ManagedList', () => {
  it('lists items in sortOrder with rename, reorder, and delete controls', () => {
    render(<ManagedList {...baseProps()} />);
    expect(screen.getByText('Manage categories')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /rename/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /move down: pre-wedding/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move up: pre-wedding/i })).toBeDisabled();
  });

  it('adds a trimmed new item and clears the input; ignores blank', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    const input = screen.getByLabelText(/new category/i);
    await user.type(input, '  Travel Diaries  ');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(props.onAdd).toHaveBeenCalledWith('Travel Diaries');
    expect(input).toHaveValue('');
    await user.click(screen.getByRole('button', { name: /^add$/i }));
    expect(props.onAdd).toHaveBeenCalledTimes(1);
  });

  it('renames inline: Rename → edit → Save calls onRename with the item and new name', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    await user.click(screen.getAllByRole('button', { name: /rename/i })[0]);
    const editInput = screen.getByDisplayValue('Pre-Wedding');
    await user.clear(editInput);
    await user.type(editInput, 'Pre Wedding Shoots');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(props.onRename).toHaveBeenCalledWith(ITEMS[0], 'Pre Wedding Shoots');
  });

  it('cancel abandons the rename without calling onRename', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    await user.click(screen.getAllByRole('button', { name: /rename/i })[0]);
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(props.onRename).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Pre-Wedding')).toBeNull();
  });

  it('reorders via arrows', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    await user.click(screen.getByRole('button', { name: /move down: pre-wedding/i }));
    expect(props.onReorder).toHaveBeenCalledWith(['b', 'a']);
  });

  it('deletes only after confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const props = baseProps();
    render(<ManagedList {...props} />);
    await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(props.onDelete).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
    await user.click(screen.getAllByRole('button', { name: /delete/i })[0]);
    expect(props.onDelete).toHaveBeenCalledWith(ITEMS[0]);
    confirmSpy.mockRestore();
  });

  it('shows the action error as an alert', () => {
    render(<ManagedList {...baseProps({ actionError: { message: 'Cannot delete "Wedding" — 24 photograph(s) still use it.' } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/24 photograph/);
  });

  it('shows the load-error state with a retry control', async () => {
    const user = userEvent.setup();
    const props = baseProps({ items: [], status: 'error', error: new Error('denied') });
    render(<ManagedList {...props} />);
    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
