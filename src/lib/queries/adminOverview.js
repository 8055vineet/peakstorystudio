import { supabase } from '../supabase';

// The dashboard's at-a-glance numbers. head:true count queries move no row
// data — five cheap counts, fired together.

async function countWhere(table, column, value) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw new Error(`${table}: count failed: ${error.message}`);
  return count ?? 0;
}

async function statusPair(table) {
  const [published, draft] = await Promise.all([
    countWhere(table, 'status', 'published'),
    countWhere(table, 'status', 'draft'),
  ]);
  return { published, draft };
}

export async function getOverviewCounts() {
  const [newLeads, weddings, gallery, films, testimonials] = await Promise.all([
    countWhere('inquiries', 'status', 'new'),
    statusPair('weddings'),
    statusPair('gallery_photos'),
    statusPair('films'),
    statusPair('testimonials'),
  ]);
  return {
    newLeads, weddings, gallery, films, testimonials,
  };
}
