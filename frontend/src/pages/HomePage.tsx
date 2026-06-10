import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CSS = `
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
  body { font-family: var(--font-body); color: var(--text-main); background: var(--white); line-height: 1.6; overflow-x: hidden; }

  .hp-page { padding-top: 72px; }
  .hp-container { max-width: 1200px; margin: 0 auto; padding: 0 48px; }

  .hp-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 14px; border: none; cursor: pointer;
    background: var(--gradient-cta); color: white;
    font-family: var(--font-heading); font-weight: 600; font-size: 15px;
    box-shadow: var(--glow-primary);
    transition: transform 200ms ease-out, box-shadow 200ms ease-out;
    text-decoration: none;
  }
  .hp-btn-primary:hover { transform: scale(1.02); box-shadow: 0 20px 48px rgba(123,140,255,0.38); }
  .hp-btn-primary:active { transform: scale(0.98); }

  .hp-btn-secondary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 24px; border-radius: 14px; cursor: pointer;
    background: var(--white); border: 1.5px solid var(--border);
    color: var(--text-main); font-family: var(--font-heading); font-weight: 500; font-size: 15px;
    box-shadow: var(--shadow-low);
    transition: transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms;
    text-decoration: none;
  }
  .hp-btn-secondary:hover { transform: scale(1.02); border-color: rgba(123,140,255,0.4); box-shadow: var(--shadow-med); }

  .hp-hero {
    display: flex; align-items: center;
    background: var(--gradient-bg);
    padding: 56px 0 88px; position: relative; overflow: hidden;
  }
  .hp-hero-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center; }
  .hp-hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 999px;
    background: rgba(123,140,255,0.1); border: 1px solid rgba(123,140,255,0.2);
    font-size: 12px; font-weight: 600; color: var(--primary); letter-spacing: 0.04em;
    margin-bottom: 24px; font-family: var(--font-heading);
  }
  .hp-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); animation: hp-pulse 2s infinite; }
  @keyframes hp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
  .hp-hero-h1 { font-family: var(--font-heading); font-size: 52px; font-weight: 700; line-height: 1.12; color: var(--text-main); margin-bottom: 20px; }
  .hp-hero-h1 .gradient-word { background: var(--gradient-cta); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .hp-hero-sub { font-size: 17px; color: var(--text-muted); line-height: 1.65; margin-bottom: 36px; max-width: 460px; }
  .hp-hero-btns { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .hp-hero-visual { position: relative; display: flex; align-items: center; justify-content: center; height: 500px; }

  .hp-ai-visual { position: relative; width: 100%; height: 100%; }
  .hp-blob { position: absolute; border-radius: 50%; filter: blur(40px); opacity: 0.7; }
  .hp-blob-1 { width: 320px; height: 320px; background: radial-gradient(circle, rgba(161,139,255,0.55), rgba(123,140,255,0.25)); top: 50%; left: 50%; transform: translate(-50%,-50%); animation: hp-drift1 8s ease-in-out infinite; }
  .hp-blob-2 { width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,179,140,0.5), transparent); bottom: 60px; right: 40px; animation: hp-drift2 10s ease-in-out infinite; }
  .hp-blob-3 { width: 150px; height: 150px; background: radial-gradient(circle, rgba(123,140,255,0.4), transparent); top: 50px; left: 30px; animation: hp-drift3 12s ease-in-out infinite; }
  @keyframes hp-drift1 { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-48%,-52%) scale(1.05)} }
  @keyframes hp-drift2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-12px,-16px)} }
  @keyframes hp-drift3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(10px,14px)} }

  .hp-brain-svg { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 2; }
  .hp-sphere { position: absolute; border-radius: 50%; z-index: 3; }
  .hp-sphere-1 { width: 28px; height: 28px; background: radial-gradient(circle at 35% 35%, #FFD4B8, #FF8C5A); bottom: 120px; right: 100px; box-shadow: 0 8px 24px rgba(255,140,90,0.4); animation: hp-float1 6s ease-in-out infinite; }
  .hp-sphere-2 { width: 18px; height: 18px; background: radial-gradient(circle at 35% 35%, #C5CBFF, #7B8CFF); top: 100px; right: 60px; box-shadow: 0 6px 18px rgba(123,140,255,0.4); animation: hp-float2 7s ease-in-out infinite; }
  .hp-sphere-3 { width: 14px; height: 14px; background: radial-gradient(circle at 35% 35%, #E0D6FF, #A18BFF); top: 160px; left: 80px; box-shadow: 0 4px 14px rgba(161,139,255,0.4); animation: hp-float3 5s ease-in-out infinite; }
  .hp-sphere-4 { width: 22px; height: 22px; background: radial-gradient(circle at 35% 35%, #FFE4D4, #FFB38C); top: 80px; left: 50%; box-shadow: 0 6px 18px rgba(255,179,140,0.4); animation: hp-float1 9s ease-in-out infinite reverse; }
  @keyframes hp-float1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-18px)} }
  @keyframes hp-float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  @keyframes hp-float3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }

  .hp-hero-card {
    position: absolute; z-index: 4;
    background: rgba(255,255,255,0.92); border: 1px solid rgba(230,234,242,0.9);
    border-radius: 16px; padding: 12px 16px;
    backdrop-filter: blur(12px); box-shadow: var(--shadow-med);
    font-size: 13px; font-family: var(--font-body);
    animation: hp-cardFloat 8s ease-in-out infinite;
  }
  .hp-hero-card.card-a { bottom: 100px; right: 20px; width: 180px; animation-delay: 0s; }
  .hp-hero-card.card-b { top: 80px; right: 40px; width: 200px; animation-delay: 2s; }
  @keyframes hp-cardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  .hp-card-label { font-size: 11px; font-weight: 600; color: var(--primary); letter-spacing: 0.05em; margin-bottom: 4px; text-transform: uppercase; }
  .hp-card-text { color: var(--text-main); font-weight: 500; font-size: 13px; }
  .hp-card-sub { color: var(--text-muted); font-size: 11px; margin-top: 2px; }
  .hp-wave-badge { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
  .hp-wave-bar { width: 3px; border-radius: 2px; background: var(--primary); animation: hp-wave 1.2s ease-in-out infinite; }
  @keyframes hp-wave { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.4)} }

  .hp-section { padding: 96px 0; }
  .hp-section-alt { background: var(--surface); }
  .hp-section-warm { background: var(--bg-warm); }
  .hp-section-header { text-align: center; margin-bottom: 56px; }
  .hp-section-title { font-family: var(--font-heading); font-size: 34px; font-weight: 700; color: var(--text-main); margin-bottom: 12px; }
  .hp-section-sub { font-size: 16px; color: var(--text-muted); }

  .hp-steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 32px; position: relative; }
  .hp-step-connector { position: absolute; top: 52px; left: calc(33.33% - 10px); right: calc(33.33% - 10px); height: 1px; background: linear-gradient(90deg, rgba(123,140,255,0.3), rgba(161,139,255,0.3), rgba(255,179,140,0.3)); z-index: 0; }
  .hp-step-card { text-align: center; position: relative; z-index: 1; }
  .hp-step-num { position: absolute; top: -8px; left: 50%; transform: translateX(-50%) translateX(24px); width: 20px; height: 20px; border-radius: 50%; background: var(--gradient-cta); color: white; font-size: 11px; font-weight: 700; font-family: var(--font-heading); display: flex; align-items: center; justify-content: center; }
  .hp-step-icon-wrap { width: 72px; height: 72px; border-radius: 20px; background: linear-gradient(135deg, rgba(123,140,255,0.12), rgba(161,139,255,0.08)); border: 1px solid rgba(123,140,255,0.12); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; transition: transform 300ms ease-out, box-shadow 300ms ease-out; position: relative; }
  .hp-step-card:hover .hp-step-icon-wrap { transform: translateY(-4px); box-shadow: var(--glow-primary); }
  .hp-step-name { font-family: var(--font-heading); font-size: 17px; font-weight: 600; color: var(--text-main); margin-bottom: 8px; }
  .hp-step-desc { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

  .hp-cards-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 24px; }
  .hp-feature-card { background: var(--white); border: 1px solid var(--border); border-radius: 20px; padding: 28px 24px; box-shadow: var(--shadow-low); transition: transform 300ms ease-out, box-shadow 300ms ease-out; }
  .hp-feature-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-high); }
  .hp-fc-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; background: linear-gradient(135deg, rgba(123,140,255,0.1), rgba(255,179,140,0.08)); }
  .hp-fc-icon.accent { background: linear-gradient(135deg, rgba(255,179,140,0.15), rgba(255,140,90,0.08)); }
  .hp-fc-title { font-family: var(--font-heading); font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 8px; }
  .hp-fc-desc { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

  .hp-features-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; }
  .hp-feat-item { display: flex; gap: 18px; align-items: flex-start; padding: 24px; background: var(--white); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow-low); transition: transform 300ms ease-out, box-shadow 300ms ease-out; }
  .hp-feat-item:hover { transform: translateY(-4px); box-shadow: var(--shadow-high); }
  .hp-feat-icon { width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(123,140,255,0.1), rgba(161,139,255,0.08)); }
  .hp-feat-icon.accent { background: linear-gradient(135deg, rgba(255,179,140,0.15), rgba(255,140,90,0.08)); }
  .hp-feat-title { font-family: var(--font-heading); font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 6px; }
  .hp-feat-desc { font-size: 14px; color: var(--text-muted); line-height: 1.6; }

  .hp-cta-block { border-radius: 24px; background: var(--gradient-cta); padding: 56px 64px; display: flex; align-items: center; justify-content: space-between; position: relative; overflow: hidden; }
  .hp-cta-block::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 20% 50%, rgba(255,255,255,0.12), transparent 50%); pointer-events: none; }
  .hp-cta-left { position: relative; z-index: 1; }
  .hp-cta-title { font-family: var(--font-heading); font-size: 30px; font-weight: 700; color: white; margin-bottom: 8px; }
  .hp-cta-sub { font-size: 16px; color: rgba(255,255,255,0.85); }
  .hp-cta-btn { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 14px; border: none; cursor: pointer; background: white; color: var(--primary); font-family: var(--font-heading); font-weight: 700; font-size: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.16); transition: transform 200ms ease-out, box-shadow 200ms ease-out; text-decoration: none; white-space: nowrap; flex-shrink: 0; }
  .hp-cta-btn:hover { transform: scale(1.02); box-shadow: 0 12px 40px rgba(0,0,0,0.22); }

  .hp-reveal { opacity: 0; transform: translateY(20px); transition: opacity 500ms ease-out, transform 500ms ease-out; }
  .hp-reveal.visible { opacity: 1; transform: translateY(0); }

  @media (max-width: 1024px) {
    .hp-container { padding: 0 24px; }
    .hp-hero-inner { gap: 40px; }
    .hp-hero-h1 { font-size: 42px; }
    .hp-cards-4 { grid-template-columns: repeat(2,1fr); }
  }
  @media (max-width: 768px) {
    .hp-hero-inner { grid-template-columns: 1fr; gap: 32px; }
    .hp-hero-visual { height: 300px; }
    .hp-hero-h1 { font-size: 36px; }
    .hp-steps-grid { grid-template-columns: 1fr; gap: 24px; }
    .hp-step-connector { display: none; }
    .hp-cards-4 { grid-template-columns: 1fr; }
    .hp-features-row { grid-template-columns: 1fr; }
    .hp-cta-block { flex-direction: column; gap: 28px; text-align: center; padding: 40px 28px; }
    .hp-section { padding: 64px 0; }
    .hp-hero { padding: 40px 0 56px; }
  }
  @media (max-width: 480px) {
    .hp-container { padding: 0 16px; }
    .hp-hero-h1 { font-size: 28px; line-height: 1.15; }
    .hp-hero-sub { font-size: 15px; }
    .hp-hero-visual { height: 220px; }
    .hp-hero-card { display: none; }
    .hp-section-title { font-size: 26px; }
    .hp-section { padding: 48px 0; }
    .hp-cta-block { padding: 28px 20px; }
    .hp-cta-title { font-size: 22px; }
    .hp-cta-sub { font-size: 14px; }
    .hp-hero-badge { font-size: 11px; padding: 5px 11px; }
    .hp-btn-primary, .hp-btn-secondary { font-size: 14px; padding: 11px 20px; }
  }

  /* Kids Mode section */
  .hp-kids-block {
    display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center;
  }
  .hp-kids-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 5px 14px; border-radius: 999px; margin-bottom: 18px;
    background: rgba(255,179,140,0.12); border: 1px solid rgba(255,179,140,0.3);
    font-size: 12px; font-weight: 700; color: #E07040; letter-spacing: 0.04em;
    font-family: var(--font-heading);
  }
  .hp-kids-title {
    font-family: var(--font-heading); font-size: 34px; font-weight: 800;
    color: var(--text-main); line-height: 1.15; margin-bottom: 14px;
  }
  .hp-kids-sub { font-size: 16px; color: var(--text-muted); line-height: 1.65; margin-bottom: 28px; max-width: 400px; }
  .hp-kids-cta {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 26px; border-radius: 14px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #FFB38C 0%, #FF8C5A 100%); color: white;
    font-family: var(--font-heading); font-weight: 700; font-size: 15px;
    box-shadow: 0 8px 28px rgba(255,140,90,0.38); text-decoration: none;
    transition: transform 180ms ease-out, box-shadow 180ms ease-out;
  }
  .hp-kids-cta:hover { transform: scale(1.02); box-shadow: 0 12px 36px rgba(255,140,90,0.48); }
  .hp-kids-visual {
    background: linear-gradient(135deg, #FFF4EE 0%, #F0F4FF 100%);
    border-radius: 28px; padding: 40px; display: flex; flex-direction: column;
    align-items: center; gap: 18px;
    border: 1px solid rgba(255,179,140,0.2);
    box-shadow: 0 12px 32px rgba(255,140,90,0.10);
  }
  .hp-kids-emoji-row { display: flex; gap: 16px; font-size: 36px; }
  .hp-kids-pillars { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .hp-kids-pillar {
    display: flex; align-items: center; gap: 7px;
    background: white; border: 1px solid rgba(230,234,242,0.9);
    border-radius: 22px; padding: 8px 14px;
    font-size: 13px; font-weight: 600; color: #475569;
    box-shadow: var(--shadow-low);
  }
  @media (max-width: 768px) {
    .hp-kids-block { grid-template-columns: 1fr; gap: 32px; }
    .hp-kids-title { font-size: 26px; }
  }
`

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect() }
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

function RevealSection({ children, style, delay = 0 }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number }) {
  const ref = useReveal()
  return (
    <div ref={ref} className="hp-reveal" style={{ transitionDelay: `${delay}ms`, ...style }}>
      {children}
    </div>
  )
}

function BookIcon({ size = 28, color = '#7B8CFF' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
}
function MicIcon({ size = 28, color = '#7B8CFF' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="20" x2="12" y2="24" /></svg>
}
function FeedbackIcon({ size = 28, color = '#7B8CFF' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="3" /><path d="M3 20l3-3h12" /><path d="M8 9h8M8 12h5" /></svg>
}
function ClockIcon({ size = 26, color = '#7B8CFF' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}
function BoltIcon({ size = 26, color = '#7B8CFF' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
}
function DollarIcon({ size = 26, color = '#FFB38C' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
}
function PersonIcon({ size = 26, color = '#FFB38C' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}
function ChatIcon({ size = 26, color = '#7B8CFF' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
}
function ExerciseIcon({ size = 26, color = '#FFB38C' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="12" y2="15" /></svg>
}

const STEPS = [
  { num: 1, label: 'Choose your lesson', desc: 'Pick a topic or textbook and set your goals.', Icon: BookIcon },
  { num: 2, label: 'Start speaking', desc: 'Have real conversations with your AI teacher.', Icon: MicIcon },
  { num: 3, label: 'Get instant feedback', desc: 'AI corrects your mistakes and helps you improve.', Icon: FeedbackIcon },
]
const WHY_CARDS = [
  { title: '24/7 Availability', desc: 'Learn anytime, anywhere. Your tutor is always here.', Icon: ClockIcon, accent: false },
  { title: 'Instant Feedback', desc: 'Get corrections and suggestions in real time.', Icon: BoltIcon, accent: false },
  { title: 'Cheaper than tutors', desc: 'Premium learning experience at a fraction of the cost.', Icon: DollarIcon, accent: true },
  { title: 'Personalized Learning', desc: 'Lessons adapt to your level, goals, and progress.', Icon: PersonIcon, accent: true },
]
const FEATURES = [
  { title: 'Voice interaction', desc: 'Speak naturally. Our AI understands and responds like a real teacher.', Icon: MicIcon, accent: false },
  { title: 'Smart chat', desc: 'Ask questions, get explanations, and go deeper anytime.', Icon: ChatIcon, accent: false },
  { title: 'Interactive exercises', desc: 'Practice with purpose. Reading, listening, speaking, and more.', Icon: ExerciseIcon, accent: true },
]

function AIBrainVisual() {
  return (
    <div className="hp-ai-visual">
      <div className="hp-blob hp-blob-1" />
      <div className="hp-blob hp-blob-2" />
      <div className="hp-blob hp-blob-3" />
      <svg className="hp-brain-svg" width="260" height="260" viewBox="0 0 260 260" fill="none">
        <defs>
          <radialGradient id="hp-brainGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="rgba(200,195,255,0.9)" />
            <stop offset="40%" stopColor="rgba(161,139,255,0.75)" />
            <stop offset="100%" stopColor="rgba(123,140,255,0.5)" />
          </radialGradient>
          <filter id="hp-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <ellipse cx="130" cy="125" rx="95" ry="85" fill="url(#hp-brainGrad)" filter="url(#hp-glow)" opacity="0.88" />
        <path d="M60 110 Q55 85 75 75 Q95 65 100 80 Q110 55 130 58 Q150 55 160 72 Q175 65 185 80 Q200 95 190 115" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M55 130 Q50 155 68 165 Q80 172 95 160 Q100 180 120 178 Q138 178 148 165 Q160 178 178 172 Q196 162 200 148" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M125 60 Q128 90 132 125 Q136 160 130 185" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" strokeLinecap="round" />
        <circle cx="95" cy="95" r="5" fill="rgba(255,200,180,0.9)" />
        <circle cx="155" cy="88" r="4" fill="rgba(200,195,255,0.95)" />
        <circle cx="170" cy="130" r="5.5" fill="rgba(255,179,140,0.85)" />
        <circle cx="90" cy="148" r="4" fill="rgba(161,139,255,0.9)" />
        <circle cx="135" cy="165" r="4.5" fill="rgba(255,200,180,0.8)" />
        <line x1="95" y1="95" x2="135" y2="165" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="155" y1="88" x2="170" y2="130" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="95" y1="95" x2="155" y2="88" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        <line x1="170" y1="130" x2="135" y2="165" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="90" y1="148" x2="135" y2="165" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <path d="M50 200 Q90 185 130 195 Q170 205 210 192" stroke="rgba(161,139,255,0.3)" strokeWidth="2" fill="none" />
        <path d="M60 215 Q100 200 130 210 Q160 220 205 207" stroke="rgba(255,179,140,0.25)" strokeWidth="1.5" fill="none" />
      </svg>
      <div className="hp-sphere hp-sphere-1" />
      <div className="hp-sphere hp-sphere-2" />
      <div className="hp-sphere hp-sphere-3" />
      <div className="hp-sphere hp-sphere-4" />
      <div className="hp-hero-card card-b">
        <div className="hp-card-label">AI Teacher</div>
        <div className="hp-card-text">She ___ (go) to<br />the gym every morning.</div>
        <div className="hp-wave-badge">
          {[1,2,3,4,5,6].map(i => <div key={i} className="hp-wave-bar" style={{ animationDelay: `${(i-1)*80}ms` }} />)}
        </div>
      </div>
      <div className="hp-hero-card card-a">
        <div className="hp-card-label">Feedback</div>
        <div className="hp-card-text">Great pronunciation!</div>
        <div className="hp-card-sub">Let's try a new exercise.</div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  return (
    <>
      <style>{CSS}</style>
      <div className="hp-page">
        {/* HERO */}
        <section id="hero" className="hp-hero">
          <div className="hp-container" style={{ width: '100%' }}>
            <div className="hp-hero-inner">
              <div>
                <RevealSection>
                  <div className="hp-hero-badge">
                    <div className="hp-badge-dot" />
                    AI-Powered English Learning
                  </div>
                </RevealSection>
                <RevealSection delay={80}>
                  <h1 className="hp-hero-h1">
                    Learn English with AI. Like a real teacher — but <span className="gradient-word">smarter.</span>
                  </h1>
                </RevealSection>
                <RevealSection delay={160}>
                  <p className="hp-hero-sub">Speak, listen, and improve in real time with your personal AI tutor.</p>
                </RevealSection>
                <RevealSection delay={240}>
                  <div className="hp-hero-btns">
                    <Link to="/demo/setup" className="hp-btn-primary">✦ Start free AI demo</Link>
                    <Link to="/demo/setup" className="hp-btn-secondary">▶ Watch demo</Link>
                  </div>
                </RevealSection>
              </div>
              <RevealSection delay={120}>
                <div className="hp-hero-visual"><AIBrainVisual /></div>
              </RevealSection>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="hp-section">
          <div className="hp-container">
            <RevealSection>
              <div className="hp-section-header">
                <h2 className="hp-section-title">How it works</h2>
                <p className="hp-section-sub">Simple steps to start learning smarter.</p>
              </div>
            </RevealSection>
            <div className="hp-steps-grid">
              <div className="hp-step-connector" />
              {STEPS.map((s, i) => (
                <RevealSection key={s.num} delay={i * 100}>
                  <div className="hp-step-card">
                    <div className="hp-step-icon-wrap">
                      <div className="hp-step-num">{s.num}</div>
                      <s.Icon size={28} />
                    </div>
                    <div className="hp-step-name">{s.label}</div>
                    <div className="hp-step-desc">{s.desc}</div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* WHY IT'S BETTER */}
        <section id="why-better" className="hp-section hp-section-alt">
          <div className="hp-container">
            <RevealSection>
              <div className="hp-section-header">
                <h2 className="hp-section-title">Why it's better</h2>
                <p className="hp-section-sub">AI learning that adapts to you.</p>
              </div>
            </RevealSection>
            <div className="hp-cards-4">
              {WHY_CARDS.map((c, i) => (
                <RevealSection key={c.title} delay={i * 90}>
                  <div className="hp-feature-card">
                    <div className={`hp-fc-icon${c.accent ? ' accent' : ''}`}>
                      <c.Icon size={26} color={c.accent ? '#FFB38C' : '#7B8CFF'} />
                    </div>
                    <div className="hp-fc-title">{c.title}</div>
                    <div className="hp-fc-desc">{c.desc}</div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="hp-section">
          <div className="hp-container">
            <RevealSection>
              <div className="hp-section-header">
                <h2 className="hp-section-title">Features</h2>
                <p className="hp-section-sub">Everything you need to learn effectively.</p>
              </div>
            </RevealSection>
            <div className="hp-features-row">
              {FEATURES.map((f, i) => (
                <RevealSection key={f.title} delay={i * 100}>
                  <div className="hp-feat-item">
                    <div className={`hp-feat-icon${f.accent ? ' accent' : ''}`}>
                      <f.Icon size={24} color={f.accent ? '#FFB38C' : '#7B8CFF'} />
                    </div>
                    <div>
                      <div className="hp-feat-title">{f.title}</div>
                      <div className="hp-feat-desc">{f.desc}</div>
                    </div>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* KIDS MODE */}
        <section id="kids-mode" className="hp-section hp-section-warm">
          <div className="hp-container">
            <RevealSection>
              <div className="hp-kids-block">
                <div>
                  <div className="hp-kids-badge">New ✦ Kids Mode</div>
                  <h2 className="hp-kids-title">
                    English for kids —<br />fun and interactive.
                  </h2>
                  <p className="hp-kids-sub">
                    Based on Kid's Box by Cambridge. An AI teacher guides your child
                    through voice lessons, games, and exercises — personalized to their
                    favourite topics.
                  </p>
                  <Link to="/kids" className="hp-kids-cta">
                    {isAuthenticated ? 'Open Kids Mode →' : 'Try Kids Mode →'}
                  </Link>
                </div>
                <div className="hp-kids-visual">
                  <div className="hp-kids-emoji-row">
                    <span>🦁</span><span>🎨</span><span>🚀</span>
                  </div>
                  <div className="hp-kids-pillars">
                    <div className="hp-kids-pillar"><span>📚</span> Kid's Box curriculum</div>
                    <div className="hp-kids-pillar"><span>🎙️</span> Voice lessons</div>
                    <div className="hp-kids-pillar"><span>⭐</span> Personalized</div>
                    <div className="hp-kids-pillar"><span>🔒</span> Safe for children</div>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="hp-section hp-section-alt">
          <div className="hp-container">
            <RevealSection>
              <div className="hp-cta-block">
                <div className="hp-cta-left">
                  <h2 className="hp-cta-title">Ready to improve your English?</h2>
                  <p className="hp-cta-sub">Try your first AI demo lesson free.</p>
                </div>
                <Link to="/demo/setup" className="hp-cta-btn">Start demo lesson →</Link>
              </div>
            </RevealSection>
          </div>
        </section>
      </div>
    </>
  )
}
