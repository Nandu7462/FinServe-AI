import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquare, Send, X, Bot, User, Sparkles, ShieldCheck,
  ShieldAlert, RefreshCw, ChevronDown, CheckCircle2, Bookmark
} from 'lucide-react'

const QUICK_PROMPTS = [
  "What is the Platinum Debit Card annual fee?",
  "How can I get my card annual fee waived?",
  "When is the scheduled banking maintenance window?",
  "What features are included in Everyday Savings Account?",
  "Can bank staff ask me for my Net Banking OTP?"
]

const WELCOME_MESSAGE = {
  id: 'welcome-01',
  role: 'assistant',
  content: `👋 **Welcome to Harborline Bank Customer Support!**\n\nI am your **FinServe AI Assistant**, powered by Gemini and grounded in official notices and approved policy memories.\n\nHow can I help you today? You can ask about:\n• Card fee revisions & waiver conditions\n• Scheduled maintenance & digital banking availability\n• Account perks & statement downloads`,
  citations: [
    {
      type: 'Harborline Policy',
      title: 'FinServe Grounded AI Directory',
      reference: 'Verified Notice & Memento Store',
      details: 'Instant access to active product disclosures and waiver policies.'
    }
  ],
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatWidget({ customerId = 'retail-001' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen, loading])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  async function handleSend(textToSend) {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const userMsg = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      })

      if (!response.ok) {
        throw new Error('Support service is temporarily busy. Please try again.')
      }

      const data = await response.json()
      const botMsg = {
        id: 'msg-bot-' + Date.now(),
        role: 'assistant',
        content: data.reply || 'Thank you for your inquiry. Please reach out to customer support at 1800-HARBORLINE.',
        citations: data.citations || [],
        source: data.source || 'grounded',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, botMsg])
    } catch (err) {
      setError(err.message || 'Unable to connect to support assistant.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setMessages([WELCOME_MESSAGE])
    setError('')
  }

  function renderFormattedContent(text) {
    // Simple, clean markdown-like line renderer
    const lines = text.split('\n')
    return (
      <div className="chat-content-flow">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="chat-spacer" />
          
          let formatted = line
          // Headers
          if (line.startsWith('### ')) {
            return <div key={idx} className="chat-h3">{line.replace('### ', '')}</div>
          }
          if (line.startsWith('## ')) {
            return <div key={idx} className="chat-h2">{line.replace('## ', '')}</div>
          }
          
          // Bullets
          const isBullet = line.trim().startsWith('• ') || line.trim().startsWith('- ')
          const cleanLine = isBullet ? line.trim().substring(2) : line

          // Bold segments
          const parts = cleanLine.split(/(\*\*.*?\*\*)/g)

          return (
            <div key={idx} className={isBullet ? 'chat-bullet-row' : 'chat-text-row'}>
              {isBullet && <span className="chat-bullet-dot">•</span>}
              <span className="chat-text-line">
                {parts.map((p, pIdx) => {
                  if (p.startsWith('**') && p.endsWith('**')) {
                    return <strong key={pIdx}>{p.slice(2, -2)}</strong>
                  }
                  return p
                })}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* Floating Chat Launcher Button */}
      {!isOpen && (
        <button
          className="chat-floating-trigger"
          onClick={() => setIsOpen(true)}
          aria-label="Open 24/7 Customer Support Chat"
        >
          <div className="trigger-pulse-indicator" />
          <MessageSquare size={20} className="trigger-icon" />
          <div className="trigger-label">
            <span className="trigger-title">Harborline Support</span>
            <span className="trigger-subtitle">Powered by Gemini AI</span>
          </div>
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="chat-widget-container" role="dialog" aria-label="Customer Support Chat">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-title-group">
              <div className="chat-avatar-shield">
                <Bot size={20} />
              </div>
              <div>
                <div className="chat-header-title">
                  <span>FinServe Support AI</span>
                  <span className="chat-model-badge">Gemini</span>
                </div>
                <div className="chat-header-status">
                  <span className="status-online-dot" /> Grounded in Notices & Memento
                </div>
              </div>
            </div>
            <div className="chat-header-actions">
              <button
                type="button"
                className="chat-header-btn"
                onClick={handleReset}
                title="Restart conversation"
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                className="chat-header-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Anti-Phishing Security Banner */}
          <div className="chat-security-banner">
            <ShieldAlert size={14} className="security-icon" />
            <span>
              <strong>Security Note:</strong> Harborline Bank will never ask for your PIN, OTP, password, or CVV.
            </span>
          </div>

          {/* Quick Prompts Bar */}
          <div className="chat-quick-prompts-bar">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                className="chat-prompt-pill"
                onClick={() => handleSend(prompt)}
                disabled={loading}
              >
                <Sparkles size={11} className="pill-icon" />
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Messages Body */}
          <div className="chat-messages-area" ref={scrollRef}>
            {messages.map((m) => {
              const isAssistant = m.role === 'assistant'
              return (
                <div
                  key={m.id}
                  className={`chat-bubble-row ${isAssistant ? 'assistant-row' : 'user-row'}`}
                >
                  {isAssistant && (
                    <div className="bubble-avatar-assistant" title="Harborline AI">
                      <ShieldCheck size={16} />
                    </div>
                  )}

                  <div className={`chat-bubble ${isAssistant ? 'assistant-bubble' : 'user-bubble'}`}>
                    {renderFormattedContent(m.content)}

                    {/* Grounded Citations Box */}
                    {isAssistant && m.citations && m.citations.length > 0 && (
                      <div className="chat-citations-card">
                        <div className="citations-header">
                          <CheckCircle2 size={12} className="cit-check" />
                          <span>Grounded in Official Records</span>
                        </div>
                        <div className="citations-list">
                          {m.citations.map((c, cIdx) => (
                            <div key={cIdx} className="citation-item">
                              <span className="citation-badge">{c.type || 'Notice'}</span>
                              <div className="citation-text">
                                <span className="citation-title">{c.title}</span>
                                {c.details && <span className="citation-details">{c.details}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bubble-timestamp">{m.timestamp}</div>
                  </div>

                  {!isAssistant && (
                    <div className="bubble-avatar-user" title="You">
                      <User size={16} />
                    </div>
                  )}
                </div>
              )
            })}

            {loading && (
              <div className="chat-bubble-row assistant-row">
                <div className="bubble-avatar-assistant">
                  <Bot size={16} />
                </div>
                <div className="chat-bubble assistant-bubble typing-bubble">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="typing-label">Consulting official notices & policies...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="chat-error-notice">
                <ShieldAlert size={14} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form
            className="chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about fees, waiver rules, maintenance..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="chat-text-input"
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={!input.trim() || loading}
              title="Send question"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
