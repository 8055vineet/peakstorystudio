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
export default function Photo({
  src, alt = '', className = '', ...rest
}) {
  if (!src) {
    return <div className={className} data-testid="photo-placeholder" aria-hidden="true" />;
  }
  return <img src={src} alt={alt} className={className} {...rest} />;
}
