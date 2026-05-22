import { Link } from 'react-router-dom'

const CSS = `
  .site-footer { background: #0F172A; color: rgba(255,255,255,0.6); padding: 64px 0 32px; }
  .site-footer .fc { max-width: 1200px; margin: 0 auto; padding: 0 48px; }
  .site-footer-top { display: grid; grid-template-columns: 200px repeat(5,1fr); gap: 40px; margin-bottom: 48px; }
  .site-footer-brand .ft-logo-text { color: white; font-family: 'Sora', sans-serif; font-weight: 600; font-size: 16px; }
  .site-footer-tagline { font-size: 14px; color: rgba(255,255,255,0.45); margin-top: 12px; line-height: 1.6; }
  .site-footer-socials { display: flex; gap: 10px; margin-top: 20px; }
  .site-footer-social {
    width: 34px; height: 34px; border-radius: 8px;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    transition: background 200ms; font-size: 13px; color: rgba(255,255,255,0.6);
    text-decoration: none;
  }
  .site-footer-social:hover { background: rgba(255,255,255,0.16); color: white; }
  .site-footer-col-title {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    color: white; letter-spacing: 0.06em; margin-bottom: 14px; text-transform: uppercase;
  }
  .site-footer-link {
    display: block; font-size: 13px; color: rgba(255,255,255,0.5);
    text-decoration: none; margin-bottom: 9px; transition: color 200ms;
    line-height: 1.4;
  }
  .site-footer-link:hover { color: rgba(255,255,255,0.9); }
  .site-footer-bottom {
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-top: 24px; text-align: center; font-size: 13px; color: rgba(255,255,255,0.3);
  }
  @media (max-width: 1024px) {
    .site-footer .fc { padding: 0 24px; }
    .site-footer-top { grid-template-columns: 1fr 1fr 1fr; }
  }
  @media (max-width: 640px) {
    .site-footer-top { grid-template-columns: 1fr 1fr; gap: 28px; }
  }
  @media (max-width: 480px) {
    .site-footer .fc { padding: 0 16px; }
    .site-footer { padding: 40px 0 24px; }
    .site-footer-top { grid-template-columns: 1fr; gap: 24px; margin-bottom: 32px; }
    .site-footer-socials { gap: 8px; }
  }
`

const COLS = [
  {
    title: 'Home',
    links: [
      { label: 'Introduction', to: '/#hero' },
      { label: 'How it works', to: '/#how-it-works' },
      { label: "Why it's better", to: '/#why-better' },
      { label: 'Features', to: '/#features' },
    ],
  },
  {
    title: 'Learning',
    links: [
      { label: 'Start learning', to: '/learning' },
      { label: 'Textbook mode', to: '/learning' },
      { label: 'Focus 2', to: '/learning' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'What is AI Teacher', to: '/about#what-is-ai-teacher' },
      { label: 'Philosophy', to: '/about#philosophy' },
      { label: 'Privacy', to: '/about#privacy' },
      { label: 'Support', to: '/about#support' },
    ],
  },
  {
    title: 'Pricing',
    links: [
      { label: 'Plans', to: '/pricing#plans' },
      { label: 'Start free', to: '/learning' },
    ],
  },
  {
    title: 'Profile',
    links: [
      { label: 'My progress', to: '/profile' },
      { label: 'Learning stats', to: '/profile#stats' },
      { label: 'Recent lessons', to: '/profile#recent-lessons' },
    ],
  },
]

export default function Footer() {
  return (
    <>
      <style>{CSS}</style>
      <footer className="site-footer">
        <div className="fc">
          <div className="site-footer-top">
            <div className="site-footer-brand">
              <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(90deg,#7B8CFF,#A18BFF 48%,#FFB38C)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15 }}>AI</div>
                <span className="ft-logo-text">AI Teacher</span>
              </Link>
              <p className="site-footer-tagline">The future of learning<br />is one-on-one with AI.</p>
              <div className="site-footer-socials">
                <a href="#" className="site-footer-social">𝕏</a>
                <a href="#" className="site-footer-social">in</a>
                <a href="#" className="site-footer-social">▶</a>
              </div>
            </div>

            {COLS.map(col => (
              <div key={col.title}>
                <div className="site-footer-col-title">{col.title}</div>
                {col.links.map(l => (
                  <Link key={l.label} to={l.to} className="site-footer-link">{l.label}</Link>
                ))}
              </div>
            ))}
          </div>

          <div className="site-footer-bottom">© 2025 AI Teacher. All rights reserved.</div>
        </div>
      </footer>
    </>
  )
}
