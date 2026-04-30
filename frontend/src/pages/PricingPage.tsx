import { Link } from 'react-router-dom'

const CSS = `
  .pr-page { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; text-align: center; }
  .pr-badge { display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#7B8CFF;background:rgba(123,140,255,0.08);padding:4px 12px;border-radius:100px;margin-bottom:24px; }
  .pr-page h1 { font-family:'Sora',sans-serif;font-size:48px;font-weight:700;color:#0F172A;margin-bottom:16px;letter-spacing:-1px; }
  .pr-page p { font-size:18px;color:#64748B;max-width:520px;margin:0 auto 40px;line-height:1.6; }
  .pr-cards { display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:960px;width:100%;margin-bottom:48px; }
  .pr-card { background:#F6F7FB;border:1px solid #E6EAF2;border-radius:24px;padding:36px 28px;text-align:left;transition:transform 200ms ease-out,box-shadow 200ms ease-out; }
  .pr-card:hover { transform:translateY(-4px);box-shadow:0 0 0 3px rgba(123,140,255,0.08),0 24px 48px rgba(15,23,42,0.12); }
  .pr-card.pr-featured { background:linear-gradient(135deg,#7B8CFF 0%,#A18BFF 50%,#FFB38C 100%);border:none;color:white; }
  .pr-card-plan { font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;color:#7B8CFF; }
  .pr-card.pr-featured .pr-card-plan { color:rgba(255,255,255,0.8); }
  .pr-card-price { font-family:'Sora',sans-serif;font-size:40px;font-weight:700;color:#0F172A;margin-bottom:4px;letter-spacing:-1px; }
  .pr-card.pr-featured .pr-card-price { color:white; }
  .pr-card-per { font-size:14px;color:#64748B;margin-bottom:24px; }
  .pr-card.pr-featured .pr-card-per { color:rgba(255,255,255,0.8); }
  .pr-card-feature { display:flex;align-items:center;gap:10px;font-size:14px;color:#475569;margin-bottom:12px; }
  .pr-card.pr-featured .pr-card-feature { color:rgba(255,255,255,0.9); }
  .pr-card-feature::before { content:'✓';font-weight:700;color:#7B8CFF;flex-shrink:0; }
  .pr-card.pr-featured .pr-card-feature::before { color:white; }
  .pr-card-btn { display:block;text-align:center;margin-top:28px;padding:12px 24px;border-radius:14px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;transition:all 200ms ease-out;border:1.5px solid #E6EAF2;color:#0F172A; }
  .pr-card-btn:hover { border-color:#7B8CFF;color:#7B8CFF; }
  .pr-card.pr-featured .pr-card-btn { background:white;color:#7B8CFF;border:none;box-shadow:0 4px 16px rgba(0,0,0,0.15); }
  .pr-card.pr-featured .pr-card-btn:hover { transform:scale(1.02);box-shadow:0 8px 24px rgba(0,0,0,0.2); }
  .pr-note { font-size:14px;color:#94A3B8; }
  @media(max-width:768px){ .pr-cards{grid-template-columns:1fr;} .pr-page h1{font-size:32px;} }
`

const PLANS = [
  {
    plan: 'Free',
    price: '$0',
    per: 'forever',
    features: ['2 free lessons', 'Text mode only', '1 textbook unit', 'Basic progress'],
    cta: 'Get started',
    featured: false,
  },
  {
    plan: 'Pro',
    price: '$29',
    per: 'per month',
    features: ['Unlimited lessons', 'Voice + text mode', 'All textbooks A2–B2', 'Advanced analytics', 'Spaced repetition vocab'],
    cta: 'Start free trial',
    featured: true,
  },
  {
    plan: 'School',
    price: '$199',
    per: 'per month · up to 30 students',
    features: ['Everything in Pro', 'Teacher dashboard', 'Class progress reports', 'Custom lesson plans', 'Priority support'],
    cta: 'Contact us',
    featured: false,
  },
]

export default function PricingPage() {
  return (
    <>
      <style>{CSS}</style>
      <div className="pr-page">
        <span className="pr-badge">✦ Pricing</span>
        <h1>Simple, honest pricing</h1>
        <p>Start for free. Upgrade when you're ready. No hidden fees, no long contracts.</p>

        <div id="plans" className="pr-cards">
          {PLANS.map(plan => (
            <div key={plan.plan} className={`pr-card${plan.featured ? ' pr-featured' : ''}`}>
              <div className="pr-card-plan">{plan.plan}</div>
              <div className="pr-card-price">{plan.price}</div>
              <div className="pr-card-per">{plan.per}</div>
              {plan.features.map(f => (
                <div key={f} className="pr-card-feature">{f}</div>
              ))}
              <Link to="/learning" className="pr-card-btn">{plan.cta}</Link>
            </div>
          ))}
        </div>

        <p className="pr-note">All plans include a 7-day free trial. Cancel anytime.</p>
      </div>
    </>
  )
}
