import { supabase, isSupabaseConfigured } from '../supabase';

// The widget cannot render without a site key, and the function refuses any
// request without a token, so an inquiry backend without this key is not a
// working one. Treated as part of being configured rather than as a separate
// failure the form would have to explain.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

export const isInquiryBackendConfigured = isSupabaseConfigured && Boolean(TURNSTILE_SITE_KEY);

export class InquiryError extends Error {
  constructor(code, fields) {
    super(code);
    this.name = 'InquiryError';
    this.code = code;
    this.fields = fields ?? {};
  }
}

async function readErrorBody(error) {
  // supabase-js wraps a non-2xx as FunctionsHttpError and hangs the original
  // Response off .context. Other failures (DNS, offline) have no context.
  try {
    return await error?.context?.json?.();
  } catch {
    return null;
  }
}

export async function submitInquiry(payload) {
  if (!isInquiryBackendConfigured) {
    throw new InquiryError('BACKEND_UNCONFIGURED');
  }

  const { data, error } = await supabase.functions.invoke('submit-inquiry', { body: payload });

  if (error) {
    const body = await readErrorBody(error);
    throw new InquiryError(body?.error ?? 'NETWORK_ERROR', body?.fields);
  }

  if (!data?.ok) {
    throw new InquiryError(data?.error ?? 'SERVER_ERROR', data?.fields);
  }

  return { id: data.id ?? null };
}
