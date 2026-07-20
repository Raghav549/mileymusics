import { useState } from 'react'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { ensureCategory, GENRE_SUGGESTIONS, LANGUAGE_SUGGESTIONS, MOOD_SUGGESTIONS } from '../musicHelpers'
import { CloseIcon, TrashIcon, CoverIcon, BannerIcon, LockIcon, GlobeIcon, UsersIcon } from './icons'

// Edit any track/podcast metadata WITHOUT touching the audio file — title,
// description, genre, language, mood, tags, cover, banner, lyrics, visibility,
// release date, copyright note. Also supports permanent delete by the owner.
export default function EditTrackModal({ track, onClose, onSaved, onDeleted }) {
  const [title, setTitle] = useState(track.title || '')
  const [description, setDescription] = useState(track.description || '')
  const [genre, setGenre] = useState(track.genre || '')
  const [language, setLanguage] = useState(track.language || '')
  const [mood, setMood] = useState(track.mood || '')
  const [tags, setTags] = useState((track.tags || []).join(', '))
  const [lyrics, setLyrics] = useState(track.lyrics || '')
  const [visibility, setVisibility] = useState(track.visibility || 'public')
  const [scheduledAt, setScheduledAt] = useState(track.scheduledAt ? track.scheduledAt.slice(0, 16) : '')
  const [copyright, setCopyright] = useState(track.copyrightInfo || '')
  const [coverPreview, setCoverPreview] = useState(track.coverUrl || '')
  const [coverFile, setCoverFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(track.bannerUrl || '')
  const [bannerFile, setBannerFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      let coverUrl = track.coverUrl
      let bannerUrl = track.bannerUrl
      if (coverFile) { const r = await storage.upload(coverFile, coverFile.name); coverUrl = r.url }
      if (bannerFile) { const r = await storage.upload(bannerFile, bannerFile.name); bannerUrl = r.url }
      if (genre) await ensureCategory(genre, 'genre')
      if (language) await ensureCategory(language, 'language')
      if (mood) await ensureCategory(mood, 'mood')
      const patch = {
        title: title.trim(), description, genre, language, mood, lyrics,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility, coverUrl, bannerUrl, copyrightInfo: copyright,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      }
      await db.updateShared('tracks', track.id, patch)
      onSaved({ ...track, ...patch })
    } catch (e) { /* ignore */ }
    setSaving(false)
  }

  const del = async () => {
    try { await db.deleteShared('tracks', track.id); onDeleted?.(track.id) } catch (e) { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full md:max-w-md bg-[#141414] rounded-t-3xl md:rounded-3xl p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] overflow-y-auto animate-sheet-up" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white text-lg">Edit {track.type === 'podcast' ? 'Episode' : 'Track'}</h3>
          <button onClick={onClose} className="text-white/50"><CloseIcon size={18} /></button>
        </div>

        <div className="flex gap-3 mb-4">
          <label className="w-20 h-20 rounded-2xl card-surface overflow-hidden cursor-pointer shrink-0">
            {coverPreview ? <img src={coverPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><CoverIcon size={20} className="text-white/30" /></div>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)) } }} />
          </label>
          <label className="flex-1 rounded-2xl card-surface overflow-hidden cursor-pointer">
            {bannerPreview ? <img src={bannerPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center py-6"><BannerIcon size={20} className="text-white/30" /></div>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)) } }} />
          </label>
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />

        <div className="grid grid-cols-3 gap-2 mb-3">
          <input value={language} onChange={(e) => setLanguage(e.target.value)} list="e-lang" placeholder="Language" className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none" />
          <input value={genre} onChange={(e) => setGenre(e.target.value)} list="e-genre" placeholder="Genre" className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none" />
          <input value={mood} onChange={(e) => setMood(e.target.value)} list="e-mood" placeholder="Mood" className="bg-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 outline-none" />
          <datalist id="e-lang">{LANGUAGE_SUGGESTIONS.map((l) => <option key={l} value={l} />)}</datalist>
          <datalist id="e-genre">{GENRE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
          <datalist id="e-mood">{MOOD_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
        </div>

        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />
        <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Lyrics (plain, or timed lines like [00:12] your line)" rows={4} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none resize-none" />
        <input value={copyright} onChange={(e) => setCopyright(e.target.value)} placeholder="Copyright info (e.g. © 2026 Your Name)" className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 mb-3 outline-none" />

        <p className="text-xs text-white/40 mb-2">Release date (scheduled publishing)</p>
        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white mb-3 outline-none [color-scheme:dark]" />

        <p className="text-xs text-white/40 mb-2">Visibility</p>
        <div className="flex gap-2 mb-5">
          {[{ k: 'public', l: 'Public', Icon: GlobeIcon }, { k: 'friends', l: 'Friends', Icon: UsersIcon }, { k: 'private', l: 'Private', Icon: LockIcon }].map(({ k, l, Icon }) => (
            <button key={k} onClick={() => setVisibility(k)} className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium ${visibility === k ? 'btn-brand text-black' : 'bg-white/5 text-white/50'}`}><Icon size={16} /> {l}</button>
          ))}
        </div>

        {confirmDelete ? (
          <div className="card-surface rounded-2xl p-4 mb-3">
            <p className="text-sm text-white mb-3">Permanently delete this {track.type === 'podcast' ? 'episode' : 'track'}? This can't be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 card-surface py-2.5 rounded-xl text-sm text-white">Cancel</button>
              <button onClick={del} className="flex-1 bg-red-500/90 py-2.5 rounded-xl text-sm text-white font-semibold">Delete</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-red-400 mb-3"><TrashIcon size={15} /> Delete permanently</button>
        )}

        <button onClick={save} disabled={saving || !title.trim()} className="w-full btn-brand text-black font-semibold py-3 rounded-2xl text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </div>
  )
}
