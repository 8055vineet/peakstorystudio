import { supabase } from '../supabase';

export async function getTestimonials() {
  const { data, error } = await supabase
    .from('testimonials')
    .select('id, quote, couple, event')
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw new Error(`getTestimonials: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    quote: row.quote,
    couple: row.couple,
    event: row.event,
  }));
}
