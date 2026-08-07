// Turns any YouTube link an admin might paste — embed, watch, youtu.be, or
// shorts — into a clean embed URL. This is why a pasted "youtu.be/..." share
// link no longer "refuses to connect" when embedded: those cannot be framed,
// but the /embed/ form built here can.

export function youtubeId(url) {
  if (!url) return null;
  const s = String(url);
  const direct = s.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts)\/)([A-Za-z0-9_-]{11})/);
  if (direct) return direct[1];
  const v = s.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return v ? v[1] : null;
}

// autoplay implies mute — the only autoplay a browser will honour.
export function youtubeEmbedUrl(url, { autoplay = false } = {}) {
  const id = youtubeId(url);
  if (!id) return url ?? '';
  const params = ['rel=0', 'playsinline=1'];
  if (autoplay) params.push('autoplay=1', 'mute=1');
  return `https://www.youtube.com/embed/${id}?${params.join('&')}`;
}
