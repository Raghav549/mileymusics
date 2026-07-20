import { QRCodeSVG } from 'qrcode.react'
import { CloseIcon } from './icons'

export default function QRCard({ url, name, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" style={{ height: 'var(--visual-height, 100dvh)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl p-6 flex flex-col items-center max-w-xs w-full relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-black/40"><CloseIcon size={18} /></button>
        <QRCodeSVG value={url} size={200} bgColor="#ffffff" fgColor="#0B0B0B" />
        <p className="font-display font-bold text-[#0B0B0B] mt-4 text-center">{name}</p>
        <p className="text-xs text-black/40 mt-1 text-center break-all">{url}</p>
      </div>
    </div>
  )
}
