import { db } from './lib/db'

export const GENRE_SUGGESTIONS = [
  'Pop', 'Rock', 'Hip-Hop', 'Rap', 'LoFi', 'Classical', 'Instrumental', 'Devotional',
  'Romantic', 'Workout', 'Study', 'Sleep', 'Meditation', 'Party', 'Gaming', 'Chill',
  'Jazz', 'Blues', 'Country', 'Folk', 'International',
]

export const LANGUAGE_SUGGESTIONS = [
  'Hindi', 'English', 'Bengali', 'Marathi', 'Punjabi', 'Tamil', 'Telugu', 'Malayalam',
  'Kannada', 'Gujarati', 'Bhojpuri', 'Odia', 'Assamese', 'Urdu', 'Sanskrit', 'Nepali',
]

export const MOOD_SUGGESTIONS = [
  'Happy', 'Sad', 'Energetic', 'Calm', 'Romantic', 'Focus', 'Nostalgic', 'Party', 'Dreamy',
]

export function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// Ensures a category (genre/language/mood) exists platform-wide. Auto-creates it
// if a user typed something new, so it becomes available to everyone.
export async function ensureCategory(name, type) {
  const clean = (name || '').trim()
  if (!clean) return
  const existing = await db.selectShared('categories', { type, nameLower: clean.toLowerCase() }, { limit: 1 })
  if (existing.length) return existing[0]
  return db.insertShared('categories', { name: clean, nameLower: clean.toLowerCase(), type })
}

export function isPublicVisible(track) {
  if (!track) return false
  if (track.visibility && track.visibility !== 'public') return false
  if (track.scheduledAt && new Date(track.scheduledAt).getTime() > Date.now()) return false
  return true
}

export const COVER_PLACEHOLDER_GRADIENTS = [
  'from-emerald-500/40 to-pink-500/40',
  'from-pink-500/40 to-emerald-400/30',
  'from-emerald-400/30 to-purple-500/30',
  'from-fuchsia-500/30 to-emerald-500/30',
]

export function gradientFor(seed) {
  const s = (seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return COVER_PLACEHOLDER_GRADIENTS[s % COVER_PLACEHOLDER_GRADIENTS.length]
}

// ── Listening Parties ──
export const ROOM_PURPOSES = ['Music', 'Friends', 'Chill', 'Gaming', 'Podcast', 'Discussion', 'Study', 'Community', 'Custom']

export const ROOM_SEAT_COUNT = 9

// Five premium built-in Listening Party backgrounds. Three are rich image-based
// themes (permanent generated art), two are on-brand gradients that render
// instantly. Each entry exposes a `style` object ready to spread onto a div.
export const ROOM_BACKGROUNDS = [
  { key: 'nebula', label: 'Nebula', imageUrl: 'https://api.whacka.app/storage/v1/object/public/app-images/projects/4274cd05-66af-42a6-9366-e088c52e3911/gen-b8e5f097-1784306789062.png' },
  { key: 'neoncity', label: 'Neon City', imageUrl: 'https://api.whacka.app/storage/v1/object/public/app-images/projects/4274cd05-66af-42a6-9366-e088c52e3911/gen-bb3c57ac-1784306789636.png' },
  { key: 'sunset', label: 'Sunset', imageUrl: 'https://api.whacka.app/storage/v1/object/public/app-images/projects/4274cd05-66af-42a6-9366-e088c52e3911/gen-fed57b26-1784306802471.png' },
  { key: 'emerald', label: 'Emerald Depth', css: 'radial-gradient(90% 70% at 15% 15%, rgba(0,224,168,0.30), transparent 55%), #0B0B0B' },
  { key: 'rosegold', label: 'Rose Gold', css: 'radial-gradient(100% 80% at 80% 10%, rgba(255,61,174,0.26), transparent 55%), radial-gradient(80% 60% at 10% 90%, rgba(0,224,168,0.14), transparent 60%), #0B0B0B' },
]

// CSS string for the preset selector swatches (thumbnail).
export function roomBackgroundCss(key) {
  const b = ROOM_BACKGROUNDS.find((x) => x.key === key) || ROOM_BACKGROUNDS[0]
  return b.imageUrl ? `center / cover no-repeat url(${b.imageUrl})` : b.css
}

// Full-screen room background style — image presets get a dark scrim so seats
// and text stay readable; gradient presets are used as-is.
export function roomBackgroundStyle(key) {
  const b = ROOM_BACKGROUNDS.find((x) => x.key === key) || ROOM_BACKGROUNDS[0]
  if (b.imageUrl) {
    return { backgroundImage: `linear-gradient(rgba(11,11,11,0.55), rgba(11,11,11,0.85)), url(${b.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return { background: b.css }
}

export function makeEmptySeats(n = ROOM_SEAT_COUNT) {
  return Array.from({ length: n }, () => null)
}
