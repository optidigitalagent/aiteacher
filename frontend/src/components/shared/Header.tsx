import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Learning', to: '/learning' },
  { label: 'About', to: '/about' },
  { label: 'Pricing', to: '/pricing' },
]

const CSS = `
  .site-header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    padding: 0 48px;
    height: 72px;
    display: flex; align-items: center; justify-content: space-between;
    transition: background 300ms ease-out, box-shadow 300ms ease-out, backdrop-filter 300ms ease-out;
  }
  .site-header.scrolled, .site-header.solid {
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(16px);
    box-shadow: 0 1px 0 rgba(230,234,242,0.9), 0 4px 12px rgba(15,23,42,0.06);
  }
  .site-header-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .site-logo-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(90deg, #7B8CFF 0%, #A18BFF 48%, #FFB38C 100%);
    display: flex; align-items: center; justify-content: center;
    color: white; font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px;
    flex-shrink: 0;
  }
  .site-logo-text { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 16px; color: #0F172A; }
  .site-header-nav { display: flex; align-items: center; gap: 4px; }
  .site-nav-link {
    padding: 6px 16px; border-radius: 999px; font-size: 14px; font-weight: 500;
    color: #64748B; text-decoration: none; position: relative;
    transition: color 200ms ease-out, background 200ms ease-out;
  }
  .site-nav-link:hover { color: #0F172A; background: rgba(123,140,255,0.07); }
  .site-nav-link.active { color: #7B8CFF; }
  .site-nav-link.active::after {
    content: ''; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%; background: #7B8CFF;
  }
  .site-header-right { display: flex; align-items: center; gap: 12px; }
  .site-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    border: 2px solid #E6EAF2; cursor: pointer;
    background: linear-gradient(135deg, #C4C9FF, #E8C4FF);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: #7B8CFF;
    transition: box-shadow 200ms; text-decoration: none;
  }
  .site-avatar:hover { box-shadow: 0 0 0 3px rgba(123,140,255,0.2); }
  .site-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 18px; border-radius: 12px; border: none; cursor: pointer;
    background: linear-gradient(90deg, #7B8CFF 0%, #A18BFF 48%, #FFB38C 100%);
    color: white; font-family: 'Sora', sans-serif; font-weight: 600; font-size: 14px;
    box-shadow: 0 16px 40px rgba(123,140,255,0.28);
    transition: transform 200ms ease-out, box-shadow 200ms ease-out;
    text-decoration: none;
  }
  .site-btn-primary:hover { transform: scale(1.02); box-shadow: 0 20px 48px rgba(123,140,255,0.38); }
  .site-hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 6px; background: none; border: none; }
  .site-hamburger span { display: block; width: 22px; height: 2px; background: #0F172A; border-radius: 2px; }
  .site-mobile-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);
    opacity: 0; pointer-events: none; transition: opacity 300ms ease-out;
  }
  .site-mobile-overlay.open { opacity: 1; pointer-events: all; }
  .site-mobile-menu {
    position: fixed; top: 0; right: 0; bottom: 0; width: 280px; z-index: 201;
    background: white; padding: 24px;
    transform: translateX(100%); transition: transform 300ms ease-out;
    box-shadow: -8px 0 32px rgba(15,23,42,0.12);
  }
  .site-mobile-menu.open { transform: translateX(0); }
  .site-mobile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
  .site-mobile-close { background: none; border: none; cursor: pointer; font-size: 22px; color: #64748B; }
  .site-mobile-nav-link {
    display: block; padding: 14px 16px; border-radius: 12px; font-size: 16px;
    font-weight: 500; color: #0F172A; text-decoration: none; margin-bottom: 4px;
    transition: background 200ms;
  }
  .site-mobile-nav-link:hover { background: #F6F7FB; }
  .site-mobile-nav-link.active { background: rgba(123,140,255,0.1); color: #7B8CFF; }
  .site-mobile-cta {
    display: block; margin-top: 24px; width: 100%; text-align: center;
    padding: 12px 24px; border-radius: 14px; border: none; cursor: pointer;
    background: linear-gradient(90deg, #7B8CFF 0%, #A18BFF 48%, #FFB38C 100%);
    color: white; font-family: 'Sora', sans-serif; font-weight: 600; font-size: 15px;
    text-decoration: none;
  }
  @media (max-width: 768px) {
    .site-header { padding: 0 24px; }
    .site-header-nav, .site-header-right .site-btn-primary { display: none; }
    .site-hamburger { display: flex; }
  }
`

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

function SignOutModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '36px 32px',
          width: 'min(360px, calc(100vw - 32px))', boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
          border: '1px solid #F0EEF8',
        }}
      >
        <div style={{ fontSize: 20, fontFamily: "'Sora', sans-serif", fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
          Sign out?
        </div>
        <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: '0 0 28px' }}>
          Your saved profile and progress will stay in your account. Any unsaved lesson setup on this device may be lost.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, border: '1.5px solid #E6EAF2',
              background: 'none', color: '#64748B', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'background 150ms',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
              background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              transition: 'background 150ms',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Header() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const { user, isAuthenticated, signOut } = useAuth()

  const isHome = location.pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const headerClass = `site-header${!isHome || scrolled ? ' solid' : ''}${scrolled ? ' scrolled' : ''}`

  function handleSignOutConfirm() {
    setShowSignOutModal(false)
    signOut()
  }

  return (
    <>
      <style>{CSS}</style>

      {showSignOutModal && (
        <SignOutModal
          onCancel={() => setShowSignOutModal(false)}
          onConfirm={handleSignOutConfirm}
        />
      )}

      <header className={headerClass}>
        <Link to="/" className="site-header-logo">
          <div className="site-logo-icon">AI</div>
          <span className="site-logo-text">AI Teacher</span>
        </Link>

        <nav className="site-header-nav">
          {NAV_LINKS.map(l => (
            <Link
              key={l.label}
              to={l.to}
              className={`site-nav-link${location.pathname === l.to ? ' active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-right">
          {isAuthenticated && user ? (
            <Link to="/profile" className="site-avatar" title={user.name}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : user.name.charAt(0).toUpperCase()
              }
            </Link>
          ) : (
            <a href={`${BACKEND_URL}/auth/google`} className="site-avatar" title="Sign in">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7B8CFF" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </a>
          )}
          {isAuthenticated
            ? <button onClick={() => setShowSignOutModal(true)} className="site-btn-primary" style={{ background: 'none', border: '1.5px solid #E6EAF2', color: '#64748B', boxShadow: 'none', fontSize: 13, padding: '8px 16px' }}>Sign out</button>
            : <Link to="/learning" className="site-btn-primary">Start lesson →</Link>
          }
          <button className="site-hamburger" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
        </div>
      </header>

      <div className={`site-mobile-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
      <div className={`site-mobile-menu${menuOpen ? ' open' : ''}`}>
        <div className="site-mobile-header">
          <Link to="/" className="site-header-logo" onClick={() => setMenuOpen(false)}>
            <div className="site-logo-icon">AI</div>
            <span className="site-logo-text">AI Teacher</span>
          </Link>
          <button className="site-mobile-close" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        {NAV_LINKS.map(l => (
          <Link
            key={l.label}
            to={l.to}
            className={`site-mobile-nav-link${location.pathname === l.to ? ' active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            {l.label}
          </Link>
        ))}
        <Link to="/learning" className="site-mobile-cta" onClick={() => setMenuOpen(false)}>
          Start lesson →
        </Link>
      </div>
    </>
  )
}
