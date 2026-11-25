import React, {useEffect, useState} from 'react'
import {createRoot} from 'react-dom/client'
import {
  ArrowUpRight, BookOpen, Check, ChevronRight, CircleAlert, Clipboard, Clock3,
  Download, Edit3, FileText, Globe, Layers3, LibraryBig, LogOut, Mail, ShieldAlert,
  ShieldCheck, Smartphone, Sparkles, User, Lock
} from 'lucide-react'
import './style.css'
import Sources from './Sources'
import KnowledgeBank from './KnowledgeBank'
import Login from './Login'
import ChatWidget from './ChatWidget'

async function api(path, payload, token) {
  const headers = {'Content-Type': 'application/json'}
  const activeToken = token || localStorage.getItem('finserve_token')
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

const date = value => new Date(value).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short'})
const states = {rejected: 'Rejected', approved: 'Approved', blocked: 'Needs source review', draft: 'Ready for review'}

function ReferenceFx({draft}) {
  const [currency, setCurrency] = useState('USD')
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function fetchQuote(event) {
    event.preventDefault()
    setBusy(true); setQuote(null); setError('')
    try { setQuote(await api('drafts/' + draft.id + '/reference-fx?currency=' + currency)) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return <details className="fx">
    <summary>Currency estimate (INR conversion)</summary>
    <p className="panel-note">Reference only. The customer notice retains the verified INR fee.</p>
    <form onSubmit={fetchQuote} className="fx-form">
      <select aria-label="Estimate currency" value={currency} disabled={busy} onChange={event => {setCurrency(event.target.value); setQuote(null); setError('')}}>
        {['USD', 'EUR', 'GBP'].map(code => <option key={code}>{code}</option>)}
      </select>
      <button className="primary" disabled={busy}>{busy ? 'Checking…' : 'Get estimate'}</button>
    </form>
    {quote && <p role="status" className="panel-note"><strong>≈ {quote.currency} {quote.amount}</strong> · {quote.date} · <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a></p>}
    {error && <p role="alert" className="panel-note">{error}</p>}
  </details>
}

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('finserve_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('finserve_token') || '')

  const [customers, setCustomers] = useState([])
  const [customer, setCustomer] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [channel, setChannel] = useState('Email')
  const [customerTier, setCustomerTier] = useState('Retail')
  const [reason, setReason] = useState('')
  const [config, setConfig] = useState(null)
  const [records, setRecords] = useState([])
  const [view, setView] = useState('studio') // 'studio', 'history', 'sources', 'memento'
  const [previewTab, setPreviewTab] = useState('email') // 'email', 'sms', 'edit'

  const [notice, setNotice] = useState('')
  const [tone, setTone] = useState('Friendly')
  const [item, setItem] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [wording, setWording] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function handleLogin(userData, tokenStr) {
    setUser(userData)
    setToken(tokenStr)
    setReviewer(userData.name)
    localStorage.setItem('finserve_user', JSON.stringify(userData))
    localStorage.setItem('finserve_token', tokenStr)
    setMessage(`Signed in as ${userData.name} (${userData.role === 'compliance' ? 'Compliance Officer' : userData.role === 'drafter' ? 'Communications Drafter' : 'Administrator'})`)
  }

  function handleLogout() {
    api('auth/logout', {}, token).catch(() => {})
    setUser(null)
    setToken('')
    localStorage.removeItem('finserve_user')
    localStorage.removeItem('finserve_token')
  }

  useEffect(() => {
    if (user && !reviewer) {
      setReviewer(user.name)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    Promise.all([api('notices'), api('drafts'), api('preferences')]).then(([settings, list, prefs]) => {
      setCustomers(prefs)
      setConfig(settings)
      setNotice(settings.notices[0]?.id || '')
      setRecords(list)
    }).catch(err => setError(err.message))
  }, [user])

  function open(draft) {
    setReason('')
    setCustomer(draft.preference?.customer || '')
    setNotice(draft.source?.id || '')
    setTone(draft.tone || 'Friendly')
    setItem(draft)
    setSubject(draft.subject || '')
    setBody(draft.body || '')
    setReviewer(draft.reviewer || user?.name || '')
    setWording(draft.reusable_wording || '')
    setConfirmed(false)
    setPreviewTab(draft.preference?.channel === 'SMS' ? 'sms' : 'email')
    setView('studio')
  }

  function remember(draft) {
    setRecords(previous => [draft, ...previous.filter(entry => entry.id !== draft.id)])
    open(draft)
  }

  async function act(callback) {
    setBusy(true); setError(''); setMessage('')
    try { await callback() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (!user) {
    return (
      <>
        <Login onLogin={handleLogin}/>
        <ChatWidget customerId="retail-001"/>
      </>
    )
  }

  const selected = config?.notices.find(entry => entry.id === notice)
  const source = item?.source || selected
  const editable = item?.status === 'draft'
  const isCompliance = user?.role === 'compliance' || user?.role === 'admin'
  const viewNames = {
    studio: 'Draft Studio',
    sources: 'Source Library (Firecrawl)',
    memento: 'Knowledge Bank (Memento)',
    history: 'Review History'
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="logo"><Layers3 size={23}/></div>
        <div>FinServe <em>AI</em><small>CUSTOMER COMMUNICATION ASSISTANT</small></div>
      </div>
      <nav aria-label="Workspace">
        <span className="nav-heading">WORKSPACE</span>
        <button className={view === 'studio' ? 'active' : ''} onClick={() => setView('studio')}>
          <FileText size={18}/> Draft studio <ChevronRight className="chevron" size={15}/>
        </button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          <Clock3 size={18}/> Review history <ChevronRight className="chevron" size={15}/>
        </button>
        <button className={view === 'sources' ? 'active' : ''} onClick={() => setView('sources')}>
          <Globe size={18}/> Source library (Firecrawl) <ChevronRight className="chevron" size={15}/>
        </button>
        <button className={view === 'memento' ? 'active' : ''} onClick={() => setView('memento')}>
          <LibraryBig size={18}/> Knowledge bank (Memento) <ChevronRight className="chevron" size={15}/>
        </button>
      </nav>
      <div className="sidebar-foot">
        <ShieldCheck size={19}/>
        <div>Authenticated Staff Session<small>{user.department}</small></div>
      </div>
    </aside>

    <main>
      <header className="top">
        <span>Workspace <ChevronRight size={14}/> <strong>{viewNames[view]}</strong></span>
        {config && (
          <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
            <span className="mode" title="Source Ingestion Provider"><i/>{config.retriever || 'Firecrawl v2'}</span>
            <span className="mode" title="Memory Provider"><LibraryBig size={13} style={{verticalAlign:'middle', marginRight:'4px'}}/>{config.memory || 'Memento'}</span>
          </div>
        )}

        {/* Authenticated Staff User Pill & Logout */}
        <div className="user-profile-header">
          <div className="user-info-chip">
            <div className="user-chip-avatar" style={{background: user.avatar_color}}>
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="user-chip-text">
              <span className="user-chip-name">{user.name}</span>
              <span className="user-chip-role">
                <span className={'role-badge ' + user.role}>
                  {user.role === 'compliance' ? 'Compliance Officer' : user.role === 'drafter' ? 'Drafter' : 'Administrator'}
                </span>
              </span>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout} title="Sign out of staff session">
            <LogOut size={14}/> Sign out
          </button>
        </div>
      </header>

      <div className="content">
        <div className="intro">
          <div className="intro-icon">
            {view === 'studio' ? <Sparkles size={23}/> : view === 'sources' ? <Globe size={23}/> : view === 'memento' ? <LibraryBig size={23}/> : <Clock3 size={23}/>}
          </div>
          <h1>{viewNames[view]}</h1>
          <p>
            {view === 'studio' && 'Create and verify customer emails and SMS using official notices from Firecrawl and approved explanations from Memento.'}
            {view === 'sources' && 'Collect official public product information and fee schedules using Firecrawl.'}
            {view === 'memento' && 'Browse, search, and manage previously approved explanations and customer preferences in Memento.'}
            {view === 'history' && 'Open previously generated drafts to inspect source grounding, audit trails, and review decisions.'}
          </p>
        </div>

        {error && <div role="alert" className="alert"><CircleAlert size={17}/>{error}</div>}
        {message && <div role="status" className="success"><Check size={17}/>{message}</div>}

        {view === 'sources' ? (
          <Sources
            notices={config?.notices || []}
            busy={busy}
            select={id => {
              setNotice(id); setItem(null); setView('studio'); setMessage(''); setError('')
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
        ) : view === 'memento' ? (
          <KnowledgeBank user={user}/>
        ) : view === 'history' ? (
          <section className="card history">
            {records.length ? records.map(record => (
              <button className="history-row" key={record.id} onClick={() => {setError(''); setMessage(''); open(record)}}>
                <FileText size={19}/>
                <span>
                  <strong>{record.subject || record.source?.title || 'Notice draft'}</strong>
                  <small>
                    {date(record.created_at)} · {record.source?.bank} · {record.preference?.channel || 'Email'}
                    {record.reviewer && ` · Reviewed by: ${record.reviewer} (${record.reviewer_role || 'Staff'})`}
                  </small>
                </span>
                <span className={'badge ' + record.status}>{states[record.status]}</span>
                <ChevronRight size={16}/>
              </button>
            )) : (
              <div className="empty">
                <Clock3 size={25}/>
                <strong>No drafts yet</strong>
                <button className="primary" onClick={() => setView('studio')}>Open draft studio</button>
              </div>
            )}
          </section>
        ) : (
          /* View: Studio */
          <div className="layout">
            <div className="column">
              <section className="card">
                <div className="card-head">
                  <div className="icon"><FileText size={18}/></div>
                  <div>
                    <h2>Draft Setup</h2>
                    <p>Select the official notice and target customer preference profile.</p>
                  </div>
                </div>
                <form onSubmit={event => {
                  event.preventDefault()
                  act(async () => remember(await api('drafts', {notice_id: notice, tone, customer}, token)))
                }}>
                  <label>Customer Communication Profile
                    <select value={customer} onChange={event => setCustomer(event.target.value)} disabled={busy}>
                      <option value="">Use selected tone (Default)</option>
                      {customers.map(entry => (
                        <option key={entry.customer} value={entry.customer}>
                          {entry.customer} · {entry.tone} · {entry.channel} ({entry.tier || 'Retail'})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="fields">
                    <label>Official Notice Source
                      <select value={notice} onChange={event => {setNotice(event.target.value); setItem(null); setMessage(''); setError('')}} disabled={busy || !config}>
                        {config?.notices.map(entry => (
                          <option key={entry.id} value={entry.id}>{entry.bank}: {entry.title}</option>
                        ))}
                      </select>
                    </label>
                    <label>Communication Tone
                      <select value={tone} onChange={event => setTone(event.target.value)} disabled={busy}>
                        {['Friendly', 'Formal', 'Concise'].map(value => <option key={value}>{value}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="actions">
                    <span>
                      <strong style={{color:'#65489c'}}>{config?.generation || 'Gen AI Drafting'}</strong> · Memento Guided
                    </span>
                    <button className="primary" disabled={busy || !notice}>
                      <Sparkles size={16}/>{busy ? 'Drafting…' : 'Generate Compliant Draft'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card">
                <div className="card-head">
                  <div className="icon"><Clipboard size={18}/></div>
                  <div>
                    <h2>Customer Communication</h2>
                    <p>Grounded in Firecrawl public notice and Memento approved phrasing.</p>
                  </div>
                  {item && <span className={'badge ' + item.status}>{states[item.status]}</span>}
                </div>

                {!item ? (
                  <div className="empty">
                    <div className="empty-icon"><FileText size={25}/></div>
                    <strong>Your draft will appear here</strong>
                    <p>Select a notice and generate to view the AI communication.</p>
                  </div>
                ) : item.status === 'blocked' ? (
                  <div className="alert">
                    <CircleAlert size={17}/>
                    Missing official source details. Resolve the warnings in the Source Evidence panel before drafting.
                  </div>
                ) : (
                  <div>
                    {/* Multi-Channel Preview Switcher Tabs */}
                    <div className="preview-tabs">
                      <button
                        type="button"
                        className={previewTab === 'email' ? 'active' : ''}
                        onClick={() => setPreviewTab('email')}
                      >
                        <Mail size={15}/> Email Preview
                      </button>
                      <button
                        type="button"
                        className={previewTab === 'sms' ? 'active' : ''}
                        onClick={() => setPreviewTab('sms')}
                      >
                        <Smartphone size={15}/> SMS Preview
                      </button>
                      <button
                        type="button"
                        className={previewTab === 'edit' ? 'active' : ''}
                        onClick={() => setPreviewTab('edit')}
                      >
                        <Edit3 size={15}/> Edit Text
                      </button>
                    </div>

                    {/* Channel Render: Email Preview */}
                    {previewTab === 'email' && (
                      <div className="email-preview">
                        <div className="email-header-bar">
                          <div className="email-bank-logo">
                            <Layers3 size={20} color="#7861a9"/>
                            <span>{item.source?.bank || 'Bank'}</span>
                          </div>
                          <span className="email-official-tag">Official Notice</span>
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
                        <div className="phone-speaker"/>
                        <div className="phone-screen">
                          <div className="sms-sender-header">
                            {item.source?.bank?.toUpperCase().replace(/\s+/g, '') || 'BANK'}-ALERT
                          </div>
                          <div className="sms-bubble">
                            {item.sms_body || body}
                          </div>
                          <div className="sms-meta-info">
                            {(item.sms_body || body).length} / 160 characters · {Math.ceil((item.sms_body || body).length / 160)} SMS
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Editor Form */}
                    <form className="editor" style={{marginTop:'16px'}} onSubmit={event => {
                      event.preventDefault()
                      act(async () => {
                        const approved = await api('drafts/' + item.id + '/approve', {
                          subject, body, reviewer, reusable_wording: wording, source_confirmed: confirmed
                        }, token)
                        remember(approved)
                        setMessage(approved.memory_write === 'failed' ?
                          'Draft approved. Wording stored in local database. Memento sync failed.' :
                          'Draft approved and recorded in Memento memory.')
                      })
                    }}>
                      {previewTab === 'edit' && (
                        <>
                          <label>Subject
                            <input value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} readOnly={!editable || busy} required/>
                          </label>
                          <label>Message Content
                            <textarea value={body} onChange={event => setBody(event.target.value)} rows={10} maxLength={12000} readOnly={!editable || busy} required/>
                          </label>
                        </>
                      )}

                      {editable ? (
                        <>
                          <div className="fields">
                            <label>
                              Reviewer Identity
                              <div style={{display:'flex', alignItems:'center', gap:'8px', marginTop:'6px'}}>
                                <input
                                  value={reviewer || user.name}
                                  onChange={event => setReviewer(event.target.value)}
                                  maxLength={100}
                                  placeholder="Reviewer Name"
                                  disabled={busy}
                                  required
                                  style={{margin:0, flex:1}}
                                />
                                <span className={'role-badge ' + user.role}>
                                  {user.role === 'compliance' ? 'Compliance Officer' : user.role === 'drafter' ? 'Drafter' : 'Administrator'}
                                </span>
                              </div>
                            </label>
                            <label>Save Approved Wording to Memento <small>Optional</small>
                              <input value={wording} onChange={event => setWording(event.target.value)} placeholder="Phrase to store in Memento for future drafts" disabled={busy} maxLength={400}/>
                            </label>
                          </div>

                          {!isCompliance && (
                            <div className="panel-note" style={{padding:'8px 12px', background:'#fbf9ee', border:'1px solid #f2e2b6', borderRadius:'8px', color:'#785210'}}>
                              <Lock size={13} style={{verticalAlign:'middle', marginRight:'5px'}}/>
                              <strong>Compliance Gate:</strong> You are currently logged in as a Communications Drafter. Approval will be recorded under your verified staff account.
                            </div>
                          )}

                          <label className="checkbox">
                            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} required/>
                            I confirmed the product facts, fee schedule, and effective date against the official source.
                          </label>

                          <div style={{display:'flex', gap:'10px', alignItems:'center', marginTop:'10px'}}>
                            <input value={reason} onChange={event => setReason(event.target.value)} placeholder="Rejection reason (required if rejecting)" maxLength={1000} style={{margin:0}}/>
                            <button
                              type="button"
                              className="primary"
                              style={{background:'#a34e65', flex:'none'}}
                              disabled={busy || !reason.trim() || !(reviewer.trim() || user.name)}
                              onClick={() => act(async () => remember(await api('drafts/' + item.id + '/reject', {reviewer: reviewer || user.name, reason}, token)))}
                            >
                              Reject Draft
                            </button>
                            <button className="primary approve" disabled={busy || !confirmed || !(reviewer.trim() || user.name)} style={{flex:'none'}}>
                              <ShieldCheck size={17}/> Approve Communication
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'12px'}}>
                          <div className="success" style={{margin:0}}>
                            <Check size={17}/>
                            {item.status === 'rejected' ? `Rejected by ${item.reviewer} (${item.reviewer_role || 'Staff'}) — ${item.rejection_reason}` : `Approved by ${item.reviewer} (${item.reviewer_role || 'Staff'}) · ${date(item.approved_at)}`}
                          </div>
                          {item.status === 'approved' && (
                            <a href={'/api/drafts/' + item.id + '/export'} download className="primary" style={{textDecoration:'none'}}>
                              <Download size={15}/> Download {item.preference?.channel === 'SMS' ? 'SMS' : 'Email'}
                            </a>
                          )}
                        </div>
                      )}
                    </form>
                  </div>
                )}
              </section>
            </div>

            <div className="column">
              {/* Customer Communication Preferences Card */}
              <section className="card">
                <h2>Customer Communication Preferences</h2>
                <p className="panel-note" style={{marginBottom:'12px'}}>Preferences are stored in Memento to adapt future communications automatically.</p>
                <form onSubmit={event => {
                  event.preventDefault()
                  act(async () => {
                    const result = await api('preferences', {customer: customerName, tone, channel, tier: customerTier}, token)
                    setCustomers(await api('preferences', undefined, token))
                    setCustomer(customerName)
                    setMessage(result.memory_write === 'failed' ? 'Preferences saved locally.' : 'Preferences saved to Memento.')
                  })
                }}>
                  <label>Customer Reference ID
                    <input value={customerName} onChange={event => setCustomerName(event.target.value)} pattern="[a-zA-Z0-9_-]+" maxLength={80} placeholder="e.g. cust_wealth_401" required/>
                  </label>
                  <div className="fields">
                    <label>Preferred Channel
                      <select value={channel} onChange={event => setChannel(event.target.value)}>
                        <option value="Email">Email</option>
                        <option value="SMS">SMS</option>
                      </select>
                    </label>
                    <label>Customer Tier
                      <select value={customerTier} onChange={event => setCustomerTier(event.target.value)}>
                        <option value="Retail">Retail</option>
                        <option value="Preferred">Preferred</option>
                        <option value="Wealth">Wealth</option>
                      </select>
                    </label>
                  </div>
                  <button className="primary" disabled={busy} style={{marginTop:'10px'}}>
                    Save to Memento
                  </button>
                </form>
              </section>

              {/* Source Evidence Card (Firecrawl) */}
              <section className="card evidence">
                <div className="card-head">
                  <div className="icon amber"><BookOpen size={18}/></div>
                  <div>
                    <h2>Source Evidence (Firecrawl)</h2>
                    <p>{source?.url ? 'Verified official web document' : 'Demonstration notice'}</p>
                  </div>
                </div>
                {source ? (
                  <>
                    <div className="source-meta">
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                        <strong>{source.title}</strong>
                        <span className="badge" style={{background:'#e0ecfb', color:'#32588a'}}>
                          {source.retriever || (source.url ? 'Firecrawl v2' : 'Local Notice')}
                        </span>
                      </div>
                      <span>{source.bank} · <span className={'badge ' + (source.category || 'fee').toLowerCase()}>{source.category || 'Fee'}</span></span>
                      {source.url && <a href={source.url} target="_blank" rel="noreferrer">Open official source <ArrowUpRight size={13}/></a>}
                    </div>

                    {item ? (
                      <>
                        <dl>
                          <div><dt>Product</dt><dd>{item.facts?.product || source.product || 'Standard'}</dd></div>
                          {item.facts?.fee && <div><dt>Annual Fee</dt><dd>{item.facts.fee}</dd></div>}
                          {item.facts?.effective_date && <div><dt>Effective Date</dt><dd>{item.facts.effective_date}</dd></div>}
                        </dl>
                        {source.statement && (
                          <div style={{padding:'10px 12px', background:'#ffffffb0', borderRadius:'8px', borderLeft:'3px solid #7861a9', fontSize:'12px', margin:'10px 0'}}>
                            <strong>Key Verified Statement:</strong><br/>
                            "{source.statement}"
                          </div>
                        )}
                        <details open={!source.url}>
                          <summary>Scraped Source Snapshot</summary>
                          <div className="excerpt">{source.text}</div>
                        </details>
                        <p className="timestamp">Retrieved {date(source.retrieved_at)}</p>
                        {item.status !== 'blocked' && item.facts?.fee && /^(₹|INR )/.test(item.facts.fee) && (
                          <ReferenceFx key={item.id} draft={item}/>
                        )}
                        {item.warnings?.map(warning => (
                          <div key={warning} className="alert"><CircleAlert size={16}/>{warning}</div>
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

              {/* Memento Knowledge Consistency Card */}
              <section className="card">
                <div className="card-head">
                  <div className="icon lilac"><LibraryBig size={18}/></div>
                  <div>
                    <h2>Approved Explanations (Memento)</h2>
                    <p>{item?.memory || config?.memory || 'Memento'}</p>
                  </div>
                </div>
                <p className="panel-note" style={{marginBottom:'10px'}}>
                  Prior approved phrasing retrieved from Memento to ensure messaging consistency:
                </p>
                <div style={{padding:'12px', background:'#f8f5ff', borderRadius:'10px', border:'1px solid #e3d8f4', fontSize:'13px', color:'#453366', lineHeight:1.6}}>
                  {item?.wording ? `"${item.wording}"` : 'Previously approved language appears here when you generate a draft.'}
                </div>
                {item?.prior_explanations && item.prior_explanations.length > 1 && (
                  <details style={{marginTop:'10px'}}>
                    <summary style={{fontSize:'12px', color:'#7861a9'}}>Additional Memento context ({item.prior_explanations.length - 1})</summary>
                    <div style={{marginTop:'8px', display:'grid', gap:'6px'}}>
                      {item.prior_explanations.slice(1).map((exp, idx) => (
                        <div key={idx} style={{padding:'8px', background:'#fff', borderRadius:'6px', fontSize:'11px', color:'#524d62'}}>
                          {exp}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
      <ChatWidget customerId={customer || 'retail-001'} />
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)
