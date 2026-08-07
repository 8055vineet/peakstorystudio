import { supabase } from '../supabase';

// The admin's read/write pair for the single site_settings row. Same
// snake_case↔camelCase discipline as adminContent.js: the boundary is
// crossed exactly once, here. The two tiny helpers are duplicated from
// adminContent.js rather than exported from it — they are that module's
// private internals, and a two-line copy beats coupling two modules'
// futures together.

const COLUMNS = [
  'id',
  'quote_text', 'quote_credit',
  'brand_story_heading', 'brand_story_p1', 'brand_story_p2',
  'hero_media_id', 'brand_story_media_id', 'closing_media_id',
  'studio_address', 'studio_email', 'studio_phone',
  'whatsapp_number', 'instagram_url', 'youtube_url',
  'heading_font', 'body_font',
];

const SELECT = COLUMNS.join(', ');

function toCamel(column) {
  return column.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function rowToItem(row) {
  const item = {};
  COLUMNS.forEach((column) => {
    item[toCamel(column)] = row[column];
  });
  return item;
}

// Only declared columns cross; `id` never does — there is exactly one row
// and a write must not be able to aim anywhere else.
function valuesToRow(values) {
  const row = {};
  COLUMNS.forEach((column) => {
    const field = toCamel(column);
    if (field !== 'id' && Object.prototype.hasOwnProperty.call(values, field)) {
      row[column] = values[field];
    }
  });
  return row;
}

export async function getSettingsRow() {
  const { data, error } = await supabase
    .from('site_settings')
    .select(SELECT)
    .eq('id', 1)
    .single();

  if (error) throw new Error(`site_settings: read failed: ${error.message}`);
  return rowToItem(data);
}

export async function updateSiteSettings(values) {
  const { data, error } = await supabase
    .from('site_settings')
    .update(valuesToRow(values))
    .eq('id', 1)
    .select(SELECT)
    .single();

  if (error) throw new Error(`site_settings: update failed: ${error.message}`);
  return rowToItem(data);
}
