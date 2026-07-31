import { isSupabaseConfigured } from './supabase';

// Temporary migration scaffolding (spec section 5.5). Removed in Phase 3,
// once the database is authoritative.
//
// 'static'   read content from src/data/weddingData.js
// 'supabase' read content from the database
//
// Asking for 'supabase' without credentials would leave the client null and
// crash on the first query, so an unconfigured environment stays on 'static'.
const requested = import.meta.env.VITE_DATA_SOURCE;

export const DATA_SOURCE =
  requested === 'supabase' && isSupabaseConfigured ? 'supabase' : 'static';
