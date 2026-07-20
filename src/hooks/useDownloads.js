import { useEffect, useState } from 'react'
import { offlineDownloads } from '../offlineDownloads'

// Reactive view of the offline download engine.
export function useDownloads() {
  const [snap, setSnap] = useState(() => offlineDownloads.getSnapshot())
  useEffect(() => {
    offlineDownloads.init()
    const unsub = offlineDownloads.subscribe(setSnap)
    setSnap(offlineDownloads.getSnapshot())
    return unsub
  }, [])
  return snap // { ready, list, totalBytes, active }
}

// Per-track download state helper.
export function useTrackDownload(trackId) {
  const snap = useDownloads()
  const downloaded = snap.list.some((r) => r.id === trackId) || offlineDownloads.isDownloaded(trackId)
  const active = snap.active[trackId] || null
  return {
    downloaded,
    active, // null | { status, received, total }
    progress: active && active.total ? Math.min(1, active.received / active.total) : 0,
    download: offlineDownloads.download,
    pause: offlineDownloads.pause,
    resume: offlineDownloads.resume,
    cancel: offlineDownloads.cancel,
    remove: offlineDownloads.removeDownload,
  }
}

export function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}
