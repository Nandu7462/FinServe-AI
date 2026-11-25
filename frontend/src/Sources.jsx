import React, {useState} from 'react'
import {ArrowUpRight, BookOpen, Check, CircleAlert, Globe, Sparkles} from 'lucide-react'

export default function Sources({notices, busy, register, select}) {
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scrapeBank, setScrapeBank] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [extractedNotice, setExtractedNotice] = useState(null)

  // Manual or pre-filled form fields
  const [bank, setBank] = useState('Harborline Bank')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [product, setProduct] = useState('')
  const [category, setCategory] = useState('Fee')
  const [statement, setStatement] = useState('')

  async function handleScrape(e) {
    e.preventDefault()
    if (!scrapeUrl.trim()) return
    setScraping(true)
    setScrapeError('')
    try {
      const response = await fetch('/api/sources/scrape', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url: scrapeUrl.trim(), bank: scrapeBank.trim() || undefined})
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Failed to scrape webpage.')
      setExtractedNotice(data)
      setBank(data.bank || 'Financial Institution')
      setUrl(data.url || scrapeUrl.trim())
      setTitle(data.title || '')
      setProduct(data.product || '')
      setCategory(data.category || 'Product')
      setStatement(data.statement || '')
    } catch (err) {
      setScrapeError(err.message)
    } finally {
      setScraping(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    const payload = {bank, url, title, product, category, statement}
    const success = await register(payload)
    if (success) {
      setExtractedNotice(null)
      setUrl('')
      setTitle('')
      setProduct('')
      setStatement('')
    }
  }

  return <div className="layout">
    <div className="column">
      <section className="card">
        <div className="card-head">
          <div className="icon"><Globe size={18}/></div>
          <div>
            <h2>Scrape Public Notice with Firecrawl</h2>
            <p>Enter any public banking URL to automatically extract official product information and passages.</p>
          </div>
        </div>
        <form onSubmit={handleScrape} className="editor">
          <label>Public Webpage URL
            <input
              type="url"
              value={scrapeUrl}
              onChange={e => setScrapeUrl(e.target.value)}
              placeholder="https://www.nsandi.com/products/premium-bonds"
              disabled={scraping || busy}
              required
            />
          </label>
          <label>Institution Name <small>Optional</small>
            <input
              type="text"
              value={scrapeBank}
              onChange={e => setScrapeBank(e.target.value)}
              placeholder="e.g. NS&I, HDFC Bank, Barclays"
              disabled={scraping || busy}
            />
          </label>
          <button className="primary" disabled={scraping || busy || !scrapeUrl.trim()}>
            <Sparkles size={16}/> {scraping ? 'Scraping with Firecrawl…' : 'Scrape & Auto-Extract'}
          </button>
        </form>
        {scrapeError && <div role="alert" className="alert" style={{marginTop:'15px'}}><CircleAlert size={16}/>{scrapeError}</div>}
        {extractedNotice && (
          <div className="success" style={{marginTop:'15px'}}>
            <Check size={16}/> Successfully scraped using <strong>{extractedNotice.retriever}</strong>. Review and confirm the details below.
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="icon amber"><BookOpen size={18}/></div>
          <div>
            <h2>Register Verified Notice</h2>
            <p>Save verified passages for consistent AI customer communications.</p>
          </div>
        </div>
        <form className="editor" onSubmit={submit}>
          <div className="fields">
            <label>Institution
              <input value={bank} onChange={e => setBank(e.target.value)} required maxLength={120}/>
            </label>
            <label>Category
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {['Fee', 'Product', 'Service'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label>Official Document URL
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} required maxLength={2000}/>
          </label>
          <div className="fields">
            <label>Notice Title
              <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} placeholder="e.g. Debit Card Annual Fee Revision"/>
            </label>
            <label>Product or Service
              <input value={product} onChange={e => setProduct(e.target.value)} required maxLength={120} placeholder="e.g. Platinum Debit Card"/>
            </label>
          </div>
          <label>Exact Customer-Facing Passage
            <textarea
              value={statement}
              onChange={e => setStatement(e.target.value)}
              required
              maxLength={1500}
              rows={4}
              placeholder="Copy the exact sentence from the official page..."
            />
            <small>The verification engine ensures this exact statement is preserved in all drafted customer emails and SMS.</small>
          </label>
          <button className="primary" disabled={busy || scraping}>
            <Check size={16}/> {busy ? 'Verifying document…' : 'Verify & Register Notice'}
          </button>
        </form>
      </section>
    </div>

    <div className="column">
      <section className="card">
        <h2>Registered Notice Catalog</h2>
        <p className="panel-note" style={{marginBottom:'15px'}}>Notices currently available for drafting consistent communications.</p>
        <div style={{display:'grid', gap:'14px'}}>
          {notices.map(n => (
            <article className="source-entry" key={n.id || n.title} style={{padding:'14px', borderRadius:'10px', background:'#f8f9fc', border:'1px solid #e5e1ee'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px'}}>
                <small style={{fontWeight:650, color:'#62677c'}}>{n.bank} · <span className={'badge ' + (n.category || 'Fee').toLowerCase()}>{n.category || 'Fee'}</span></small>
                {n.url && <a href={n.url} target="_blank" rel="noreferrer" style={{fontSize:'12px'}}>Source <ArrowUpRight size={12}/></a>}
              </div>
              <h3 style={{margin:'0 0 6px', fontSize:'15px', color:'#303347'}}>{n.title}</h3>
              <p style={{fontSize:'13px', margin:'0 0 10px', color:'#52655c', lineHeight:1.5}}>
                "{n.statement || n.evidence || n.text}"
              </p>
              <button
                type="button"
                className="primary"
                style={{padding:'7px 12px', fontSize:'12px'}}
                onClick={() => select(n.id)}
              >
                Use in Draft Studio
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  </div>
}
