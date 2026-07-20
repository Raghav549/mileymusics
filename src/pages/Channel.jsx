import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { auth } from '../lib/auth'
import { messaging } from '../lib/messaging'
import { useLiveShared } from '../lib/useLive'
import { useFollows, followerCount, getFollowersList } from '../hooks/useFollows'
import { notify } from '../hooks/useNotifications'
import { TrackRow, Cover } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import FollowListModal from '../components/FollowListModal'
import { BackIcon, ChannelIcon, MessageIcon, VerifiedIcon, LinkIcon, PodcastIcon, ChannelIcon as AnnounceIcon } from '../components/icons'
import { isPublicVisible } from '../musicHelpers'

export default function Channel() {
  const { username } = useParams()
  const navigate = useNavigate()
  const me = auth.getCurrentUser()
  const [channel, setChannel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('songs')
  const [followers, setFollowers] = useState(0)
  const [showFollowers, setShowFollowers] = useState(false)
  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const { data: allAlbums } = useLiveShared('albums', { order: '-createdAt', limit: 100 })
  const { data: allPlaylists } = useLiveShared('playlists', { order: '-createdAt', limit: 100 })
  const { data: announcements } = useLiveShared('announcements', { order: '-createdAt', limit: 30 })
  const { isFollowing, toggleFollow } = useFollows()

  useEffect(() => {
    setLoading(true)
    db.selectShared('channels', { username }, { limit: 1 }).then((r) => setChannel(r[0] || null)).finally(() => setLoading(false))
  }, [username])

  useEffect(() => {
    if (channel?.id) followerCount(channel.id).then(setFollowers)
  }, [channel?.id])

  const songs = useMemo(() => (allTracks || []).filter((t) => t.channelId === channel?.id && t.type !== 'podcast' && isPublicVisible(t)), [allTracks, channel])
  const episodes = useMemo(() => (allTracks || []).filter((t) => t.channelId === channel?.id && t.type === 'podcast' && isPublicVisible(t)), [allTracks, channel])
  const albums = useMemo(() => (allAlbums || []).filter((a) => a.channelId === channel?.id), [allAlbums, channel])
  const playlists = useMemo(() => (allPlaylists || []).filter((p) => p.channelId === channel?.id), [allPlaylists, channel])
  const posts = useMemo(() => (announcements || []).filter((a) => a.channelId === channel?.id), [announcements, channel])

  if (loading) return null
  if (!channel) return <div className="h-full flex items-center justify-center text-white/40 text-sm">Channel not found.</div>

  const isMine = me?.id === channel.ownerId
  const following = isFollowing(channel.id)

  const messageOwner = async () => {
    if (channel.ownerId === me?.id) return
    const ch = await messaging.createDM(channel.ownerId)
    navigate(`/chat/${ch.id}`)
  }

  const follow = async () => {
    await toggleFollow(channel.id, 'channel', channel.name, channel.avatarUrl, channel.username)
    if (!following) notify(channel.ownerId, { type: 'follow', title: 'New follower', body: `${me?.displayName || 'Someone'} followed ${channel.name}`, url: `/channel/${channel.username}` })
  }

  return (
    <div className="max-w-4xl mx-auto w-full pb-8">
      <div className="relative h-40 md:h-56 w-full">
        {channel.bannerUrl ? <img src={channel.bannerUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-pink-500/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"><BackIcon size={20} /></button>
      </div>

      <div className="px-5 -mt-12 relative">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-full border-4 border-[#0B0B0B] overflow-hidden bg-gradient-to-br from-emerald-500/40 to-pink-500/40 flex items-center justify-center">
            {channel.avatarUrl ? <img src={channel.avatarUrl} className="w-full h-full object-cover" /> : <ChannelIcon size={30} className="text-white/60" />}
          </div>
          {!isMine && (
            <div className="flex gap-2 mb-1">
              <button onClick={messageOwner} className="w-11 h-11 rounded-full card-surface flex items-center justify-center text-white"><MessageIcon size={17} /></button>
              <button onClick={follow} className={`px-5 py-2.5 rounded-2xl text-sm font-semibold ${following ? 'card-surface text-white' : 'btn-brand text-black'}`}>{following ? 'Following' : 'Follow'}</button>
            </div>
          )}
          {isMine && <button onClick={() => navigate('/channel-dashboard')} className="mb-1 card-surface px-4 py-2.5 rounded-2xl text-sm font-medium text-white">Manage Channel</button>}
        </div>

        <div className="flex items-center gap-1.5 mt-3">
          <h1 className="font-display font-bold text-xl text-white">{channel.name}</h1>
          {channel.verified && <VerifiedIcon size={17} className="grad-brand-text" />}
        </div>
        <p className="text-sm text-white/40">@{channel.username} · {channel.category}{channel.language ? ` · ${channel.language}` : ''}{channel.country ? ` · ${channel.country}` : ''}</p>
        <button onClick={() => setShowFollowers(true)} className="text-sm text-white mt-2"><b>{followers}</b> <span className="text-white/40">Followers</span></button>
        {channel.description && <p className="text-sm text-white/60 mt-2 max-w-lg">{channel.description}</p>}
        {(channel.socialLinks?.instagram || channel.socialLinks?.website) && (
          <div className="flex gap-3 mt-2">
            {channel.socialLinks?.instagram && <a href={channel.socialLinks.instagram} target="_blank" rel="noreferrer" className="text-xs grad-brand-text flex items-center gap-1"><LinkIcon size={12} /> Instagram</a>}
            {channel.socialLinks?.website && <a href={channel.socialLinks.website} target="_blank" rel="noreferrer" className="text-xs grad-brand-text flex items-center gap-1"><LinkIcon size={12} /> Website</a>}
          </div>
        )}

        <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar overscroll-x-contain">
          {['songs', 'episodes', 'albums', 'playlists', 'announcements'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-medium capitalize shrink-0 ${tab === t ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t}</button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'songs' && (songs.length ? <div className="space-y-0.5">{songs.map((t) => <TrackRow key={t.id} track={t} queueList={songs} showMenu={false} />)}</div> : <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No songs yet" />)}
          {tab === 'episodes' && (episodes.length ? <div className="space-y-0.5">{episodes.map((t) => <TrackRow key={t.id} track={t} queueList={episodes} showMenu={false} />)}</div> : <EmptyState icon={<PodcastIcon size={22} className="grad-brand-text" />} title="No podcast episodes yet" />)}
          {tab === 'albums' && (albums.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {albums.map((a) => (
                <button key={a.id} onClick={() => navigate(`/album/${a.id}`)} className="text-left">
                  <div className="relative aspect-square"><Cover track={{ title: a.title, coverUrl: a.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm text-white truncate">{a.title}</p>
                </button>
              ))}
            </div>
          ) : <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No albums yet" />)}
          {tab === 'playlists' && (playlists.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {playlists.map((p) => (
                <button key={p.id} onClick={() => navigate(`/playlist/${p.id}`)} className="text-left">
                  <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-2 text-sm text-white truncate">{p.title}</p>
                </button>
              ))}
            </div>
          ) : <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No playlists yet" />)}
          {tab === 'announcements' && (posts.length ? (
            <div className="space-y-2">{posts.map((a) => <div key={a.id} className="card-surface rounded-2xl p-4"><p className="text-sm text-white">{a.text}</p><p className="text-xs text-white/30 mt-1">{new Date(a.createdAt).toLocaleString()}</p></div>)}</div>
          ) : <EmptyState icon={<AnnounceIcon size={22} className="grad-brand-text" />} title="No announcements yet" />)}
        </div>
      </div>
      {showFollowers && <FollowListModal title="Followers" loader={() => getFollowersList(channel.id)} onClose={() => setShowFollowers(false)} />}
    </div>
  )
}
