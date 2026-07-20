import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { useLiveShared } from '../lib/useLive'
import { ensureCategory, GENRE_SUGGESTIONS, LANGUAGE_SUGGESTIONS } from '../musicHelpers'
import { notify } from '../hooks/useNotifications'
import { PRACHI_USER_ID } from '../permissions'
import EditTrackModal from '../components/EditTrackModal'
import { Cover, TrackRow } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import {
  ChannelIcon, CoverIcon, BannerIcon, EditIcon, CheckIcon, TrashIcon, LinkIcon,
  VerifiedIcon, CalendarIcon,
} from '../components/icons'

const CATEGORIES = ['Music Artist', 'Podcast Channel', 'Band', 'Label', 'DJ', 'Composer', 'Cover Artist', 'Community']

export default function ChannelDashboard() {
  const navigate = useNavigate()
  const user = auth.getCurrentUser()
  const [channel, setChannel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('songs')
  const [editTrack, setEditTrack] = useState(null)
  const [showAnnounce, setShowAnnounce] = useState(false)

  const { data: tracks } = useLiveShared('tracks', { order: '-createdAt', limit: 400 })
  const { data: albums } = useLiveShared('albums', { order: '-createdAt', limit: 100 })
  const { data: playlists } = useLiveShared('playlists', { order: '-createdAt', limit: 100 })
  const { data: announcements } = useLiveShared('announcements', { order: '-createdAt', limit: 50 })

  const load = async () => {
    setLoading(true)
    const rows = await db.selectShared('channels', { ownerId: user.id }, { limit: 1 }).catch(() => [])
    setChannel(rows[0] || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const mySongs = useMemo(() => (tracks || []).filter((t) => t.channelId === channel?.id && t.type !== 'podcast' && !t.albumId), [tracks, channel])
  const myEpisodes = useMemo(() => (tracks || []).filter((t) => t.channelId === channel?.id && t.type === 'podcast'), [tracks, channel])
  const myAlbums = useMemo(() => (albums || []).filter((a) => a.channelId === channel?.id || (a.artistId === user?.id)), [albums, channel, user])
  const myPlaylists = useMemo(() => (playlists || []).filter((p) => p.channelId === channel?.id), [playlists, channel])
  const myAnnouncements = useMemo(() => (announcements || []).filter((a) => a.channelId === channel?.id), [announcements, channel])

  if (loading) return null

  if (!channel) return <CreateChannelForm user={user} onCreated={(c) => setChannel(c)} />

  return (
    <div className="max-w-4xl mx-auto w-full pb-8">
      <div className="relative h-40 md:h-56 w-full">
        {channel.bannerUrl ? <img src={channel.bannerUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-pink-500/20" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
      </div>
      <div className="px-5 -mt-12 relative">
        <div className="flex items-end justify-between">
          <div className="w-24 h-24 rounded-full border-4 border-[#0B0B0B] overflow-hidden bg-gradient-to-br from-emerald-500/40 to-pink-500/40 flex items-center justify-center">
            {channel.avatarUrl ? <img src={channel.avatarUrl} className="w-full h-full object-cover" /> : <ChannelIcon size={30} className="text-white/60" />}
          </div>
          <button onClick={() => setEditing(true)} className="mb-1 card-surface w-10 h-10 rounded-full flex items-center justify-center text-white/60"><EditIcon size={16} /></button>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          <h1 className="font-display font-bold text-xl text-white">{channel.name}</h1>
          {channel.verified && <VerifiedIcon size={17} className="grad-brand-text" />}
        </div>
        <p className="text-sm text-white/40">@{channel.username} · {channel.category}</p>

        {channel.status === 'pending' && (
          <div className="mt-3 card-surface rounded-2xl px-4 py-3 border border-yellow-400/20">
            <p className="text-sm text-yellow-300/90 font-medium">Channel pending approval</p>
            <p className="text-xs text-white/40 mt-0.5">An admin is reviewing your channel. You can upload music once it’s approved.</p>
          </div>
        )}
        {channel.status === 'rejected' && (
          <div className="mt-3 card-surface rounded-2xl px-4 py-3 border border-red-400/20">
            <p className="text-sm text-red-300/90 font-medium">Channel not approved</p>
            <p className="text-xs text-white/40 mt-0.5">Update your details and resubmit for review from Edit Channel.</p>
          </div>
        )}
        {channel.status === 'approved' && (
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => navigate('/upload')} className="btn-brand text-black text-xs font-semibold px-4 py-2 rounded-xl">Open Upload Studio</button>
          </div>
        )}
        {channel.status === 'approved' && (
          <VerificationCard channel={channel} onChange={(patch) => setChannel({ ...channel, ...patch })} />
        )}
        <button onClick={() => navigate(`/channel/${channel.username}`)} className="text-xs grad-brand-text font-medium mt-3 block">View public channel page →</button>

        <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar overscroll-x-contain">
          {['songs', 'episodes', 'albums', 'playlists', 'announcements'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-medium capitalize shrink-0 ${tab === t ? 'btn-brand text-black' : 'card-surface text-white/60'}`}>{t}</button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'songs' && (mySongs.length ? mySongs.map((t) => <DashRow key={t.id} track={t} onEdit={() => setEditTrack(t)} />) : <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No songs uploaded from this channel yet" subtitle="Use the Upload Studio, then manage everything here." />)}
          {tab === 'episodes' && (myEpisodes.length ? myEpisodes.map((t) => <DashRow key={t.id} track={t} onEdit={() => setEditTrack(t)} />) : <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No podcast episodes yet" />)}
          {tab === 'albums' && (myAlbums.length ? myAlbums.map((a) => <AlbumDashRow key={a.id} album={a} />) : <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No albums yet" />)}
          {tab === 'playlists' && (myPlaylists.length ? myPlaylists.map((p) => <AlbumDashRow key={p.id} album={p} isPlaylist />) : <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No channel playlists yet" />)}
          {tab === 'announcements' && (
            <div>
              <button onClick={() => setShowAnnounce(true)} className="w-full mb-3 btn-brand text-black font-semibold py-2.5 rounded-2xl text-sm">Post Announcement</button>
              {myAnnouncements.length === 0 && <EmptyState icon={<ChannelIcon size={22} className="grad-brand-text" />} title="No announcements yet" />}
              <div className="space-y-2">
                {myAnnouncements.map((a) => (
                  <div key={a.id} className="card-surface rounded-2xl p-4 flex items-start justify-between gap-3">
                    <div><p className="text-sm text-white">{a.text}</p><p className="text-xs text-white/30 mt-1">{new Date(a.createdAt).toLocaleString()}</p></div>
                    <button onClick={() => db.deleteShared('announcements', a.id)} className="text-white/30 shrink-0"><TrashIcon size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && <EditChannelForm channel={channel} onClose={() => setEditing(false)} onSaved={(c) => { setChannel(c); setEditing(false) }} />}
      {editTrack && <EditTrackModal track={editTrack} onClose={() => setEditTrack(null)} onSaved={() => setEditTrack(null)} onDeleted={() => setEditTrack(null)} />}
      {showAnnounce && (
        <AnnounceModal channel={channel} onClose={() => setShowAnnounce(false)} />
      )}
    </div>
  )
}

function VerificationCard({ channel, onChange }) {
  const [busy, setBusy] = useState(false)

  if (channel.verified) {
    return (
      <div className="mt-3 card-surface rounded-2xl px-4 py-3 border border-emerald-400/20 flex items-center gap-2.5">
        <VerifiedIcon size={18} className="grad-brand-text shrink-0" />
        <div>
          <p className="text-sm text-white font-medium">Verified channel</p>
          <p className="text-xs text-white/40">The green badge now shows beside your name everywhere.</p>
        </div>
      </div>
    )
  }

  if (channel.verificationRequested) {
    return (
      <div className="mt-3 card-surface rounded-2xl px-4 py-3 border border-yellow-400/20">
        <p className="text-sm text-yellow-300/90 font-medium">Verification pending review</p>
        <p className="text-xs text-white/40 mt-0.5">An admin will review your request shortly.</p>
      </div>
    )
  }

  const request = async () => {
    setBusy(true)
    try {
      await db.updateShared('channels', channel.id, { verificationRequested: true, verificationRejected: false })
      const ownerEnvId = import.meta.env.VITE_APP_OWNER_ID
      for (const rid of [ownerEnvId, PRACHI_USER_ID]) {
        if (rid) notify(rid, { type: 'channel', title: 'Verification request', body: `${channel.name} (@${channel.username}) requested verification`, url: '/admin/reports' })
      }
      onChange({ verificationRequested: true, verificationRejected: false })
    } catch (e) { /* ignore */ }
    setBusy(false)
  }

  return (
    <div className="mt-3 card-surface rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 mb-1"><VerifiedIcon size={16} className="text-white/40" /><p className="text-sm text-white font-medium">Get verified</p></div>
      {channel.verificationRejected && <p className="text-xs text-red-300/80 mb-1.5">Your previous request was declined. You can request again.</p>}
      <p className="text-xs text-white/40 mb-3">Request a green verified badge shown beside your channel name across MiLey.</p>
      <button onClick={request} disabled={busy} className="btn-brand text-black text-xs font-semibold px-4 py-2 rounded-xl disabled:opacity-50">{busy ? 'Requesting…' : 'Request Verification'}</button>
    </div>
  )
}

function DashRow({ track, onEdit }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0"><TrackRow track={track} queueList={[track]} showMenu={false} /></div>
      <button onClick={onEdit} className="p-2 text-white/40 shrink-0"><EditIcon size={16} /></button>
    </div>
  )
}

function AlbumDashRow({ album, isPlaylist }) {
  const del = async () => {
    await db.deleteShared(isPlaylist ? 'playlists' : 'albums', album.id).catch(() => {})
  }
  return (
    <div className="flex items-center gap-3 py-2">
      <Cover track={{ title: album.title, coverUrl: album.coverUrl }} size={44} />
      <span className="flex-1 text-sm text-white truncate">{album.title}</span>
      <button onClick={del} className="p-2 text-white/40"><TrashIcon size={16} /></button>
    </div>
  )
}

function AnnounceModal({ channel, onClose }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const post = async () => {
    if (!text.trim()) return
    setSaving(true)
    await db.insertShared('announcements', { channelId: channel.id, channelName: channel.name, text: text.trim() }, undefined, { visibleTo: 'public' }).catch(() => {})
    setSaving(false)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
        <h3 className="font-display font-bold text-white text-lg mb-3">New Announcement</h3>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Share news with your followers…" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-4 outline-none resize-none" />
        <button onClick={post} disabled={saving || !text.trim()} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Posting…' : 'Post'}</button>
      </div>
    </div>
  )
}

function CreateChannelForm({ user, onCreated }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [language, setLanguage] = useState('')
  const [country, setCountry] = useState('')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState(user?.email || '')
  const [instagram, setInstagram] = useState('')
  const [website, setWebsite] = useState('')
  const [verify, setVerify] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    const uname = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!name.trim() || !uname) { setError('Name and username are required.'); return }
    setSaving(true)
    setError('')
    try {
      const existing = await db.selectShared('channels', { username: uname }, { limit: 1 })
      if (existing.length) { setError('That username is taken — try another.'); setSaving(false); return }
      let avatarUrl = ''; let bannerUrl = ''
      if (avatarFile) { const r = await storage.upload(avatarFile, avatarFile.name); avatarUrl = r.url }
      if (bannerFile) { const r = await storage.upload(bannerFile, bannerFile.name); bannerUrl = r.url }
      if (language) await ensureCategory(language, 'language')
      const channel = await db.insertShared('channels', {
        ownerId: user.id, ownerName: user.displayName || 'MiLey user', ownerEmail: user.email || '',
        name: name.trim(), username: uname, avatarUrl, bannerUrl, description,
        category, language, country, contact, socialLinks: { instagram, website },
        verificationRequested: verify, verified: false, status: 'pending',
      }, undefined, { visibleTo: 'public', writableBy: 'anyone', writableFields: ['status', 'verified', 'verificationRequested', 'verificationRejected'] })
      // Alert the approvers (Main Admin + Prachi) of the new channel request.
      const ownerEnvId = import.meta.env.VITE_APP_OWNER_ID
      for (const rid of [ownerEnvId, PRACHI_USER_ID]) {
        if (rid) notify(rid, { type: 'channel', title: 'New channel request', body: `${name.trim()} (@${uname}) is awaiting approval`, url: '/admin/reports' })
      }
      onCreated(channel)
    } catch (e) { setError('Something went wrong — try again.') }
    setSaving(false)
  }

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-5"><ChannelIcon size={22} className="grad-brand-text" /><h1 className="font-display font-bold text-xl text-white">Create Your Channel</h1></div>
      <p className="text-sm text-white/40 mb-5">Set up a channel to upload songs, albums, podcasts and announcements from one dashboard. New channels are reviewed by an admin before you can upload.</p>

      <div className="flex gap-4 mb-4">
        <label className="w-20 h-20 rounded-full card-surface overflow-hidden cursor-pointer shrink-0 flex items-center justify-center">
          {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <CoverIcon size={20} className="text-white/30" />}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) } }} />
        </label>
        <label className="flex-1 rounded-2xl card-surface overflow-hidden cursor-pointer flex items-center justify-center">
          {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : <BannerIcon size={20} className="text-white/30" />}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) } }} />
        </label>
      </div>

      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Unique username (e.g. luna_music)" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />

      <div className="grid grid-cols-3 gap-2 mb-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white outline-none">
          {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#141414]">{c}</option>)}
        </select>
        <input value={language} onChange={(e) => setLanguage(e.target.value)} list="ch-lang" placeholder="Language" className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none" />
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none" />
        <datalist id="ch-lang">{LANGUAGE_SUGGESTIONS.map((l) => <option key={l} value={l} />)}</datalist>
      </div>

      <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram / social link" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
      <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (optional)" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact email" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-4 outline-none" />

      <label className="flex items-start gap-3 mb-5 cursor-pointer">
        <div onClick={() => setVerify((v) => !v)} className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center shrink-0 ${verify ? 'btn-brand' : 'bg-white/10'}`}>{verify && <CheckIcon size={13} color="#0B0B0B" />}</div>
        <span className="text-xs text-white/50">Request verification badge review for this channel.</span>
      </label>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <button onClick={create} disabled={saving} className="w-full btn-brand text-black font-semibold py-3.5 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Creating…' : 'Create Channel'}</button>
    </div>
  )
}

function EditChannelForm({ channel, onClose, onSaved }) {
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description || '')
  const [category, setCategory] = useState(channel.category)
  const [language, setLanguage] = useState(channel.language || '')
  const [country, setCountry] = useState(channel.country || '')
  const [contact, setContact] = useState(channel.contact || '')
  const [instagram, setInstagram] = useState(channel.socialLinks?.instagram || '')
  const [website, setWebsite] = useState(channel.socialLinks?.website || '')
  const [verify, setVerify] = useState(!!channel.verificationRequested)
  const [avatarPreview, setAvatarPreview] = useState(channel.avatarUrl || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(channel.bannerUrl || '')
  const [bannerFile, setBannerFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      let avatarUrl = channel.avatarUrl; let bannerUrl = channel.bannerUrl
      if (avatarFile) { const r = await storage.upload(avatarFile, avatarFile.name); avatarUrl = r.url }
      if (bannerFile) { const r = await storage.upload(bannerFile, bannerFile.name); bannerUrl = r.url }
      const resubmit = channel.status === 'rejected'
      const patch = { name, description, category, language, country, contact, avatarUrl, bannerUrl, verificationRequested: verify, verificationRejected: false, socialLinks: { instagram, website } }
      if (resubmit) patch.status = 'pending'
      await db.updateShared('channels', channel.id, patch)
      if (resubmit) {
        const ownerEnvId = import.meta.env.VITE_APP_OWNER_ID
        for (const rid of [ownerEnvId, PRACHI_USER_ID]) {
          if (rid) notify(rid, { type: 'channel', title: 'Channel resubmitted', body: `${name} (@${channel.username}) was resubmitted for approval`, url: '/admin/reports' })
        }
      }
      onSaved({ ...channel, ...patch })
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <h3 className="font-display font-bold text-white text-lg mb-4">Edit Channel</h3>
        <div className="flex gap-3 mb-4">
          <label className="w-16 h-16 rounded-full card-surface overflow-hidden cursor-pointer shrink-0">
            {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><CoverIcon size={16} className="text-white/30" /></div>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)) } }} />
          </label>
          <label className="flex-1 rounded-2xl card-surface overflow-hidden cursor-pointer">
            {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center py-4"><BannerIcon size={16} className="text-white/30" /></div>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) } }} />
          </label>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-3 outline-none" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-3 outline-none resize-none" />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white outline-none">
            {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#141414]">{c}</option>)}
          </select>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white outline-none" />
        </div>
        <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Language" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-3 outline-none" />
        <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram / social link" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-3 outline-none" />
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-3 outline-none" />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact email" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-4 outline-none" />
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <div onClick={() => setVerify((v) => !v)} className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${verify ? 'btn-brand' : 'bg-white/10'}`}>{verify && <CheckIcon size={13} color="#0B0B0B" />}</div>
          <span className="text-xs text-white/50">Request verification review</span>
        </label>
        <button onClick={save} disabled={saving} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Channel'}</button>
      </div>
    </div>
  )
}
