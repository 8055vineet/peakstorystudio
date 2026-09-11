import React from 'react';

// A photograph that tolerates an unresolvable source (PS-036). Every public
// image URL comes from publicMediaUrl() (src/lib/mediaUrl.js), which returns
// '' when a media row's storage bucket has no public base URL configured —
// and `<img src="">` renders the browser's broken-image glyph with the alt
// text beside it, the ugliest possible failure on a photography site. This
// renders a quiet cream block at the same size instead, so the grid keeps its
// shape and nothing looks broken. Presentational; `className` carries the
// caller's own sizing/aspect classes so the placeholder occupies exactly the
// space the photograph would have.
//
// `width`/`height` (the stored pixel size, when the media row has one) go on
// the <img> so the browser reserves its space before the bytes arrive — the
// Core Web Vitals layout-shift fix — and give the placeholder the same
// aspect ratio for the same reason. Absent, neither is emitted.
export default function Photo({
  src, alt = '', className = '', width = null, height = null, ...rest
}) {
  const sized = width != null && height != null;
  if (!src) {
    return (
      <div
        className={className}
        style={sized ? { aspectRatio: `${width} / ${height}` } : undefined}
        data-testid="photo-placeholder"
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={sized ? width : undefined}
      height={sized ? height : undefined}
      {...rest}
    />
  );
}
