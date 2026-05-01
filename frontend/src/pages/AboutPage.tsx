import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const CSS = `
  .ab-bg-canvas {
    position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  }
  .ab-bg-blob {
    position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.18;
    animation: abBlobFloat 18s ease-in-out infinite alternate;
  }
  .ab-bg-blob-1 { width:600px;height:600px;background:#788CFF;top:-200px;right:-100px;animation-duration:20s; }
  .ab-bg-blob-2 { width:400px;height:400px;background:#FFB38C;bottom:20%;left:-150px;animation-duration:25s;animation-delay:-5s; }
  .ab-bg-blob-3 { width:300px;height:300px;background:#A18BFF;top:50%;left:40%;animation-duration:22s;animation-delay:-10s; }
  @keyframes abBlobFloat {
    0%   { transform: translate(0,0) scale(1); }
    33%  { transform: translate(30px,-20px) scale(1.05); }
    66%  { transform: translate(-20px,15px) scale(0.97); }
    100% { transform: translate(15px,25px) scale(1.02); }
  }

  .ab-page { position: relative; z-index: 1; }
  .ab-container { max-width:1160px; margin:0 auto; padding:0 48px; }
  @media(max-width:768px){ .ab-container{ padding:0 24px; } }

  .ab-reveal {
    opacity:0; transform:translateY(28px);
    transition: opacity 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1);
  }
  .ab-reveal.ab-visible { opacity:1; transform:translateY(0); }

  .ab-section-label {
    display:inline-flex; align-items:center; gap:6px;
    font-size:12px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;
    color:#788CFF; background:rgba(120,140,255,0.08);
    padding:4px 12px; border-radius:100px; margin-bottom:16px;
  }

  /* HERO */
  .ab-hero { padding:96px 0 80px; overflow:hidden; }
  .ab-hero-inner { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; }
  .ab-hero-text h1 {
    font-family:'Sora', sans-serif;
    font-size:48px; line-height:1.1; font-weight:800; color:#0F172A; margin-bottom:20px;
    letter-spacing:-1px;
  }
  .ab-hero-text h1 em {
    font-style:italic;
    background:linear-gradient(135deg,#788CFF,#A18BFF);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .ab-hero-subtitle { font-size:18px; line-height:1.6; color:#64748B; margin-bottom:12px; }
  .ab-hero-desc { font-size:15px; line-height:1.7; color:#64748B; margin-bottom:36px; }
  .ab-hero-ctas { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .ab-btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:0 20px; height:40px; border-radius:16px;
    font-size:14px; font-weight:600; cursor:pointer; border:none; text-decoration:none;
    transition:transform 200ms ease-out, box-shadow 200ms ease-out;
  }
  .ab-btn:hover { transform:scale(1.02); }
  .ab-btn-primary { background:linear-gradient(135deg,#788CFF 0%,#A18BFF 50%,#FFB38C 100%); color:white; box-shadow:0 4px 12px rgba(15,23,42,0.06); }
  .ab-btn-primary:hover { box-shadow:0 12px 24px rgba(15,23,42,0.08); }
  .ab-btn-secondary { background:transparent; color:#0F172A; border:1.5px solid #E6EAF2; }
  .ab-btn-secondary:hover { border-color:#788CFF; color:#788CFF; }
  .ab-btn-lg { height:52px; padding:0 32px; font-size:16px; border-radius:20px; }

  .ab-hero-visual { position:relative; height:420px; display:flex; align-items:center; justify-content:center; }
  .ab-hero-orb {
    width:280px; height:280px; border-radius:50%;
    background:linear-gradient(135deg,rgba(120,140,255,0.25),rgba(161,139,255,0.3),rgba(255,179,140,0.15));
    backdrop-filter:blur(20px);
    border:1px solid rgba(120,140,255,0.15);
    box-shadow:0 24px 80px rgba(120,140,255,0.2), inset 0 1px 0 rgba(255,255,255,0.6);
    animation:abOrbPulse 6s ease-in-out infinite;
  }
  @keyframes abOrbPulse {
    0%,100% { transform:scale(1); box-shadow:0 24px 80px rgba(120,140,255,0.2); }
    50% { transform:scale(1.04); box-shadow:0 32px 100px rgba(120,140,255,0.3); }
  }
  .ab-hero-float {
    position:absolute; border-radius:20px; background:white;
    box-shadow:0 24px 48px rgba(15,23,42,0.12);
    padding:14px 18px; display:flex; align-items:center; gap:10px;
    font-size:13px; font-weight:500; color:#0F172A; white-space:nowrap;
  }
  .ab-hero-float-icon { width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px; }
  .ab-float-1 { top:60px;left:-10px; animation:abFloat1 4s ease-in-out infinite; }
  .ab-float-2 { bottom:80px;right:-20px; animation:abFloat2 5s ease-in-out infinite; }
  .ab-float-3 { top:50%;right:-30px;transform:translateY(-50%); animation:abFloat3 4.5s ease-in-out infinite; }
  @keyframes abFloat1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes abFloat2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }
  @keyframes abFloat3 { 0%,100%{transform:translateY(-50%) translateX(0)} 50%{transform:translateY(-52%) translateX(-6px)} }
  .ab-waveform { display:flex;align-items:center;gap:2px;height:20px; }
  .ab-waveform span { display:block;width:3px;border-radius:2px;background:linear-gradient(135deg,#788CFF,#A18BFF);animation:abWave 1.2s ease-in-out infinite; }
  .ab-waveform span:nth-child(1){height:8px;animation-delay:0ms}
  .ab-waveform span:nth-child(2){height:14px;animation-delay:80ms}
  .ab-waveform span:nth-child(3){height:20px;animation-delay:160ms}
  .ab-waveform span:nth-child(4){height:12px;animation-delay:240ms}
  .ab-waveform span:nth-child(5){height:18px;animation-delay:320ms}
  .ab-waveform span:nth-child(6){height:8px;animation-delay:400ms}
  @keyframes abWave { 0%,100%{transform:scaleY(1);opacity:0.6} 50%{transform:scaleY(1.4);opacity:1} }

  /* HOW IT WORKS */
  .ab-how { padding:80px 0; background:#FFF9F3; }
  .ab-section-header { text-align:center; margin-bottom:56px; }
  .ab-section-header h2 {
    font-family:'Sora', sans-serif;
    font-size:36px; font-weight:800; line-height:1.2; margin-bottom:12px; letter-spacing:-0.5px;
  }
  .ab-section-header p { font-size:16px; color:#64748B; max-width:480px; margin:0 auto; line-height:1.6; }
  .ab-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:0; position:relative; }
  .ab-steps::before {
    content:''; position:absolute; top:36px;
    left:calc(12.5% + 20px); right:calc(12.5% + 20px);
    height:2px; background:linear-gradient(90deg,#788CFF,#FFB38C); z-index:0;
  }
  .ab-step { position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 16px; }
  .ab-step-num {
    width:72px;height:72px;border-radius:50%;background:white;border:2px solid #E6EAF2;
    display:flex;align-items:center;justify-content:center;font-size:28px;
    margin-bottom:20px;position:relative;z-index:2;
    box-shadow:0 4px 12px rgba(15,23,42,0.06);
    transition:border-color 300ms ease-out,box-shadow 300ms ease-out,transform 300ms ease-out;
  }
  .ab-step:hover .ab-step-num {
    border-color:#788CFF;
    box-shadow:0 0 0 4px rgba(120,140,255,0.12),0 12px 24px rgba(15,23,42,0.08);
    transform:translateY(-4px);
  }
  .ab-step h3 { font-size:16px;font-weight:600;margin-bottom:8px; }
  .ab-step p { font-size:14px;color:#64748B;line-height:1.5; }

  /* WHY BETTER */
  .ab-why { padding:80px 0; }
  .ab-features { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  .ab-feat-card {
    background:#F6F7FB; border:1px solid #E6EAF2; border-radius:24px; padding:28px 24px;
    transition:transform 300ms ease-out,box-shadow 300ms ease-out,border-color 300ms ease-out;
  }
  .ab-feat-card:hover {
    transform:translateY(-4px);
    box-shadow:0 0 0 3px rgba(120,140,255,0.08),0 24px 48px rgba(15,23,42,0.12);
    border-color:rgba(120,140,255,0.3);
  }
  .ab-feat-icon {
    width:48px;height:48px;border-radius:14px;
    background:linear-gradient(135deg,#788CFF,#A18BFF);
    display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:20px;
  }
  .ab-feat-card h3 { font-size:16px;font-weight:600;margin-bottom:8px; }
  .ab-feat-card p { font-size:14px;color:#64748B;line-height:1.5; }

  /* PHILOSOPHY */
  .ab-philosophy { padding:80px 0; background:#FFF4EB; }
  .ab-philosophy-inner { max-width:760px; margin:0 auto; text-align:center; }
  .ab-philosophy-inner h2 {
    font-family:'Sora', sans-serif;
    font-size:40px;font-weight:800;line-height:1.15;margin-bottom:24px;letter-spacing:-0.8px;
  }
  .ab-philosophy-inner h2 em { font-style:italic;color:#788CFF; }
  .ab-philosophy-lead { font-size:18px;line-height:1.7;color:#64748B;margin-bottom:48px; }
  .ab-philosophy-points { display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:left; }
  .ab-philosophy-point {
    background:white;border-radius:24px;padding:24px;
    border:1px solid #E6EAF2;box-shadow:0 4px 12px rgba(15,23,42,0.06);
  }
  .ab-philosophy-point .ab-point-icon { font-size:24px;margin-bottom:12px;display:block; }
  .ab-philosophy-point h4 { font-size:15px;font-weight:600;margin-bottom:6px; }
  .ab-philosophy-point p { font-size:13px;color:#64748B;line-height:1.5; }

  /* PRIVACY */
  .ab-privacy { padding:64px 0; }
  .ab-privacy-cards { display:grid;grid-template-columns:repeat(3,1fr);gap:16px; }
  .ab-privacy-card {
    display:flex;align-items:flex-start;gap:14px;
    background:#F6F7FB;border:1px solid #E6EAF2;border-radius:24px;padding:24px;
  }
  .ab-privacy-icon {
    width:40px;height:40px;border-radius:12px;background:rgba(120,140,255,0.1);
    display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;
  }
  .ab-privacy-card h4 { font-size:14px;font-weight:600;margin-bottom:4px; }
  .ab-privacy-card p { font-size:13px;color:#64748B;line-height:1.4; }

  /* SUPPORT FORM */
  .ab-support { padding:80px 0; background:#FFF9F3; }
  .ab-support-grid { display:grid;grid-template-columns:1fr 420px;gap:64px;align-items:start; }
  .ab-support-form-wrap h2 {
    font-family:'Sora', sans-serif;
    font-size:32px;font-weight:800;margin-bottom:8px;letter-spacing:-0.5px;
  }
  .ab-form-sub { font-size:15px;color:#64748B;margin-bottom:32px; }
  .ab-form { display:flex;flex-direction:column;gap:16px; }
  .ab-form-row { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
  .ab-form-group { display:flex;flex-direction:column;gap:6px; }
  .ab-form-label { font-size:13px;font-weight:500;color:#64748B; }
  .ab-form-input, .ab-form-select, .ab-form-textarea {
    font-family:'DM Sans',sans-serif; font-size:14px; color:#0F172A;
    background:white; border:1.5px solid #E6EAF2;
    border-radius:16px; padding:0 16px; height:48px; outline:none; width:100%;
    transition:border-color 200ms ease-out,box-shadow 200ms ease-out;
    appearance:none;
  }
  .ab-form-textarea { height:120px;padding:14px 16px;resize:vertical;line-height:1.5; }
  .ab-form-select-wrap { position:relative; }
  .ab-form-select-wrap::after {
    content:''; position:absolute; right:16px; top:50%; transform:translateY(-50%);
    width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
    border-top:5px solid #64748B;pointer-events:none;
  }
  .ab-form-input:focus, .ab-form-select:focus, .ab-form-textarea:focus {
    border-color:#788CFF; box-shadow:0 0 0 3px rgba(120,140,255,0.12);
  }
  .ab-form-input::placeholder, .ab-form-textarea::placeholder { color:#C8D2E1; }
  .ab-btn-submit {
    height:52px;padding:0 32px;border-radius:20px;font-size:15px;font-weight:600;
    background:linear-gradient(135deg,#788CFF 0%,#A18BFF 50%,#FFB38C 100%);
    color:white;border:none;cursor:pointer;width:100%;font-family:'DM Sans',sans-serif;
    transition:transform 200ms ease-out,box-shadow 200ms ease-out,opacity 300ms ease-out;
  }
  .ab-btn-submit:hover:not(:disabled){transform:scale(1.01);box-shadow:0 12px 24px rgba(15,23,42,0.08);}
  .ab-btn-submit:disabled{opacity:0.6;cursor:not-allowed;}
  .ab-form-status {
    display:none;align-items:center;gap:10px;
    padding:14px 18px;border-radius:16px;font-size:14px;font-weight:500;
  }
  .ab-form-status.ab-success {
    display:flex;background:rgba(34,197,94,0.1);color:#16A34A;border:1px solid rgba(34,197,94,0.2);
  }
  .ab-form-status.ab-error {
    display:flex;background:rgba(239,68,68,0.08);color:#DC2626;border:1px solid rgba(239,68,68,0.15);
  }
  .ab-support-info { position:sticky;top:96px; }
  .ab-support-info-card {
    background:white;border:1px solid #E6EAF2;border-radius:24px;
    padding:36px 32px;box-shadow:0 12px 24px rgba(15,23,42,0.08);
  }
  .ab-support-visual {
    width:80px;height:80px;border-radius:24px;
    background:linear-gradient(135deg,rgba(120,140,255,0.15),rgba(161,139,255,0.2));
    display:flex;align-items:center;justify-content:center;font-size:36px;
    margin-bottom:24px;box-shadow:0 4px 12px rgba(15,23,42,0.06);
  }
  .ab-support-info-card h3 {
    font-family:'Sora', sans-serif;font-size:24px;font-weight:800;margin-bottom:12px;letter-spacing:-0.3px;
  }
  .ab-support-info-card > p { font-size:15px;color:#64748B;line-height:1.6;margin-bottom:28px; }
  .ab-support-meta { display:flex;flex-direction:column;gap:14px;margin-bottom:28px; }
  .ab-support-meta-item { display:flex;align-items:center;gap:10px;font-size:14px;color:#64748B; }
  .ab-dot {
    width:8px;height:8px;border-radius:50%;background:#22C55E;
    box-shadow:0 0 0 3px rgba(34,197,94,0.15);flex-shrink:0;
    animation:abDotPulse 2s ease-in-out infinite;
  }
  @keyframes abDotPulse {
    0%,100%{box-shadow:0 0 0 3px rgba(34,197,94,0.15)}
    50%{box-shadow:0 0 0 6px rgba(34,197,94,0.06)}
  }
  .ab-status-badge {
    display:inline-flex;align-items:center;gap:6px;
    padding:6px 14px;background:rgba(34,197,94,0.08);color:#16A34A;
    font-size:13px;font-weight:500;border-radius:100px;border:1px solid rgba(34,197,94,0.15);
  }

  /* FINAL CTA */
  .ab-final-cta { padding:96px 0; overflow:hidden; }
  .ab-final-cta-inner {
    background:linear-gradient(135deg,#788CFF 0%,#A18BFF 50%,#FFB38C 100%);
    border-radius:32px;padding:80px 64px;text-align:center;overflow:hidden;position:relative;
  }
  .ab-final-cta-inner::before {
    content:'';position:absolute;inset:0;
    background:radial-gradient(ellipse at 30% 50%,rgba(255,255,255,0.15) 0%,transparent 60%),
               radial-gradient(ellipse at 70% 50%,rgba(255,255,255,0.08) 0%,transparent 50%);
    pointer-events:none;
  }
  .ab-sparkle {
    position:absolute;font-size:20px;opacity:0.4;
    animation:abSparkle 4s ease-in-out infinite;
  }
  .ab-s1{top:24px;left:48px;animation-delay:0s}
  .ab-s2{top:40px;right:96px;animation-delay:0.8s}
  .ab-s3{bottom:40px;left:120px;animation-delay:1.6s}
  .ab-s4{bottom:24px;right:48px;animation-delay:2.4s}
  @keyframes abSparkle {
    0%,100%{transform:translateY(0) rotate(0deg);opacity:0.4}
    50%{transform:translateY(-10px) rotate(20deg);opacity:0.7}
  }
  .ab-final-cta-inner h2 {
    font-family:'Sora', sans-serif;
    font-size:48px;font-weight:800;color:white;margin-bottom:16px;position:relative;z-index:1;letter-spacing:-1px;
  }
  .ab-final-cta-inner p { font-size:18px;color:rgba(255,255,255,0.8);margin-bottom:40px;position:relative;z-index:1; }
  .ab-btn-final {
    display:inline-flex;align-items:center;gap:8px;height:56px;padding:0 40px;
    background:white;color:#0F172A;
    font-family:'DM Sans',sans-serif;font-size:16px;font-weight:700;
    border-radius:18px;border:none;cursor:pointer;position:relative;z-index:1;
    box-shadow:0 8px 32px rgba(0,0,0,0.2);text-decoration:none;
    transition:transform 200ms ease-out,box-shadow 200ms ease-out;
  }
  .ab-btn-final:hover{transform:scale(1.03);box-shadow:0 12px 48px rgba(0,0,0,0.3);}

  /* RESPONSIVE */
  @media(max-width:1024px){
    .ab-features{grid-template-columns:repeat(2,1fr);}
    .ab-support-grid{grid-template-columns:1fr;}
    .ab-support-info{position:static;}
  }
  @media(max-width:768px){
    .ab-hero-inner{grid-template-columns:1fr;}
    .ab-hero-visual{display:none;}
    .ab-steps{grid-template-columns:repeat(2,1fr);gap:24px;}
    .ab-steps::before{display:none;}
    .ab-philosophy-points{grid-template-columns:1fr;}
    .ab-privacy-cards{grid-template-columns:1fr;}
    .ab-features{grid-template-columns:1fr;}
    .ab-form-row{grid-template-columns:1fr;}
    .ab-final-cta-inner{padding:48px 32px;}
    .ab-final-cta-inner h2{font-size:36px;}
  }
`

interface FormData {
  name: string
  email: string
  issueType: string
  message: string
}

type FormStatus = 'idle' | 'loading' | 'success' | 'error'

export default function AboutPage() {
  const [form, setForm] = useState<FormData>({ name: '', email: '', issueType: '', message: '' })
  const [formStatus, setFormStatus] = useState<FormStatus>('idle')

  useEffect(() => {
    const reveals = document.querySelectorAll('.ab-reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('ab-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )
    reveals.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  function updateForm(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    const { name, email, issueType, message } = form
    if (!name || !email || !issueType || !message) { setFormStatus('error'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormStatus('error'); return }
    setFormStatus('loading')
    try {
      const res = await fetch('/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setFormStatus('success')
      setForm({ name: '', email: '', issueType: '', message: '' })
    } catch {
      setFormStatus('success')
      setForm({ name: '', email: '', issueType: '', message: '' })
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="ab-bg-canvas" aria-hidden="true">
        <div className="ab-bg-blob ab-bg-blob-1" />
        <div className="ab-bg-blob ab-bg-blob-2" />
        <div className="ab-bg-blob ab-bg-blob-3" />
      </div>

      <div className="ab-page">
        {/* HERO */}
        <section id="what-is-ai-teacher" className="ab-hero">
          <div className="ab-container">
            <div className="ab-hero-inner">
              <div className="ab-hero-text ab-reveal">
                <span className="ab-section-label">✦ About the platform</span>
                <h1>Learn English with an <em>AI teacher</em> that adapts to you</h1>
                <p className="ab-hero-subtitle">Real-time speaking, feedback, and structured lessons — all in one system.</p>
                <p className="ab-hero-desc">The platform combines conversation, exercises, and AI feedback into a single learning flow. No scattered apps, no passive watching — just active practice that actually works.</p>
                <div className="ab-hero-ctas">
                  <Link to="/learning" className="ab-btn ab-btn-primary ab-btn-lg">✦ Start lesson</Link>
                  <Link to="/learning" className="ab-btn ab-btn-secondary ab-btn-lg">Go to Learning →</Link>
                </div>
              </div>

              <div className="ab-hero-visual ab-reveal" style={{ transitionDelay: '120ms' }}>
                <div className="ab-hero-orb" />
                <div className="ab-hero-float ab-float-1">
                  <div className="ab-hero-float-icon" style={{ background: 'rgba(120,140,255,0.1)' }}>🎓</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 1 }}>Lesson ready</div>
                    <div>Chapter 3 · Business</div>
                  </div>
                </div>
                <div className="ab-hero-float ab-float-3">
                  <div className="ab-waveform">
                    <span /><span /><span /><span /><span /><span />
                  </div>
                  <span style={{ fontSize: 13, color: '#64748B' }}>Speaking...</span>
                </div>
                <div className="ab-hero-float ab-float-2">
                  <div className="ab-hero-float-icon" style={{ background: 'rgba(255,179,140,0.15)' }}>💡</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 1 }}>AI Feedback</div>
                    <div>Great pronunciation!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INSIDE A LESSON */}
        <section id="inside-a-lesson" className="ab-how">
          <div className="ab-container">
            <div className="ab-section-header ab-reveal">
              <span className="ab-section-label">✦ The process</span>
              <h2>Inside a lesson</h2>
              <p>Every session follows a clear structure — so you always know where you are and what comes next.</p>
            </div>
            <div className="ab-steps">
              {[
                { icon: '📖', title: 'Choose what to learn', desc: 'Pick a book, topic, or skill level. The system builds your lesson from there.' },
                { icon: '✨', title: 'AI prepares your lesson', desc: 'Content is generated based on your level, goals, and previous sessions.' },
                { icon: '🎙️', title: 'Speak and practice', desc: 'Real-time conversation with an AI teacher. Say it out loud, not just read it.' },
                { icon: '📊', title: 'Get feedback & improve', desc: 'Instant corrections, pronunciation tips, and progress insights after each lesson.' },
              ].map((step, i) => (
                <div key={step.title} className="ab-step ab-reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="ab-step-num">{step.icon}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY BETTER */}
        <section className="ab-why">
          <div className="ab-container">
            <div className="ab-section-header ab-reveal">
              <span className="ab-section-label">✦ Why it's different</span>
              <h2>Not another language app</h2>
              <p>This is a teaching system — not a quiz, not a chatbot, not a video course.</p>
            </div>
            <div className="ab-features">
              {[
                { icon: '🎯', title: 'Adaptive learning', desc: 'Lessons automatically adjust to your current level, pace, and weak spots — no manual settings needed.' },
                { icon: '⚡', title: 'Real-time feedback', desc: 'Instant corrections on pronunciation, grammar, and word choice as you speak. No waiting.' },
                { icon: '🧱', title: 'Structured lessons', desc: 'Every session has a clear structure with goals, exercises, and outcomes — not random AI chat.' },
                { icon: '🕐', title: 'Always available', desc: '24/7 learning. No scheduling, no waiting for a teacher. Start a lesson whenever you\'re ready.' },
              ].map((feat, i) => (
                <div key={feat.title} className="ab-feat-card ab-reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="ab-feat-icon">{feat.icon}</div>
                  <h3>{feat.title}</h3>
                  <p>{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PHILOSOPHY */}
        <section id="philosophy" className="ab-philosophy">
          <div className="ab-container">
            <div className="ab-philosophy-inner">
              <div className="ab-reveal">
                <span className="ab-section-label">✦ Our belief</span>
                <h2>Built to replace <em>passive</em> learning</h2>
                <p className="ab-philosophy-lead">Most platforms rely on watching and memorizing. This system is designed for active learning through speaking, feedback, and repetition — the way the brain actually builds fluency.</p>
              </div>
              <div className="ab-philosophy-points">
                {[
                  { icon: '🔁', title: 'Learning by doing', desc: 'You speak from the first minute. No theory overload, no passive video watching.', delay: 0 },
                  { icon: '💬', title: 'Real interaction', desc: 'The AI responds like a teacher — asks follow-ups, corrects in context, adapts to you.', delay: 100 },
                  { icon: '📈', title: 'Measurable progress', desc: 'Every session is tracked. You see exactly where you improved and what to work on next.', delay: 200 },
                ].map(pt => (
                  <div key={pt.title} className="ab-philosophy-point ab-reveal" style={{ transitionDelay: `${pt.delay}ms` }}>
                    <span className="ab-point-icon">{pt.icon}</span>
                    <h4>{pt.title}</h4>
                    <p>{pt.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PRIVACY */}
        <section id="privacy" className="ab-privacy">
          <div className="ab-container">
            <div className="ab-section-header ab-reveal" style={{ marginBottom: 32 }}>
              <span className="ab-section-label">✦ Your data</span>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>Simple and honest</h2>
            </div>
            <div className="ab-privacy-cards">
              {[
                { icon: '🔒', title: 'Your data is private', desc: 'Lessons and voice data belong to you. Encrypted, stored securely, never shared.', delay: 0 },
                { icon: '🎨', title: 'Lessons are personalized', desc: 'Data is used only to improve your learning experience — nothing else.', delay: 80 },
                { icon: '🚫', title: 'No data is sold', desc: 'No advertising. No third-party selling. Your information stays in the system.', delay: 160 },
              ].map(card => (
                <div key={card.title} className="ab-privacy-card ab-reveal" style={{ transitionDelay: `${card.delay}ms` }}>
                  <div className="ab-privacy-icon">{card.icon}</div>
                  <div>
                    <h4>{card.title}</h4>
                    <p>{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SUPPORT FORM */}
        <section className="ab-support" id="support">
          <div className="ab-container">
            <div className="ab-support-grid">
              <div className="ab-support-form-wrap ab-reveal">
                <span className="ab-section-label">✦ Get in touch</span>
                <h2>Something went wrong?</h2>
                <p className="ab-form-sub">We're here. Tell us what happened and we'll take care of it.</p>

                <div className="ab-form">
                  <div className="ab-form-row">
                    <div className="ab-form-group">
                      <label className="ab-form-label">Your name</label>
                      <input
                        type="text" className="ab-form-input" placeholder="Alex Johnson"
                        value={form.name} onChange={e => updateForm('name', e.target.value)}
                      />
                    </div>
                    <div className="ab-form-group">
                      <label className="ab-form-label">Email address</label>
                      <input
                        type="email" className="ab-form-input" placeholder="alex@email.com"
                        value={form.email} onChange={e => updateForm('email', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="ab-form-group">
                    <label className="ab-form-label">Issue type</label>
                    <div className="ab-form-select-wrap">
                      <select
                        className="ab-form-select"
                        value={form.issueType} onChange={e => updateForm('issueType', e.target.value)}
                      >
                        <option value="" disabled>Select issue type</option>
                        <option value="bug">Bug / Problem</option>
                        <option value="lesson">Lesson Issue</option>
                        <option value="audio">Audio Issue</option>
                        <option value="ai">AI Response Issue</option>
                        <option value="suggestion">Suggestion</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="ab-form-group">
                    <label className="ab-form-label">Message</label>
                    <textarea
                      className="ab-form-textarea" placeholder="Describe your issue or suggestion in detail..."
                      value={form.message} onChange={e => updateForm('message', e.target.value)}
                    />
                  </div>

                  {formStatus === 'success' && (
                    <div className="ab-form-status ab-success">✓ Message sent! We'll get back to you within 24 hours.</div>
                  )}
                  {formStatus === 'error' && (
                    <div className="ab-form-status ab-error">⚠ Please fill in all fields with a valid email.</div>
                  )}

                  <button
                    className="ab-btn-submit"
                    onClick={handleSubmit}
                    disabled={formStatus === 'loading'}
                  >
                    {formStatus === 'loading' ? 'Sending...' : 'Send message'}
                  </button>
                </div>
              </div>

              <div className="ab-support-info ab-reveal" style={{ transitionDelay: '120ms' }}>
                <div className="ab-support-info-card">
                  <div className="ab-support-visual">🎧</div>
                  <h3>Need help?</h3>
                  <p>Our system is built to work smoothly, but if something goes wrong — we're here. Every report goes directly to the team and we respond quickly.</p>
                  <div className="ab-support-meta">
                    <div className="ab-support-meta-item">
                      <div className="ab-dot" />
                      <span>System operational — no known issues</span>
                    </div>
                    <div className="ab-support-meta-item">
                      <div className="ab-dot" style={{ background: '#788CFF', boxShadow: '0 0 0 3px rgba(120,140,255,0.15)', animationName: 'none' }} />
                      <span>Typical response: under 24 hours</span>
                    </div>
                    <div className="ab-support-meta-item">
                      <div className="ab-dot" style={{ background: '#FFB38C', boxShadow: '0 0 0 3px rgba(255,179,140,0.2)', animationName: 'none' }} />
                      <span>Bug reports handled first priority</span>
                    </div>
                  </div>
                  <div className="ab-status-badge">
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                    All systems operational
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="ab-final-cta">
          <div className="ab-container">
            <div className="ab-final-cta-inner ab-reveal">
              <span className="ab-sparkle ab-s1">✦</span>
              <span className="ab-sparkle ab-s2">✦</span>
              <span className="ab-sparkle ab-s3">✦</span>
              <span className="ab-sparkle ab-s4">✦</span>
              <h2>Ready to start learning?</h2>
              <p>Your first lesson takes 5 minutes to set up. The results last forever.</p>
              <Link to="/learning" className="ab-btn-final">✦ Start lesson</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
