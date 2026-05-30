import { useState, useEffect } from 'react'
import api from './api'

export default function SandboxIndexAdvisor({ sessionId, sql }) {
  const [advice, setAdvice] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sql || !sessionId) return

    setLoading(true)
    setAdvice(null)
    setMessage(null)

    api.post('/sandbox/advise', { sessionId, sql })
      .then(res => {
        setAdvice(res.data.advice)
        setMessage(res.data.message)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))

  }, [sql, sessionId])
  // re-runs whenever sql or sessionId changes
  // so every new query triggers a fresh analysis

  if (loading) return (
    <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '1rem' }}>
      Analyzing query...
    </p>
  )

  if (message) return (
    <div style={{
      background: '#f0fdf4',
      border: '1px solid #86efac',
      borderRadius: '6px',
      padding: '1rem',
      color: '#166534',
      fontSize: '13px',
      marginTop: '1.5rem'
    }}>
      ✅ {message}
    </div>
  )

  if (!advice) return null

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>Index Advisor</h3>
      {advice.map((item, i) => (
        <div key={i} style={{
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ fontSize: '13px', color: '#9a3412', marginBottom: '0.5rem' }}>
            ⚠️ {item.reason}
          </div>

          <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '0.75rem' }}>
            Table: <strong>{item.table}</strong> ·
            Rows scanned: <strong>{item.rowsScanned?.toLocaleString()}</strong> ·
            Cost: <strong>{item.cost?.toFixed(2)}</strong>
          </div>

          {item.suggestedIndex && (
            <div>
              <div style={{ fontSize: '12px', color: '#78350f', marginBottom: '4px' }}>
                Suggested fix:
              </div>
              <code style={{
                display: 'block',
                background: '#1e293b',
                color: '#86efac',
                padding: '0.75rem',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {item.suggestedIndex}
              </code>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}