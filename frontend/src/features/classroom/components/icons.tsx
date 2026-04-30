interface IconProps { s?: number; c?: string }

export const IcMic = ({ s = 24, c = 'white' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <rect x="9" y="2" width="6" height="12" rx="3" fill={c} />
    <path d="M5 10a7 7 0 0 0 14 0" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none" />
    <line x1="12" y1="19" x2="12" y2="22" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <line x1="8"  y1="22" x2="16" y2="22" stroke={c} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const IcSend = ({ s = 16, c = 'white' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IcCheck = ({ s = 12, c = '#22c55e' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IcClose = ({ s = 14, c = '#aaa' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const ChatIcon = ({ s = 15, c = '#6E7CFB' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IcBulb = ({ s = 13, c = '#f59e0b' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.5-1.5 4.5-3 6H9c-1.5-1.5-3-3.5-3-6a6 6 0 0 1 6-6z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IcSpark = ({ s = 13, c = 'white' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 7.2H22l-6.2 4.5 2.4 7.3L12 17l-6.2 4L8.2 13.7 2 9.2h7.6z" fill={c} />
  </svg>
)

export const IcQ = ({ s = 15, c = '#666' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke={c} strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1" fill={c} />
  </svg>
)

export const IcChev = ({ s = 12, c = '#aaa' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IcExit = ({ s = 14, c = '#888' }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
