import { makeResourceQueries } from '../../lib/queries/adminContent';

export const filmsResource = {
  key: 'films',
  label: 'Films',
  table: 'films',
  columns: [
    'id', 'title', 'couple', 'location', 'duration_seconds', 'thumbnail_media_id', 'video_embed_url', 'sort_order', 'status',
  ],
  defaultSort: 'sort_order',
  listColumns: [
    { name: 'title', label: 'Title' },
    { name: 'couple', label: 'Couple' },
    { name: 'location', label: 'Location' },
    { name: 'status', label: 'Status' },
  ],
  fields: [
    { name: 'title', label: 'Title', type: 'text', required: true },
    // `couple` and `location` are nullable `text` columns.
    {
      name: 'couple', label: 'Couple', type: 'text', required: false, emptyValue: null,
    },
    {
      name: 'location', label: 'Location', type: 'text', required: false, emptyValue: null,
    },
    // films.duration_seconds is a genuine integer with no small, closed set of
    // values — unlike gallery_photos.category or grid_span, a film's length is
    // whatever the edit actually runs, so this stays free-entry `number` rather
    // than becoming a `select`. src/lib/queries/films.js's own formatDuration
    // rebuilds the "m:ss mins" display string the public site shows from this
    // value, so the help text below states the unit rather than leaving an
    // admin to guess whether it wants seconds or minutes.
    {
      name: 'durationSeconds',
      label: 'Duration (seconds)',
      type: 'number',
      required: false,
      // `duration_seconds` is a genuinely nullable `int` column — unlike
      // `sortOrder` below, blank clears to `null`, not a default.
      emptyValue: null,
      help: 'Length of the film, in seconds — e.g. 272 for 4:32. The public site formats this as minutes:seconds.',
    },
    {
      name: 'thumbnailMediaId',
      label: 'Thumbnail',
      type: 'media',
      required: false,
      // `thumbnail_media_id` is a nullable `uuid` column, so a blank field
      // clears to `null` — never `''`, which Postgres rejects with `22P02`.
      emptyValue: null,
      help: 'Shown as the film\'s preview image before it plays.',
    },
    // video_embed_url is written straight into an <iframe src="..."> by
    // src/App.jsx's video modal (see the videoModalUrl state there) — the
    // admin is a trusted user, so this is not an injection concern, but a
    // mistyped or watch-page URL here silently breaks the film for every
    // visitor rather than failing loudly anywhere. The help text says what
    // shape is expected so that mistake is less likely, not impossible.
    {
      name: 'videoEmbedUrl',
      label: 'Video Embed URL',
      type: 'text',
      required: true,
      help: 'An embed URL, e.g. https://www.youtube.com/embed/VIDEO_ID — not a normal watch-page link. This is placed directly into an embed frame, so the wrong form silently breaks the film for visitors.',
    },
    // `sort_order` is `int not null default 0` — the column's own default,
    // never `null`, which Postgres rejects with `23502`.
    {
      name: 'sortOrder', label: 'Order', type: 'number', required: false, emptyValue: 0,
    },
  ],
};

export const filmsQueries = makeResourceQueries(filmsResource.table, filmsResource.columns);
