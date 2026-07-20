import { NavLink } from 'react-router-dom'
import { HomeIcon, CompassIcon, LibraryIcon, UploadIcon, ProfileIcon, MicIcon } from './icons'
import Logo from './Logo'

const items = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/explore', label: 'Explore', Icon: CompassIcon },
  { to: '/ai', label: 'AI', Icon: MicIcon, plus: true },
  { to: '/upload', label: 'Upload', Icon: UploadIcon },
  { to: '/library', label: 'Library', Icon: LibraryIcon },
  { to: '/profile', label: 'Profile', Icon: ProfileIcon },
]

export default function BottomNav() {
  return (
    <nav className="hidden md:hidden fixed bottom-0 left-0 right-0 z-30" />
  )
}

export function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom,0px)] bg-black/70 backdrop-blur-xl border-t border-white/5">
      <div className="flex items-stretch justify-between px-2 pt-2 pb-1">
        {items.map(({ to, label, Icon, end, plus }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-1.5 rounded-2xl transition-all duration-200 ${
                isActive ? 'text-black' : 'text-white/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`relative w-10 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'btn-brand scale-105' : ''
                  }`}
                >
                  <Icon size={19} color={isActive ? '#0B0B0B' : 'currentColor'} />
                  {plus && <span className="absolute -top-0.5 -right-0.5 text-[8px] font-black leading-none px-1 py-0.5 rounded bg-gradient-to-r from-amber-300 to-amber-500 text-black">+</span>}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-white/50'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function SidebarNav() {
  return (
    <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-white/5 p-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
      <div className="mb-8 px-1">
        <Logo size={30} />
      </div>
      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, Icon, end, plus }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 hover:bg-white/5 ${
                isActive ? 'card-surface text-white' : 'text-white/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'btn-brand' : ''}`}>
                  <Icon size={17} color={isActive ? '#0B0B0B' : 'currentColor'} />
                </div>
                <span className="text-sm font-medium">{label}</span>
                {plus && <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-300 to-amber-500 text-black">MiLey+</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
