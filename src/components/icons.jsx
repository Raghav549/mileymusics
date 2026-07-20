// Custom original SVG icon set for MiLey — every icon here is hand-drawn, no third-party icon packs.
const base = (props) => ({
  width: props.size || 24,
  height: props.size || 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: props.color || 'currentColor',
  strokeWidth: props.strokeWidth || 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: props.className || '',
})

export const HomeIcon = (p) => (
  <svg {...base(p)}><path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v9.5a1 1 0 0 0 1 1H10v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5.5h3.5a1 1 0 0 0 1-1V9"/></svg>
)

export const CompassIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="m14.8 9.2-1.8 4.6-4.6 1.8 1.8-4.6z"/></svg>
)

export const LibraryIcon = (p) => (
  <svg {...base(p)}><rect x="3.5" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><path d="M17 5.2 20 6.4a1 1 0 0 1 .6 1.3l-3.7 12a1 1 0 0 1-1.3.6L14 19.4"/></svg>
)

export const UploadIcon = (p) => (
  <svg {...base(p)}><path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/></svg>
)

export const ProfileIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="8.2" r="3.2"/><path d="M5 19.5c1-3.3 3.9-5 7-5s6 1.7 7 5"/></svg>
)

export const PlayIcon = (p) => (
  <svg {...base(p)} fill={p.color || 'currentColor'} stroke="none"><path d="M8 5.5v13l11-6.5z"/></svg>
)

export const PauseIcon = (p) => (
  <svg {...base(p)} fill={p.color || 'currentColor'} stroke="none"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>
)

export const NextIcon = (p) => (
  <svg {...base(p)} fill={p.color || 'currentColor'} stroke="none"><path d="M6 5.5v13l9-6.5z"/><rect x="16.5" y="5.5" width="2.2" height="13" rx="0.6"/></svg>
)

export const PrevIcon = (p) => (
  <svg {...base(p)} fill={p.color || 'currentColor'} stroke="none"><path d="M18 5.5v13l-9-6.5z"/><rect x="5.3" y="5.5" width="2.2" height="13" rx="0.6"/></svg>
)

export const ShuffleIcon = (p) => (
  <svg {...base(p)}><path d="M3 6.5h3.2l7 11h4.3"/><path d="M3 17.5h3.2l7-11h4.3"/><path d="m16 4 3.5 2.5L16 9"/><path d="m16 15 3.5 2.5L16 20"/></svg>
)

export const RepeatIcon = (p) => (
  <svg {...base(p)}><path d="M6 7.5h10a3 3 0 0 1 3 3V12"/><path d="m7.5 4.5-3.5 3 3.5 3"/><path d="M18 16.5H8a3 3 0 0 1-3-3V12"/><path d="m16.5 19.5 3.5-3-3.5-3"/></svg>
)

export const RepeatOneIcon = (p) => (
  <svg {...base(p)}><path d="M6 7.5h10a3 3 0 0 1 3 3V12"/><path d="m7.5 4.5-3.5 3 3.5 3"/><path d="M18 16.5H8a3 3 0 0 1-3-3V12"/><path d="m16.5 19.5 3.5-3-3.5-3"/><text x="10.3" y="12.3" fontSize="6.5" fill="currentColor" stroke="none">1</text></svg>
)

export const QueueIcon = (p) => (
  <svg {...base(p)}><path d="M4 6.5h11"/><path d="M4 12h11"/><path d="M4 17.5h7"/><circle cx="18.5" cy="16" r="2.5"/><path d="M18.5 5.5v9"/><path d="m18.5 5.5 3 1.8"/></svg>
)

export const HeartIcon = (p) => (
  <svg {...base(p)} fill={p.filled ? (p.color || 'currentColor') : 'none'}><path d="M12 20s-7-4.4-9.5-9C1 8 2 4.5 5.4 3.6 8 2.9 10.4 4.4 12 6.8 13.6 4.4 16 2.9 18.6 3.6 22 4.5 23 8 21.5 11 19 15.6 12 20 12 20Z"/></svg>
)

export const ShareIcon = (p) => (
  <svg {...base(p)}><circle cx="18" cy="5.5" r="2.3"/><circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="18.5" r="2.3"/><path d="m8.1 10.8 7.8-4.4"/><path d="m8.1 13.2 7.8 4.4"/></svg>
)

export const DownloadIcon = (p) => (
  <svg {...base(p)}><path d="M12 3.5V15"/><path d="m7.5 11 4.5 4.5L16.5 11"/><path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/></svg>
)

export const SearchIcon = (p) => (
  <svg {...base(p)}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>
)

export const MicIcon = (p) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/></svg>
)

export const SlidersIcon = (p) => (
  <svg {...base(p)}><path d="M4 6h9"/><path d="M17 6h3"/><path d="M4 12h3"/><path d="M11 12h9"/><path d="M4 18h13"/><path d="M21 18h-.01"/><circle cx="14" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="19" cy="18" r="2"/></svg>
)

export const TimerIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2"/><path d="M9.5 2.5h5"/></svg>
)

export const SpeedIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="13" r="8"/><path d="M12 13 15.5 9.2"/><path d="M8.5 5 9.5 3"/><path d="M15.5 5 14.5 3"/></svg>
)

export const LyricsIcon = (p) => (
  <svg {...base(p)}><path d="M6 3.5h9l3.5 3.5V20.5H6z"/><path d="M15 3.5V7h3.5"/><path d="M8.5 12h7"/><path d="M8.5 15.5h7"/><path d="M8.5 8.5h3"/></svg>
)

export const CloseIcon = (p) => (
  <svg {...base(p)}><path d="M5.5 5.5l13 13"/><path d="M18.5 5.5l-13 13"/></svg>
)

export const ChevronDownIcon = (p) => (
  <svg {...base(p)}><path d="m5.5 8.5 6.5 7 6.5-7"/></svg>
)

export const ChevronLeftIcon = (p) => (
  <svg {...base(p)}><path d="m15 5-7 7 7 7"/></svg>
)

export const ChevronRightIcon = (p) => (
  <svg {...base(p)}><path d="m9 5 7 7-7 7"/></svg>
)

export const PlusIcon = (p) => (
  <svg {...base(p)}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
)

export const CheckIcon = (p) => (
  <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7"/></svg>
)

export const MoreIcon = (p) => (
  <svg {...base(p)} fill={p.color || 'currentColor'} stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
)

export const PodcastIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="9" r="4"/><path d="M12 13v3"/><path d="M8 19.5c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5"/></svg>
)

export const LiveIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="2.4" fill={p.color || 'currentColor'} stroke="none"/><path d="M8.2 8.2a5.5 5.5 0 0 0 0 7.6"/><path d="M15.8 8.2a5.5 5.5 0 0 1 0 7.6"/><path d="M5 5a10 10 0 0 0 0 14"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>
)

export const ChartIcon = (p) => (
  <svg {...base(p)}><path d="M5 19.5V11"/><path d="M11 19.5V6"/><path d="M17 19.5v-8"/></svg>
)

export const UsersIcon = (p) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3 3-4.6 5.5-4.6s4.8 1.6 5.5 4.6"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.6c1.9.3 3.3 1.6 3.8 3.7"/></svg>
)

export const LockIcon = (p) => (
  <svg {...base(p)}><rect x="5.5" y="10.5" width="13" height="9.5" rx="1.6"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9"/></svg>
)

export const GlobeIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.3 3.7 5.3 3.7 8.5s-1.3 6.2-3.7 8.5c-2.4-2.3-3.7-5.3-3.7-8.5S9.6 5.8 12 3.5Z"/></svg>
)

export const CoverIcon = (p) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9.5" r="2"/><path d="m5 18 4.5-4.5L12 16l3-4 4 6"/></svg>
)

export const TrashIcon = (p) => (
  <svg {...base(p)}><path d="M4.5 7h15"/><path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2"/><path d="M6.5 7 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7"/></svg>
)

export const EditIcon = (p) => (
  <svg {...base(p)}><path d="M16.5 4.5 19.5 7.5 8 19H5v-3z"/></svg>
)

export const BannerIcon = (p) => (
  <svg {...base(p)}><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="m5 15 3.5-3.5L11 14l4-4.5 4 4.5"/></svg>
)

export const BackIcon = ChevronLeftIcon
export const FilterIcon = (p) => (
  <svg {...base(p)}><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
)

export const MessageIcon = (p) => (
  <svg {...base(p)}><path d="M4 5.5h16v11H9l-4 3.5v-3.5H4z"/><path d="M8 9.5h8"/><path d="M8 12.5h5"/></svg>
)

export const SendIcon = (p) => (
  <svg {...base(p)} fill={p.color || 'currentColor'} stroke="none"><path d="M4 4.5 20.5 12 4 19.5l2.5-6.7L14 12 6.5 10.7z"/></svg>
)

export const ReplyIcon = (p) => (
  <svg {...base(p)}><path d="M11 5 4.5 11l6.5 6"/><path d="M4.5 11h9a6 6 0 0 1 6 6v1.5"/></svg>
)

export const ForwardIcon = (p) => (
  <svg {...base(p)}><path d="m13 5 6.5 6-6.5 6"/><path d="M19.5 11h-9a6 6 0 0 0-6 6v1.5"/></svg>
)

export const CopyIcon = (p) => (
  <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.5"/></svg>
)

export const PinIcon = (p) => (
  <svg {...base(p)}><path d="M9 4.5h6l-.7 6.3L18 14v1.5H6V14l3.7-3.2z"/><path d="M12 15.5V20"/></svg>
)

export const BlockIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5"/><path d="m6.3 6.3 11.4 11.4"/></svg>
)

export const FlagIcon = (p) => (
  <svg {...base(p)}><path d="M6 3.5v17"/><path d="M6 4.5h11l-2.5 3.5L17 11.5H6"/></svg>
)

export const BellIcon = (p) => (
  <svg {...base(p)}><path d="M6 10a6 6 0 0 1 12 0v4.5l1.8 2.5H4.2L6 14.5z"/><path d="M9.7 19.5a2.3 2.3 0 0 0 4.6 0"/></svg>
)

export const MuteIcon = (p) => (
  <svg {...base(p)}><path d="M6 10a6 6 0 0 1 10.3-4.2"/><path d="M18 10v4.5l1.8 2.5H4.2L6 14.5v-1"/><path d="M9.7 19.5a2.3 2.3 0 0 0 4.6 0"/><path d="m4 4 16 16"/></svg>
)

export const ArchiveIcon = (p) => (
  <svg {...base(p)}><rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13.5h4"/></svg>
)

export const RoomIcon = (p) => (
  <svg {...base(p)}><circle cx="9" cy="9" r="3"/><path d="M4 19c.6-3 2.5-4.6 5-4.6s4.4 1.6 5 4.6"/><path d="M15.5 5.5a4 4 0 0 1 0 7.4"/><path d="M15 14.5c2 .3 3.5 1.7 4 4"/></svg>
)

export const ChannelIcon = (p) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m9.5 9 4 3-4 3z"/></svg>
)

export const VerifiedIcon = (p) => (
  <svg {...base(p)} fill={p.color || 'currentColor'} stroke="none"><path d="M12 2.5 14.4 5l3.4-.4.9 3.3 3 1.8-1.5 3.1 1.5 3.1-3 1.8-.9 3.3-3.4-.4L12 23.5 9.6 21l-3.4.4-.9-3.3-3-1.8 1.5-3.1L2.3 9.9l3-1.8.9-3.3L9.6 5z"/><path d="m8.3 12.3 2.6 2.6 4.8-5.2" stroke="#0B0B0B" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

export const CalendarIcon = (p) => (
  <svg {...base(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>
)

export const StreakIcon = (p) => (
  <svg {...base(p)} fill={p.filled ? (p.color || 'currentColor') : 'none'}><path d="M12 3s-5 4.5-5 9.5a5 5 0 0 0 10 0c0-1.3-.5-2.4-1.1-3.3.1 1.6-.7 2.6-1.4 2.6-.9 0-1-1-1-1.6 0-1.7-1.5-3-1.5-3s.5 2-1 4c-1 1.3-1 2.5-1 2.5"/></svg>
)

export const ThemeIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="8.5" cy="14.5" r="1.3" fill="currentColor" stroke="none"/><path d="M12 20.5A8.5 8.5 0 0 0 12 3.5c1 0 1.8 1.6 1.8 3.5S13 10 12 10a2 2 0 0 0 0 4c1.5 0 2.5 1.4 2.5 3s-1 3.5-2.5 3.5Z"/></svg>
)

export const LinkIcon = (p) => (
  <svg {...base(p)}><path d="M9.5 14.5 14.5 9.5"/><path d="M11 7.5 12.7 5.8a3.2 3.2 0 0 1 4.5 4.5L15.5 12"/><path d="M13 16.5l-1.7 1.7a3.2 3.2 0 0 1-4.5-4.5L8.5 12"/></svg>
)

export const QRIcon = (p) => (
  <svg {...base(p)}><rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h2.5v2.5h-2.5z"/><path d="M19.5 14.5h1"/><path d="M14.5 19.5h1"/><path d="M19.5 19.5h1"/></svg>
)

export const SkipVoteIcon = (p) => (
  <svg {...base(p)}><path d="M6 5.5v13l8-6.5z"/><path d="M15.5 5.5v13"/><path d="M18.5 5.5v13"/></svg>
)

export const InviteIcon = (p) => (
  <svg {...base(p)}><circle cx="9" cy="9" r="3.3"/><path d="M3.5 19.2c.8-3.1 2.9-4.7 5.5-4.7s4.7 1.6 5.5 4.7"/><path d="M18 8v6"/><path d="M15 11h6"/></svg>
)

export const CollabIcon = (p) => (
  <svg {...base(p)}><circle cx="8.5" cy="9" r="2.8"/><circle cx="16" cy="9" r="2.8"/><path d="M3.7 19c.6-2.7 2.4-4.2 4.8-4.2S13 16.3 13.6 19"/><path d="M12 19c.6-2.7 2.4-4.2 4.8-4.2s3.5 1.5 4 4.2"/></svg>
)

export const CrownIcon = (p) => (
  <svg {...base(p)} fill={p.filled ? (p.color || 'currentColor') : 'none'}><path d="M3.5 9.5 7 12l5-7 5 7 3.5-2.5-1.6 9.3a1 1 0 0 1-1 .8H6.1a1 1 0 0 1-1-.8Z"/><path d="M6.5 20h11"/></svg>
)

export const ShieldIcon = (p) => (
  <svg {...base(p)} fill={p.filled ? (p.color || 'currentColor') : 'none'}><path d="M12 3.5 19 6.3v5.4c0 4.5-3 7.8-7 8.8-4-1-7-4.3-7-8.8V6.3Z"/><path d="m9 12 2 2 4-4.5" stroke={p.filled ? '#0B0B0B' : 'currentColor'}/></svg>
)

export const VolumeIcon = (p) => (
  <svg {...base(p)}><path d="M4.5 9.5h3.2L12 6v12l-4.3-3.5H4.5z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.7a7.7 7.7 0 0 1 0 10.6"/></svg>
)

export const MicOffIcon = (p) => (
  <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 10.9 4.8"/><path d="M18.3 12.6c.13-.5.2-1 .2-1.6"/><path d="M12 17.5V21"/><path d="M8.5 21h7"/><path d="m4 4 16 16"/></svg>
)

export const SignalIcon = (p) => (
  <svg {...base(p)}><rect x="3.5" y="14" width="3" height="6.5" rx="0.8" fill={p.color || 'currentColor'} stroke="none"/><rect x="10.5" y="10" width="3" height="10.5" rx="0.8" fill={p.color || 'currentColor'} stroke="none" opacity={p.bars > 1 ? 1 : 0.3}/><rect x="17.5" y="5" width="3" height="15.5" rx="0.8" fill={p.color || 'currentColor'} stroke="none" opacity={p.bars > 2 ? 1 : 0.3}/></svg>
)

export const SmileIcon = (p) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1" fill="currentColor" stroke="none"/><path d="M8 14.5c1 1.5 2.5 2.3 4 2.3s3-.8 4-2.3"/></svg>
)

export const SeatIcon = (p) => (
  <svg {...base(p)}><path d="M6.5 12V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v6"/><path d="M5 12h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"/><path d="M6 16v3"/><path d="M18 16v3"/></svg>
)
