import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import EmptyState from '../components/EmptyState'
import { timeAgo } from '../musicHelpers'
import {
  BellIcon, BackIcon, MessageIcon, UsersIcon, UploadIcon, ChannelIcon, RoomIcon,
  CalendarIcon, CheckIcon, HeartIcon,
} from '../components/icons'

const TYPE_ICON = {
  message: MessageIcon, follow: UsersIcon, upload: UploadIcon, channel: ChannelIcon,
  room: RoomIcon, premiere: CalendarIcon, achievement: CheckIcon, like: HeartIcon,
}

export default function Notifications() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  return (
    <div className="max-w-2xl mx-auto w-full h-full flex flex-col">
      <div className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)] pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-white/60 md:hidden"><BackIcon size={20} /></button>
          <BellIcon size={22} className="grad-brand-text" />
          <h1 className="font-display font-bold text-xl text-white">Notifications</h1>
        </div>
        {unreadCount > 0 && <button onClick={markAllRead} className="text-xs grad-brand-text font-medium">Mark all read</button>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 pb-8">
        {notifications.length === 0 ? (
          <EmptyState icon={<BellIcon size={24} className="grad-brand-text" />} title="You're all caught up" subtitle="Follows, messages, uploads and invites will show up here." />
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] || BellIcon
              return (
                <button key={n.id} onClick={() => { markRead(n.id); if (n.url) navigate(n.url) }} className={`w-full flex items-start gap-3 px-2 py-3 rounded-2xl text-left ${n.read ? '' : 'bg-white/5'}`}>
                  <div className="w-9 h-9 rounded-full card-surface flex items-center justify-center shrink-0"><Icon size={16} className="grad-brand-text" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{n.title}</p>
                    <p className="text-xs text-white/40 truncate">{n.body}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!n.read && <span className="w-2 h-2 rounded-full grad-brand" />}
                    <span className="text-[10px] text-white/25">{timeAgo(n.createdAt)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
