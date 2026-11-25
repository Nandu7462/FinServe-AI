import React, { useState, useEffect, useRef } from 'react'

/* ─── Inline styles (all CSS from the original design) ─── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  .fs-login-root {
    --cream:#faf8f4; --ink:#0f1115; --muted:#5b6170;
    --blue:#2563eb; --line:#e4e1da; --glow:#c7d7ff;
    font-family: "Outfit", system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--ink);
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100vh;
    background: var(--cream);
  }

  /* ── LEFT AUTH PANEL ── */
  .fs-auth { display:flex; align-items:center; justify-content:center; padding:48px 24px; background:var(--cream); }
  .fs-auth-inner { width:100%; max-width:525px; position:relative; animation:fs-rise .8s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes fs-rise { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:none} }

  .fs-brand { display:flex; align-items:center; gap:14px; }
  .fs-brand-mark {
    width:50px; height:50px; border-radius:12px; flex-shrink:0;
    background:linear-gradient(135deg,#3b82f6,#1d4ed8);
    display:grid; place-items:center;
    box-shadow:0 10px 25px -8px rgba(37,99,235,.6);
    transition:transform .7s cubic-bezier(.2,.7,.2,1);
  }
  .fs-brand:hover .fs-brand-mark { transform:rotateY(180deg); }
  .fs-brand-name { font-size:26px; font-weight:700; letter-spacing:-.02em; }
  .fs-brand-name span { color:var(--blue); }
  .fs-brand-sub { font-family:"JetBrains Mono",monospace; font-size:10.5px; letter-spacing:.18em; color:var(--muted); text-transform:uppercase; margin-top:2px; }

  .fs-auth-inner h1 { margin-top:48px; font-size:clamp(48px,6vw,64px); font-weight:800; letter-spacing:-.045em; line-height:1; }
  .fs-auth-inner h1 .fs-dot { color:var(--blue); display:inline-block; animation:fs-pulse 2.4s ease-in-out infinite; }
  @keyframes fs-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.35)} }
  .fs-lede { margin-top:14px; color:var(--muted); font-size:17px; }

  /* Tabs */
  .fs-tabs { margin-top:32px; position:relative; display:grid; grid-template-columns:1fr 1fr; background:#efece6; border:1px solid var(--line); border-radius:999px; padding:5px; }
  .fs-tab-thumb { position:absolute; top:5px; bottom:5px; left:5px; width:calc(50% - 5px); background:#fff; border-radius:999px; box-shadow:0 2px 8px rgba(0,0,0,.06); transition:transform .45s cubic-bezier(.2,.7,.2,1); pointer-events:none; }
  .fs-tabs.right .fs-tab-thumb { transform:translateX(100%); }
  .fs-tab { position:relative; z-index:1; border:0; background:none; cursor:pointer; padding:12px 0; font-family:inherit; font-size:15px; font-weight:500; color:var(--muted); transition:color .3s; }
  .fs-tab.active { color:var(--ink); font-weight:600; }

  /* Fields */
  .fs-field { margin-top:22px; }
  .fs-field label { display:block; font-size:15px; font-weight:500; margin-bottom:8px; color:var(--ink); }
  .fs-input-wrap { background:#fff; border:1px solid var(--line); border-radius:999px; height:62px; display:flex; align-items:center; transition:border-color .25s,box-shadow .25s,transform .25s; }
  .fs-input-wrap:focus-within { border-color:var(--blue); box-shadow:0 0 0 5px rgba(37,99,235,.12),0 12px 30px -12px rgba(37,99,235,.35); transform:translateY(-2px); }
  .fs-input-wrap input { flex:1; border:0; outline:0; background:transparent; font-family:inherit; font-size:17px; font-weight:500; color:var(--ink); padding:0 26px; height:100%; border-radius:999px; min-width:0; }
  .fs-toggle { margin-right:14px; border:0; background:#f3f1ec; cursor:pointer; width:38px; height:38px; border-radius:50%; display:grid; place-items:center; color:var(--muted); transition:background .2s,transform .2s; flex-shrink:0; }
  .fs-toggle:hover { background:#e9e6df; transform:scale(1.08); }

  /* Submit button */
  .fs-btn {
    margin-top:28px; width:100%; height:62px; border:0; border-radius:999px; cursor:pointer;
    background:linear-gradient(90deg,#3b82f6 0%,#1d4ed8 100%);
    color:#fff; font-family:inherit; font-size:18px; font-weight:600;
    display:flex; align-items:center; justify-content:center; gap:12px;
    box-shadow:0 16px 34px -14px rgba(37,99,235,.7);
    position:relative; overflow:hidden;
    transition:transform .2s ease-out,box-shadow .3s,opacity .2s;
  }
  .fs-btn::after { content:""; position:absolute; top:0; bottom:0; width:40%; left:-60%; background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent); transform:skewX(-20deg); }
  .fs-btn:hover::after { animation:fs-sheen .9s ease; }
  @keyframes fs-sheen { to{left:130%} }
  .fs-btn:active { transform:scale(.98); }
  .fs-btn:disabled { opacity:.7; cursor:not-allowed; }
  .fs-spinner { width:20px; height:20px; border-radius:50%; border:2.5px solid rgba(255,255,255,.35); border-top-color:#fff; animation:fs-spin .8s linear infinite; display:none; position:absolute; }
  .fs-btn.loading .fs-spinner { display:block; }
  .fs-btn.loading .fs-btn-label { visibility:hidden; }
  @keyframes fs-spin { to{transform:rotate(360deg)} }

  .fs-error { margin-top:12px; color:#b91c1c; font-size:14px; min-height:20px; font-weight:500; }
  .fs-notice { margin-top:16px; padding:14px 18px; border-radius:16px; background:#f5f3ee; color:var(--muted); font-size:13.5px; line-height:1.45; }

  /* Success overlay */
  .fs-success { position:absolute; inset:0; display:grid; place-items:center; text-align:center; background:var(--cream); opacity:0; pointer-events:none; transition:opacity .5s; border-radius:24px; }
  .fs-success.show { opacity:1; pointer-events:auto; }
  .fs-success h2 { font-size:36px; letter-spacing:-.03em; font-weight:800; color:var(--ink); }
  .fs-success p { color:var(--muted); margin-top:8px; }

  /* Evaluation profiles */
  .fs-profiles { margin-top:24px; display:flex; flex-direction:column; gap:10px; }
  .fs-profile-btn {
    display:flex; align-items:center; gap:14px; padding:14px 18px;
    background:#fff; border:1px solid var(--line); border-radius:20px;
    cursor:pointer; text-align:left; font-family:inherit;
    transition:border-color .25s,box-shadow .25s,transform .25s;
    width:100%;
  }
  .fs-profile-btn:hover { border-color:var(--blue); box-shadow:0 8px 24px -8px rgba(37,99,235,.2); transform:translateY(-2px); }
  .fs-profile-btn:disabled { opacity:.6; cursor:not-allowed; transform:none; }
  .fs-avatar { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:700; font-size:15px; flex-shrink:0; }
  .fs-profile-meta { flex:1; min-width:0; }
  .fs-profile-meta strong { display:block; font-size:15px; font-weight:600; color:var(--ink); }
  .fs-profile-role { display:inline-block; font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; padding:2px 8px; border-radius:999px; margin:2px 0; }
  .fs-role-drafter { background:#eff4ff; color:#315dcc; }
  .fs-role-compliance { background:#f0fdf4; color:#15803d; }
  .fs-role-admin { background:#fff7ed; color:#c2410c; }
  .fs-profile-dept { display:block; font-size:12px; color:var(--muted); margin-top:1px; }
  .fs-arrow { color:var(--muted); flex-shrink:0; }
  .fs-profiles-label { font-family:"JetBrains Mono",monospace; font-size:11px; letter-spacing:.18em; color:var(--muted); text-transform:uppercase; margin-bottom:4px; }

  /* ── RIGHT SHOWCASE PANEL ── */
  .fs-showcase {
    position:relative; background:radial-gradient(120% 90% at 20% 0%,#1a2140 0%,#0b1020 60%,#070a14 100%);
    color:#fff; overflow:hidden; padding:56px 56px 48px;
    display:flex; flex-direction:column; min-height:100vh;
  }
  .fs-eyebrow { display:flex; align-items:center; gap:12px; font-family:"JetBrains Mono",monospace; font-size:12px; letter-spacing:.3em; color:#c9d4ee; text-transform:uppercase; position:relative; z-index:2; }
  .fs-hero { margin-top:48px; font-size:clamp(42px,4.6vw,66px); font-weight:700; letter-spacing:-.045em; line-height:1.02; position:relative; z-index:2; }
  .fs-hero .soft { color:var(--glow); }
  .fs-hero .word { display:inline-block; opacity:0; transform:translate3d(0,40px,0) rotateX(-40deg); transform-origin:50% 100%; animation:fs-wordIn .9s cubic-bezier(.2,.7,.2,1) forwards; animation-delay:calc(var(--i) * 90ms + 200ms); }
  @keyframes fs-wordIn { to{opacity:1;transform:none} }
  .fs-sub { margin-top:18px; font-size:18px; line-height:1.5; color:#c9d1e6; max-width:520px; font-weight:300; position:relative; z-index:2; }

  #fs-scene-wrap { position:relative; flex:1; min-height:360px; margin:8px -56px 0; cursor:grab; }
  #fs-scene { position:absolute; inset:0; width:100%; height:100%; display:block; }
  .fs-paper { position:absolute; inset:0; margin:auto; width:min(55%,260px); height:150px; border-radius:8px; overflow:hidden; background:#edf2ff; transform:rotate(-5deg); box-shadow:0 12px 40px #04091b; }
  .fs-paper strong { display:block; background:#1d4ed8; padding:8px 14px; color:white; }
  .fs-paper i { display:block; margin:14px; height:8px; background:#94a3b8; width:72%; }
  .fs-paper i:nth-child(3) { width:55%; background:#2563eb; }
  #fs-scene-wrap.grabbing { cursor:grabbing; }

  .fs-stations { position:relative; z-index:2; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .fs-station-btn { text-align:left; cursor:pointer; font-family:inherit; color:#c9d1e6; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:14px 16px; transition:all .35s cubic-bezier(.2,.7,.2,1); }
  .fs-station-btn:hover { transform:translateY(-3px); border-color:rgba(147,181,255,.5); }
  .fs-station-btn.active { background:linear-gradient(160deg,rgba(59,130,246,.35),rgba(29,78,216,.12)); border-color:rgba(147,181,255,.8); color:#fff; box-shadow:0 18px 36px -18px rgba(59,130,246,.8); }
  .fs-station-btn small { display:block; font-family:"JetBrains Mono",monospace; font-size:11px; opacity:.6; margin-bottom:4px; }
  .fs-station-btn strong { font-size:16px; font-weight:600; }

  .fs-caption { position:relative; z-index:2; margin-top:16px; min-height:44px; font-size:14.5px; color:#aab5d4; line-height:1.5; }
  .fs-caption b { color:#fff; font-weight:600; }
  .fs-footer-label { position:relative; z-index:2; margin-top:22px; font-family:"JetBrains Mono",monospace; font-size:12px; letter-spacing:.3em; color:#aab5d4; text-transform:uppercase; }

  /* Responsive */
  @media (max-width:900px) {
    .fs-login-root { grid-template-columns:1fr; }
    .fs-showcase { padding:40px 20px 32px; min-height:0; }
    #fs-scene-wrap { min-height:300px; margin:8px -20px 0; }
    .fs-hero { margin-top:32px; }
    .fs-stations { grid-template-columns:1fr; }
  }
  @media (prefers-reduced-motion:reduce) { .fs-login-root *, .fs-login-root *::before, .fs-login-root *::after { animation:none!important; transition:none!important; } .fs-hero .word { opacity:1; transform:none; } }
`

function getRoleClass(role) {
  if (role === 'drafter') return 'fs-role-drafter'
  if (role === 'compliance') return 'fs-role-compliance'
  return 'fs-role-admin'
}
function getRoleLabel(role) {
  if (role === 'drafter') return 'Communications Drafter'
  if (role === 'compliance') return 'Compliance Officer'
  return 'Administrator'
}

/* ─── Showcase / 3D right panel ─── */
const stages = [
  ['Official source', 'Check a product clause against its public HDFC Bank source.'],
  ['Draft', 'Use the source and approved wording to draft a customer message.'],
  ['Review', 'Compare the message with its HDFC Bank source before approval.'],
]

function Showcase() {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const activeRef = useRef(0)
  const [active, setActive] = useState(0)
  const [interactive, setInteractive] = useState(false)
  const [manual, setManual] = useState(false)

  function chooseStage(index) {
    activeRef.current = index
    setActive(index)
    setManual(true)
  }

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let disposed = false
    let unmount
    async function syncScene() {
      if (motion.matches) {
        unmount?.()
        unmount = undefined
        setInteractive(false)
        return
      }
      try {
        const { mountLoginScene } = await import('./loginScene.js')
        if (disposed || motion.matches || unmount) return
        unmount = mountLoginScene(canvasRef.current, wrapRef.current, activeRef, chooseStage)
        setInteractive(true)
      } catch {
        if (!disposed) setInteractive(false)
      }
    }
    syncScene()
    motion.addEventListener('change', syncScene)
    return () => {
      disposed = true
      motion.removeEventListener('change', syncScene)
      unmount?.()
    }
  }, [])

  useEffect(() => {
    if (!interactive || manual) return
    const timer = setInterval(() => {
      activeRef.current = (activeRef.current + 1) % stages.length
      setActive(activeRef.current)
    }, 2800)
    return () => clearInterval(timer)
  }, [interactive, manual])

  return (
    <section className="fs-showcase">
      <div className="fs-eyebrow">FinServe Workspace</div>
      <h2 className="fs-hero">
        <span className="word" style={{ '--i': 0 }}>From</span>{' '}
        <span className="word" style={{ '--i': 1 }}>official</span>{' '}
        <span className="word" style={{ '--i': 2 }}>notice</span>{' '}
        <span className="word soft" style={{ '--i': 3 }}>to</span>{' '}
        <span className="word soft" style={{ '--i': 4 }}>customer</span>{' '}
        <span className="word" style={{ '--i': 5 }}>message.</span>
      </h2>
      <p className="fs-sub">Draft from verified product information and bring the source to every review.</p>

      <div id="fs-scene-wrap" ref={wrapRef}>
        <canvas id="fs-scene" ref={canvasRef} aria-hidden="true" />
        {!interactive && <div className="fs-paper" aria-hidden="true"><strong>{stages[active][0]}</strong><i /><i /><i /></div>}
      </div>

      <div className="fs-stations">
        {stages.map(([label], i) => (
          <button key={i} className={`fs-station-btn${i === active ? ' active' : ''}`} aria-pressed={i === active} onClick={() => chooseStage(i)} type="button">
            <small>0{i + 1}</small><strong>{label}</strong>
          </button>
        ))}
      </div>
      <div className="fs-caption"><b>{stages[active][0]}.</b> {stages[active][1]}</div>
      <div className="fs-footer-label">Staff communication portal</div>

    </section>
  )
}

/* ─── Main Login component ─── */
export default function Login({ onLogin }) {
  const [tab, setTab] = useState('staff')   // 'staff' | 'eval'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [demoUsers, setDemoUsers] = useState([])

  useEffect(() => {
    fetch('/api/auth/users')
      .then(r => r.json())
      .then(d => Array.isArray(d) && setDemoUsers(d))
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid staff email address.'); return
    }
    if (!password) {
      setError('Enter your workspace password.'); return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Authentication failed.')
      setSuccess(true)
      setTimeout(() => onLogin(data.user, data.token), 1200)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function selectProfile(profile) {
    setEmail(profile.email)
    setPassword('')
    setShowPw(false)
    setError('')
    setTab('profile-password')
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="fs-login-root">
        {/* ── LEFT AUTH PANEL ── */}
        <section className="fs-auth">
          <div className="fs-auth-inner">
            {/* Brand */}
            <div className="fs-brand">
              <div className="fs-brand-mark">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round">
                  <path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5"/>
                </svg>
              </div>
              <div>
                <div className="fs-brand-name">FinServe <span>AI</span></div>
                <div className="fs-brand-sub">BFSI Customer Communication Assistant</div>
              </div>
            </div>

            <h1>Welcome back<span className="fs-dot">.</span></h1>
            <p className="fs-lede">{tab === 'profile-password' ? 'Enter the password for the selected profile.' : 'Sign in to prepare and review communications using HDFC Bank sources.'}</p>

            {/* Tabs */}
            <div className={`fs-tabs${tab !== 'staff' ? ' right' : ''}`}>
              <span className="fs-tab-thumb" />
              <button type="button" className={`fs-tab${tab === 'staff' ? ' active' : ''}`}
                disabled={busy} onClick={() => { setTab('staff'); setPassword(''); setShowPw(false); setError('') }}>Staff sign-in</button>
              <button type="button" className={`fs-tab${tab !== 'staff' ? ' active' : ''}`}
                disabled={busy} onClick={() => { setTab('eval'); setPassword(''); setShowPw(false); setError('') }}>Evaluation profiles</button>
            </div>

            {/* Staff sign-in form */}
            {tab !== 'eval' && (
              <form onSubmit={handleSubmit} noValidate>
                <div className="fs-field">
                  <label htmlFor="fs-email">Staff Email Address</label>
                  <div className="fs-input-wrap">
                    <input id="fs-email" type="email" value={email} autoComplete="username" readOnly={tab === 'profile-password'}
                      onChange={e => setEmail(e.target.value)} disabled={busy} />
                  </div>
                </div>
                <div className="fs-field">
                  <label htmlFor="fs-password">Password</label>
                  <div className="fs-input-wrap">
                    <input id="fs-password" type={showPw ? 'text' : 'password'} value={password}
                      autoFocus={tab === 'profile-password'} autoComplete="current-password" onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" disabled={busy} />
                    <button type="button" className="fs-toggle" aria-label={showPw ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPw(s => !s)}>
                      {showPw
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                <button type="submit" className={`fs-btn${busy ? ' loading' : ''}`} disabled={busy}>
                  <span className="fs-spinner" />
                  <span className="fs-btn-label">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"
                      style={{ verticalAlign: '-5px', marginRight: '10px' }}>
                      <circle cx="8" cy="15" r="4"/><path d="m10.85 12.15 8.15-8.15M18 5l3 3M15 8l3 3"/>
                    </svg>
                    {busy ? 'Authenticating…' : 'Sign in to Workspace'}
                  </span>
                </button>

                {error && <div className="fs-error" role="alert">{error}</div>}
              </form>
            )}

            {/* Evaluation profiles */}
            {tab === 'eval' && (
              <div className="fs-profiles">
                <div className="fs-profiles-label">Choose a staff profile</div>
                {demoUsers.length === 0 && (
                  <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No evaluation profiles are configured.</p>
                )}
                {demoUsers.map(u => (
                  <button key={u.id} type="button" className="fs-profile-btn"
                    onClick={() => selectProfile(u)} disabled={busy}>
                    <div className="fs-avatar" style={{ background: u.avatar_color }}>
                      {u.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="fs-profile-meta">
                      <strong>{u.name}</strong>
                      <span className={`fs-profile-role ${getRoleClass(u.role)}`}>{getRoleLabel(u.role)}</span>
                      <span className="fs-profile-dept">{u.department}</span>
                    </div>
                    <svg className="fs-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                ))}
                {error && <div className="fs-error" role="alert">{error}</div>}
              </div>
            )}

            <div className="fs-notice">Independent workspace · HDFC Bank public sources</div>

            {/* Success overlay */}
            <div className={`fs-success${success ? ' show' : ''}`}>
              <div>
                <h2>Access granted.</h2>
                <p>Opening your drafting workspace…</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── RIGHT SHOWCASE PANEL ── */}
        <Showcase />
      </div>
    </>
  )
}
