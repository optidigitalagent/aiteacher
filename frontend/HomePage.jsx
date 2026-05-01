import { useState, useEffect, useRef } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --primary: #7B8CFF;
    --primary-soft: #A18BFF;
    --accent: #FFB38C;
    --text-main: #0F172A;
    --text-muted: #64748B;
    --border: #E6EAF2;
    --surface: #F6F7FB;
    --white: #FFFFFF;
    --bg-warm: #FFF9F3;
    --bg-beige: #FFF4E8;
    --gradient-cta: linear-gradient(90deg, #7B8CFF 0%, #A18BFF 48%, #FFB38C 100%);
    --gradient-bg: radial-gradient(circle at 80% 10%, rgba(161,139,255,0.18) 0%, transparent 35%), radial-gradient(circle at 10% 90%, rgba(255,179,140,0.14) 0%, transparent 35%);
    --shadow-low: 0 4px 12px rgba(15,23,42,0.06);
    --shadow-med: 0 12px 24px rgba(15,23,42,0.08);
    --shadow-high: 0 24px 48px rgba(15,23,42,0.12);
    --glow-primary: 0 16px 40px rgba(123,140,255,0.28);
    --glow-accent: 0 16px 40px rgba(255,179,140,0.22);
    --font-heading: 'Sora', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: var(--font-body);
    color: var(--text-main);
    background: var(--white);
    line-height: 1.6;
    overflow-x: hidden;
  }

  /* ─── HEADER ─── */
  .header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    padding: 0 48px;
    height: 72px;
    display: flex; align-items: center; justify-content: space-between;
    transition: background 300ms ease-out, box-shadow 300ms ease-out, backdrop-filter 300ms ease-out;
  }
  .header.scrolled {
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(16px);
    box-shadow: 0 1px 0 rgba(230,234,242,0.9), var(--shadow-low);
  }
  .header-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
  .logo-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: var(--gradient-cta);
    display: flex; align-items: center; justify-content: center;
    color: white; font-family: var(--font-heading); font-weight: 700; font-size: 15px;
    flex-shrink: 0;
  }
  .logo-text { font-family: var(--font-heading); font-weight: 600; font-size: 16px; color: var(--text-main); }
  .header-nav { display: flex; align-items: center; gap: 4px; }
  .nav-link {
    padding: 6px 16px; border-radius: 999px; font-size: 14px; font-weight: 500;
    color: var(--text-muted); text-decoration: none; position: relative;
    transition: color 200ms ease-out, background 200ms ease-out;
  }
  .nav-link:hover { color: var(--text-main); background: rgba(123,140,255,0.07); }
  .nav-link.active { color: var(--primary); }
  .nav-link.active::after {
    content: ''; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%; background: var(--primary);
  }
  .header-right { display: flex; align-items: center; gap: 12px; }
  .avatar {
    width: 38px; height: 38px; border-radius: 50%; overflow: hidden;
    border: 2px solid var(--border); cursor: pointer;
    background: linear-gradient(135deg, #C4C9FF, #E8C4FF);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: var(--primary);
    transition: box-shadow 200ms;
  }
  .avatar:hover { box-shadow: 0 0 0 3px rgba(123,140,255,0.2); }

  /* ─── BUTTONS ─── */
  .btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 14px; border: none; cursor: pointer;
    background: var(--gradient-cta);
    color: white; font-family: var(--font-heading); font-weight: 600; font-size: 15px;
    box-shadow: var(--glow-primary);
    transition: transform 200ms ease-out, box-shadow 200ms ease-out;
    text-decoration: none;
  }
  .btn-primary:hover { transform: scale(1.02); box-shadow: 0 20px 48px rgba(123,140,255,0.38); }
  .btn-primary:active { transform: scale(0.98); box-shadow: var(--shadow-low); }
  .btn-primary.sm { padding: 9px 18px; font-size: 14px; border-radius: 12px; }

  .btn-secondary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 14px; cursor: pointer;
    background: var(--white); border: 1.5px solid var(--border);
    color: var(--text-main); font-family: var(--font-heading); font-weight: 500; font-size: 15px;
    box-shadow: var(--shadow-low);
    transition: transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms;
    text-decoration: none;
  }
  .btn-secondary:hover { transform: scale(1.02); border-color: rgba(123,140,255,0.4); box-shadow: var(--shadow-med); }
  .btn-secondary:active { transform: scale(0.98); }

  /* ─── PAGE ─── */
  .page { padding-top: 72px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 48px; }

  /* ─── HERO ─── */
  .hero {
    min-height: calc(100vh - 72px);
    display: flex; align-items: center;
    background: var(--gradient-bg);
    padding: 64px 0;
    position: relative; overflow: hidden;
  }
  .hero-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 999px;
    background: rgba(123,140,255,0.1); border: 1px solid rgba(123,140,255,0.2);
    font-size: 12px; font-weight: 600; color: var(--primary); letter-spacing: 0.04em;
    margin-bottom: 24px; font-family: var(--font-heading);
  }
  .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
  .hero-h1 { font-family: var(--font-heading); font-size: 52px; font-weight: 700; line-height: 1.12; color: var(--text-main); margin-bottom: 20px; }
  .hero-h1 .gradient-word { background: var(--gradient-cta); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .hero-sub { font-size: 17px; color: var(--text-muted); line-height: 1.65; margin-bottom: 36px; max-width: 460px; }
  .hero-btns { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .hero-visual { position: relative; display: flex; align-items: center; justify-content: center; height: 500px; }

  /* ─── AI Visual ─── */
  .ai-visual { position: relative; width: 100%; height: 100%; }
  .blob {
    position: absolute; border-radius: 50%;
    filter: blur(40px); opacity: 0.7;
  }
  .blob-1 { width: 320px; height: 320px; background: radial-gradient(circle, rgba(161,139,255,0.55), rgba(123,140,255,0.25)); top: 50%; left: 50%; transform: translate(-50%,-50%); animation: drift1 8s ease-in-out infinite; }
  .blob-2 { width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,179,140,0.5), transparent); bottom: 60px; right: 40px; animation: drift2 10s ease-in-out infinite; }
  .blob-3 { width: 150px; height: 150px; background: radial-gradient(circle, rgba(123,140,255,0.4), transparent); top: 50px; left: 30px; animation: drift3 12s ease-in-out infinite; }
  @keyframes drift1 { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-48%,-52%) scale(1.05)} }
  @keyframes drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-12px,-16px)} }
  @keyframes drift3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(10px,14px)} }

  .brain-svg { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 2; }
  .sphere { position: absolute; border-radius: 50%; z-index: 3; }
  .sphere-1 { width: 28px; height: 28px; background: radial-gradient(circle at 35% 35%, #FFD4B8, #FF8C5A); bottom: 120px; right: 100px; box-shadow: 0 8px 24px rgba(255,140,90,0.4); animation: float1 6s ease-in-out infinite; }
  .sphere-2 { width: 18px; height: 18px; background: radial-gradient(circle at 35% 35%, #C5CBFF, #7B8CFF); top: 100px; right: 60px; box-shadow: 0 6px 18px rgba(123,140,255,0.4); animation: float2 7s ease-in-out infinite; }
  .sphere-3 { width: 14px; height: 14px; background: radial-gradient(circle at 35% 35%, #E0D6FF, #A18BFF); top: 160px; left: 80px; box-shadow: 0 4px 14px rgba(161,139,255,0.4); animation: float3 5s ease-in-out infinite; }
  .sphere-4 { width: 22px; height: 22px; background: radial-gradient(circle at 35% 35%, #FFE4D4, #FFB38C); top: 80px; left: 50%; box-shadow: 0 6px 18px rgba(255,179,140,0.4); animation: float1 9s ease-in-out infinite reverse; }
  @keyframes float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
  @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  @keyframes float3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

  /* Floating UI cards on hero */
  .hero-card {
    position: absolute; z-index: 4;
    background: rgba(255,255,255,0.92); border: 1px solid rgba(230,234,242,0.9);
    border-radius: 16px; padding: 12px 16px;
    backdrop-filter: blur(12px);
    box-shadow: var(--shadow-med);
    font-size: 13px; font-family: var(--font-body);
    animation: cardFloat 8s ease-in-out infinite;
  }
  .hero-card.card-a { bottom: 100px; right: 20px; width: 180px; animation-delay: 0s; }
  .hero-card.card-b { top: 80px; right: 40px; width: 200px; animation-delay: 2s; }
  @keyframes cardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  .card-label { font-size: 11px; font-weight: 600; color: var(--primary); letter-spacing: 0.05em; margin-bottom: 4px; text-transform: uppercase; }
  .card-text { color: var(--text-main); font-weight: 500; font-size: 13px; }
  .card-sub { color: var(--text-muted); font-size: 11px; margin-top: 2px; }
  .wave-badge { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
  .wave-bar { width: 3px; border-radius: 2px; background: var(--primary); animation: wave 1.2s ease-in-out infinite; }
  .wave-bar:nth-child(1){ height: 8px; animation-delay: 0ms; }
  .wave-bar:nth-child(2){ height: 14px; animation-delay: 100ms; }
  .wave-bar:nth-child(3){ height: 10px; animation-delay: 200ms; }
  .wave-bar:nth-child(4){ height: 18px; animation-delay: 300ms; }
  .wave-bar:nth-child(5){ height: 12px; animation-delay: 400ms; }
  .wave-bar:nth-child(6){ height: 8px; animation-delay: 500ms; }
  @keyframes wave { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.4)} }

  /* ─── SECTION ─── */
  .section { padding: 96px 0; }
  .section-alt { background: var(--surface); }
  .section-warm { background: var(--bg-warm); }
  .section-header { text-align: center; margin-bottom: 56px; }
  .section-title { font-family: var(--font-heading); font-size: 34px; font-weight: 700; color: var(--text-main); margin-bottom: 12px; }
  .section-sub { font-size: 16px; color: var(--text-muted); }

  /* ─── HOW IT WORKS ─── */
  .steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 32px; position: relative; }
  .step-connector {
    position: absolute; top: 52px; left: calc(33.33% - 10px); right: calc(33.33% - 10px);
    height: 1px; background: linear-gradient(90deg, rgba(123,140,255,0.3), rgba(161,139,255,0.3), rgba(255,179,140,0.3));
    z-index: 0;
  }
  .step-card { text-align: center; position: relative; z-index: 1; }
  .step-num {
    position: absolute; top: -8px; left: 50%; transform: translateX(-50%) translateX(24px);
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--gradient-cta);
    color: white; font-size: 11px; font-weight: 700; font-family: var(--font-heading);
    display: flex; align-items: center; justify-content: center;
  }
  .step-icon-wrap {
    width: 72px; height: 72px; border-radius: 20px;
    background: linear-gradient(135deg, rgba(123,140,255,0.12), rgba(161,139,255,0.08));
    border: 1px solid rgba(123,140,255,0.12);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px;
    transition: transform 300ms ease-out, box-shadow 300ms ease-out;
    position: relative;
  }
  .step-card:hover .step-icon-wrap { transform: translateY(-4px); box-shadow: var(--glow-primary); }
  .step-name { font-family: var(--font-heading); font-size: 17px; font-weight: 600; color: var(--text-main); margin-bottom: 8px; }
  .step-desc { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

  /* ─── WHY BETTER ─── */
  .cards-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 24px; }
  .feature-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 28px 24px;
    box-shadow: var(--shadow-low);
    transition: transform 300ms ease-out, box-shadow 300ms ease-out;
  }
  .feature-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-high); }
  .fc-icon {
    width: 52px; height: 52px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 18px;
    background: linear-gradient(135deg, rgba(123,140,255,0.1), rgba(255,179,140,0.08));
  }
  .fc-icon.accent { background: linear-gradient(135deg, rgba(255,179,140,0.15), rgba(255,140,90,0.08)); }
  .fc-title { font-family: var(--font-heading); font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 8px; }
  .fc-desc { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

  /* ─── FEATURES ─── */
  .features-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; }
  .feat-item {
    display: flex; gap: 18px; align-items: flex-start;
    padding: 24px; background: var(--white);
    border: 1px solid var(--border); border-radius: 20px;
    box-shadow: var(--shadow-low);
    transition: transform 300ms ease-out, box-shadow 300ms ease-out;
  }
  .feat-item:hover { transform: translateY(-4px); box-shadow: var(--shadow-high); }
  .feat-icon {
    width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, rgba(123,140,255,0.1), rgba(161,139,255,0.08));
  }
  .feat-icon.accent { background: linear-gradient(135deg, rgba(255,179,140,0.15), rgba(255,140,90,0.08)); }
  .feat-title { font-family: var(--font-heading); font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 6px; }
  .feat-desc { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

  /* ─── FINAL CTA ─── */
  .cta-block {
    border-radius: 24px;
    background: var(--gradient-cta);
    padding: 56px 64px;
    display: flex; align-items: center; justify-content: space-between;
    position: relative; overflow: hidden;
  }
  .cta-block::before {
    content: '';
    position: absolute; inset: 0;
    background: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.12), transparent 50%);
    pointer-events: none;
  }
  .cta-left { position: relative; z-index: 1; }
  .cta-title { font-family: var(--font-heading); font-size: 30px; font-weight: 700; color: white; margin-bottom: 8px; }
  .cta-sub { font-size: 16px; color: rgba(255,255,255,0.85); }
  .cta-btn {
    position: relative; z-index: 1;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 28px; border-radius: 14px; border: none; cursor: pointer;
    background: white; color: var(--primary);
    font-family: var(--font-heading); font-weight: 700; font-size: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.16);
    transition: transform 200ms ease-out, box-shadow 200ms ease-out;
    text-decoration: none; white-space: nowrap;
    flex-shrink: 0;
  }
  .cta-btn:hover { transform: scale(1.02); box-shadow: 0 12px 40px rgba(0,0,0,0.22); }
  .cta-btn:active { transform: scale(0.98); }

  /* ─── FOOTER ─── */
  .footer { background: var(--text-main); color: rgba(255,255,255,0.6); padding: 64px 0 32px; }
  .footer-top { display: grid; grid-template-columns: 220px repeat(4,1fr); gap: 40px; margin-bottom: 48px; }
  .footer-brand .logo-text { color: white; }
  .footer-brand .logo-icon { background: var(--gradient-cta); }
  .footer-tagline { font-size: 14px; color: rgba(255,255,255,0.45); margin-top: 12px; line-height: 1.6; }
  .footer-socials { display: flex; gap: 10px; margin-top: 20px; }
  .social-icon {
    width: 34px; height: 34px; border-radius: 8px;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    transition: background 200ms;
  }
  .social-icon:hover { background: rgba(255,255,255,0.16); }
  .footer-col-title { font-family: var(--font-heading); font-size: 13px; font-weight: 600; color: white; letter-spacing: 0.04em; margin-bottom: 16px; text-transform: uppercase; }
  .footer-link { display: block; font-size: 14px; color: rgba(255,255,255,0.5); text-decoration: none; margin-bottom: 10px; transition: color 200ms; }
  .footer-link:hover { color: rgba(255,255,255,0.9); }
  .footer-bottom { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px; text-align: center; font-size: 13px; color: rgba(255,255,255,0.3); }

  /* ─── MOBILE NAV OVERLAY ─── */
  .mobile-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(15,23,42,0.5); backdrop-filter: blur(4px);
    opacity: 0; pointer-events: none; transition: opacity 300ms ease-out;
  }
  .mobile-overlay.open { opacity: 1; pointer-events: all; }
  .mobile-menu {
    position: fixed; top: 0; right: 0; bottom: 0; width: 280px; z-index: 201;
    background: white; padding: 24px;
    transform: translateX(100%); transition: transform 300ms ease-out;
    box-shadow: -8px 0 32px rgba(15,23,42,0.12);
  }
  .mobile-menu.open { transform: translateX(0); }
  .mobile-menu-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
  .mobile-nav-link { display: block; padding: 14px 16px; border-radius: 12px; font-size: 16px; font-weight: 500; color: var(--text-main); text-decoration: none; margin-bottom: 4px; transition: background 200ms; }
  .mobile-nav-link:hover { background: var(--surface); }
  .mobile-nav-link.active { background: rgba(123,140,255,0.1); color: var(--primary); }

  /* ─── HAMBURGER ─── */
  .hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 6px; background: none; border: none; }
  .hamburger span { display: block; width: 22px; height: 2px; background: var(--text-main); border-radius: 2px; transition: all 300ms ease-out; }

  /* ─── SCROLL REVEAL ─── */
  .reveal { opacity: 0; transform: translateY(20px); transition: opacity 500ms ease-out, transform 500ms ease-out; }
  .reveal.visible { opacity: 1; transform: translateY(0); }

  /* ─── RESPONSIVE ─── */
  @media (max-width: 1024px) {
    .header { padding: 0 24px; }
    .container { padding: 0 24px; }
    .hero-inner { gap: 40px; }
    .hero-h1 { font-size: 42px; }
    .cards-4 { grid-template-columns: repeat(2,1fr); }
    .footer-top { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 768px) {
    .header-nav, .header-right .btn-primary { display: none; }
    .hamburger { display: flex; }
    .hero-inner { grid-template-columns: 1fr; gap: 32px; }
    .hero-visual { height: 300px; }
    .hero-h1 { font-size: 36px; }
    .steps-grid { grid-template-columns: 1fr; gap: 24px; }
    .step-connector { display: none; }
    .cards-4 { grid-template-columns: 1fr; }
    .features-row { grid-template-columns: 1fr; }
    .cta-block { flex-direction: column; gap: 28px; text-align: center; padding: 40px 28px; }
    .footer-top { grid-template-columns: 1fr; }
    .section { padding: 64px 0; }
  }
`;

const NAV_LINKS = [
  { label: "Home", href: "/", active: true },
  { label: "Learning", href: "/learning" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Support", href: "/support" },
];

function AppHeader({ menuOpen, setMenuOpen }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <header className={`header${scrolled ? " scrolled" : ""}`}>
        <a href="/" className="header-logo">
          <div className="logo-icon">AI</div>
          <span className="logo-text">AI Teacher</span>
        </a>
        <nav className="header-nav">
          {NAV_LINKS.map(l => (
            <a key={l.label} href={l.href} className={`nav-link${l.active ? " active" : ""}`}>{l.label}</a>
          ))}
        </nav>
        <div className="header-right">
          <div className="avatar">U</div>
          <a href="/learning" className="btn-primary sm">Start lesson →</a>
          <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
        </div>
      </header>
      <div className={`mobile-overlay${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        <div className="mobile-menu-header">
          <a href="/" className="header-logo">
            <div className="logo-icon">AI</div>
            <span className="logo-text">AI Teacher</span>
          </a>
          <button style={{background:"none",border:"none",cursor:"pointer",fontSize:"22px",color:"var(--text-muted)"}} onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        {NAV_LINKS.map(l => (
          <a key={l.label} href={l.href} className={`mobile-nav-link${l.active ? " active" : ""}`}>{l.label}</a>
        ))}
        <a href="/learning" className="btn-primary" style={{marginTop:"24px",width:"100%",justifyContent:"center"}}>Start lesson →</a>
      </div>
    </>
  );
}

function AIBrainVisual() {
  return (
    <div className="ai-visual">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <svg className="brain-svg" width="260" height="260" viewBox="0 0 260 260" fill="none">
        <defs>
          <radialGradient id="brainGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(200,195,255,0.9)" />
            <stop offset="40%" stopColor="rgba(161,139,255,0.75)" />
            <stop offset="100%" stopColor="rgba(123,140,255,0.5)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Stylized brain shape */}
        <ellipse cx="130" cy="125" rx="95" ry="85" fill="url(#brainGrad)" filter="url(#glow)" opacity="0.88" />
        <path d="M60 110 Q55 85 75 75 Q95 65 100 80 Q110 55 130 58 Q150 55 160 72 Q175 65 185 80 Q200 95 190 115" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M55 130 Q50 155 68 165 Q80 172 95 160 Q100 180 120 178 Q138 178 148 165 Q160 178 178 172 Q196 162 200 148" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M125 60 Q128 90 132 125 Q136 160 130 185" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
        {/* Glowing nodes */}
        <circle cx="95" cy="95" r="5" fill="rgba(255,200,180,0.9)" />
        <circle cx="155" cy="88" r="4" fill="rgba(200,195,255,0.95)" />
        <circle cx="170" cy="130" r="5.5" fill="rgba(255,179,140,0.85)" />
        <circle cx="90" cy="148" r="4" fill="rgba(161,139,255,0.9)" />
        <circle cx="135" cy="165" r="4.5" fill="rgba(255,200,180,0.8)" />
        {/* Connection lines */}
        <line x1="95" y1="95" x2="135" y2="165" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="155" y1="88" x2="170" y2="130" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="95" y1="95" x2="155" y2="88" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1="170" y1="130" x2="135" y2="165" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="90" y1="148" x2="135" y2="165" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        {/* Soft wave arcs */}
        <path d="M50 200 Q90 185 130 195 Q170 205 210 192" stroke="rgba(161,139,255,0.3)" strokeWidth="2" fill="none" />
        <path d="M60 215 Q100 200 130 210 Q160 220 205 207" stroke="rgba(255,179,140,0.25)" strokeWidth="1.5" fill="none" />
      </svg>
      <div className="sphere sphere-1" />
      <div className="sphere sphere-2" />
      <div className="sphere sphere-3" />
      <div className="sphere sphere-4" />
      <div className="hero-card card-b">
        <div className="card-label">AI Teacher</div>
        <div className="card-text">She ___ (go) to<br/>the gym every morning.</div>
        <div className="wave-badge">
          {[1,2,3,4,5,6].map(i => <div key={i} className="wave-bar" style={{animationDelay:`${(i-1)*80}ms`}} />)}
        </div>
      </div>
      <div className="hero-card card-a">
        <div className="card-label">Feedback</div>
        <div className="card-text">Great pronunciation!</div>
        <div className="card-sub">Let's try a new exercise.</div>
      </div>
    </div>
  );
}

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add("visible"); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, style, delay = 0 }) {
  const ref = useReveal();
  return (
    <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

const STEPS = [
  { num: 1, label: "Choose your lesson", desc: "Pick a topic or textbook and set your goals.", icon: BookIcon },
  { num: 2, label: "Start speaking", desc: "Have real conversations with your AI teacher.", icon: MicIcon },
  { num: 3, label: "Get instant feedback", desc: "AI corrects your mistakes and helps you improve.", icon: FeedbackIcon },
];

const WHY_CARDS = [
  { title: "24/7 Availability", desc: "Learn anytime, anywhere. Your tutor is always here.", icon: ClockIcon, accent: false },
  { title: "Instant Feedback", desc: "Get corrections and suggestions in real time.", icon: BoltIcon, accent: false },
  { title: "Cheaper than tutors", desc: "Premium learning experience at a fraction of the cost.", icon: DollarIcon, accent: true },
  { title: "Personalized Learning", desc: "Lessons adapt to your level, goals, and progress.", icon: PersonIcon, accent: true },
];

const FEATURES = [
  { title: "Voice interaction", desc: "Speak naturally. Our AI understands and responds like a real teacher.", icon: MicIcon, accent: false },
  { title: "Smart chat", desc: "Ask questions, get explanations, and go deeper anytime.", icon: ChatIcon, accent: false },
  { title: "Interactive exercises", desc: "Practice with purpose. Reading, listening, speaking, and more.", icon: ExerciseIcon, accent: true },
];

// ─── ICONS ───
function BookIcon({ size = 28, color = "#7B8CFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function MicIcon({ size = 28, color = "#7B8CFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="20" x2="12" y2="24" />
    </svg>
  );
}
function FeedbackIcon({ size = 28, color = "#7B8CFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="14" rx="3" /><path d="M3 20l3-3h12" /><path d="M8 9h8M8 12h5" />
    </svg>
  );
}
function ClockIcon({ size = 26, color = "#7B8CFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function BoltIcon({ size = 26, color = "#7B8CFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function DollarIcon({ size = 26, color = "#FFB38C" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function PersonIcon({ size = 26, color = "#FFB38C" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function ChatIcon({ size = 26, color = "#7B8CFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function ExerciseIcon({ size = 26, color = "#FFB38C" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="12" y2="15" />
    </svg>
  );
}
function TwitterIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>;
}
function InstagramIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="rgba(255,255,255,0.6)"/></svg>;
}
function YoutubeIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#1a1a2e"/></svg>;
}
function TikTokIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.79 1.54V6.78a4.85 4.85 0 0 1-1.02-.09z"/></svg>;
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <style>{CSS}</style>
      <div className="page">
        <AppHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />

        {/* ─── HERO ─── */}
        <section className="hero">
          <div className="container" style={{width:"100%"}}>
            <div className="hero-inner">
              <div>
                <RevealSection>
                  <div className="hero-badge">
                    <div className="badge-dot" />
                    AI-Powered English Learning
                  </div>
                </RevealSection>
                <RevealSection delay={80}>
                  <h1 className="hero-h1">
                    Learn English with AI. Like a real teacher — but <span className="gradient-word">smarter.</span>
                  </h1>
                </RevealSection>
                <RevealSection delay={160}>
                  <p className="hero-sub">Speak, listen, and improve in real time with your personal AI tutor.</p>
                </RevealSection>
                <RevealSection delay={240}>
                  <div className="hero-btns">
                    <a href="/learning" className="btn-primary">✦ Start lesson</a>
                    <button className="btn-secondary" onClick={() => alert("Demo coming soon!")}>▶ Watch demo</button>
                  </div>
                </RevealSection>
              </div>
              <RevealSection delay={120}>
                <AIBrainVisual />
              </RevealSection>
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section className="section">
          <div className="container">
            <RevealSection>
              <div className="section-header">
                <h2 className="section-title">How it works</h2>
                <p className="section-sub">Simple steps to start learning smarter.</p>
              </div>
            </RevealSection>
            <div className="steps-grid">
              <div className="step-connector" />
              {STEPS.map((s, i) => (
                <RevealSection key={s.num} delay={i * 100}>
                  <div className="step-card">
                    <div className="step-icon-wrap">
                      <div className="step-num">{s.num}</div>
                      <s.icon size={28} />
                    </div>
                    <div className="step-name">{s.label}</div>
                    <div className="step-desc">{s.desc}</div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ─── WHY IT'S BETTER ─── */}
        <section className="section section-alt">
          <div className="container">
            <RevealSection>
              <div className="section-header">
                <h2 className="section-title">Why it's better</h2>
                <p className="section-sub">AI learning that adapts to you.</p>
              </div>
            </RevealSection>
            <div className="cards-4">
              {WHY_CARDS.map((c, i) => (
                <RevealSection key={c.title} delay={i * 90}>
                  <div className="feature-card">
                    <div className={`fc-icon${c.accent ? " accent" : ""}`}>
                      <c.icon size={26} color={c.accent ? "#FFB38C" : "#7B8CFF"} />
                    </div>
                    <div className="fc-title">{c.title}</div>
                    <div className="fc-desc">{c.desc}</div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section className="section">
          <div className="container">
            <RevealSection>
              <div className="section-header">
                <h2 className="section-title">Features</h2>
                <p className="section-sub">Everything you need to learn effectively.</p>
              </div>
            </RevealSection>
            <div className="features-row">
              {FEATURES.map((f, i) => (
                <RevealSection key={f.title} delay={i * 100}>
                  <div className="feat-item">
                    <div className={`feat-icon${f.accent ? " accent" : ""}`}>
                      <f.icon size={24} color={f.accent ? "#FFB38C" : "#7B8CFF"} />
                    </div>
                    <div>
                      <div className="feat-title">{f.title}</div>
                      <div className="feat-desc">{f.desc}</div>
                    </div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FINAL CTA ─── */}
        <section className="section section-warm">
          <div className="container">
            <RevealSection>
              <div className="cta-block">
                <div className="cta-left">
                  <h2 className="cta-title">Ready to improve your English?</h2>
                  <p className="cta-sub">Start your first lesson now. It's free.</p>
                </div>
                <a href="/learning" className="cta-btn">Start lesson →</a>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="footer">
          <div className="container">
            <div className="footer-top">
              <div className="footer-brand">
                <a href="/" className="header-logo">
                  <div className="logo-icon">AI</div>
                  <span className="logo-text">AI Teacher</span>
                </a>
                <p className="footer-tagline">The future of learning<br/>is one-on-one with AI.</p>
                <div className="footer-socials">
                  <div className="social-icon"><TwitterIcon /></div>
                  <div className="social-icon"><InstagramIcon /></div>
                  <div className="social-icon"><YoutubeIcon /></div>
                  <div className="social-icon"><TikTokIcon /></div>
                </div>
              </div>
              {[
                { title: "Product", links: ["Learning", "Features", "Pricing", "For Schools"] },
                { title: "Resources", links: ["Help Center", "Blog", "Guides", "Community"] },
                { title: "Company", links: ["About Us", "Careers", "Contact", "Privacy Policy"] },
                { title: "Support", links: ["Support Center", "System Status", "Report a Bug", "Contact Support"] },
              ].map(col => (
                <div key={col.title}>
                  <div className="footer-col-title">{col.title}</div>
                  {col.links.map(l => <a key={l} href="#" className="footer-link">{l}</a>)}
                </div>
              ))}
            </div>
            <div className="footer-bottom">© 2025 AI Teacher. All rights reserved.</div>
          </div>
        </footer>
      </div>
    </>
  );
}
