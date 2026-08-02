import { supabase } from '../supabase';

// Backs every one of the five admin content screens (weddings, wedding
// photos, gallery photos, films, testimonials — Tasks 8 and 9) through one
// generic factory, so none of them writes its own Supabase calls. A resource
// config (see src/admin/ResourceList.jsx and ResourceForm.jsx) names a
// `table` and the `columns` it reads and writes; this file is the only place
// that ever turns those into a query.
//
// snake_case in Postgres, camelCase in the app — every row this module reads
// or writes crosses that boundary exactly once, here, so no screen has to.

function toCamel(column) {
  return column.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function rowToItem(row, columns) {
  const item = {};
  columns.forEach((column) => {
    item[toCamel(column)] = row[column];
  });
  return item;
}

// Builds a snake_case row from a camelCase `values` object, but only for
// keys this resource actually declared in `columns` — an unrelated key on
// `values` (e.g. a caller spreading a whole item back in) is silently
// dropped rather than sent to Postgres. `id` is stripped unconditionally
// even though every real resource's `columns` includes it: a row's id is
// never something a write is allowed to change, whether this is an insert
// (Postgres generates it) or an update (the `id` this function's caller
// receives identifies *which* row to write, never a new value to write).
function valuesToRow(values, columns) {
  const row = {};
  columns.forEach((column) => {
    const field = toCamel(column);
    if (field !== 'id' && Object.prototype.hasOwnProperty.call(values, field)) {
      row[column] = values[field];
    }
  });
  return row;
}

// makeResourceQueries(table, columns) -> { list, create, update, remove, reorder }
//
// Every function throws a plain Error on a Postgres error rather than
// resolving to something empty or partial — same convention as every other
// write in src/lib/queries/ (see adminInquiries.js, media.js). An admin
// screen that reads "nothing here" from a broken query is indistinguishable
// from an actually-empty resource, which is the exact confusion this
// project has already built a fallback layer to avoid on the public site.
export function makeResourceQueries(table, columns) {
  const select = columns.join(', ');

  // Ordered by sort_order ascending — every one of the five content tables
  // this factory serves has that column (see the sort_order indexes in
  // supabase/migrations/20260730203451_initial_schema.sql), and it is what
  // ResourceList's reorder controls and Postgres agree is "the" order.
  async function list() {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`${table}: list failed: ${error.message}`);
    return (data ?? []).map((row) => rowToItem(row, columns));
  }

  async function create(values) {
    const row = valuesToRow(values, columns);
    const { data, error } = await supabase
      .from(table)
      .insert(row)
      .select(select)
      .single();

    if (error) throw new Error(`${table}: create failed: ${error.message}`);
    return rowToItem(data, columns);
  }

  // Handles both a ResourceForm submission (several fields at once) and
  // ResourceList's publish toggle (`{ status }` alone) — the same function,
  // because both are "write these columns to this row," and giving the
  // toggle its own function would be a second place the snake_case mapping
  // could drift from this one.
  async function update(id, values) {
    const row = valuesToRow(values, columns);
    const { data, error } = await supabase
      .from(table)
      .update(row)
      .eq('id', id)
      .select(select)
      .single();

    if (error) throw new Error(`${table}: update(${id}) failed: ${error.message}`);
    return rowToItem(data, columns);
  }

  async function remove(id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(`${table}: remove(${id}) failed: ${error.message}`);
    return { id };
  }

  // orderedIds is every id in the resource, in the order it should now
  // read — ResourceList computes that array (see its own module comment)
  // and this just writes each one's position back as sort_order. The writes
  // run in parallel; if any fails, this throws and — because useResource's
  // mutate() only reloads once its call resolves — the reload that follows
  // shows whatever Postgres actually ended up with, not the order this
  // function merely attempted.
  async function reorder(orderedIds) {
    const results = await Promise.all(orderedIds.map((id, index) => supabase
      .from(table)
      .update({ sort_order: index })
      .eq('id', id)));

    const failed = results.find((result) => result.error);
    if (failed) throw new Error(`${table}: reorder failed: ${failed.error.message}`);
    return { ok: true };
  }

  return {
    list, create, update, remove, reorder,
  };
}
