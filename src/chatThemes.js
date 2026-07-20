// Per-user chat backgrounds. A theme affects ONLY the local user's view of a
// conversation, so it lives in localStorage keyed by channel — never written to
// the shared message store. Presets are CSS gradients (no image downloads, no
// per-render cost); "custom" stores an uploaded image URL from storage.upload.

const KEY = (channelId) => `miley_chat_theme_${channelId}`

export const CHAT_THEMES = [
  { id: 'default', name: 'MiLey', bg: 'linear-gradient(180deg,#0B0B0B,#0B0B0B)', dark: true },
  { id: 'flowers', name: 'Flowers', bg: 'linear-gradient(160deg,#2a0f1f,#3d1830 55%,#120711)', dark: true },
  { id: 'nature', name: 'Nature', bg: 'linear-gradient(160deg,#08231a,#0d3327 55%,#04140f)', dark: true },
  { id: 'alone', name: 'Alone', bg: 'linear-gradient(180deg,#0d0f14,#161a24 60%,#080a0f)', dark: true },
  { id: 'cars', name: 'Cars', bg: 'linear-gradient(160deg,#101418,#1c232b 55%,#0a0d10)', dark: true },
  { id: 'sketch', name: 'Sketch', bg: 'linear-gradient(160deg,#17171a,#242428 55%,#101012)', dark: true },
  { id: 'dark', name: 'Dark', bg: 'linear-gradient(180deg,#000000,#0a0a0a)', dark: true },
  { id: 'anime', name: 'Anime', bg: 'linear-gradient(160deg,#1a1030,#2b1550 55%,#0d0720)', dark: true },
  { id: 'galaxy', name: 'Galaxy', bg: 'radial-gradient(120% 100% at 20% 0%,#241640,#0a0a1f 60%,#050510)', dark: true },
  { id: 'abstract', name: 'Abstract', bg: 'linear-gradient(135deg,#0f2a24,#2a1030 60%,#0b0b0b)', dark: true },
  { id: 'minimal', name: 'Minimal', bg: 'linear-gradient(180deg,#f4f4f6,#e9e9ee)', dark: false },
  { id: 'phone', name: 'Phone', bg: 'linear-gradient(180deg,#eef2f7,#dfe6ef)', dark: false },
  { id: 'city', name: 'City', bg: 'linear-gradient(180deg,#0a0f18,#182234 55%,#070b12)', dark: true },
  { id: 'rain', name: 'Rain', bg: 'linear-gradient(180deg,#0b1418,#13232b 55%,#070e11)', dark: true },
  { id: 'sunset', name: 'Sunset', bg: 'linear-gradient(180deg,#2c1409,#3d1d1a 45%,#1a0e12 80%,#0b0b0b)', dark: true },
]

export function getChatTheme(channelId) {
  try {
    const raw = localStorage.getItem(KEY(channelId))
    if (!raw) return { id: 'default', ...CHAT_THEMES[0] }
    const saved = JSON.parse(raw)
    if (saved.id === 'custom') return { id: 'custom', name: 'Custom', imageUrl: saved.imageUrl, dark: true }
    return CHAT_THEMES.find((t) => t.id === saved.id) || { id: 'default', ...CHAT_THEMES[0] }
  } catch (e) { return { id: 'default', ...CHAT_THEMES[0] } }
}

export function setChatTheme(channelId, theme) {
  try {
    if (theme.id === 'custom') localStorage.setItem(KEY(channelId), JSON.stringify({ id: 'custom', imageUrl: theme.imageUrl }))
    else localStorage.setItem(KEY(channelId), JSON.stringify({ id: theme.id }))
  } catch (e) { /* ignore */ }
}

export function themeStyle(theme) {
  if (!theme) return {}
  if (theme.id === 'custom' && theme.imageUrl) {
    return { backgroundImage: `linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.55)), url(${theme.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: theme.bg }
}
