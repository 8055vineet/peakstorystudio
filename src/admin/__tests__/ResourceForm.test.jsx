import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listMedia = vi.fn();
vi.mock('../../lib/queries/media', () => ({
  listMedia: (...args) => listMedia(...args),
}));

// UploadField's own pipeline is already proven by
// src/hooks/__tests__/useMediaUpload.test.jsx and exercised again in
// UploadField.test.jsx — mocked wholesale here for the same reason
// App.test.jsx mocks it: this file is about ResourceForm's wiring of the
// `media` field type, not the upload pipeline itself.
const useMediaUpload = vi.fn();
vi.mock('../../hooks/useMediaUpload', () => ({
  useMediaUpload: (...args) => useMediaUpload(...args),
}));

const { default: ResourceForm } = await import('../ResourceForm.jsx');

// A fixture config, not one of the five real content tables — proves
// ResourceForm is generic. Covers every field `type` the contract defines:
// text, textarea, date, number, select, tags, and media.
const CONFIG = {
  key: 'widgets',
  label: 'Widgets',
  table: 'widgets',
  columns: [
    'id', 'name', 'category', 'description', 'launch_date', 'weight', 'cover_media_id', 'tags', 'sort_order', 'status',
  ],
  defaultSort: 'sort_order',
  listColumns: [
    { name: 'name', label: 'Name' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      required: true,
      options: [{ value: 'a', label: 'Category A' }, { value: 'b', label: 'Category B' }],
    },
    { name: 'description', label: 'Description', type: 'textarea', required: false },
    { name: 'launchDate', label: 'Launch Date', type: 'date', required: false },
    { name: 'weight', label: 'Weight', type: 'number', required: false },
    { name: 'coverMediaId', label: 'Cover Photo', type: 'media', required: false },
    { name: 'tags', label: 'Tags', type: 'tags', required: false },
  ],
};

// A config with no `media` field, used to prove ResourceForm never fetches
// the media library for a resource that has no use for it — the same "not
// fetched until asked for" discipline App.test.jsx proves for the Media
// Library tab.
const CONFIG_NO_MEDIA = {
  ...CONFIG,
  fields: CONFIG.fields.filter((field) => field.type !== 'media'),
};

const MEDIA_ITEMS = [
  {
    id: 'media-1', storagePath: 'uploads/one.webp', width: 800, height: 600, altText: 'A couple at dusk.', blurhash: null, createdAt: '2026-08-01T10:00:00Z',
  },
];

beforeEach(() => {
  listMedia.mockReset();
  listMedia.mockResolvedValue(MEDIA_ITEMS);
  useMediaUpload.mockReset();
  useMediaUpload.mockReturnValue({
    status: 'idle', progress: 0, error: null, upload: vi.fn(), reset: vi.fn(),
  });
});

function baseProps(overrides = {}) {
  return {
    config: CONFIG,
    initial: null,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    pending: false,
    error: null,
    ...overrides,
  };
}

describe('ResourceForm', () => {
  it('renders a labelled control for every field type', async () => {
    render(<ResourceForm {...baseProps()} />);

    expect(screen.getByLabelText(/^name/i)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText(/category/i).tagName).toBe('SELECT');
    expect(screen.getByLabelText(/description/i).tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText(/launch date/i)).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText(/weight/i)).toHaveAttribute('type', 'number');
    // The media field has no single input to label — it renders as a
    // fieldset/legend group embedding MediaPicker and UploadField instead.
    expect(screen.getByRole('group', { name: /cover photo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/photograph/i)).toHaveAttribute('type', 'file');
    await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
  });

  it('wires every label to its control with htmlFor/id', async () => {
    render(<ResourceForm {...baseProps()} />);

    ['Name', 'Category', 'Description', 'Launch Date', 'Weight'].forEach((text) => {
      const control = screen.getByLabelText(new RegExp(`^${text}`, 'i'));
      const label = document.querySelector(`label[for="${control.id}"]`);
      expect(label).not.toBeNull();
    });

    // Lets the media field's own useResource(listMedia) call resolve before
    // the test ends, so its state update lands inside act() rather than
    // dangling into whichever test runs next — same discipline
    // App.test.jsx's own module comment documents for this exact hazard.
    await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
  });

  it('does not fetch the media library for a resource with no media field', async () => {
    render(<ResourceForm {...baseProps({ config: CONFIG_NO_MEDIA })} />);

    expect(listMedia).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: /cover photo/i })).not.toBeInTheDocument();

    // The no-op stub queries object still resolves (to []) on mount — let
    // that settle inside act() too, even though nothing here depends on it.
    await waitFor(() => expect(listMedia).not.toHaveBeenCalled());
  });

  // Task 7 review: without a remount, ResourceForm must not let a record A's
  // edited-but-unsaved values survive into a submission that writes under
  // record B's id. The documented `key={initial?.id ?? 'new'}` guidance at
  // the call site is belt-and-braces, not the enforcement — this component
  // must be correct even when a call site forgets it.
  describe('when `initial` changes to a different record without remounting', () => {
    const RECORD_A = {
      id: 'record-a', name: 'Record A', category: 'a', description: '', launchDate: '', weight: null, coverMediaId: '', tags: [],
    };
    const RECORD_B = {
      id: 'record-b', name: 'Record B', category: 'b', description: '', launchDate: '', weight: null, coverMediaId: '', tags: [],
    };

    it("shows the new record's values instead of edits made to the previous one", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ResourceForm {...baseProps({ initial: RECORD_A })} />);

      await user.clear(screen.getByLabelText(/^name/i));
      await user.type(screen.getByLabelText(/^name/i), 'Edited but never saved');
      expect(screen.getByLabelText(/^name/i)).toHaveValue('Edited but never saved');

      rerender(<ResourceForm {...baseProps({ initial: RECORD_B })} />);

      // Must show record B's own value — never A's edited-but-unsaved text
      // under B's identity. Losing this means a submission would carry A's
      // field data but write it under B's id: one record silently
      // overwritten with another's content, on a live commercial site, with
      // no error anywhere.
      expect(screen.getByLabelText(/^name/i)).toHaveValue('Record B');
      await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
    });

    it('clears a validation error left over from the previous record', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<ResourceForm {...baseProps({
        initial: { ...RECORD_A, name: '' },
      })}
      />);

      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();

      rerender(<ResourceForm {...baseProps({ initial: RECORD_B })} />);

      expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
    });
  });

  describe('required fields', () => {
    it('blocks submission and shows an inline message when a required field is empty', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({ onSubmit })} />);

      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).not.toHaveBeenCalled();
      const nameField = screen.getByLabelText(/^name/i);
      expect(nameField).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(nameField.getAttribute('aria-describedby')).toBe(
        screen.getByText(/name is required/i).id,
      );
    });

    it('submits once every required field is filled', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({ onSubmit })} />);

      await user.type(screen.getByLabelText(/^name/i), 'Widget One');
      await user.selectOptions(screen.getByLabelText(/category/i), 'a');
      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Widget One',
        category: 'a',
        description: '',
        weight: null,
      }));
    });
  });

  describe('date field', () => {
    it('round-trips an initial ISO date unchanged into the input value', async () => {
      render(<ResourceForm {...baseProps({
        initial: {
          name: 'Existing', category: 'a', description: '', launchDate: '2026-01-05', weight: 3, coverMediaId: '',
        },
      })}
      />);

      expect(screen.getByLabelText(/launch date/i)).toHaveValue('2026-01-05');
      await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
    });

    it('submits the exact ISO string typed, with no timezone shift', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({
        initial: {
          name: 'Existing', category: 'a', description: '', launchDate: '', weight: null, coverMediaId: '',
        },
        onSubmit,
      })}
      />);

      // fireEvent rather than user.type: jsdom's <input type="date"> does not
      // support userEvent's per-character typing, and this is the one place
      // a Date object slipping in anywhere would show up — asserting a plain
      // input-change event round-trips proves the same thing more directly.
      const dateInput = screen.getByLabelText(/launch date/i);
      fireEvent.change(dateInput, { target: { value: '2026-12-31' } });
      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ launchDate: '2026-12-31' }));
    });

    it('leaves an existing ISO date exactly as-is when the form is submitted unchanged', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({
        initial: {
          name: 'Existing', category: 'a', description: '', launchDate: '2026-01-05', weight: 3, coverMediaId: '',
        },
        onSubmit,
      })}
      />);

      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ launchDate: '2026-01-05' }));
    });
  });

  describe('tags field', () => {
    it('renders a text control with help text explaining the comma format', async () => {
      render(<ResourceForm {...baseProps()} />);

      expect(screen.getByLabelText(/^tags/i)).toHaveAttribute('type', 'text');
      expect(screen.getByText(/comma-separated/i)).toBeInTheDocument();
      // weddings.tags is text[] with no escaping scheme — decided not worth
      // supporting a comma inside a single tag, so this is stated rather
      // than silently mangled if someone types one.
      expect(screen.getByText(/cannot itself contain a comma/i)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
    });

    it('round-trips an initial array of tags into a comma-separated value, unchanged on submit', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({
        initial: {
          name: 'Existing', category: 'a', description: '', launchDate: '', weight: null, coverMediaId: '', tags: ['Beach', 'Sunset'],
        },
        onSubmit,
      })}
      />);

      expect(screen.getByLabelText(/^tags/i)).toHaveValue('Beach, Sunset');

      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tags: ['Beach', 'Sunset'] }));
    });

    it('parses typed tags into a trimmed, de-duplicated array', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({ onSubmit })} />);

      await user.type(screen.getByLabelText(/^name/i), 'Widget One');
      await user.selectOptions(screen.getByLabelText(/category/i), 'a');
      await user.type(screen.getByLabelText(/^tags/i), ' Beach ,  Sunset ,Beach,');
      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tags: ['Beach', 'Sunset'] }));
    });

    it('submits an empty array, not [""], when the tags field is left blank', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({ onSubmit })} />);

      await user.type(screen.getByLabelText(/^name/i), 'Widget One');
      await user.selectOptions(screen.getByLabelText(/category/i), 'a');
      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ tags: [] }));
    });
  });

  describe('media field', () => {
    it('stores the selected item\'s id and includes it on submit', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({ onSubmit })} />);

      await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: /select/i }));

      await user.type(screen.getByLabelText(/^name/i), 'Widget One');
      await user.selectOptions(screen.getByLabelText(/category/i), 'a');
      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ coverMediaId: 'media-1' }));
    });

    it('sets the field from onUploaded when a new photograph is uploaded', async () => {
      const upload = vi.fn().mockResolvedValue({ id: 'media-new', storagePath: 'uploads/new.webp' });
      useMediaUpload.mockReturnValue({
        status: 'idle', progress: 0, error: null, upload, reset: vi.fn(),
      });
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<ResourceForm {...baseProps({ onSubmit })} />);

      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(screen.getByLabelText(/photograph/i), file);

      await user.type(screen.getByLabelText(/^name/i), 'Widget One');
      await user.selectOptions(screen.getByLabelText(/category/i), 'a');
      await user.click(screen.getByRole('button', { name: /^(save|create)/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ coverMediaId: 'media-new' }));
    });
  });

  it('calls onCancel when Cancel is used, without validating or submitting', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ResourceForm {...baseProps({ onSubmit, onCancel })} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the submit control while pending', async () => {
    render(<ResourceForm {...baseProps({ pending: true })} />);

    expect(screen.getByRole('button', { name: /^(save|create|saving)/i })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
  });

  it('shows a write-failure message from the error prop', async () => {
    render(<ResourceForm {...baseProps({ error: new Error('permission denied') })} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/permission denied/i);
    await waitFor(() => expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument());
  });
});
