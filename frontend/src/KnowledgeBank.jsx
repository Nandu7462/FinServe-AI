import React, {useEffect, useState} from 'react'
import {Check, CircleAlert, LibraryBig, Lock, Plus, Search, Sparkles, Tag, User} from 'lucide-react'

export default function KnowledgeBank({user, mode}) {
  const isDrafter = user?.role === 'drafter' || mode === 'approved'
  const isCompliance = user?.role === 'compliance' || mode === 'rules'
  const canManageRules = user?.role === 'compliance'
  const [memories, setMemories] = useState([])
  const [preferences, setPreferences] = useState([])
  const [filter, setFilter] = useState('all') // 'all', 'explanation', 'preference'
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Add Memory Form state
  const bank = 'HDFC Bank'
  const [product, setProduct] = useState('')
  const [category, setCategory] = useState('Fee')
  const [explanation, setExplanation] = useState('')
  const [reusableWording, setReusableWording] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [memRes, prefRes] = await Promise.all([
        fetch('/api/memories').then(r => r.json()),
        fetch('/api/preferences').then(r => r.json())
      ])
      setMemories(memRes)
      setPreferences(prefRes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleAddExplanation(e) {
    e.preventDefault()
    if (!product.trim() || !explanation.trim()) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          bank: bank.trim(),
          product: product.trim(),
          category,
          explanation: explanation.trim(),
          reusable_wording: reusableWording.trim()
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.detail || 'Failed to save explanation.')
      setMessage('Approved explanation saved to Memento successfully!')
      setProduct('')
      setExplanation('')
      setReusableWording('')
      loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMemories = memories.filter(m => {
    if (filter === 'explanation' && m.kind !== 'explanation') return false
    if (filter === 'preference' && m.kind !== 'preference') return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const text = JSON.stringify(m).toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })

  return <div className="layout">
    <div className="column">
      <section className="card">
        <div className="card-head">
          <div className="icon lilac"><LibraryBig size={18}/></div>
          <div>
            <h2>Memento Memory Explorer</h2>
            <p>Approved explanations and customer preferences stored in Memento to guarantee consistent communications.</p>
          </div>
        </div>

        <div style={{display:'flex', gap:'10px', alignItems:'center', marginBottom:'16px'}}>
          <div style={{position:'relative', flex:1}}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Memento memories (e.g. product, service, wording)..."
              style={{paddingLeft:'36px'}}
            />
            <Search size={16} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#62677c'}}/>
          </div>
          <div style={{display:'flex', gap:'6px'}}>
            {['all', 'explanation', 'preference'].map(type => (
              <button
                key={type}
                className={filter === type ? 'primary' : ''}
                style={{
                  padding:'8px 12px',
                  fontSize:'12px',
                  borderRadius:'8px',
                  border: filter === type ? 'none' : '1px solid #dad6e6',
                  background: filter === type ? '#315dcc' : '#fff',
                  color: filter === type ? '#fff' : '#303347'
                }}
                onClick={() => setFilter(type)}
              >
                {type === 'all' ? 'All' : type === 'explanation' ? 'Approved Explanations' : 'Preferences'}
              </button>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="alert"><CircleAlert size={16}/>{error}</div>}
        {message && <div role="status" className="success"><Check size={16}/>{message}</div>}

        <div style={{display:'grid', gap:'14px', marginTop:'10px'}}>
          {filteredMemories.length === 0 ? (
            <div className="empty">
              <LibraryBig size={28}/>
              <strong>No matching memories found in Memento</strong>
              <p>Add an approved explanation or save customer preferences to populate Memento.</p>
            </div>
          ) : (
            filteredMemories.map(m => (
              <article
                key={m.id || Math.random()}
                style={{
                  padding:'16px',
                  borderRadius:'12px',
                  background:'#fff',
                  border:'1px solid #e5e1ee',
                  boxShadow:'0 2px 6px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                  <span style={{display:'flex', alignItems:'center', gap:'8px'}}>
                    <span className={'badge ' + (m.kind === 'explanation' ? (m.category || 'fee').toLowerCase() : 'approved')}>
                      {m.kind === 'explanation' ? (m.category || 'Explanation') : 'Customer Profile'}
                    </span>
                    <strong style={{fontSize:'14px', color:'#303347'}}>
                      {m.kind === 'explanation' ? `${m.bank} · ${m.product}` : `Customer: ${m.name ? `${m.name} (${m.customer})` : m.customer}`}
                    </strong>
                  </span>
                  <small style={{color:'#62677c', fontSize:'11px'}}>
                    {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Active'}
                  </small>
                </div>

                {m.kind === 'explanation' ? (
                  <>
                    <p style={{fontSize:'13px', margin:'0 0 8px', color:'#303347', lineHeight:1.5}}>
                      {m.explanation}
                    </p>
                    {m.reusable_wording && (
                      <div style={{padding:'8px 12px', background:'#f8f5ff', borderRadius:'8px', fontSize:'12px', color:'#244cae', marginBottom:'8px'}}>
                        <strong>Reusable clause:</strong> {m.reusable_wording}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{fontSize:'13px', color:'#303347', display:'flex', gap:'8px', flexWrap:'wrap', margin:'6px 0'}}>
                    <span style={{padding:'3px 8px', background:'#eef4ff', color:'#244cae', borderRadius:'6px', fontWeight:600, fontSize:'11.5px'}}>
                      🌐 {m.language || 'English'}
                    </span>
                    <span style={{padding:'3px 8px', background:'#f0fdf4', color:'#166534', borderRadius:'6px', fontWeight:600, fontSize:'11.5px'}}>
                      📬 {m.channel || 'Email'}
                    </span>
                    <span style={{padding:'3px 8px', background:'#faf5ff', color:'#6b21a8', borderRadius:'6px', fontWeight:600, fontSize:'11.5px'}}>
                      🎭 {m.tone || 'Friendly'}
                    </span>
                    <span style={{padding:'3px 8px', background:'#fffbeb', color:'#92400e', borderRadius:'6px', fontWeight:600, fontSize:'11.5px'}}>
                      🏷️ {m.tier || 'Retail'}
                    </span>
                  </div>
                )}

                {m.tags && (
                  <div style={{display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'8px'}}>
                    {m.tags.map(t => (
                      <span key={t} style={{fontSize:'10px', background:'#eef2f6', color:'#48658a', padding:'2px 6px', borderRadius:'4px'}}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>

    <div className="column">
      {canManageRules ? (
        <section className="card">
          <div className="card-head">
            <div className="icon amber"><Plus size={18}/></div>
            <div>
              <h2>Add Approved Explanation</h2>
              <p>Teach Memento new standard phrasing for financial notices to ensure consistent drafting across your team.</p>
            </div>
          </div>

          <form onSubmit={handleAddExplanation} className="editor">
            <div className="fields">
              <label>Institution
                <input value={bank} readOnly required maxLength={120}/>
              </label>
              <label>Category
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="Fee">Fee</option>
                  <option value="Product">Product</option>
                  <option value="Service">Service</option>
                </select>
              </label>
            </div>

            <label>Product or Service
              <input
                value={product}
                onChange={e => setProduct(e.target.value)}
                placeholder="Product named in the source"
                required
                maxLength={120}
              />
            </label>

            <label>Standard Approved Explanation
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                placeholder="Explain the reason for the fee revision, feature upgrade, or maintenance window..."
                rows={4}
                required
                maxLength={1500}
              />
              <small>This approved explanation is retrieved by the AI to maintain consistency with past communications.</small>
            </label>

            <label>Reusable Closing / Waiver Clause <small>Optional</small>
              <textarea
                value={reusableWording}
                onChange={e => setReusableWording(e.target.value)}
                placeholder="Enter previously approved wording"
                rows={2}
                maxLength={400}
              />
            </label>

            <button className="primary" disabled={submitting || !product.trim() || !explanation.trim()}>
              <Sparkles size={16}/> {submitting ? 'Saving to Memento…' : 'Save to Memento'}
            </button>
          </form>
        </section>
      ) : (
        <section className="card">
          <div className="card-head">
            <div className="icon"><Lock size={18}/></div>
            <div>
              <h2>Compliance Governance Gate</h2>
              <p>Segregation of Duties Enforcement</p>
            </div>
          </div>
          <div className="panel-note" style={{padding:'16px', background:'#fbf9ee', border:'1px solid #f2e2b6', borderRadius:'10px', color:'#785210', lineHeight:1.6}}>
            <Lock size={16} style={{verticalAlign:'middle', marginRight:'6px'}}/>
            <strong>Read-Only Approved Library:</strong> As a <strong>Communications Drafter</strong>, you can view and reference approved explanations and customer preferences to guide drafts. Modifying or adding compliance rules requires a compliance officer’s authorization.
          </div>
          <div style={{marginTop:'16px', padding:'12px', background:'#f8f9fc', borderRadius:'8px', border:'1px solid #e2e8f0', fontSize:'12.5px', color:'#475569'}}>
            <strong>Segregation of Duties Rule:</strong><br/>
            • <em>Can:</em> Create, edit and submit drafts<br/>
            • <em>Cannot:</em> Approve messages or change rules
          </div>
        </section>
      )}
    </div>
  </div>
}
