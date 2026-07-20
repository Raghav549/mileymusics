import { useState, useCallback, useMemo, useEffect } from 'react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'
import { ai } from '../lib/ai'
import { audio } from '../lib/audio'
import { storage } from '../lib/storage'
import { useLiveShared } from '../lib/useLive'
import { useMileyPlusStatus, submitSubscriptionRequest, buildUpiIntent, UPI_ID, MILEY_PLUS_PRICE } from '../mileyPlus'
import { TrackRow } from '../components/TrackViews'
import EmptyState from '../components/EmptyState'
import {
  MicIcon, CrownIcon, CloseIcon, TrashIcon, EditIcon, CoverIcon, HeartIcon,
  CheckIcon, LockIcon, PlayIcon, TimerIcon, CopyIcon,
} from '../components/icons'
import { LANGUAGE_SUGGESTIONS, GENRE_SUGGESTIONS, ensureCategory } from '../musicHelpers'

const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Rap', 'EDM', 'Lo-Fi', 'Classical', 'Folk', 'Devotional', 'Bollywood', 'Acoustic', 'Jazz', 'Blues', 'Country', 'Instrumental']
const MOODS = ['Happy', 'Sad', 'Romantic', 'Energetic', 'Calm', 'Nostalgic', 'Dreamy', 'Workout', 'Party']
const VOCALS = ['Male', 'Female', 'Duet', 'Instrumental']
const TEMPOS = [{ k: 'Slow', d: 'slow, relaxed tempo' }, { k: 'Medium', d: 'medium groove' }, { k: 'Fast', d: 'fast, high-energy tempo' }]
const DURATIONS = [15, 30, 45, 60]

const PROMPT_IDEAS = [
  'A romantic Hindi song about first love',
  'A sad breakup song',
  'A gym motivation anthem',
  'A song about missing my hometown',
  'A calm lo-fi track for late-night study',
]

const BENEFITS = [
  { icon: MicIcon, title: 'AI Song Studio', desc: 'Turn any idea, emotion or photo into an original song with lyrics, vocals and music.' },
  { icon: CoverIcon, title: 'AI Cover Art', desc: 'Every creation gets unique, auto-generated album artwork.' },
  { icon: HeartIcon, title: 'Unlimited Creations', desc: 'Save every song to your Library, edit, regenerate and build alternate versions.' },
  { icon: CrownIcon, title: 'Multi-language Vocals', desc: 'Create in Hindi, English, Tamil, Telugu, Bengali, Punjabi and more.' },
]

export default function AIStudio() {
  const { isPlus, status, loading } = useMileyPlusStatus()

  if (loading) {
    return <div className="h-full flex items-center justify-center text-white/40 text-sm">Loading MiLey AI…</div>
  }
  return isPlus ? <Studio /> : <Paywall status={status} />
}

/* ─────────────────────────  Paywall  ───────────────────────── */

const UPI_APPS = [
  { label: 'PhonePe', bg: '#5F259F' },
  { label: 'Google Pay', bg: '#4285F4' },
  { label: 'Paytm', bg: '#00BAF2' },
  { label: 'BHIM', bg: '#EA7900' },
]

function Paywall({ status }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const subscribe = async () => {
    setError('')
    setBusy(true)
    try {
      const user = auth.getCurrentUser() || (await auth.signIn())
      if (!user) { setBusy(false); return }
      let profile = null
      try { profile = await db.getShared('profiles', user.id) } catch (e) { /* ignore */ }
      await submitSubscriptionRequest({
        userName: profile?.displayName || user.displayName || 'MiLey user',
        username: profile?.customUsername || '',
        email: user.email || '',
      })
      // The request is now pending — trigger the native UPI intent so the
      // user's installed UPI app (PhonePe / Google Pay / Paytm / BHIM…) opens
      // with the amount pre-filled. Whether the user completes it, cancels it,
      // or the device has no UPI app, MiLey does NOT auto-unlock — the live
      // status hook flips this screen to "Waiting for Approval" the moment
      // the pending request is recorded, and stays there until the admin
      // approves it by hand.
      window.location.href = buildUpiIntent({ amount: MILEY_PLUS_PRICE, note: 'MiLey+ Subscription' })
    } catch (e) {
      setError(e?.message || 'Could not submit your subscription request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const copyUpi = () => {
    navigator.clipboard?.writeText(UPI_ID).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }

  if (status === 'pending') {
    return (
      <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-8 max-w-2xl mx-auto w-full">
        <div className="relative rounded-3xl overflow-hidden mb-6 p-6 border border-amber-300/20 text-center"
          style={{ background: 'radial-gradient(120% 90% at 15% 10%, rgba(0,224,168,0.14), transparent 55%), radial-gradient(90% 80% at 90% 20%, rgba(255,61,174,0.12), transparent 60%), #121212' }}>
          <div className="w-14 h-14 rounded-full bg-amber-400/15 flex items-center justify-center mx-auto mb-4">
            <TimerIcon size={26} className="text-amber-300" />
          </div>
          <h1 className="font-display font-bold text-xl text-white mb-1">⏳ Waiting for Approval</h1>
          <p className="text-sm text-white/55 max-w-sm mx-auto leading-relaxed">Your MiLey+ payment via UPI has been recorded and is awaiting manual verification by the MiLey administrator. This usually takes a short while — MiLey AI Studio unlocks automatically the moment it’s approved, no need to re-open the app.</p>
        </div>
        <div className="card-surface rounded-2xl p-5 text-center">
          <p className="text-white/50 text-xs uppercase tracking-wide mb-1">Already paid?</p>
          <p className="text-sm text-white/60">If you haven’t completed the UPI payment yet, send ₹{MILEY_PLUS_PRICE} to the UPI ID below and the admin will verify and activate MiLey+ shortly.</p>
          <button onClick={copyUpi} className="mt-3 mx-auto flex items-center gap-2 card-surface px-4 py-2 rounded-xl text-sm text-white/80">
            <span className="font-mono">{UPI_ID}</span><CopyIcon size={14} />
          </button>
          {copied && <p className="text-[11px] text-emerald-300 mt-1">Copied</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-8 max-w-2xl mx-auto w-full">
      <div className="relative rounded-3xl overflow-hidden mb-6 p-6 border border-amber-300/20"
        style={{ background: 'radial-gradient(120% 90% at 15% 10%, rgba(0,224,168,0.18), transparent 55%), radial-gradient(90% 80% at 90% 20%, rgba(255,61,174,0.16), transparent 60%), #121212' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="grad-brand-text font-display font-extrabold text-2xl tracking-tight">MiLey</span>
          <span className="text-xs font-black px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-300 to-amber-500 text-black">+</span>
        </div>
        <h1 className="font-display font-bold text-2xl text-white leading-tight mb-2">Create original songs with AI</h1>
        <p className="text-sm text-white/60 max-w-md">Describe a feeling, a memory or a story — MiLey writes the lyrics, composes the music and designs the cover. Your songs, made by you.</p>
        {status === 'rejected' && <p className="text-xs text-red-300 bg-red-500/10 rounded-xl px-3 py-2 mt-3">Your last request wasn’t approved. You can submit a new one below.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card-surface rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl btn-brand flex items-center justify-center mb-3"><Icon size={18} color="#0B0B0B" /></div>
            <p className="text-sm font-semibold text-white mb-1">{title}</p>
            <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      <div className="card-surface rounded-2xl p-5 mb-4 text-center">
        <p className="text-white/50 text-xs uppercase tracking-wide mb-1">MiLey+ Membership</p>
        <p className="font-display font-extrabold text-3xl text-white">₹499<span className="text-base font-medium text-white/40">/month</span></p>
        <p className="text-xs text-white/40 mt-1">Verified manually by the MiLey admin after UPI payment.</p>
      </div>

      {error && <p className="text-xs text-red-300 bg-red-500/10 rounded-xl px-4 py-3 mb-3">{error}</p>}

      <button onClick={subscribe} disabled={busy} className="w-full btn-brand text-black font-bold py-3.5 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
        <CrownIcon size={17} color="#0B0B0B" /> {busy ? 'Submitting…' : 'Subscribe Now'}
      </button>

      <div className="text-center mt-4">
        <p className="text-[11px] text-white/35 mb-1.5">Pay via UPI to</p>
        <button onClick={copyUpi} className="mx-auto flex items-center gap-2 card-surface px-4 py-2 rounded-xl text-sm text-white/85">
          <span className="font-mono">{UPI_ID}</span><CopyIcon size={13} />
        </button>
        {copied && <p className="text-[11px] text-emerald-300 mt-1">Copied</p>}
        <div className="flex items-center justify-center gap-2 mt-3">
          {UPI_APPS.map((a) => (
            <span key={a.label} className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: a.bg }}>{a.label[0]}</span>
          ))}
          <span className="text-[10px] text-white/30">+ other UPI apps</span>
        </div>
      </div>

      <p className="text-[11px] text-white/30 text-center mt-4">Tapping Subscribe Now opens your UPI app with ₹{MILEY_PLUS_PRICE} pre-filled. After paying, your request goes to the MiLey admin for manual approval — MiLey+ activates only once approved. AI songs are original compositions up to ~60 seconds.</p>
    </div>
  )
}

/* ─────────────────────────  Studio  ───────────────────────── */

const EMPTY_FORM = { prompt: '', language: 'Hindi', genre: 'Pop', mood: 'Happy', vocal: 'Female', tempo: 'Medium', duration: 30 }

function Studio() {
  const user = auth.getCurrentUser()
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageUrl, setImageUrl] = useState('')
  const [imgBusy, setImgBusy] = useState(false)
  const [job, setJob] = useState(null) // { stage, error, form }
  const [renaming, setRenaming] = useState(null)

  const { data: allTracks } = useLiveShared('tracks', { order: '-createdAt', limit: 300 })
  const creations = useMemo(
    () => (allTracks || []).filter((t) => t.aiGenerated && t.artistId === user?.id),
    [allTracks, user],
  )

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImgBusy(true)
    try {
      const { url } = await storage.upload(file, file.name)
      setImageUrl(url)
    } catch { /* ignore */ }
    setImgBusy(false)
  }

  const generate = useCallback(async () => {
    if (!form.prompt.trim() && !imageUrl) return
    const f = { ...form, imageUrl }
    setJob({ stage: 'Understanding your idea…', error: null, form: f })
    try {
      const instrumental = f.vocal === 'Instrumental'
      let ideaText = f.prompt.trim()

      // If a photo was provided, describe it and fold it into the theme.
      if (imageUrl) {
        try {
          const { text } = await ai.run('Describe the mood, colors and feeling of this image in one vivid sentence for songwriting inspiration.', { images: [imageUrl] })
          ideaText = `${ideaText ? ideaText + '. ' : ''}Inspired by this image: ${text}`.trim()
        } catch { /* proceed without vision */ }
      }

      // 1) Lyrics + title
      setJob((j) => ({ ...j, stage: 'Writing lyrics…' }))
      let title = ideaText.slice(0, 40) || `${f.mood} ${f.genre}`
      let lines = []
      try {
        const { json } = await ai.run(
          `Write an original short song in ${f.language}. Theme: "${ideaText || `${f.mood} ${f.genre} song`}". Genre: ${f.genre}. Mood: ${f.mood}. Return JSON with fields: title (string, catchy, in ${f.language}) and lines (array of 6-10 short lyric lines in ${f.language}). Keep it suitable for a ${f.duration}-second song.`,
          { json: true },
        )
        if (json?.title) title = String(json.title).slice(0, 80)
        if (Array.isArray(json?.lines)) lines = json.lines.map((l) => String(l)).filter(Boolean).slice(0, 10)
      } catch { /* fall back to instrumental-style prompt */ }

      // 2) Music
      setJob((j) => ({ ...j, stage: 'Composing music… (this can take up to a minute)' }))
      const durationMs = f.duration * 1000
      const tempoDesc = (TEMPOS.find((t) => t.k === f.tempo) || {}).d || 'medium groove'
      const vocalDesc = f.vocal === 'Male' ? 'male lead vocals' : f.vocal === 'Female' ? 'female lead vocals' : f.vocal === 'Duet' ? 'male and female duet vocals' : 'instrumental'
      const globalStyles = [f.genre, f.mood, tempoDesc, `${f.language} language`, vocalDesc, 'rich stereo', 'high quality'].filter(Boolean)

      let audioUrl = ''
      try {
        if (instrumental || lines.length === 0) {
          const r = await audio.music(`${f.genre} ${f.mood} ${instrumental ? 'instrumental' : vocalDesc}, ${tempoDesc}, ${f.language} style, rich high-quality stereo`, { duration: durationMs, instrumental })
          audioUrl = r.url
        } else {
          const r = await audio.music({ plan: {
            positive_global_styles: globalStyles,
            negative_global_styles: ['low quality', 'distortion', 'noise', 'muffled'],
            sections: [{ section_name: 'song', positive_local_styles: [vocalDesc, 'clear lead vocal'], negative_local_styles: [], duration_ms: durationMs, lines }],
          } })
          audioUrl = r.url
        }
      } catch {
        const r = await audio.music(`${f.genre} ${f.mood} song, ${tempoDesc}, ${f.language} ${instrumental ? 'instrumental' : vocalDesc}`, { duration: durationMs, instrumental })
        audioUrl = r.url
      }
      if (!audioUrl) throw new Error('no-audio')

      // 3) Cover art
      setJob((j) => ({ ...j, stage: 'Designing cover art…' }))
      let coverUrl = ''
      try {
        const r = await ai.run(`Album cover art for a ${f.genre.toLowerCase()} ${f.mood.toLowerCase()} song titled "${title}". Vibrant, artistic, cinematic lighting, no text, no words.`, { image: true, aspectRatio: '1:1' })
        coverUrl = r.images?.[0] || ''
      } catch { /* cover optional */ }

      // 4) Save as a real, playable track (private to the creator)
      setJob((j) => ({ ...j, stage: 'Saving to your Library…' }))
      if (f.genre) await ensureCategory(f.genre, 'genre').catch(() => {})
      if (f.language) await ensureCategory(f.language, 'language').catch(() => {})
      await db.insertShared('tracks', {
        title, artistName: user?.displayName || 'MiLey Creator', artistId: user?.id,
        coverUrl, bannerUrl: '', audioUrl, duration: f.duration,
        genre: f.genre, language: f.language, mood: f.mood,
        lyrics: lines.join('\n'), type: 'song', albumId: null, albumTitle: null,
        visibility: 'private', aiGenerated: true, aiPrompt: f.prompt.trim(),
        aiVocal: f.vocal, aiTempo: f.tempo, favorite: false, plays: 0, likesCount: 0,
      }, undefined, { visibleTo: 'creator-and-admin' })

      setJob(null)
    } catch {
      setJob((j) => ({ ...(j || { form: f }), stage: null, error: 'Something went wrong while creating your song. Please try again.' }))
    }
  }, [form, imageUrl, user])

  const retry = () => { setJob(null); generate() }

  const rename = async (id, title) => {
    if (!title.trim()) return
    await db.updateShared('tracks', id, { title: title.trim() }).catch(() => {})
    setRenaming(null)
  }
  const toggleFav = async (t) => {
    await db.updateShared('tracks', t.id, { favorite: !t.favorite }).catch(() => {})
  }
  const regenCover = async (t) => {
    try {
      const r = await ai.run(`Album cover art for a ${(t.genre || 'pop').toLowerCase()} ${(t.mood || '').toLowerCase()} song titled "${t.title}". Vibrant, artistic, cinematic, no text.`, { image: true, aspectRatio: '1:1' })
      if (r.images?.[0]) await db.updateShared('tracks', t.id, { coverUrl: r.images[0] })
    } catch { /* ignore */ }
  }
  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"? This can't be undone.`)) return
    await db.deleteShared('tracks', t.id).catch(() => {})
  }

  return (
    <div className="px-4 md:px-8 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-2 mb-1">
        <MicIcon size={22} className="grad-brand-text" />
        <h1 className="font-display font-bold text-xl text-white">MiLey AI Studio</h1>
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-300 to-amber-500 text-black ml-1">MiLey+</span>
      </div>
      <p className="text-xs text-white/40 mb-5">Describe a song and MiLey composes it — original lyrics, vocals, music and cover art.</p>

      {/* Prompt */}
      <textarea
        value={form.prompt}
        onChange={(e) => set('prompt', e.target.value)}
        placeholder="Describe your song — an idea, emotion, memory or story…"
        rows={3}
        className="w-full bg-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none resize-none mb-2"
      />
      <div className="flex gap-2 flex-wrap mb-3">
        {PROMPT_IDEAS.map((p) => (
          <button key={p} onClick={() => set('prompt', p)} className="text-[11px] px-3 py-1.5 rounded-full card-surface text-white/60 hover:text-white">{p}</button>
        ))}
      </div>

      {/* Optional image */}
      <div className="flex items-center gap-3 mb-4">
        <label className="flex items-center gap-2 card-surface rounded-xl px-3 py-2.5 cursor-pointer text-sm text-white/70">
          <CoverIcon size={16} className="text-white/40" />
          {imgBusy ? 'Uploading…' : imageUrl ? 'Photo added' : 'Add a photo (optional)'}
          <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </label>
        {imageUrl && (
          <div className="relative w-11 h-11 rounded-lg overflow-hidden border border-white/10">
            <img src={imageUrl} className="w-full h-full object-cover" alt="" />
            <button onClick={() => setImageUrl('')} className="absolute top-0 right-0 bg-black/60 p-0.5"><CloseIcon size={11} color="#fff" /></button>
          </div>
        )}
      </div>

      {/* Selectors */}
      <Selector label="Language" value={form.language} options={LANGUAGE_SUGGESTIONS.slice(0, 12)} onSelect={(v) => set('language', v)} />
      <Selector label="Genre" value={form.genre} options={GENRES} onSelect={(v) => set('genre', v)} />
      <Selector label="Mood" value={form.mood} options={MOODS} onSelect={(v) => set('mood', v)} />
      <Selector label="Vocals" value={form.vocal} options={VOCALS} onSelect={(v) => set('vocal', v)} />
      <Selector label="Tempo" value={form.tempo} options={TEMPOS.map((t) => t.k)} onSelect={(v) => set('tempo', v)} />
      <Selector label="Length" value={form.duration} options={DURATIONS} render={(d) => `${d}s`} onSelect={(v) => set('duration', v)} />

      <button
        onClick={generate}
        disabled={!!job || (!form.prompt.trim() && !imageUrl)}
        className="w-full btn-brand text-black font-bold py-3.5 rounded-2xl text-sm disabled:opacity-40 mt-4 mb-2 flex items-center justify-center gap-2"
      >
        <MicIcon size={17} color="#0B0B0B" /> {job ? 'Creating…' : 'Generate Song'}
      </button>
      <p className="text-[11px] text-white/30 text-center mb-6">Songs are original AI compositions up to ~60s. Multi-language vocals are supported but may vary in quality.</p>

      {/* Job progress */}
      {job && (
        <div className="card-surface rounded-2xl p-4 mb-6">
          {job.error ? (
            <div>
              <p className="text-sm text-red-300 mb-3">{job.error}</p>
              <div className="flex gap-2">
                <button onClick={retry} className="btn-brand text-black text-sm font-semibold px-4 py-2 rounded-xl">Retry</button>
                <button onClick={() => setJob(null)} className="card-surface text-white/70 text-sm px-4 py-2 rounded-xl">Dismiss</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{job.stage}</p>
                <p className="text-xs text-white/40">Keep this screen open while your song is created.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creations */}
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-display font-bold text-lg text-white">Your AI Creations</h2>
        {creations.length > 0 && <span className="text-xs text-white/40">{creations.length}</span>}
      </div>
      {creations.length === 0 ? (
        <EmptyState icon={<MicIcon size={24} className="grad-brand-text" />} title="No AI songs yet" subtitle="Generate your first song above — it will appear here and in your Library." />
      ) : (
        <div className="space-y-1">
          {creations.map((t) => (
            <div key={t.id} className="card-surface rounded-2xl px-2 py-1">
              {renaming === t.id ? (
                <RenameRow track={t} onSave={(title) => rename(t.id, title)} onCancel={() => setRenaming(null)} />
              ) : (
                <>
                  <TrackRow track={t} queueList={creations} showMenu={false} />
                  <div className="flex items-center gap-1 px-2 pb-1.5 -mt-1">
                    <button onClick={() => toggleFav(t)} className={`p-1.5 rounded-lg ${t.favorite ? 'text-pink-400' : 'text-white/35'}`}><HeartIcon size={15} filled={t.favorite} /></button>
                    <button onClick={() => setRenaming(t.id)} className="p-1.5 rounded-lg text-white/35"><EditIcon size={15} /></button>
                    <button onClick={() => regenCover(t)} className="p-1.5 rounded-lg text-white/35"><CoverIcon size={15} /></button>
                    <button onClick={() => remove(t)} className="p-1.5 rounded-lg text-white/35"><TrashIcon size={15} /></button>
                    <span className="ml-auto text-[10px] text-white/25">{t.language} · {t.genre}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Selector({ label, value, options, onSelect, render }) {
  return (
    <div className="mb-3">
      <p className="text-xs text-white/40 mb-1.5">{label}</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar overscroll-x-contain pb-0.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onSelect(o)}
            className={`px-3.5 py-2 rounded-full text-sm font-medium shrink-0 ${value === o ? 'btn-brand text-black' : 'card-surface text-white/55'}`}
          >
            {render ? render(o) : o}
          </button>
        ))}
      </div>
    </div>
  )
}

function RenameRow({ track, onSave, onCancel }) {
  const [title, setTitle] = useState(track.title)
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-white outline-none" autoFocus />
      <button onClick={() => onSave(title)} className="p-2 text-emerald-300"><CheckIcon size={16} /></button>
      <button onClick={onCancel} className="p-2 text-white/40"><CloseIcon size={16} /></button>
    </div>
  )
}
