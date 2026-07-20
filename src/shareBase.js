// Canonical public base URL for every share link, QR code, invite and deep link.
// Only the DOMAIN is fixed here — paths/slugs/query params are appended by callers,
// so routing and deep-linking behaviour are unchanged.
export const SHARE_BASE = 'https://mileymusic.space'

// Returns the canonical share base (no trailing slash).
export function shareBase() {
  return SHARE_BASE
}

// Convenience: build a full share URL from a hash-route path.
// shareUrl('/rooms/abc') -> 'https://mileymusic.space/#/rooms/abc'
export function shareUrl(hashPath = '') {
  const clean = String(hashPath).replace(/^#?\/?/, '')
  return `${SHARE_BASE}/#/${clean}`
}
