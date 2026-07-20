// Real offline download engine for MiLey.
//
// Audio is fetched once and stored as a Blob inside IndexedDB — the app's own
// private, origin-scoped storage. It never lands in the device Downloads folder
// and is not reachable by other apps. Downloaded tracks then play back from the
// local blob (via an object URL), so they work with no network.
//
// The download LIST is also mirrored to the signed-in user's private db rows so
// it is linked to their account and visible across devices; the actual offline
// audio blob is per-device (each device caches its own copy on demand).

import { db } from './lib/db'
import { auth } from './lib/auth'

const DB_NAME = 'miley-offline'
const STORE = 'tracks'
const DB_VERSION = 1

let _dbPromise = null
function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    let req
    try { req = indexedDB.open(DB_NAME, DB_VERSION) } catch (e) { reject(e); return }
    req.onupgradeneeded = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx(mode) {
  return openDB().then((idb) => idb.transaction(STORE, mode).objectStore(STORE))
}

function idbGet(id) {
  return tx('readonly').then((store) => new Promise((res, rej) => {
    const r = store.get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error)
  }))
}
function idbPut(record) {
  return tx('readwrite').then((store) => new Promise((res, rej) => {
    const r = store.put(record); r.onsuccess = () => res(); r.onerror = () => rej(r.error)
  }))
}
function idbDelete(id) {
  return tx('readwrite').then((store) => new Promise((res, rej) => {
    const r = store.delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error)
  }))
}
function idbGetAll() {
  return tx('readonly').then((store) => new Promise((res, rej) => {
    const r = store.getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error)
  }))
}

// ── In-memory reactive state ──────────────────────────────────────────────
// list: [{ id, title, artistName, coverUrl, duration, type, artistId, genre, size, createdAt }]
// active: { [id]: { status: 'downloading'|'paused'|'error', received, total, error } }
const state = {
  ready: false,
  list: [],
  totalBytes: 0,
  active: {},
}
const objectUrls = new Map()   // id -> object URL for cached blob
const cachedIds = new Set()    // ids present in IndexedDB
const controllers = new Map()  // id -> { abort, paused, received, chunks, total }
const listeners = new Set()

function emit() {
  const snapshot = {
    ready: state.ready,
    list: [...state.list],
    totalBytes: state.totalBytes,
    active: { ...state.active },
  }
  listeners.forEach((fn) => { try { fn(snapshot) } catch (e) {} })
}

function getSnapshot() {
  return { ready: state.ready, list: [...state.list], totalBytes: state.totalBytes, active: { ...state.active } }
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function recomputeFromRecords(records) {
  const list = records
    .map((r) => ({
      id: r.id,
      title: r.title,
      artistName: r.artistName,
      coverUrl: r.coverUrl,
      duration: r.duration,
      type: r.type,
      artistId: r.artistId,
      genre: r.genre,
      audioUrl: r.audioUrl,
      size: r.size || 0,
      createdAt: r.createdAt || 0,
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  state.list = list
  state.totalBytes = list.reduce((sum, r) => sum + (r.size || 0), 0)
}

let _initPromise = null
async function init() {
  if (_initPromise) return _initPromise
  _initPromise = (async () => {
    try {
      const records = await idbGetAll()
      cachedIds.clear()
      for (const rec of records) {
        cachedIds.add(rec.id)
        if (rec.blob && !objectUrls.has(rec.id)) {
          try { objectUrls.set(rec.id, URL.createObjectURL(rec.blob)) } catch (e) {}
        }
      }
      recomputeFromRecords(records)
    } catch (e) {
      // IndexedDB unavailable (private mode / unsupported) — degrade gracefully
      state.list = []
      state.totalBytes = 0
    }
    state.ready = true
    emit()
  })()
  return _initPromise
}

// ── Public API ─────────────────────────────────────────────────────────────

function isDownloaded(id) {
  return cachedIds.has(id)
}

// Synchronous — used by the player to prefer local playback with zero latency.
function getOfflineUrl(id) {
  return objectUrls.get(id) || null
}

async function removeDownload(id) {
  cancel(id)
  try { await idbDelete(id) } catch (e) {}
  cachedIds.delete(id)
  const url = objectUrls.get(id)
  if (url) { try { URL.revokeObjectURL(url) } catch (e) {} objectUrls.delete(id) }
  delete state.active[id]
  state.list = state.list.filter((r) => r.id !== id)
  state.totalBytes = state.list.reduce((sum, r) => sum + (r.size || 0), 0)
  emit()
  // best-effort remove the account-linked list row
  try {
    if (auth.isAuthenticated()) {
      const rows = await db.select('downloads', { trackId: id }, { limit: 5 })
      for (const row of rows) await db.delete('downloads', row.id)
    }
  } catch (e) {}
}

function cancel(id) {
  const ctl = controllers.get(id)
  if (ctl) {
    ctl.canceled = true
    try { ctl.abort() } catch (e) {}
    controllers.delete(id)
  }
  if (state.active[id]) { delete state.active[id]; emit() }
}

function pause(id) {
  const ctl = controllers.get(id)
  if (!ctl) return
  ctl.paused = true
  try { ctl.abort() } catch (e) {}
  if (state.active[id]) { state.active[id] = { ...state.active[id], status: 'paused' }; emit() }
}

async function resume(track) {
  return download(track) // download() picks up any retained partial bytes
}

// Stream a URL into the retained chunk buffer on `ctl`. `allowRange` enables
// resume via a Range request; on any pre-body failure the caller decides whether
// to retry from scratch. Returns the assembled Blob on success.
async function streamInto(url, ctl, id, abortCtl, allowRange) {
  const headers = {}
  if (allowRange && ctl.received > 0) headers['Range'] = `bytes=${ctl.received}-`
  const resp = await fetch(url, { signal: abortCtl.signal, headers, mode: 'cors', credentials: 'omit' })
  if (!resp.ok && resp.status !== 206) throw new Error(`HTTP ${resp.status}`)

  // Server ignored Range (200 where we expected 206) → restart from zero.
  if (allowRange && ctl.received > 0 && resp.status === 200) {
    ctl.chunks.length = 0
    ctl.received = 0
  }

  let total = ctl.total
  if (resp.status === 206) {
    const cr = resp.headers.get('Content-Range')
    const m = cr && cr.match(/\/(\d+)$/)
    if (m) total = Number(m[1])
  } else {
    const lenHeader = resp.headers.get('Content-Length')
    if (lenHeader) total = Number(lenHeader)
  }
  ctl.total = total
  state.active[id] = { status: 'downloading', received: ctl.received, total: total || 0 }
  emit()

  if (!resp.body || !resp.body.getReader) {
    // No readable stream (opaque response) — fall back to a single blob read.
    const blob = await resp.blob()
    if (!blob || blob.size === 0) throw new Error('Empty response')
    ctl.chunks = [new Uint8Array(await blob.arrayBuffer())]
    ctl.received = blob.size
    return new Blob(ctl.chunks, { type: resp.headers.get('Content-Type') || blob.type || 'audio/mpeg' })
  }

  const reader = resp.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    ctl.chunks.push(value)
    ctl.received += value.length
    state.active[id] = { status: 'downloading', received: ctl.received, total: total || 0 }
    emit()
  }
  return new Blob(ctl.chunks, { type: resp.headers.get('Content-Type') || 'audio/mpeg' })
}

async function download(track) {
  if (!track || !track.id) return false
  if (!track.audioUrl) {
    state.active[track.id] = { status: 'error', received: 0, total: 0, error: 'This song has no audio file to download.' }
    emit()
    return false
  }
  const id = track.id
  if (cachedIds.has(id)) return true

  // retain partial progress across pause/resume
  let prior = controllers.get(id)
  const chunks = prior && prior.chunks ? prior.chunks : []
  let received = prior && prior.received ? prior.received : 0

  const abortCtl = new AbortController()
  const ctl = { abort: () => abortCtl.abort(), paused: false, canceled: false, chunks, received, total: prior?.total || 0 }
  controllers.set(id, ctl)

  state.active[id] = { status: 'downloading', received, total: ctl.total || 0 }
  emit()

  try {
    let blob
    try {
      // Normal path: stream directly from storage (resume when we have partial bytes).
      blob = await streamInto(track.audioUrl, ctl, id, abortCtl, received > 0)
    } catch (e1) {
      if (ctl.canceled || ctl.paused) throw e1
      // A resume can fail on a Range/CORS preflight — restart cleanly once.
      ctl.chunks.length = 0
      ctl.received = 0
      blob = await streamInto(track.audioUrl, ctl, id, abortCtl, false)
    }

    if (!blob || blob.size === 0) throw new Error('Downloaded file was empty.')
    const size = blob.size
    const record = {
      id,
      blob,
      size,
      title: track.title,
      artistName: track.artistName,
      coverUrl: track.coverUrl,
      duration: track.duration,
      type: track.type,
      artistId: track.artistId,
      genre: track.genre,
      audioUrl: track.audioUrl,
      createdAt: Date.now(),
    }
    await idbPut(record)
    cachedIds.add(id)
    if (!objectUrls.has(id)) { try { objectUrls.set(id, URL.createObjectURL(blob)) } catch (e) {} }
    controllers.delete(id)
    delete state.active[id]
    // refresh list from records so ordering/size stay accurate
    const { blob: _b, ...meta } = record
    state.list = [meta, ...state.list.filter((r) => r.id !== id)].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    state.totalBytes = state.list.reduce((sum, r) => sum + (r.size || 0), 0)
    emit()

    // best-effort: mirror to account so the list syncs across devices
    try {
      if (auth.isAuthenticated()) {
        await db.insert('downloads', {
          trackId: id, title: track.title, artistName: track.artistName, coverUrl: track.coverUrl,
          duration: track.duration, type: track.type, artistId: track.artistId, genre: track.genre,
          audioUrl: track.audioUrl, size, downloadedAt: new Date().toISOString(),
        })
      }
    } catch (e) {}
    return true
  } catch (e) {
    if (ctl.canceled) { return false }
    if (ctl.paused) {
      // keep chunks for resume
      controllers.set(id, { ...ctl, chunks: ctl.chunks, received: ctl.received, total: ctl.total })
      state.active[id] = { status: 'paused', received: ctl.received, total: ctl.total || 0 }
      emit()
      return false
    }
    controllers.delete(id)
    const raw = (e && e.message) || 'Download failed'
    const msg = /failed to fetch|networkerror|load failed/i.test(raw)
      ? 'Could not reach the audio file. Check your connection and try again.'
      : raw
    state.active[id] = { status: 'error', received: ctl.received, total: ctl.total || 0, error: msg }
    emit()
    return false
  }
}

export const offlineDownloads = {
  init,
  subscribe,
  getSnapshot,
  isDownloaded,
  getOfflineUrl,
  download,
  pause,
  resume,
  cancel,
  removeDownload,
}
