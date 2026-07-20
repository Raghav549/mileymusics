import { useCallback, useEffect, useState } from 'react'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { requireAuth } from '../authGate'

export function useFollows() {
  const [followingIds, setFollowingIds] = useState(new Set())
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const user = auth.getCurrentUser()
    if (!user) { setLoaded(true); return }
    try {
      const rows = await db.selectShared('follows', { followerId: user.id }, { limit: 500 })
      setFollowingIds(new Set(rows.map((r) => r.targetId)))
    } catch (e) { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const isFollowing = useCallback((targetId) => followingIds.has(targetId), [followingIds])

  const toggleFollow = useCallback(async (targetId, targetType, targetName, targetAvatar, targetUsername) => {
    if (!(await requireAuth('follow'))) return
    const user = auth.getCurrentUser()
    const id = `${user.id}:${targetId}`
    const already = followingIds.has(targetId)
    setFollowingIds((prev) => {
      const next = new Set(prev)
      if (already) next.delete(targetId); else next.add(targetId)
      return next
    })
    try {
      if (already) {
        await db.deleteShared('follows', id)
      } else {
        await db.insertShared('follows', {
          followerId: user.id, targetId, targetType, targetName, targetAvatar, targetUsername: targetUsername || null,
          followerName: user.displayName || 'MiLey user', followerAvatar: user.avatarUrl || '',
        }, id, { visibleTo: 'public' })
      }
    } catch (e) { /* ignore */ }
  }, [followingIds])

  return { isFollowing, toggleFollow, loaded }
}

export async function followerCount(targetId) {
  try { return await db.countShared('follows', { targetId }) } catch (e) { return 0 }
}

// Full clickable list of who follows `targetId`.
export async function getFollowersList(targetId) {
  try {
    const rows = await db.selectShared('follows', { targetId }, { limit: 500 })
    return rows.map((r) => ({ id: r.followerId, name: r.followerName || 'MiLey user', avatarUrl: r.followerAvatar || '', kind: 'user' }))
  } catch (e) { return [] }
}

// Full clickable list of who/what `userId` follows.
export async function getFollowingList(userId) {
  try {
    const rows = await db.selectShared('follows', { followerId: userId }, { limit: 500 })
    return rows.map((r) => ({ id: r.targetId, name: r.targetName || 'MiLey user', avatarUrl: r.targetAvatar || '', kind: r.targetType || 'user', username: r.targetUsername || '' }))
  } catch (e) { return [] }
}
