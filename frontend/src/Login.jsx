import React, {useState, useEffect} from 'react'
import {
  Layers3, ShieldCheck, Lock, UserCheck, ArrowRight,
  CircleAlert, Sparkles, KeyRound, Building2
} from 'lucide-react'

export default function Login({onLogin}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [demoUsers, setDemoUsers] = useState([])

  useEffect(() => {
    fetch('/api/auth/users')
      .then(res => res.json())
      .then(data => setDemoUsers(data))
      .catch(() => {})
  }, [])

  async function handleLogin(e) {
    if (e) e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Please enter both staff email and password.')
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
          <div className="login-trust-badges">
            <span className="trust-pill"><ShieldCheck size={13}/> BFSI Compliant</span>
            <span className="trust-pill"><Lock size={13}/> Role-Based Access</span>
          </div>
        </div>

        <div className="login-body">
          <div className="login-instructions">
            <h2>Staff Portal Login</h2>
            <p>Sign in with your verified financial institution credentials to manage customer notices, Firecrawl ingestion, and Memento consistency.</p>
          </div>

          {error && (
            <div role="alert" className="alert login-alert">
              <CircleAlert size={16}/> {error}
            </div>
          )}

          {/* Quick 1-Click Role Switcher */}
          {demoUsers.length > 0 && (
            <div className="demo-users-section">
              <span className="demo-section-label">SELECT STAFF ROLE FOR IMMEDIATE EVALUATION:</span>
              <div className="demo-users-grid">
                {demoUsers.map(u => (
                  <button
                    type="button"
                    key={u.id}
                    className="demo-user-btn"
                    onClick={() => quickLogin(u)}
                    disabled={busy}
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

          <div className="login-divider">
            <span>OR ENTER CUSTOM CREDENTIALS</span>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleLogin} className="login-form">
            <label>
              Staff Email Address
              <input
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
        </div>

        <div className="login-footer">
          <Building2 size={14}/>
          <span>Harborline Bank & Financial Services · Dual-Control Compliance & Audit System</span>
        </div>
      </div>
    </div>
  )
}
