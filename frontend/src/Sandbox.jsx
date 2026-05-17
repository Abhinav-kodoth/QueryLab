import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import axios from 'axios'

export default function Sandbox() {
  const [sessionId, setSessionId] = useState(null)
  const [query, setQuery] = useState('CREATE TABLE test (id SERIAL PRIMARY KEY, name TEXT);\nINSERT INTO test (name) VALUES (\'hello\'), (\'world\');\nSELECT * FROM test;')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const createSandbox = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await axios.post('http://localhost:3000/sandbox/create')
      setSessionId(res.data.sessionId)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create sandbox')
    } finally {
      setCreating(false)
    }
  }

  const runQuery = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await axios.post('http://localhost:3000/sandbox/query', {
        sessionId,
        sql: query
      })
      setResults(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Query failed')
    } finally {
      setLoading(false)
    }
  }

  const destroySandbox = async () => {
    try {
      await axios.delete(`http://localhost:3000/sandbox/${sessionId}`)
      setSessionId(null)
      setResults(null)
    } catch (err) {
      setError('Failed to destroy sandbox')
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>Isolated Sandbox</h2>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '1.5rem' }}>
        Each sandbox is a fresh isolated PostgreSQL container. 
        Your queries only affect your sandbox. Auto-destroys after 15 min idle.
      </p>

      {/* No session yet */}
      {!sessionId && (
        <button
          onClick={createSandbox}
          disabled={creating}
          style={{
            padding: '10px 24px',
            background: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: creating ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {creating ? 'Spawning container...' : 'Create Sandbox'}
        </button>
      )}

      {/* Active session */}
      {sessionId && (
        <div>
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '1rem',
            fontSize: '12px',
            color: '#166534',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🟢 Sandbox active — Session: {sessionId.slice(0, 8)}...</span>
            <button
              onClick={destroySandbox}
              style={{
                background: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                borderRadius: '4px',
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Destroy
            </button>
          </div>

          <div style={{ border: '1px solid #ccc', borderRadius: '6px', marginBottom: '1rem' }}>
            <CodeMirror
              value={query}
              height="180px"
              extensions={[sql()]}
              onChange={(val) => setQuery(val)}
            />
          </div>

          <button
            onClick={runQuery}
            disabled={loading}
            style={{
              padding: '8px 24px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              marginBottom: '1.5rem'
            }}
          >
            {loading ? 'Running...' : 'Run in Sandbox'}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '1rem',
          color: '#b91c1c',
          fontSize: '13px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results && results.fields && results.fields.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '0.5rem' }}>Results — {results.rowCount} rows</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {results.fields.map(f => (
                    <th key={f} style={{ background: '#f1f5f9', padding: '8px 12px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                    {results.fields.map(f => (
                      <td key={f} style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>
                        {String(row[f])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (!results.fields || results.fields.length === 0) && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '6px',
          padding: '1rem',
          color: '#166534',
          fontSize: '13px'
        }}>
          ✅ Query executed. {results.rowCount} rows affected.
        </div>
      )}
    </div>
  )
}