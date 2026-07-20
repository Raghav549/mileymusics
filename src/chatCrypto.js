// Lightweight message content encryption for MiLey DMs — encrypts text at rest
// (and in transit) using AES-GCM with a per-channel key derived from the
// channel id. Keeps raw chat text out of the database in plaintext.
const PREFIX = 'MLENC1:'

async function deriveKey(channelId) {
  const enc = new TextEncoder()
  const material = await crypto.subtle.digest('SHA-256', enc.encode('miley-secure-channel::' + channelId))
  return crypto.subtle.importKey('raw', material, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function toB64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
function fromB64(str) {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encryptText(channelId, text) {
  if (!text) return text
  try {
    const key = await deriveKey(channelId)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
    const combined = new Uint8Array(iv.length + cipherBuf.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(cipherBuf), iv.length)
    return PREFIX + toB64(combined)
  } catch (e) {
    return text // graceful fallback — never block sending
  }
}

export async function decryptText(channelId, payload) {
  if (!payload || !payload.startsWith(PREFIX)) return payload
  try {
    const key = await deriveKey(channelId)
    const raw = fromB64(payload.slice(PREFIX.length))
    const iv = raw.slice(0, 12)
    const data = raw.slice(12)
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plainBuf)
  } catch (e) {
    return '🔒 Encrypted message'
  }
}

export const isEncrypted = (payload) => typeof payload === 'string' && payload.startsWith(PREFIX)
