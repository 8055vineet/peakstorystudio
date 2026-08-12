import { supabase } from '../supabase';

// The client delivery portal's single public read path: the
// client_galleries_for_code RPC (security definer — the table itself is
// admin-only under RLS). The presented code is the credential; the RPC
// returns only published rows matching it, so "wrong code" and "no
// deliveries yet" both surface as an empty list — deliberately
// indistinguishable to a guesser, and disambiguated in the UI only after a
// code has already unlocked something once.
export async function getClientGalleries(code) {
  const { data, error } = await supabase.rpc('client_galleries_for_code', {
    p_code: String(code ?? '').trim(),
  });

  if (error) throw new Error(`getClientGalleries: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    coupleLabel: row.couple_label,
    description: row.description,
    driveUrl: row.drive_url,
  }));
}
