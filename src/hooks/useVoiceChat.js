// Real peer-to-peer voice chat for MiLey Listening Parties.
//
// This uses the browser's native WebRTC stack (RTCPeerConnection + getUserMedia)
// for actual two-way microphone audio between seated participants. There is no
// external media server (SFU) — peers connect directly in a mesh. Signalling
// (the SDP offer/answer handshake) is carried over the app's own realtime data
// stream (db.subscribeShared on a 'voice_sig' collection). STUN/TURN come from
// a static ICE config below.
//
// Constraints of a mesh topology: each participant holds one connection per other
// participant, so this is tuned for small rooms (<= 9 seats). Connections behind
// strict/symmetric NAT rely on the TURN relay in ICE_SERVERS; for heavy production
// traffic a dedicated TURN credential should be dropped into ICE_SERVERS.

import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../lib/db'
import { realtime } from '../lib/realtime'

// Public STUN + free TURN relay (OpenRelay). Works with zero setup.
// To upgrade to a dedicated TURN service, add its { urls, username, credential }.
const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
]

// NOTE: echoCancellation/noiseSuppression/autoGainControl are voice-call DSP.
// When ON alongside music playback, the OS routes the ENTIRE audio output through
// the low-quality "communication/voice-call" stream (mono, ~16kHz) — which is what
// made music in the room sound like an in-call recording. A listening party is
// music-first, so we request a high-quality media-grade mic stream instead.
const MIC_CONSTRAINTS = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 2,
    sampleRate: 48000,
  },
  video: false,
}

const SPEAK_THRESHOLD = 0.045 // RMS gate for the speaking indicator

// Wait for ICE gathering to finish, or bail after `ms` and send what we have.
function waitForIce(pc, ms = 2200) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    let done = false
    const finish = () => { if (done) return; done = true; pc.removeEventListener('icegatheringstatechange', check); resolve() }
    const check = () => { if (pc.iceGatheringState === 'complete') finish() }
    pc.addEventListener('icegatheringstatechange', check)
    setTimeout(finish, ms)
  })
}

/**
 * @param {object} opts
 * @param {string} opts.roomId
 * @param {string} opts.selfId    stable user id of the local participant
 * @param {boolean} opts.enabled  true when the local user occupies a seat
 * @param {boolean} opts.micOn    true when the mic is unmuted
 * @param {number} opts.volume    0..1 output volume for remote peers
 * @returns {{ speakingIds:Set<string>, micReady:boolean, error:string|null, peerCount:number, connected:boolean }}
 */
export function useVoiceChat({ roomId, selfId, enabled, micOn, volume = 1 }) {
  const [speakingIds, setSpeakingIds] = useState(() => new Set())
  const [micReady, setMicReady] = useState(false)
  const [error, setError] = useState(null)
  const [peerCount, setPeerCount] = useState(0)
  const [connected, setConnected] = useState(false)

  const localStream = useRef(null)
  const peers = useRef(new Map())        // peerId -> { pc, audioEl }
  const presenceRef = useRef(null)
  const sigSubRef = useRef(null)
  const audioCtx = useRef(null)
  const analysers = useRef(new Map())    // id ('self'|peerId) -> { analyser, data }
  const rafRef = useRef(0)
  const speakingRef = useRef(new Set())
  const selfRef = useRef(selfId)
  selfRef.current = selfId

  const sendSignal = useCallback(async (to, kind, desc) => {
    try {
      await db.insertShared('voice_sig', {
        room: roomId, from: selfRef.current, to, kind,
        sdp: desc ? JSON.stringify(desc) : null, t: Date.now(),
      }, undefined, { visibleTo: 'public', writableBy: 'anyone' })
    } catch { /* signalling is best-effort; ICE retries cover drops */ }
  }, [roomId])

  // Attach an analyser so we can drive the speaking indicator from real audio.
  const attachAnalyser = useCallback((id, stream) => {
    try {
      if (!audioCtx.current) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return
        audioCtx.current = new AC()
      }
      const ctx = audioCtx.current
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      analysers.current.set(id, { analyser, data: new Uint8Array(analyser.frequencyBinCount) })
    } catch { /* analyser is cosmetic; ignore failures */ }
  }, [])

  const createPeer = useCallback((peerId, isInitiator) => {
    if (peers.current.has(peerId)) return peers.current.get(peerId).pc
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    const audioEl = typeof Audio !== 'undefined' ? new Audio() : null
    if (audioEl) { audioEl.autoplay = true; audioEl.volume = volume }
    peers.current.set(peerId, { pc, audioEl })
    setPeerCount(peers.current.size)

    if (localStream.current) {
      for (const track of localStream.current.getTracks()) pc.addTrack(track, localStream.current)
    }

    pc.ontrack = (e) => {
      const [stream] = e.streams
      if (audioEl && stream) { audioEl.srcObject = stream; audioEl.play().catch(() => {}) }
      if (stream) attachAnalyser(peerId, stream)
    }

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      if (st === 'connected') setConnected(true)
      if (st === 'failed') {
        // Renegotiate from the initiator side after a brief backoff.
        if (isInitiator) {
          try { pc.restartIce?.() } catch { /* noop */ }
          setTimeout(() => { if (peers.current.get(peerId)?.pc === pc) makeOffer(peerId, true) }, 800)
        }
      }
      if (st === 'closed' || st === 'disconnected') {
        const anyLive = [...peers.current.values()].some((p) => p.pc.connectionState === 'connected')
        setConnected(anyLive)
      }
    }
    return pc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachAnalyser, volume])

  const makeOffer = useCallback(async (peerId, isInitiator) => {
    const pc = createPeer(peerId, isInitiator)
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitForIce(pc)
      await sendSignal(peerId, 'offer', pc.localDescription)
    } catch { /* peer may have left mid-negotiation */ }
  }, [createPeer, sendSignal])

  const closePeer = useCallback((peerId) => {
    const entry = peers.current.get(peerId)
    if (!entry) return
    try { entry.pc.close() } catch { /* noop */ }
    if (entry.audioEl) { try { entry.audioEl.srcObject = null } catch { /* noop */ } }
    peers.current.delete(peerId)
    analysers.current.delete(peerId)
    setPeerCount(peers.current.size)
  }, [])

  // ── Main lifecycle: capture mic, join presence, wire signalling ──
  useEffect(() => {
    if (!enabled || !roomId || !selfId) return
    let disposed = false

    ;(async () => {
      // 1) Capture the microphone.
      try {
        const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
        if (disposed) { stream.getTracks().forEach((t) => t.stop()); return }
        localStream.current = stream
        for (const t of stream.getAudioTracks()) t.enabled = !!micOn
        attachAnalyser('self', stream)
        setMicReady(true)
      } catch (e) {
        if (!disposed) setError(e?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Enable it in your browser to talk.'
          : 'Could not access the microphone.')
        return
      }

      // 2) Signalling: react to offers/answers addressed to us.
      sigSubRef.current = db.subscribeShared('voice_sig', async (ev) => {
        if (ev.type !== 'INSERT') return
        const s = ev.data
        if (!s || s.room !== roomId || s.to !== selfRef.current || s.from === selfRef.current) return
        try {
          if (s.kind === 'offer') {
            const pc = createPeer(s.from, false)
            await pc.setRemoteDescription(JSON.parse(s.sdp))
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await waitForIce(pc)
            await sendSignal(s.from, 'answer', pc.localDescription)
          } else if (s.kind === 'answer') {
            const entry = peers.current.get(s.from)
            if (entry && !entry.pc.currentRemoteDescription) {
              await entry.pc.setRemoteDescription(JSON.parse(s.sdp))
            }
          } else if (s.kind === 'bye') {
            closePeer(s.from)
          }
        } catch { /* malformed / out-of-order signal — ICE recovery handles it */ }
        // Consume the signal so the collection stays small.
        try { await db.deleteShared('voice_sig', s.id) } catch { /* noop */ }
      })

      // 3) Presence: discover the other voice participants.
      const p = realtime.presence(`voicechat-${roomId}`, { vid: selfRef.current })
      presenceRef.current = p
      p.onSync((users) => {
        const ids = new Set(users.map((u) => u.vid).filter(Boolean))
        // Open connections to newly-seen peers; the lower id initiates (no glare).
        for (const pid of ids) {
          if (pid === selfRef.current || peers.current.has(pid)) continue
          if (selfRef.current < pid) makeOffer(pid, true)
        }
        // Drop peers who left.
        for (const pid of [...peers.current.keys()]) if (!ids.has(pid)) closePeer(pid)
      })
    })()

    return () => {
      disposed = true
      try { presenceRef.current?.leave?.() } catch { /* noop */ }
      // Tell peers we're leaving so they tear down immediately.
      for (const pid of peers.current.keys()) sendSignal(pid, 'bye', null)
      try { sigSubRef.current?.unsubscribe?.() } catch { /* noop */ }
      for (const pid of [...peers.current.keys()]) closePeer(pid)
      if (localStream.current) { localStream.current.getTracks().forEach((t) => t.stop()); localStream.current = null }
      analysers.current.clear()
      setMicReady(false); setConnected(false); setPeerCount(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, roomId, selfId])

  // Toggle the local track when mic state changes (no renegotiation needed).
  useEffect(() => {
    if (localStream.current) for (const t of localStream.current.getAudioTracks()) t.enabled = !!micOn
    if (!micOn) {
      speakingRef.current.delete('self')
      setSpeakingIds(new Set(speakingRef.current))
    }
  }, [micOn])

  // Apply output volume to all remote peers.
  useEffect(() => {
    for (const { audioEl } of peers.current.values()) if (audioEl) audioEl.volume = volume
  }, [volume, peerCount])

  // Speaking-level loop — drives real speaking indicators from audio RMS.
  useEffect(() => {
    if (!enabled) return
    let stop = false
    const tick = () => {
      if (stop) return
      let changed = false
      for (const [id, { analyser, data }] of analysers.current) {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / data.length)
        const muted = id === 'self' && !micOn
        const speaking = rms > SPEAK_THRESHOLD && !muted
        const had = speakingRef.current.has(id)
        if (speaking && !had) { speakingRef.current.add(id); changed = true }
        else if (!speaking && had) { speakingRef.current.delete(id); changed = true }
      }
      if (changed) setSpeakingIds(new Set(speakingRef.current))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { stop = true; cancelAnimationFrame(rafRef.current) }
  }, [enabled, micOn])

  return { speakingIds, micReady, error, peerCount, connected }
}
