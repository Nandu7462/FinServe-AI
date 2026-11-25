import React, {useMemo, useState} from 'react'
import {checkText, protectedPhrases, wordLimit} from './readability.mjs'

export default function Readability({item, subject, body, onChange, busy}) {
  const [undo, setUndo] = useState(null)
  const {findings, next} = useMemo(() => {
    const language = item.language || item.preference?.language || 'English'
    const protectedText = protectedPhrases(item)
    const title = checkText(subject, language, protectedText)
    const message = checkText(body, language, protectedText)
    return {
      findings: [
        ...title.findings.map(f => ({...f, field:'Subject'})),
        ...message.findings.map(f => ({...f, field:'Message'})),
      ],
      next: {subject:title.simplified, body:message.simplified},
    }
  }, [item, subject, body])
  const canApply = next.subject !== subject || next.body !== body
  const canUndo = undo && undo.after.subject === subject && undo.after.body === body
  return <section className="readability" aria-label="Readability check">
    <div className="readability-heading">
      <h3>Readability check</h3>
      <button type="button" className="primary" disabled={busy || !canApply} onClick={() => {
        setUndo({before:{subject, body}, after:next})
        onChange(next)
      }}>Simplify</button>
      {canUndo && <button type="button" disabled={busy} onClick={() => {
        onChange(undo.before); setUndo(null)
      }}>Undo</button>}
    </div>
    {findings.length ? <>
      <p className="panel-note">Review jargon and sentences over {wordLimit} words. Simplify applies available edits and keeps official passages intact.</p>
      <ul>{findings.map((f, i) => <li key={i}>
        <strong>{f.field} · {f.kind}</strong> — {f.text} <small>({f.note})</small>
      </li>)}</ul>
      {!canApply && <p className="panel-note">Review the remaining flags manually.</p>}
    </> : <p className="panel-note" role="status">No matching jargon or long sentences found.</p>}
  </section>
}
