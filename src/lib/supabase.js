import { createClient } from '@supabase/supabase-js';

// The anon key is public by design: it ships in the browser bundle, and Row
// Level Security in Postgres — not this file — is what constrains it.
// See supabase/migrations/*_row_level_security.sql.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
