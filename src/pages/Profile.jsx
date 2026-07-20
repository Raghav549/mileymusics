import { useEffect, useMemo, useState } from 'react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { push } from '../lib/push'
import { useLiveShared } from '../lib/useLive'
import { followerCount, getFollowersList, getFollowingList } from '../hooks/useFollows'
import { Cover } from '../components/TrackViews'
import { useNavigate } from 'react-router-dom'
import {
  ProfileIcon, EditIcon, CloseIcon, ChartIcon, UsersIcon, UploadIcon, HeartIcon, CheckIcon,
  MessageIcon, BellIcon, RoomIcon, CalendarIcon, ChannelIcon, QRIcon, StreakIcon, ThemeIcon,
  LinkIcon, FlagIcon, PlusIcon, ShieldIcon,
} from '../components/icons'
import { timeAgo } from '../musicHelpers'
import { useNotifications, useUnreadMessageCount } from '../hooks/useNotifications'
import { useMyPermissions } from '../permissions'
import QRCard from '../components/QRCard'
import { shareBase } from '../shareBase'
import FollowListModal from '../components/FollowListModal'

const PROFILE_THEMES = [
  { key: 'signature', label: 'Signature', grad: 'from-emerald-500/20 to-pink-500/20' },
  { key: 'sunset', label: 'Sunset', grad: 'from-orange-500/25 to-pink-600/25' },
  { key: 'ocean', label: 'Ocean', grad: 'from-emerald-500/25 to-sky-500/20' },
  { key: 'violet', label: 'Violet', grad: 'from-fuchsia-500/25 to-indigo-500/20' },
]

export default function Profile() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [history, setHistory] = useState([])
  const [showQR, setShowQR] = useState(false)
  const [followModal, setFollowModal] = useState(null)
  const [pushState, setPushState] = useState(() => push.getPermission ? push.getPermission() : 'default')
  const { unreadCount } = useNotifications()
  const unreadMsgCount = useUnreadMessageCount()
  const { isAdminish } = useMyPermissions()
  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const { data: allPlaylists } = useLiveShared('playlists', { order: '-createdAt', limit: 200 })

  const myTracks = useMemo(() => (allTracks || []).filter((t) => t.artistId === user?.id), [allTracks, user])
  const myPlaylists = useMemo(() => (allPlaylists || []).filter((p) => p.ownerId === user?.id), [allPlaylists, user])
  const totalPlays = useMemo(() => myTracks.reduce((s, t) => s + (t.plays || 0), 0), [myTracks])
  const totalLikes = useMemo(() => myTracks.reduce((s, t) => s + (t.likesCount || 0), 0), [myTracks])

  const favoriteGenres = useMemo(() => {
    const counts = {}
    for (const h of history) if (h.genre) counts[h.genre] = (counts[h.genre] || 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g)
  }, [history])

  useEffect(() => {
    if (!user) return
    db.getShared('profiles', user.id).then(setProfile).catch(() => setProfile(null))
    followerCount(user.id).then(setFollowers)
    db.selectShared('follows', { followerId: user.id }, { limit: 500 }).then((r) => setFollowingCount(r.length))
    db.select('history', {}, { limit: 200, order: '-createdAt' }).then(setHistory)
  }, [user])

  const badges = []
  if (totalPlays >= 100) badges.push('Rising Star')
  if (totalPlays >= 1000) badges.push('Crowd Favorite')
  if (myTracks.length >= 5) badges.push('Prolific Uploader')
  if (followers >= 10) badges.push('Community Voice')

  const streak = useMemo(() => {
    if (!history.length) return 0
    const days = new Set(history.map((h) => (h.playedAt || '').slice(0, 10)))
    let count = 0
    const d = new Date()
    for (;;) {
      const key = d.toISOString().slice(0, 10)
      if (days.has(key)) { count++; d.setDate(d.getDate() - 1) } else break
    }
    return count
  }, [history])
  if (streak >= 3) badges.push(`${streak}-Day Streak`)

  const theme = PROFILE_THEMES.find((t) => t.key === profile?.theme) || PROFILE_THEMES[0]
  const profileUrl = `${shareBase()}/#/artist/${user?.id}`

  return (
    <div className="max-w-4xl mx-auto w-full pb-8">
      <div className="relative h-40 md:h-56 w-full">
        {profile?.bannerUrl ? (
          <img src={profile.bannerUrl} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${theme.grad}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
      </div>

      <div className="px-5 -mt-12 relative">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-full border-4 border-[#0B0B0B] overflow-hidden bg-gradient-to-br from-emerald-500/40 to-pink-500/40 flex items-center justify-center">
            {profile?.avatarUrl ? <img src={profile.avatarUrl} className="w-full h-full object-cover" /> : <ProfileIcon size={30} className="text-white/60" />}
          </div>
          <div className="flex gap-2 mb-1">
            <button onClick={() => navigate('/notifications')} className="relative card-surface w-10 h-10 rounded-full flex items-center justify-center text-white/60">
              <BellIcon size={16} />
              {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grad-brand text-[9px] font-bold text-black flex items-center justify-center">{unreadCount}</span>}
            </button>
            <button onClick={() => navigate('/messages')} className="relative card-surface w-10 h-10 rounded-full flex items-center justify-center text-white/60">
              <MessageIcon size={16} />
              {unreadMsgCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full grad-brand text-[9px] font-bold text-black flex items-center justify-center">{unreadMsgCount}</span>}
            </button>
            <button onClick={() => setShowQR(true)} className="card-surface w-10 h-10 rounded-full flex items-center justify-center text-white/60"><QRIcon size={16} /></button>
            <button onClick={() => setEditing(true)} className="card-surface w-10 h-10 rounded-full flex items-center justify-center text-white/60">
              <EditIcon size={16} />
            </button>
          </div>
        </div>

        <h1 className="font-display font-bold text-xl text-white mt-3">{profile?.displayName || user?.displayName || 'MiLey user'}</h1>
        {profile?.customUsername && <p className="text-sm text-white/40">@{profile.customUsername}</p>}
        {profile?.bio && <p className="text-sm text-white/50 mt-1 max-w-lg">{profile.bio}</p>}

        {profile?.links?.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-2">
            {profile.links.map((l, i) => l && <a key={i} href={l} target="_blank" rel="noreferrer" className="text-xs grad-brand-text font-medium flex items-center gap-1"><LinkIcon size={11} /> {l.replace(/^https?:\/\//, '').slice(0, 24)}</a>)}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => navigate('/rooms')} className="text-xs font-medium card-surface px-3 py-2 rounded-xl text-white/70 flex items-center gap-1.5"><RoomIcon size={14} /> Listening Parties</button>
          <button onClick={() => navigate('/premieres')} className="text-xs font-medium card-surface px-3 py-2 rounded-xl text-white/70 flex items-center gap-1.5"><CalendarIcon size={14} /> Premieres</button>
          <button onClick={() => navigate('/channel-dashboard')} className="text-xs font-medium card-surface px-3 py-2 rounded-xl text-white/70 flex items-center gap-1.5"><ChannelIcon size={14} /> My Channel</button>
          {isAdminish && <button onClick={() => navigate('/admin/reports')} className="text-xs font-medium card-surface px-3 py-2 rounded-xl text-white/70 flex items-center gap-1.5"><ShieldIcon size={14} /> Moderation</button>}
        </div>

        <div className="flex gap-5 mt-4 text-sm">
          <button onClick={() => setFollowModal('followers')} className="text-white"><b>{followers}</b> <span className="text-white/40">Followers</span></button>
          <button onClick={() => setFollowModal('following')} className="text-white"><b>{followingCount}</b> <span className="text-white/40">Following</span></button>
          <span className="text-white"><b>{myTracks.length}</b> <span className="text-white/40">Uploads</span></span>
        </div>

        {pushState !== 'granted' && (
          <button
            onClick={async () => { const p = await push.requestPermission(); setPushState(p); if (p === 'granted') await push.subscribe() }}
            className="mt-4 w-full flex items-center justify-center gap-2 card-surface rounded-2xl py-3 text-sm font-medium grad-brand-text"
          >
            <BellIcon size={15} /> Enable Notifications
          </button>
        )}

        {badges.length > 0 && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {badges.map((b) => (
              <span key={b} className="text-xs font-medium px-3 py-1.5 rounded-full card-surface grad-brand-text flex items-center gap-1">
                <CheckIcon size={12} /> {b}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-6">
          <Stat icon={<ChartIcon size={16} />} label="Total Plays" value={totalPlays} />
          <Stat icon={<HeartIcon size={16} />} label="Total Likes" value={totalLikes} />
          <Stat icon={<UploadIcon size={16} />} label="Uploads" value={myTracks.length} />
        </div>

        {favoriteGenres.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-white/40 mb-2">Favorite Genres</p>
            <div className="flex gap-2 flex-wrap">
              {favoriteGenres.map((g) => <span key={g} className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-white/70">{g}</span>)}
            </div>
          </div>
        )}

        {myPlaylists.length > 0 && (
          <div className="mt-7">
            <p className="font-display font-bold text-white mb-3">My Playlists</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {myPlaylists.slice(0, 6).map((p) => (
                <div key={p.id} className="text-left">
                  <div className="relative aspect-square"><Cover track={{ title: p.title, coverUrl: p.coverUrl }} size="fill" rounded="rounded-2xl" /></div>
                  <p className="mt-1.5 text-sm text-white truncate">{p.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-7">
            <p className="font-display font-bold text-white mb-3">Activity Timeline</p>
            <div className="space-y-2">
              {history.slice(0, 8).map((h, i) => (
                <div key={h.id + i} className="flex items-center gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full grad-brand shrink-0" />
                  <span className="text-white/60 truncate">Played <span className="text-white">{h.title}</span></span>
                  <span className="text-white/25 text-xs ml-auto shrink-0">{timeAgo(h.playedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => auth.signOut()}
          className="w-full mt-8 py-3 rounded-2xl text-sm font-medium text-white/50 card-surface"
        >
          Sign out
        </button>
      </div>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(p) => { setProfile(p); setEditing(false) }}
        />
      )}
      {showQR && <QRCard url={profileUrl} name={profile?.displayName || user?.displayName || 'MiLey user'} onClose={() => setShowQR(false)} />}
      {followModal === 'followers' && <FollowListModal title="Followers" loader={() => getFollowersList(user.id)} onClose={() => setFollowModal(null)} />}
      {followModal === 'following' && <FollowListModal title="Following" loader={() => getFollowingList(user.id)} onClose={() => setFollowModal(null)} />}
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="card-surface rounded-2xl p-3 flex flex-col items-center gap-1">
      <div className="grad-brand-text">{icon}</div>
      <span className="font-display font-bold text-white text-lg">{value}</span>
      <span className="text-[10px] text-white/40">{label}</span>
    </div>
  )
}

function EditProfileModal({ profile, onClose, onSaved }) {
  const user = auth.getCurrentUser()
  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [customUsername, setCustomUsername] = useState(profile?.customUsername || '')
  const [links, setLinks] = useState((profile?.links && profile.links.length ? profile.links : ['']))
  const [theme, setTheme] = useState(profile?.theme || 'signature')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatarUrl || '')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(profile?.bannerUrl || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      let avatarUrl = profile?.avatarUrl || ''
      let bannerUrl = profile?.bannerUrl || ''
      if (avatarFile) { const r = await storage.upload(avatarFile, avatarFile.name); avatarUrl = r.url }
      if (bannerFile) { const r = await storage.upload(bannerFile, bannerFile.name); bannerUrl = r.url }
      const data = {
        displayName: displayName.trim() || 'MiLey user', bio, avatarUrl, bannerUrl, userId: user.id,
        customUsername: customUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        links: links.map((l) => l.trim()).filter(Boolean), theme,
      }
      const saved = await db.upsertShared('profiles', data, user.id, { visibleTo: 'public' })
      onSaved(saved)
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">Edit Profile</h3>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>

        <label className="block w-full aspect-[3/1] rounded-2xl card-surface overflow-hidden mb-4 cursor-pointer relative">
          {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">Cover Banner</div>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) } }} />
        </label>

        <label className="w-20 h-20 rounded-full card-surface overflow-hidden mx-auto -mt-12 mb-4 block cursor-pointer border-4 border-[#141414]">
          {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">Avatar</div>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) } }} />
        </label>

        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <input value={customUsername} onChange={(e) => setCustomUsername(e.target.value)} placeholder="Custom username (e.g. luna_music)" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={3} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />

        <p className="text-xs text-white/40 mb-2">Profile links</p>
        {links.map((l, i) => (
          <input key={i} value={l} onChange={(e) => setLinks((arr) => arr.map((x, xi) => xi === i ? e.target.value : x))} placeholder="https://…" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-2 outline-none" />
        ))}
        <button onClick={() => setLinks((arr) => [...arr, ''])} className="text-xs grad-brand-text font-medium mb-4">+ Add another link</button>

        <p className="text-xs text-white/40 mb-2">Profile theme</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {PROFILE_THEMES.map((t) => (
            <button key={t.key} onClick={() => setTheme(t.key)} className={`aspect-square rounded-xl bg-gradient-to-br ${t.grad} border-2 ${theme === t.key ? 'border-white' : 'border-transparent'}`} title={t.label} />
          ))}
        </div>

        <button onClick={save} disabled={saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
