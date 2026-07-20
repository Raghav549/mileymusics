import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { messaging } from '../lib/messaging'
import { useLiveShared } from '../lib/useLive'
import { useFollows, getFollowersList } from '../hooks/useFollows'
import { notify } from '../hooks/useNotifications'
import { TrackRow, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import FollowListModal from '../components/FollowListModal'
import { BackIcon, ProfileIcon, ChartIcon, MessageIcon, ChannelIcon } from '../components/icons'
import { isPublicVisible } from '../musicHelpers'

export default function ArtistProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [channel, setChannel] = useState(null)
  const [followers, setFollowers] = useState(0)
  const [showFollowers, setShowFollowers] = useState(false)
  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const { data: allAlbums } = useLiveShared('albums', { order: '-createdAt', limit: 100 })
  const { isFollowing, toggleFollow } = useFollows()
  const me = auth.getCurrentUser()

  useEffect(() => {
    db.getShared('profiles', id).then(setProfile).catch(() => setProfile(null))
    db.countShared('follows', { targetId: id }).then(setFollowers).catch(() => {})
    db.selectShared('channels', { ownerId: id }, { limit: 1 }).then((r) => setChannel(r[0] || null)).catch(() => {})
  }, [id])

  const messageUser = async () => {
    if (id === me?.id) return
    const ch = await messaging.createDM(id)
    navigate(`/chat/${ch.id}`)
  }

  const tracks = useMemo(() => (allTracks || []).filter((t) => t.artistId === id && isPublicVisible(t)), [allTracks, id])
  const albums = useMemo(() => (allAlbums || []).filter((a) => a.artistId === id), [allAlbums, id])
  const totalPlays = useMemo(() => tracks.reduce((s, t) => s + (t.plays || 0), 0), [tracks])
  const following = isFollowing(id)
  const isMe = me?.id === id

  return (
    <div className="max-w-4xl mx-auto w-full pb-8">
      <div className="relative h-40 md:h-56 w-full">
        {profile?.bannerUrl ? <img src={profile.bannerUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-pink-500/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"><BackIcon size={20} /></button>
      </div>

      <div className="px-5 -mt-12 relative">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-full border-4 border-[#0B0B0B] overflow-hidden bg-gradient-to-br from-emerald-500/40 to-pink-500/40 flex items-center justify-center">
            {profile?.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover" /> : <ProfileIcon size={30} className="text-white/60" />}
          </div>
          {!isMe && (
            <div className="flex gap-2 mb-1">
              <button onClick={messageUser} className="w-11 h-11 rounded-full card-surface flex items-center justify-center text-white"><MessageIcon size={17} /></button>
              <button onClick={() => toggleFollow(id, 'artist', profile?.displayName, profile?.avatarUrl).then(() => !following && notify(id, { type: 'follow', title: 'New follower', body: `${me?.displayName || 'Someone'} started following you`, url: `/artist/${me?.id}` }))} className={`px-5 py-2.5 rounded-2xl text-sm font-semibold ${following ? 'card-surface text-white' : 'btn-brand text-black'}`}>
                {following ? 'Following' : 'Follow'}
              </button>
            </div>
          )}
        </div>

        <h1 className="font-display font-bold text-xl text-white mt-3">{profile?.displayName || 'MiLey user'}</h1>
        {profile?.bio && <p className="text-sm text-white/50 mt-1 max-w-lg">{profile.bio}</p>}
        {channel && (
          <button onClick={() => navigate(`/channel/${channel.username}`)} className="mt-2 text-xs grad-brand-text font-medium flex items-center gap-1"><ChannelIcon size={13} /> Visit @{channel.username} channel</button>
        )}

        <div className="flex gap-5 mt-4 text-sm">
          <button onClick={() => setShowFollowers(true)} className="text-white"><b>{followers}</b> <span className="text-white/40">Followers</span></button>
          <span className="text-white"><b>{tracks.length}</b> <span className="text-white/40">Uploads</span></span>
          <span className="text-white flex items-center gap-1"><ChartIcon size={13} className="text-white/40" /><b>{totalPlays}</b> <span className="text-white/40">Plays</span></span>
        </div>

        {albums.length > 0 && (
          <div className="mt-7">
            <p className="font-display font-bold text-white mb-3">Albums</p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar overscroll-x-contain">
              {albums.map((a) => (
                <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="shrink-0 w-32 text-left">
                  <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-1.5 text-sm text-white truncate">{a.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-7">
          <p className="font-display font-bold text-white mb-3">Tracks</p>
          {tracks.length === 0 ? (
            <EmptyState icon={<ProfileIcon size={22} className="grad-brand-text" />} title="No public tracks yet" />
          ) : (
            <div className="space-y-0.5">{tracks.map((t) => <TrackRow key={t.id} track={t} queueList={tracks} showMenu={false} />)}</div>
          )}
        </div>
      </div>
      {showFollowers && <FollowListModal title="Followers" loader={() => getFollowersList(id)} onClose={() => setShowFollowers(false)} />}
    </div>
  )
}
