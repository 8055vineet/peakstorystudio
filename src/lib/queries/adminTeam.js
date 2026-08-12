import { supabase } from '../supabase';

// The owner's team console, through the manage-team Edge Function — the
// only code path that may create or remove admin accounts. Same typed-error
// convention as media.js's MediaError: every response the function can send
// (400/401/403/409/500) surfaces as a distinct code the Team panel can
// phrase for a human, not a collapsed generic failure.

export class TeamError extends Error {
  constructor(code) {
    super(code);
    this.name = 'TeamError';
    this.code = code;
  }
}

async function readErrorBody(error) {
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

async function invokeTeam(body) {
  const { data, error } = await supabase.functions.invoke('manage-team', { body });

  if (error) {
    const parsed = await readErrorBody(error);
    throw new TeamError(parsed?.error ?? 'NETWORK_ERROR');
  }
  if (!data?.ok) {
    throw new TeamError(data?.error ?? 'SERVER_ERROR');
  }
  return data;
}

// -> [{ userId, email, displayName, isOwner, createdAt }], owner first.
export async function listTeam() {
  const data = await invokeTeam({ action: 'list' });
  return data.members;
}

export async function createAdmin({ email, password }) {
  const data = await invokeTeam({ action: 'create', email, password });
  return data.member;
}

export async function removeAdmin(userId) {
  await invokeTeam({ action: 'remove', userId });
  return { userId };
}
