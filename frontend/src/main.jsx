import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, AlertTriangle, ArrowUpRight, BookOpen, Check, ChevronRight,
  CircleAlert, Clipboard, Clock3, Database, Download, Edit3, FileText,
  GitCompare, Globe, Layers3, LibraryBig, Lock, LogOut, Mail, MessageSquare,
  Moon, Plus, RefreshCw, Search, Settings, ShieldAlert, ShieldCheck,
  Smartphone, Sparkles, Sun, User, UserPlus, Users, Wifi
} from 'lucide-react'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/urbanist'
import './style.css'
import './compass.css'
import Sources from './Sources'
import KnowledgeBank from './KnowledgeBank'
import Login from './Login'
import ChatWidget from './ChatWidget'
import Readability from './Readability.jsx'

async function api(path, payload, token) {
  const headers = { 'Content-Type': 'application/json' }
  const activeToken = token || localStorage.getItem('hdfc_finserve_token')
  if (activeToken) {
    headers['Authorization'] = 'Bearer ' + activeToken
  }
  const response = await fetch('/api/' + path, payload === undefined ? { headers } : {
    method: 'POST', headers, body: JSON.stringify(payload)
  })
  const value = await response.json()
  if (!response.ok) throw new Error(typeof value.detail === 'string' ? value.detail : 'Check the required fields and try again.')
  return value
}

const date = value => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const states = { rejected: 'Returned / Rejected', approved: 'Approved', blocked: 'Needs source review', draft: 'Ready for review' }

function PreFlightLinter({ item, subject, body, onInjectDisclaimers, canDraft }) {
  const [lintResult, setLintResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!body || !body.trim()) {
      setLintResult(null)
      return
    }
    let active = true
    setLoading(true)
    api('compliance/lint', {
      subject: subject || '',
      body: body || '',
      facts: item?.facts || {},
      bank: item?.source?.bank || 'HDFC Bank',
      language: item?.language || 'English'
    })
      .then(res => {
        if (active) setLintResult(res)
      })
      .catch(() => { })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [subject, body, item])

  if (!body || !lintResult) return null

  const isCompliant = lintResult.score >= 80

  return (
    <div className="linter-card">
      <div className="linter-head">
        <div>
          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>Regulatory Pre-Flight Linter</strong>
          <small style={{ display: 'block', color: 'var(--text-muted)' }}>Checks for source details and security reminders</small>
        </div>
        <span className={`linter-score-badge ${isCompliant ? 'score-compliant' : 'score-warning'}`}>
          {isCompliant ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {lintResult.score}% Compliant
        </span>
      </div>

      <div className="linter-checks-grid">
        {lintResult.checks.map(c => (
          <div key={c.id} className={`linter-check-item ${c.passed ? 'linter-check-passed' : 'linter-check-failed'}`}>
            <span style={{ color: c.passed ? '#10b981' : '#f59e0b', marginTop: '1px', flexShrink: 0 }}>
              {c.passed ? <Check size={14} /> : <CircleAlert size={14} />}
            </span>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: '12px', color: 'var(--text-main)', display: 'inline-block', marginRight: '6px' }}>
                {c.name}
              </strong>
              <span className="badge" style={{ fontSize: '9.5px', padding: '1px 5px', background: c.severity === 'critical' ? '#fee2e2' : '#fef3c7', color: c.severity === 'critical' ? '#991b1b' : '#92400e' }}>
                {c.severity}
              </span>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                {c.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {!isCompliant && canDraft && onInjectDisclaimers && (
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--table-hover)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-line)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Missing statutory disclosures detected.</span>
          <button type="button" className="primary" style={{ padding: '5px 10px', fontSize: '11.5px' }} onClick={onInjectDisclaimers}>
            Auto-Inject Disclaimers
          </button>
        </div>
      )}
    </div>
  )
}

// Visual Redline Diff Tool Component
function VisualRedlineDiff({ source, body, wording }) {
  const statement = source?.statement || source?.evidence || ''
  const hasStatement = statement && body.includes(statement)

  return (
    <div className="redline-diff-container">
      <div className="redline-header">
        <div>
          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>Visual Redline Diff Tool</strong>
          <small style={{ display: 'block', color: 'var(--text-muted)' }}>Grounding verification between scraped notice, Memento, and drafted text</small>
        </div>
        <div className="redline-legend">
          <span className="legend-verified">● Verified Source Fact</span>
          <span className="legend-added">● Memento Policy Explanation</span>
        </div>
      </div>

      <div className="redline-content-box">
        {hasStatement ? (
          <div>
            <p style={{ margin: '0 0 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
              ✓ Verified canonical passage preserved without alteration:
            </p>
            <div className="diff-fact-highlight" style={{ marginBottom: '12px', display: 'block', padding: '8px 12px' }}>
              "{statement}"
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '12px', marginBottom: '10px' }}>
            ⚠️ Warning: Exact source passage from the official notice was modified. Statutory compliance requires keeping the verified statement intact.
          </div>
        )}

        {wording && (
          <div>
            <p style={{ margin: '0 0 6px', color: 'var(--text-muted)', fontSize: '12px' }}>
              Memento Approved Language Grounding:
            </p>
            <div className="diff-memento-highlight" style={{ display: 'block', padding: '8px 12px' }}>
              "{wording}"
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Role Specifications defined exactly per user requirement table
const ROLE_SPECS = {
  drafter: {
    title: 'Communications Drafter',
    mainJob: 'Writes messages',
    homeScreen: 'drafts',
    homeScreenTitle: 'My Drafts',
    mainButton: 'Create draft',
    summaryCards: [
      { id: 'drafts', label: 'Drafts', key: 'drafts', icon: FileText, color: '#315dcc', bg: '#eff4ff' },
      { id: 'returned', label: 'Returned', key: 'returned', icon: ShieldAlert, color: '#b06228', bg: '#fef3eb' },
      { id: 'approved', label: 'Approved', key: 'approved', icon: ShieldCheck, color: '#288763', bg: '#ebfbf3' }
    ],
    menu: [
      { id: 'compose', label: 'Compose', icon: Edit3 },
      { id: 'drafts', label: 'My Drafts', icon: FileText },
      { id: 'sources', label: 'Sources', icon: Globe },
      { id: 'approved', label: 'Approved Library', icon: LibraryBig }
    ],
    can: 'Create, edit and submit drafts',
    cannot: 'Approve messages or change rules'
  },
  compliance: {
    title: 'Compliance Officer',
    mainJob: 'Checks and approves them',
    homeScreen: 'review',
    homeScreenTitle: 'Review Queue',
    mainButton: 'Review next',
    summaryCards: [
      { id: 'pending', label: 'Pending', key: 'pending', icon: Clock3, color: '#315dcc', bg: '#eff4ff' },
      { id: 'high_risk', label: 'High risk', key: 'high_risk', icon: ShieldAlert, color: '#c2410c', bg: '#fff1ec' },
      { id: 'outdated', label: 'Outdated approvals', key: 'outdated', icon: AlertTriangle, color: '#854d0e', bg: '#fefce8' }
    ],
    menu: [
      { id: 'review', label: 'Review Queue', icon: Clock3 },
      { id: 'rules', label: 'Compliance Rules', icon: ShieldCheck },
      { id: 'sources', label: 'Sources', icon: Globe },
      { id: 'audit', label: 'Audit Log', icon: FileText }
    ],
    can: 'Comment, approve, reject and manage rules',
    cannot: 'Edit draft text directly or manage users'
  },
  admin: {
    title: 'Administrator',
    mainJob: 'Manages the system',
    homeScreen: 'overview',
    homeScreenTitle: 'System Overview',
    mainButton: 'Manage users',
    summaryCards: [
      { id: 'active_users', label: 'Active users', key: 'active_users', icon: Users, color: '#315dcc', bg: '#eff4ff' },
      { id: 'source_errors', label: 'Source errors', key: 'source_errors', icon: CircleAlert, color: '#c2410c', bg: '#fff1ec' },
      { id: 'connection_status', label: 'Connection status', key: 'connection_status', icon: Activity, color: '#288763', bg: '#ebfbf3' }
    ],
    menu: [
      { id: 'overview', label: 'System Overview', icon: Layers3 },
      { id: 'users', label: 'Users and Roles', icon: Users },
      { id: 'settings', label: 'Source Settings', icon: Settings },
      { id: 'integrations', label: 'Integrations', icon: Database },
      { id: 'audit', label: 'Audit Log', icon: FileText }
    ],
    can: 'Add users, assign roles, and set up sources and tools',
    cannot: 'Write or approve messages'
  }
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('hdfc_finserve_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('hdfc_finserve_token') || '')

  // Theme Management (Midnight Dark Theme / Light Mode)
  const [theme, setTheme] = useState(() => localStorage.getItem('finserve_theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('finserve_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const currentRole = user?.role || 'drafter'
  const currentSpec = ROLE_SPECS[currentRole] || ROLE_SPECS.drafter

  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState('')
  const [language, setLanguage] = useState('English')
  const [channel, setChannel] = useState('Email')
  const [tone, setTone] = useState('Friendly')

  // Customer Preferences form state
  const [prefCustomer, setPrefCustomer] = useState('')
  const [prefName, setPrefName] = useState('')
  const [prefLang, setPrefLang] = useState('English')
  const [prefChannel, setPrefChannel] = useState('Email')
  const [prefTone, setPrefTone] = useState('Friendly')
  const [prefTier, setPrefTier] = useState('Retail')

  const [reason, setReason] = useState('')
  const [config, setConfig] = useState(null)
  const [records, setRecords] = useState([])
  const [systemOverview, setSystemOverview] = useState(null)
  const [view, setView] = useState(() => {
    if (user?.role === 'compliance') return 'review'
    if (user?.role === 'admin') return 'overview'
    return 'drafts'
  })
  const [previewTab, setPreviewTab] = useState('email') // 'email', 'sms', 'whatsapp', 'redline', 'edit'

  const [notice, setNotice] = useState('')
  const [item, setItem] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [wording, setWording] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Admin New User form state
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState('drafter')
  const [newUserDept, setNewUserDept] = useState('Customer Communications')
  const [newUserPwd, setNewUserPwd] = useState('')
  const [adminUserSubmitting, setAdminUserSubmitting] = useState(false)

  // Filter state for Drafts & Review queues
  const [draftFilter, setDraftFilter] = useState('all')

  function handleCustomerSelect(selectedId) {
    setCustomer(selectedId)
    if (!selectedId) return
    const match = customers.find(c => c.customer === selectedId)
    if (match) {
      setTone(match.tone || 'Friendly')
      setChannel(match.channel || 'Email')
      setLanguage(match.language || 'English')
      setPreviewTab(match.channel === 'SMS' ? 'sms' : match.channel === 'WhatsApp' ? 'whatsapp' : 'email')
      setMessage(`Memento: Loaded communication profile for ${match.name || match.customer} (${match.language || 'English'}, ${match.channel}, ${match.tone} tone).`)
    }
  }

  function handleLogin(userData, tokenStr) {
    setUser(userData)
    setToken(tokenStr)
    setReviewer(userData.name)
    localStorage.setItem('hdfc_finserve_user', JSON.stringify(userData))
    localStorage.setItem('hdfc_finserve_token', tokenStr)
    const targetHome = ROLE_SPECS[userData.role]?.homeScreen || 'drafts'
    setView(targetHome)
    setMessage(`Signed in as ${userData.name} (${ROLE_SPECS[userData.role]?.title || 'Staff'})`)
  }

  function handleLogout() {
    api('auth/logout', {}, token).catch(() => { })
    setUser(null)
    setToken('')
    localStorage.removeItem('hdfc_finserve_user')
    localStorage.removeItem('hdfc_finserve_token')
  }

  useEffect(() => {
    if (user && !reviewer) {
      setReviewer(user.name)
    }
  }, [user])

  async function refreshSystemData() {
    if (!user) return
    try {
      const [settings, list, prefs, overview] = await Promise.all([
        api('notices', undefined, token),
        api('drafts', undefined, token),
        api('preferences', undefined, token),
        api('system/overview', undefined, token)
      ])
      setCustomers(prefs)
      setConfig(settings)
      if (!notice && settings.notices?.length) setNotice(settings.notices[0].id)
      setRecords(list)
      setSystemOverview(overview)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refreshSystemData()
  }, [user, token])

  function open(draft) {
    setReason('')
    setCustomer(draft.preference?.customer || '')
    setNotice(draft.source?.id || '')
    setTone(draft.tone || draft.preference?.tone || 'Friendly')
    setChannel(draft.channel || draft.preference?.channel || 'Email')
    setLanguage(draft.language || draft.preference?.language || 'English')
    setItem(draft)
    setSubject(draft.subject || '')
    setBody(draft.body || '')
    setReviewer(draft.reviewer || user?.name || '')
    setWording(draft.reusable_wording || '')
    setConfirmed(false)
    const chan = draft.channel || draft.preference?.channel || 'Email'
    setPreviewTab(chan === 'SMS' ? 'sms' : chan === 'WhatsApp' ? 'whatsapp' : 'email')
    setView('compose')
  }

  function remember(draft) {
    setRecords(previous => [draft, ...previous.filter(entry => entry.id !== draft.id)])
    open(draft)
    refreshSystemData()
  }

  async function act(callback) {
    setBusy(true); setError(''); setMessage('')
    try { await callback() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function handleMainAction() {
    if (currentRole === 'drafter') {
      setItem(null)
      setView('compose')
    } else if (currentRole === 'compliance') {
      const pendingDraft = records.find(r => r.status === 'draft')
      if (pendingDraft) {
        open(pendingDraft)
      } else {
        setMessage('No drafts are awaiting review.')
      }
    } else if (currentRole === 'admin') {
      setView('users')
    }
  }

  function handleInjectDisclaimers() {
    let updatedBody = body
    const bankName = item?.source?.bank || 'HDFC Bank'
    if (!updatedBody.toLowerCase().includes('pin') && !updatedBody.toLowerCase().includes('never ask')) {
      updatedBody += `\n\nSecurity Advisory: ${bankName} will never ask for your PIN, OTP, CVV, or net banking password via phone, email, or SMS.`
    }
    if (!updatedBody.toLowerCase().includes('support') && !updatedBody.toLowerCase().includes('customer care') && !updatedBody.toLowerCase().includes('queries')) {
      updatedBody += `\n\nFor questions, refer to the HDFC Bank source linked to this message.`
    }
    setBody(updatedBody)
    setMessage('Auto-injected mandatory statutory and anti-phishing disclaimers!')
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPwd.trim()) return
    setAdminUserSubmitting(true)
    setError('')
    setMessage('')
    try {
      await api('admin/users', {
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        role: newUserRole,
        department: newUserDept.trim(),
        password: newUserPwd.trim()
      }, token)
      setMessage(`Staff account created for ${newUserName} (${newUserRole})`)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPwd('')
      refreshSystemData()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdminUserSubmitting(false)
    }
  }

  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <ChatWidget />
      </>
    )
  }

  const selected = config?.notices.find(entry => entry.id === notice)
  const source = item?.source || selected
  const editable = item?.status === 'draft'
  const smsPreview = (item?.channel || item?.preference?.channel) === 'SMS' ? body : item?.sms_body || body

  const canDraft = currentRole === 'drafter'
  const canApprove = currentRole === 'compliance'
  const canManageUsers = currentRole === 'admin'
  const canManageRules = currentRole === 'compliance'

  const liveMetrics = systemOverview?.metrics || {
    drafts: records.filter(d => d.status === 'draft').length,
    returned: records.filter(d => d.status === 'rejected').length,
    approved: records.filter(d => d.status === 'approved').length,
    pending: records.filter(d => d.status === 'draft').length,
    high_risk: records.filter(d => d.status === 'blocked' || (d.warnings && d.warnings.length > 0)).length,
    outdated: 0,
    active_users: systemOverview?.users?.length || 0,
    source_errors: 0,
    connection_status: 'Loading'
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo"><Layers3 size={23} /></div>
          <div>FinServe <em>AI</em><small>CUSTOMER COMMUNICATION ASSISTANT</small></div>
        </div>

        {/* Dynamic Role Navigation Menu */}
        <nav aria-label="Role Workspace">
          {currentSpec.menu.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={view === item.id ? 'active' : ''}
                onClick={() => { setView(item.id); setError(''); setMessage(''); }}
              >
                <Icon size={16} /> {item.label}
              </button>
            )
          })}
        </nav>

        {/* User Identity Chip & Theme Toggle & Sign Out */}
        <div className="user-profile-header">
          <div className="user-info-chip">
            <div className="user-chip-avatar" style={{ background: user.avatar_color }}>
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="user-chip-text">
              <span className="user-chip-name">{user.name}</span>
              <span className="user-chip-role">
                <span className={'role-badge ' + user.role}>
                  {currentSpec.title}
                </span>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Midnight Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            title="Sign out of session"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <main>
        <div className="content">
          {/* Persona Governance & Segregation of Duties Banner */}
          <div className="role-governance-card">
            <div className="governance-meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="governance-name">{user.name}</span>
                <span className={'role-badge ' + currentRole}>{currentSpec.title}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>· Main job: <strong>{currentSpec.mainJob}</strong></span>
              </div>
              <div className="governance-badges">
                <span className="badge-can">
                  <Check size={13} /> <strong>Can:</strong> {currentSpec.can}
                </span>
                <span className="badge-cannot">
                  <Lock size={12} /> <strong>Cannot:</strong> {currentSpec.cannot}
                </span>
              </div>
            </div>

            {/* Role Main Action Button */}
            <button
              type="button"
              className="main-cta-btn"
              onClick={handleMainAction}
            >
              {currentRole === 'drafter' && <Plus size={16} />}
              {currentRole === 'compliance' && <ShieldCheck size={16} />}
              {currentRole === 'admin' && <UserPlus size={16} />}
              {currentSpec.mainButton}
            </button>
          </div>

          {/* Role Summary Metric Cards (Shown on Home Screens: 'drafts', 'review', 'overview') */}
          {(view === 'drafts' || view === 'review' || view === 'overview') && (
            <div className="summary-cards-grid">
              {currentSpec.summaryCards.map(card => {
                const Icon = card.icon
                const val = liveMetrics[card.key] !== undefined ? liveMetrics[card.key] : 0
                return (
                  <div key={card.id} className="summary-card">
                    <div>
                      <div className="summary-card-val">{val}</div>
                      <div className="summary-card-lbl">{card.label}</div>
                    </div>
                    <div className="summary-card-icon" style={{ background: card.bg, color: card.color }}>
                      <Icon size={22} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {error && <div role="alert" className="alert"><CircleAlert size={17} />{error}</div>}
          {message && <div role="status" className="success"><Check size={17} />{message}</div>}

          {/* =========================================================================
              VIEW 1: MY DRAFTS (Home Screen for The drafter - Drafter)
              ========================================================================= */}
          {view === 'drafts' && (
            <section className="card history">
              <div className="card-head" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Draft Register</h2>
                  <p>Browse, edit, and submit customer communications created for official banking notices.</p>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['all', 'draft', 'rejected', 'approved'].map(filterKey => (
                    <button
                      key={filterKey}
                      type="button"
                      className={draftFilter === filterKey ? 'primary' : ''}
                      style={{
                        padding: '6px 12px', fontSize: '12px', borderRadius: '8px',
                        border: draftFilter === filterKey ? 'none' : '1px solid var(--border-line)',
                        background: draftFilter === filterKey ? 'var(--green)' : 'var(--bg-card)',
                        color: draftFilter === filterKey ? '#fff' : 'var(--text-main)'
                      }}
                      onClick={() => setDraftFilter(filterKey)}
                    >
                      {filterKey === 'all' ? 'All' : filterKey === 'draft' ? 'Drafts' : filterKey === 'rejected' ? 'Returned' : 'Approved'}
                    </button>
                  ))}
                </div>
              </div>

              {records.filter(r => draftFilter === 'all' || r.status === draftFilter).length > 0 ? (
                records.filter(r => draftFilter === 'all' || r.status === draftFilter).map(record => (
                  <button className="history-row" key={record.id} onClick={() => { setError(''); setMessage(''); open(record); }}>
                    <FileText size={20} color="#315dcc" />
                    <span>
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{record.subject || record.source?.title || 'Financial Notice Draft'}</strong>
                      <small>
                        {date(record.created_at)} · {record.source?.bank || 'Bank'} · {record.preference?.channel || record.channel || 'Email'} ({record.language || record.preference?.language || 'English'})
                        {record.rejection_reason && <span style={{ color: '#b91c1c', display: 'block', marginTop: '2px' }}>⚠️ Returned with note: "{record.rejection_reason}"</span>}
                        {record.reviewer && <span style={{ color: '#15803d', display: 'block', marginTop: '2px' }}>✓ Reviewed by: {record.reviewer}</span>}
                      </small>
                    </span>
                    <span className={'badge ' + record.status}>{states[record.status] || record.status}</span>
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <div className="empty">
                  <FileText size={28} />
                  <strong>No communications match the current filter</strong>
                  <p>The drafter can create compliant customer communications using the button below.</p>
                  <button className="primary" onClick={() => setView('compose')}>
                    <Plus size={15} /> Create draft
                  </button>
                </div>
              )}
            </section>
          )}

          {/* =========================================================================
              VIEW 2: REVIEW QUEUE (Home Screen for the compliance officer - Compliance Officer)
              ========================================================================= */}
          {view === 'review' && (
            <section className="card history">
              <div className="card-head" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Compliance Review Queue</h2>
                  <p>Verify source grounding, inspect anti-phishing safeguards, comment, approve, or reject customer drafts.</p>
                </div>
                <button className="primary approve" onClick={handleMainAction}>
                  <ShieldCheck size={16} /> Review Next Pending
                </button>
              </div>

              {records.filter(r => r.status === 'draft' || r.status === 'blocked').length > 0 ? (
                records.filter(r => r.status === 'draft' || r.status === 'blocked').map(record => (
                  <button className="history-row" key={record.id} onClick={() => { setError(''); setMessage(''); open(record); }}>
                    <ShieldAlert size={20} color={record.status === 'blocked' ? '#c2410c' : '#315dcc'} />
                    <span>
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{record.subject || record.source?.title || 'Notice Review Item'}</strong>
                      <small>
                        Drafted: {date(record.created_at)} · {record.source?.bank} · Channel: {record.channel || 'Email'} · Language: {record.language || 'English'}
                        {record.warnings && record.warnings.length > 0 && (
                          <span style={{ color: '#c2410c', display: 'block', marginTop: '2px' }}>
                            ⚠️ High risk flags: {record.warnings.join('; ')}
                          </span>
                        )}
                      </small>
                    </span>
                    <span className={'badge ' + record.status}>
                      {record.status === 'blocked' ? 'Needs Review' : 'Pending Approval'}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <div className="empty">
                  <ShieldCheck size={30} color="#288763" />
                  <strong>Compliance Review Queue is Clear</strong>
                  <p>No drafts are awaiting review.</p>
                </div>
              )}
            </section>
          )}

          {/* =========================================================================
              VIEW 3: SYSTEM OVERVIEW (Home Screen for The administrator - Administrator)
              ========================================================================= */}
          {view === 'overview' && (
            <div className="column">
              <section className="card">
                <div className="card-head" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="icon"><Layers3 size={20} /></div>
                    <div>
                      <h2>System Overview</h2>
                      <p>Operational health of core BFSI components, web scraping tools, and knowledge bases.</p>
                    </div>
                  </div>
                  <button className="primary" onClick={() => setView('users')}>
                    <UserPlus size={15} /> Manage users
                  </button>
                </div>

                <div className="integration-grid">
                  {systemOverview?.integrations ? Object.entries(systemOverview.integrations).map(([key, intg]) => (
                    <div key={key} className="integration-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{intg.name}</strong>
                        <span className="status-pill status-connected">
                          <span className="status-dot-active" /> {intg.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 8px' }}>{intg.description}</p>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-line)' }}>
                        {intg.latency && <span>⚡ Latency: <strong>{intg.latency}</strong></span>}
                        {intg.model && <span>🤖 Model: <strong>{intg.model}</strong></span>}
                        {intg.db && <span>💾 Store: <strong>{intg.db}</strong></span>}
                        {intg.dialect && <span>🗄️ Dialect: <strong>{intg.dialect}</strong></span>}
                      </div>
                    </div>
                  )) : (
                    <p className="panel-note">Loading integration diagnostics…</p>
                  )}
                </div>
              </section>

              {/* Quick Navigation Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <button type="button" className="quick-nav-card" onClick={() => setView('users')}>
                  <Users size={20} color="#315dcc" />
                  <strong>Users and Roles</strong>
                  <small>Manage staff profiles & assign roles</small>
                </button>
                <button type="button" className="quick-nav-card" onClick={() => setView('settings')}>
                  <Settings size={20} color="#b06228" />
                  <strong>Source Settings</strong>
                  <small>Firecrawl web crawler & domains</small>
                </button>
                <button type="button" className="quick-nav-card" onClick={() => setView('audit')}>
                  <FileText size={20} color="#288763" />
                  <strong>Audit Log</strong>
                  <small>Review timestamps & review trail</small>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 4: COMPOSE / DRAFT STUDIO (Drafting and Review)
              ========================================================================= */}
          {view === 'compose' && (
            <div className="layout studio-layout">
              {/* Left Column: Draft Setup & Memento Preferences */}
              <div className="column">
                <section className="card">
                  <div className="card-head">
                    <div className="icon"><FileText size={18} /></div>
                    <div>
                      <h2>Draft Setup</h2>
                      <p>Select the official notice and target customer preference profile.</p>
                    </div>
                  </div>

                  {!canDraft && (
                    <div className="panel-note" style={{ padding: '8px 12px', background: 'var(--table-hover)', border: '1px solid var(--border-line)', borderRadius: '8px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      <Lock size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                      <strong>Staff Governance:</strong> Viewing communication as <strong>{user.name} ({currentSpec.title})</strong>.
                    </div>
                  )}

                  <form onSubmit={event => {
                    event.preventDefault()
                    if (!canDraft) {
                      setError("Segregation of duties: Administrator cannot write customer drafts.")
                      return
                    }
                    act(async () => remember(await api('drafts', { notice_id: notice, customer, tone, channel, language }, token)))
                  }}>
                    <label>Customer Communication Profile (Memento)
                      <select value={customer} onChange={event => handleCustomerSelect(event.target.value)} disabled={busy || !canDraft}>
                        <option value="">Manual / Custom Settings</option>
                        {customers.map(entry => (
                          <option key={entry.customer} value={entry.customer}>
                            {entry.name ? `${entry.name} (${entry.customer})` : entry.customer} · 🌐 {entry.language || 'English'} · 📬 {entry.channel} · 🎭 {entry.tone}
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Active Customer Profile Card */}
                    {(() => {
                      const activeCust = customers.find(c => c.customer === customer)
                      if (!activeCust) return null
                      return (
                        <div className="memento-customer-card" style={{ padding: '10px 14px', background: 'var(--table-hover)', borderRadius: '10px', border: '1px solid var(--border-line)', margin: '10px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#315dcc', fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>
                            <LibraryBig size={14} /> Loaded from Memento Knowledge Store
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
                            <span style={{ background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-line)', color: 'var(--text-main)' }}>
                              🌐 <strong>Language:</strong> {activeCust.language || 'English'}
                            </span>
                            <span style={{ background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-line)', color: 'var(--text-main)' }}>
                              📬 <strong>Channel:</strong> {activeCust.channel}
                            </span>
                            <span style={{ background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-line)', color: 'var(--text-main)' }}>
                              🎭 <strong>Tone:</strong> {activeCust.tone}
                            </span>
                            <span style={{ background: 'var(--bg-card)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-line)', color: 'var(--text-main)' }}>
                              🏷️ <strong>Tier:</strong> {activeCust.tier || 'Retail'}
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    <div className="fields">
                      <label>Official Notice Source
                        <select value={notice} onChange={event => { setNotice(event.target.value); setItem(null); setMessage(''); setError('') }} disabled={busy || !config || !canDraft}>
                          {config?.notices.map(entry => (
                            <option key={entry.id} value={entry.id}>{entry.bank}: {entry.title}</option>
                          ))}
                        </select>
                      </label>
                      <label>Preferred Language
                        <select value={language} onChange={event => setLanguage(event.target.value)} disabled={busy || !canDraft}>
                          <option value="English">English</option>
                          <option value="Hindi">Hindi (हिंदी)</option>
                          <option value="Spanish">Spanish (Español)</option>
                          <option value="French">French (Français)</option>
                          <option value="German">German (Deutsch)</option>
                        </select>
                      </label>
                    </div>

                    <div className="fields">
                      <label>Delivery Channel
                        <select value={channel} onChange={event => {
                          setChannel(event.target.value);
                          setPreviewTab(event.target.value === 'SMS' ? 'sms' : event.target.value === 'WhatsApp' ? 'whatsapp' : 'email');
                        }} disabled={busy || !canDraft}>
                          <option value="Email">Email</option>
                          <option value="SMS">SMS</option>
                          <option value="WhatsApp">WhatsApp Business</option>
                        </select>
                      </label>
                      <label>Communication Tone
                        <select value={tone} onChange={event => setTone(event.target.value)} disabled={busy || !canDraft}>
                          {['Friendly', 'Formal', 'Concise'].map(value => <option key={value}>{value}</option>)}
                        </select>
                      </label>
                    </div>

                    {canDraft ? (
                      <div className="actions">
                        <span>
                          <strong style={{ color: '#315dcc' }}>{config?.generation || 'Gen AI Drafting'}</strong> · Memento Guided
                        </span>
                        <button className="primary" disabled={busy || !notice}>
                          <Sparkles size={16} />{busy ? 'Drafting…' : 'Generate Compliant Draft'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        * Draft generation is restricted to Communications Drafters.
                      </div>
                    )}
                  </form>
                </section>

                {/* Save Customer Preferences to Memento */}
                {canDraft && (
                  <section className="card">
                    <div className="card-head">
                      <div className="icon lilac"><User size={18} /></div>
                      <div>
                        <h2>Customer Preferences (Memento)</h2>
                        <p>Remember each customer's language, channel, tone, and tier in Memento for future communications.</p>
                      </div>
                    </div>
                    <form onSubmit={event => {
                      event.preventDefault()
                      act(async () => {
                        const result = await api('preferences', {
                          customer: prefCustomer,
                          name: prefName,
                          language: prefLang,
                          channel: prefChannel,
                          tone: prefTone,
                          tier: prefTier
                        }, token)
                        const freshPrefs = await api('preferences', undefined, token)
                        setCustomers(freshPrefs)
                        handleCustomerSelect(prefCustomer)
                        setMessage(result.memory_write === 'failed' ? 'Preferences saved locally.' : `Saved ${prefName || prefCustomer}'s preferences to Memento.`)
                        setPrefCustomer('')
                        setPrefName('')
                      })
                    }}>
                      <div className="fields">
                        <label>Customer Reference ID
                          <input value={prefCustomer} onChange={event => setPrefCustomer(event.target.value)} pattern="[a-zA-Z0-9_-]+" maxLength={80} placeholder="Customer reference" required />
                        </label>
                        <label>Customer Name
                          <input value={prefName} onChange={event => setPrefName(event.target.value)} maxLength={120} placeholder="Customer name" />
                        </label>
                      </div>
                      <div className="fields">
                        <label>Preferred Language
                          <select value={prefLang} onChange={event => setPrefLang(event.target.value)}>
                            <option value="English">English</option>
                            <option value="Hindi">Hindi (हिंदी)</option>
                            <option value="Spanish">Spanish (Español)</option>
                            <option value="French">French (Français)</option>
                            <option value="German">German (Deutsch)</option>
                          </select>
                        </label>
                        <label>Preferred Channel
                          <select value={prefChannel} onChange={event => setPrefChannel(event.target.value)}>
                            <option value="Email">Email</option>
                            <option value="SMS">SMS</option>
                            <option value="WhatsApp">WhatsApp</option>
                          </select>
                        </label>
                      </div>
                      <button className="primary" disabled={busy || !prefCustomer.trim()} style={{ marginTop: '10px' }}>
                        <Sparkles size={15} /> Save to Memento
                      </button>
                    </form>
                  </section>
                )}
              </div>

              {/* Right Column: Communication Preview & Review Actions */}
              <div className="column">
                <section className="card result-panel">
                  <div className="card-head">
                    <div className="icon"><Clipboard size={18} /></div>
                    <div>
                      <h2>Customer Communication</h2>
                      <p>{item?.brief || 'Review the draft alongside its HDFC Bank source.'}</p>
                    </div>
                    {item && <span className={'badge ' + item.status}>{states[item.status] || item.status}</span>}
                  </div>

                  {!item ? (
                    <div className="empty">
                      <FileText size={28} />
                      <strong>Your draft will appear here</strong>
                      <p>Select a notice and generate to view the AI communication.</p>
                    </div>
                  ) : item.status === 'blocked' ? (
                    <div className="alert">
                      <CircleAlert size={17} />
                      Missing official source details. Resolve the warnings in the Source Evidence panel before drafting.
                    </div>
                  ) : (
                    <div>
                      {/* Multi-Channel & Regulatory Preview Tabs */}
                      <div className="preview-tabs">
                        <button
                          type="button"
                          className={previewTab === 'email' ? 'active' : ''}
                          onClick={() => setPreviewTab('email')}
                        >
                          <Mail size={15} /> Email Preview
                        </button>
                        <button
                          type="button"
                          className={previewTab === 'sms' ? 'active' : ''}
                          onClick={() => setPreviewTab('sms')}
                        >
                          <Smartphone size={15} /> SMS Preview
                        </button>
                        <button
                          type="button"
                          className={previewTab === 'whatsapp' ? 'active' : ''}
                          onClick={() => setPreviewTab('whatsapp')}
                        >
                          <MessageSquare size={15} /> WhatsApp Business
                        </button>
                        <button
                          type="button"
                          className={previewTab === 'redline' ? 'active' : ''}
                          onClick={() => setPreviewTab('redline')}
                        >
                          <GitCompare size={15} /> Redline Diff
                        </button>
                        <button
                          type="button"
                          className={previewTab === 'edit' ? 'active' : ''}
                          onClick={() => setPreviewTab('edit')}
                        >
                          <Edit3 size={15} /> Edit Text {!canDraft && '(Read-Only)'}
                        </button>
                      </div>

                      {/* Channel Render: Email Preview */}
                      {previewTab === 'email' && (
                        <div className="email-preview">
                          <div className="email-header-bar">
                            <div className="email-bank-logo">
                              <Layers3 size={20} color="#315dcc" />
                              <span>{item.source?.bank || 'Bank'}</span>
                            </div>
                            <span className="email-official-tag">Message preview</span>
                          </div>
                          <div className="email-subject-line">
                            Subject: {subject}
                          </div>
                          <div className="email-content-body">
                            {body}
                          </div>
                        </div>
                      )}

                      {/* Channel Render: SMS Preview */}
                      {previewTab === 'sms' && (
                        <div className="sms-phone-mockup">
                          <div className="phone-speaker" />
                          <div className="phone-screen">
                            <div className="sms-sender-header">
                              SMS preview · {item.source.bank}
                            </div>
                            <div className="sms-bubble">
                              {smsPreview}
                            </div>
                            <div className="sms-meta-info">
                              {smsPreview.length} / 160 characters · {Math.ceil(smsPreview.length / 160)} SMS
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Channel Render: WhatsApp Business Interactive Preview */}
                      {previewTab === 'whatsapp' && (
                        <div className="whatsapp-mockup">
                          <div className="whatsapp-header">
                            <div className="whatsapp-avatar">
                              {(item.source?.bank || 'Bank').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="whatsapp-header-info">
                              <div className="whatsapp-sender">
                                {item.source?.bank || 'HDFC Bank'}

                              </div>
                              <span className="whatsapp-status">Message preview</span>
                            </div>
                          </div>
                          <div className="whatsapp-chat-body">
                            <div className="whatsapp-bubble">
                              {item.whatsapp_body || body}
                            </div>
                            <div className="whatsapp-buttons-container">
                              <a className="whatsapp-action-btn" href={item.source.url} target="_blank" rel="noreferrer">View HDFC Bank source</a>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Channel Render: Visual Redline Diff Tool */}
                      {previewTab === 'redline' && (
                        <VisualRedlineDiff
                          source={item.source}
                          body={body}
                          wording={wording || item.wording}
                        />
                      )}

                      {/* Pre-Flight Regulatory Compliance Linter */}
                      <PreFlightLinter
                        item={item}
                        subject={subject}
                        body={body}
                        canDraft={canDraft}
                        onInjectDisclaimers={handleInjectDisclaimers}
                      />

                      {/* Editor & Actions Form */}
                      <form className="editor" style={{ marginTop: '16px' }} onSubmit={event => {
                        event.preventDefault()
                        if (!canApprove) {
                          setError("Segregation of duties: Only a Compliance Officer can approve messages.")
                          return
                        }
                        act(async () => {
                          const approved = await api('drafts/' + item.id + '/approve', {
                            subject, body, reviewer: reviewer || user.name, reusable_wording: wording, source_confirmed: confirmed
                          }, token)
                          remember(approved)
                          setMessage('Draft approved and recorded in Memento memory.')
                        })
                      }}>
                        {previewTab === 'edit' && (
                          <>
                            {!canDraft && (
                              <div className="panel-note" style={{ padding: '8px 12px', background: 'var(--table-hover)', border: '1px solid var(--border-line)', borderRadius: '8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                <Lock size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                                <strong>Compliance review:</strong> Cannot edit draft text directly. You can comment, reject with revision feedback, or provide approved wording.
                              </div>
                            )}
                            <label>Subject
                              <input
                                value={subject}
                                onChange={event => { if (canDraft) { setSubject(event.target.value); setConfirmed(false); } }}
                                maxLength={160}
                                readOnly={!canDraft || !editable || busy}
                                required
                              />
                            </label>
                            <label>Message Content
                              <textarea
                                value={body}
                                onChange={event => { if (canDraft) { setBody(event.target.value); setConfirmed(false); } }}
                                rows={10}
                                maxLength={12000}
                                readOnly={!canDraft || !editable || busy}
                                required
                              />
                            </label>
                            {editable && canDraft && (
                              <Readability key={item.id} item={item} subject={subject} body={body} busy={busy}
                                onChange={next => { setSubject(next.subject); setBody(next.body); setConfirmed(false) }} />
                            )}
                          </>
                        )}

                        {editable ? (
                          <>
                            {/* Segregation of Duties Action Block */}
                            {canApprove ? (
                              /* Compliance Officer: Comment, Approve, Reject */
                              <>
                                <div className="fields">
                                  <label>Compliance Officer
                                    <input value={reviewer || user.name} onChange={event => setReviewer(event.target.value)} required />
                                  </label>
                                  <label>Approved Wording to Save in Memento
                                    <input value={wording} onChange={event => setWording(event.target.value)} placeholder="Standard policy wording to store" />
                                  </label>
                                </div>

                                <label className="checkbox">
                                  <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} required />
                                  I verified that the communication accurately reflects official source facts and includes security disclaimers.
                                </label>

                                <div className="review-action-container">
                                  <input
                                    value={reason}
                                    onChange={event => setReason(event.target.value)}
                                    placeholder="Rejection reason / comments (required if returning to drafter)"
                                    maxLength={1000}
                                    style={{ margin: 0 }}
                                  />
                                  <div className="review-action-buttons">
                                    <button
                                      type="button"
                                      className="primary"
                                      style={{ background: '#a34e65' }}
                                      disabled={busy || !reason.trim()}
                                      onClick={() => act(async () => remember(await api('drafts/' + item.id + '/reject', { reviewer: user.name, reason }, token)))}
                                    >
                                      Reject & Return
                                    </button>
                                    <button
                                      className="primary approve"
                                      disabled={busy || !confirmed}
                                    >
                                      <ShieldCheck size={17} /> Approve Communication
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : canDraft ? (
                              /* Communications Drafter: Submit for Review */
                              <div style={{ marginTop: '12px', padding: '14px', background: 'var(--table-hover)', border: '1px solid var(--border-line)', borderRadius: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--green)', fontWeight: 600, fontSize: '13px' }}>
                                  <Check size={16} /> Draft Ready for Review
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 12px' }}>
                                  The drafter cannot approve messages. When you finish drafting, this draft is automatically queued for a compliance officer.
                                </p>
                                <button
                                  type="button"
                                  className="primary"
                                  onClick={() => {
                                    setMessage(`Draft queued for Compliance Officer review! Switched to My Drafts view.`)
                                    setView('drafts')
                                  }}
                                >
                                  <Check size={16} /> Submit for Review
                                </button>
                              </div>
                            ) : (
                              /* Administrator: Read-Only Governance */
                              <div className="panel-note" style={{ padding: '12px', background: 'var(--table-hover)', border: '1px solid var(--border-line)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                                <Lock size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                                <strong>Administrator Mode:</strong> The administrator manages users and system integrations; writing or approving messages is restricted to Drafter and Compliance roles.
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                            <div className="success" style={{ margin: 0 }}>
                              <Check size={17} />
                              {item.status === 'rejected' ? `Returned by ${item.reviewer} — ${item.rejection_reason}` : `Approved by ${item.reviewer} · ${date(item.approved_at)}`}
                            </div>
                            {item.status === 'approved' && (
                              <a href={'/api/drafts/' + item.id + '/export'} download className="primary" style={{ textDecoration: 'none' }}>
                                <Download size={15} /> Download {item.preference?.channel === 'SMS' ? 'SMS' : 'Email'}
                              </a>
                            )}
                          </div>
                        )}
                      </form>
                    </div>
                  )}
                </section>

                {/* Source Evidence Card (Firecrawl) */}
                <section className="card evidence">
                  <div className="card-head">
                    <div className="icon amber"><BookOpen size={18} /></div>
                    <div>
                      <h2>Source evidence</h2><small className="provider-label">{source?.retriever || config?.retriever}</small>
                      <p>{source?.url ? 'Verified official web document' : 'Source unavailable'}</p>
                    </div>
                  </div>
                  {source ? (
                    <>
                      <div className="source-meta">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{source.title}</strong>
                          <span className="badge" style={{ background: '#e0ecfb', color: '#32588a' }}>
                            {source.retriever || (source.url ? 'Firecrawl v2' : 'Local Notice')}
                          </span>
                        </div>
                        <span>{source.bank} · <span className={'badge ' + (source.category || 'fee').toLowerCase()}>{source.category || 'Fee'}</span></span>
                        {source.url && <a href={source.url} target="_blank" rel="noreferrer">Open official source <ArrowUpRight size={13} /></a>}
                      </div>

                      {item ? (
                        <>
                          <dl>
                            <div><dt>Product</dt><dd>{item.facts?.product || source.product || 'Standard'}</dd></div>
                            {item.facts?.fee && <div><dt>Annual Fee</dt><dd>{item.facts.fee}</dd></div>}
                            {item.facts?.effective_date && <div><dt>Effective Date</dt><dd>{item.facts.effective_date}</dd></div>}
                          </dl>
                          {source.statement && (
                            <div style={{ padding: '10px 12px', background: 'var(--table-hover)', borderRadius: '8px', borderLeft: '3px solid #315dcc', fontSize: '12px', margin: '10px 0' }}>
                              <strong>Key Verified Statement:</strong><br />
                              "{source.statement}"
                            </div>
                          )}
                          <details open={!source.url}>
                            <summary>{item.brief ? 'Verified source excerpt' : 'Scraped Source Snapshot'}</summary>
                            <div className="excerpt">{source.text}</div>
                          </details>
                          <p className="timestamp">Retrieved {date(source.retrieved_at)}</p>
                          {item.warnings?.map(warning => (
                            <div key={warning} className="alert"><CircleAlert size={16} />{warning}</div>
                          ))}
                        </>
                      ) : (
                        <p className="panel-note">Generate a draft to retrieve the notice text and verify source facts.</p>
                      )}
                    </>
                  ) : (
                    <p className="panel-note">No source selected.</p>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 5: SOURCES (Firecrawl Scraping & Verified Catalog)
              ========================================================================= */}
          {view === 'sources' && (
            <Sources
              notices={config?.notices || []}
              busy={busy}
              select={id => {
                setNotice(id); setItem(null); setView('compose'); setMessage(''); setError('')
              }}
              register={async values => {
                let saved = false
                await act(async () => {
                  const result = await api('sources', values, token)
                  const fresh = await api('notices', undefined, token)
                  setConfig(fresh)
                  setMessage(`Notice registered with ${result.retriever || 'Firecrawl'} and added to catalog.`)
                  saved = true
                })
                return saved
              }}
            />
          )}

          {/* =========================================================================
              VIEW 6 & 7: APPROVED LIBRARY & COMPLIANCE RULES
              ========================================================================= */}
          {(view === 'approved' || view === 'rules') && (
            <KnowledgeBank user={user} mode={view} />
          )}

          {/* =========================================================================
              VIEW 8: USERS AND ROLES (The administrator - Administrator)
              ========================================================================= */}
          {view === 'users' && (
            <div className="layout">
              <div className="column">
                <section className="card">
                  <div className="card-head">
                    <div className="icon"><Users size={18} /></div>
                    <div>
                      <h2>Staff Directory & Role Assignments</h2>
                      <p>View all registered bank personnel and their segregated permissions.</p>
                    </div>
                  </div>

                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemOverview?.users ? systemOverview.users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="user-chip-avatar" style={{ background: u.avatar_color, width: '26px', height: '26px', fontSize: '10px' }}>
                                {u.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <strong>{u.name}</strong>
                            </div>
                          </td>
                          <td>
                            <span className={'role-badge ' + u.role}>
                              {u.role === 'compliance' ? 'Compliance Officer' : u.role === 'drafter' ? 'Communications Drafter' : 'Administrator'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{u.department}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{u.email}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}>Loading directory…</td></tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </div>

              <div className="column">
                <section className="card">
                  <div className="card-head">
                    <div className="icon amber"><UserPlus size={18} /></div>
                    <div>
                      <h2>Add Staff Member</h2>
                      <p>Create a new user and assign their persona and duties.</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateUser} className="editor">
                    <label>Full Name
                      <input value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Staff name" required />
                    </label>
                    <label>Bank Email Address
                      <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Staff email address" required />
                    </label>
                    <div className="fields">
                      <label>Assigned Persona & Role
                        <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
                          <option value="drafter">Communications Drafter</option>
                          <option value="compliance">Compliance Officer</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </label>
                      <label>Department
                        <input value={newUserDept} onChange={e => setNewUserDept(e.target.value)} placeholder="e.g. Retail Communications" required />
                      </label>
                    </div>
                    <label>Initial Temporary Password
                      <input type="password" value={newUserPwd} onChange={e => setNewUserPwd(e.target.value)} placeholder="••••••••" required minLength={4} />
                    </label>
                    <button className="primary" disabled={adminUserSubmitting || !newUserName.trim() || !newUserEmail.trim()}>
                      <UserPlus size={16} /> {adminUserSubmitting ? 'Creating User…' : 'Create Staff Member'}
                    </button>
                  </form>
                </section>
              </div>
            </div>
          )}

          {/* =========================================================================
              VIEW 9: SOURCE SETTINGS (The administrator - Administrator)
              ========================================================================= */}
          {view === 'settings' && (
            <section className="card">
              <div className="card-head">
                <div className="icon"><Settings size={18} /></div>
                <div>
                  <h2>Source Scraper & Firecrawl Settings</h2>
                  <p>Official HDFC Bank sources and passage verification.</p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '16px', maxWidth: '680px' }}>
                <label>Retriever<input value={config?.retriever || 'Loading'} readOnly /></label>
                <label>Official source websites<input value="hdfc.bank.in and hdfcbank.com (including www)" readOnly /></label>
                <p>Drafting requires the registered passage to match the current source.</p>
              </div>
            </section>
          )}

          {/* =========================================================================
              VIEW 10: INTEGRATIONS (The administrator - Administrator)
              ========================================================================= */}
          {view === 'integrations' && (
            <section className="card">
              <div className="card-head">
                <div className="icon"><Database size={18} /></div>
                <div>
                  <h2>Integrations Health & Connection Diagnostics</h2>
                  <p>Configured providers and workspace database.</p>
                </div>
              </div>

              <div className="integration-grid">
                {Object.values(systemOverview?.integrations || {}).map(item => (
                  <div key={item.name} className="integration-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{item.name}</strong>
                      <span className="status-pill status-connected">
                        <span className="status-dot-active" /> {item.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '6px 0' }}>{item.description}</p>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-line)' }}>
                      {item.model || item.dialect}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* =========================================================================
              VIEW 11: AUDIT LOG
              ========================================================================= */}
          {view === 'audit' && (
            <section className="card">
              <div className="card-head">
                <div className="icon"><Activity size={18} /></div>
                <div>
                  <h2>Regulatory Compliance Audit Trail</h2>
                  <p>Immutable log of every draft generation, compliance review, and Memento knowledge sync.</p>
                </div>
              </div>

              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Subject / Target</th>
                    <th>Actor & Role</th>
                    <th>Audit Details</th>
                  </tr>
                </thead>
                <tbody>
                  {systemOverview?.audit_log && systemOverview.audit_log.length > 0 ? (
                    systemOverview.audit_log.map((log, index) => (
                      <tr key={log.id || index}>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {log.timestamp ? date(log.timestamp) : 'Recent'}
                        </td>
                        <td>
                          <span className={'badge ' + (log.action.includes('Approved') ? 'approved' : log.action.includes('Rejected') ? 'rejected' : 'draft')}>
                            {log.action}
                          </span>
                        </td>
                        <td><strong>{log.target}</strong></td>
                        <td>
                          {log.actor}
                          <small style={{ display: 'block', color: 'var(--text-muted)' }}>{log.actor_role}</small>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.details}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5}>No audit logs recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

        </div>
        <ChatWidget customerId={customer || ''} />
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
