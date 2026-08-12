import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../../supabase', () => ({
  supabase: { functions: { invoke: (...args) => invoke(...args) } },
}));

const { listTeam, createAdmin, removeAdmin, TeamError } = await import('../adminTeam.js');

beforeEach(() => invoke.mockReset());

const MEMBER = {
  userId: 'u-1', email: 'owner@studio.test', displayName: null, isOwner: true, createdAt: '2026-08-12T10:00:00Z',
};

describe('adminTeam', () => {
  it('listTeam invokes manage-team list and returns the members', async () => {
    invoke.mockResolvedValue({ data: { ok: true, members: [MEMBER] }, error: null });
    await expect(listTeam()).resolves.toEqual([MEMBER]);
    expect(invoke).toHaveBeenCalledWith('manage-team', { body: { action: 'list' } });
  });

  it('createAdmin sends email and password and returns the created member', async () => {
    const created = { ...MEMBER, userId: 'u-2', email: 'new@studio.test', isOwner: false };
    invoke.mockResolvedValue({ data: { ok: true, member: created }, error: null });
    await expect(createAdmin({ email: 'new@studio.test', password: 'long-enough-pass' })).resolves.toEqual(created);
    expect(invoke).toHaveBeenCalledWith('manage-team', {
      body: { action: 'create', email: 'new@studio.test', password: 'long-enough-pass' },
    });
  });

  it('removeAdmin sends the userId', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(removeAdmin('u-2')).resolves.toEqual({ userId: 'u-2' });
    expect(invoke).toHaveBeenCalledWith('manage-team', { body: { action: 'remove', userId: 'u-2' } });
  });

  it.each([
    ['FORBIDDEN'],
    ['EMAIL_EXISTS'],
    ['PASSWORD_TOO_SHORT'],
    ['CANNOT_REMOVE_OWNER'],
    ['NOT_FOUND'],
  ])('surfaces a %s response as a typed TeamError', async (code) => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ ok: false, error: code }) } },
    });
    const failure = await listTeam().catch((error) => error);
    expect(failure).toBeInstanceOf(TeamError);
    expect(failure.code).toBe(code);
  });

  it('maps a bare network failure to NETWORK_ERROR', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('offline') });
    const failure = await listTeam().catch((error) => error);
    expect(failure.code).toBe('NETWORK_ERROR');
  });
});
