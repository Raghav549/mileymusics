import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { requireAuth } from '../authGate'
import { notify } from './useNotifications'

export function useLikes() {
  const [likedIds, setLikedIds] = useState(new Set())
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!auth.isAuthenticated()) { setLoaded(true); return }
    try {
      const rows = await db.select('likedTracks', {}, { limit: 500 })
      setLikedIds(new Set(rows.map((r) => r.id)))
    } catch (e) { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isLiked = useCallback((trackId) => likedIds.has(trackId), [likedIds])

  const toggleLike = useCallback(async (track) => {
    if (!(await requireAuth('like'))) return
    const liked = likedIds.has(track.id)
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (liked) next.delete(track.id); else next.add(track.id)
      return next
    })
    try {
      if (liked) {
        await db.delete('likedTracks', track.id)
        await db.incrementShared('tracks', track.id, 'likesCount', -1)
      } else {
        await db.insert('likedTracks', {
          trackId: track.id,
          title: track.title,
          artistName: track.artistName,
          coverUrl: track.coverUrl,
          audioUrl: track.audioUrl,
          duration: track.duration,
          type: track.type,
          artistId: track.artistId,
        }, track.id)
        await db.incrementShared('tracks', track.id, 'likesCount', 1)
        // Alert the track's owner that someone liked their song (self-likes are
        // ignored inside notify). Best-effort — never blocks the like.
        if (track.artistId) {
          const me = auth.getCurrentUser()
          notify(track.artistId, { type: 'like', title: 'New like', body: `${me?.displayName || 'Someone'} liked “${track.title}”`, url: `/artist/${track.artistId}` })
        }
      }
    } catch (e) { /* ignore */ }
  }, [likedIds])

  return { isLiked, toggleLike, loaded }
}

export async function getLikedTracks() {
  const rows = await db.select('likedTracks', {}, { limit: 500, order: '-createdAt' })
  return rows.map((r) => ({ ...r, id: r.trackId || r.id }))
}
