import { makeResourceQueries } from '../../lib/queries/adminContent';

// The Client Galleries tab: how the studio delivers photographs. Each row
// is a Drive folder a couple unlocks with the access code the studio gave
// them — see docs/superpowers/specs/2026-08-12-client-portal-and-team-design.md.
// Same factory as every other content type; draft-first create and the
// publish toggle mean a delivery only becomes reachable (even with the
// right code) when the admin publishes it.
export const clientGalleriesResource = {
  key: 'clientGalleries',
  label: 'Client Galleries',
  table: 'client_galleries',
  columns: [
    'id', 'title', 'couple_label', 'description', 'drive_url', 'access_code', 'sort_order', 'status',
  ],
  defaultSort: 'sort_order',
  deleteNote: 'The couple loses access to this entry; the Drive folder itself is untouched.',
  listColumns: [
    { name: 'title', label: 'Title' },
    { name: 'coupleLabel', label: 'Couple' },
    { name: 'accessCode', label: 'Access code' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    {
      name: 'coupleLabel',
      label: 'Couple',
      type: 'text',
      required: false,
      emptyValue: null,
      help: 'Shown as the greeting when the couple signs in — e.g. "Pragya & Family".',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      required: false,
      emptyValue: null,
      help: 'A line under the title — e.g. "All 412 edited ceremony photographs".',
    },
    {
      name: 'driveUrl',
      label: 'Drive folder link',
      type: 'text',
      required: true,
      help: 'The full https://drive.google.com/... link. Check the folder\'s own sharing setting in Google Drive — this page controls who finds the link, Google controls who the folder admits.',
    },
    {
      name: 'accessCode',
      label: 'Access code',
      type: 'text',
      required: true,
      help: 'What the couple types to sign in — at least 6 characters, 8+ random letters and numbers recommended. Give the same code to several entries and the couple sees them together.',
    },
    {
      name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
    },
  ],
};

export const clientGalleriesQueries = makeResourceQueries(
  clientGalleriesResource.table,
  clientGalleriesResource.columns,
);
