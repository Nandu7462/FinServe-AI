import React, {useState, useEffect} from 'react'
import {
  Layers3, ShieldCheck, ArrowRight,
  CircleAlert, KeyRound, Building2
} from 'lucide-react'
import workspacePicture from './assets/sign-in-workspace.jpg'

export default function Login({onLogin, children}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState('credentials')
  const [demoUsers, setDemoUsers] = useState([])

  useEffect(() => {
    fetch('/api/auth/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDemoUsers(data)
        }
      })
      .catch(() => {})
  }, [])

  async function handleLogin(e) {
    if (e) e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter both staff email address and password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: email.trim(), password: password.trim()})
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed. Please verify credentials.')
      }
      onLogin(data.user, data.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function quickLogin(user) {
    setEmail(user.email)
    setPassword(user.demo_password)
    setBusy(true)
    setError('')
    fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: user.email, password: user.demo_password})
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          onLogin(data.user, data.token)
        } else {
          setError(data.detail || 'Sign-in failed')
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setBusy(false))
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        {/* Header Branding */}
        <div className="login-header">
          <div className="login-brand">
            <div className="logo"><Layers3 size={24}/></div>
            <div>
              <span className="login-title">FinServe <em>AI</em></span>
              <small className="login-subtitle">BFSI CUSTOMER COMMUNICATION ASSISTANT</small>
            </div>
          </div>
        </div>

        <div className="login-body">
          <div className="login-instructions">
            <h1>Welcome back<span>.</span></h1>
            <p>Sign in to prepare and review customer communications.</p>
          </div>

          {error && (
            <div role="alert" className="alert login-alert">
              <CircleAlert size={16}/> {error}
            </div>
          )}

          {/* Switcher between Staff sign-in and Evaluation profiles */}
          <div className="method-switch" aria-label="Sign-in method">
            {[
              ['credentials', 'Staff sign-in'],
              ['profiles', 'Evaluation profiles']
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={method === id}
                disabled={busy}
                onClick={() => { setMethod(id); setError(''); }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Evaluation Profiles: 1-click immediate quick-login without fill credentials */}
          {method === 'profiles' && (
            <div className="demo-users-section">
              <span className="demo-section-label">CHOOSE A STAFF PROFILE FOR IMMEDIATE EVALUATION:</span>
              <div className="demo-users-grid">
                {demoUsers.length === 0 && <p>No evaluation profiles are configured.</p>}
                {demoUsers.map(u => (
                  <button
                    type="button"
                    key={u.id}
                    className="demo-user-btn"
                    onClick={() => quickLogin(u)}
                    disabled={busy}
                    title={`Click to sign in immediately as ${u.name}`}
                  >
                    <div className="demo-avatar" style={{background: u.avatar_color}}>
                      {u.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="demo-user-meta">
                      <strong>{u.name}</strong>
                      <span className={'role-badge ' + u.role}>
                        {u.role === 'compliance' ? 'Compliance Officer' : u.role === 'drafter' ? 'Communications Drafter' : 'Administrator'}
                      </span>
                      <small>{u.department}</small>
                    </div>
                    <ArrowRight size={15} className="demo-arrow"/>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Staff Sign-in Manual Form */}
          {method === 'credentials' && (
            <form onSubmit={handleLogin} className="login-form">
              <label>
                Staff Email Address
                <input
                  autoComplete="username"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@harborline.bank"
                  required
                  disabled={busy}
                />
              </label>

              <label>
                Password
                <input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={busy}
                />
              </label>

              <button type="submit" className="primary login-submit" disabled={busy}>
                <KeyRound size={16}/> {busy ? 'Authenticating…' : 'Sign in to Workspace'}
              </button>
            </form>
          )}

        </div>

        <div className="login-footer">
          <Building2 size={14}/>
          <span>Harborline Bank & Financial Services · Dual-Control Compliance & Audit System</span>
        </div>
      </div>

      <aside className="login-art-panel" aria-label="FinServe workspace">
        <div className="login-art">
          <img src={workspacePicture} alt="From official notice to customer message. Draft from verified product information and bring the source to every review. Official source, draft, review."/>
          {children}
        </div>
      </aside>
    </div>
  )
}
