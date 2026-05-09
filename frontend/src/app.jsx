import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import axios from 'axios'
import './App.css'

function App() {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(null)

  const runQuery = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    setPlan(null)

    try {
      // Run the query
      const res = await axios.post('http://localhost:3000/query', { sql: query })
      setResults(res.data)

      // Also fetch the explain plan
      const explainRes = await axios.post('http://localhost:3000/explain', { sql: query })
      setPlan(explainRes.data.plan)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>QueryLab</h1>

      {/* SQL Editor */}
      <div style={{ border: '1px solid #ccc', borderRadius: '6px', marginBottom: '1rem' }}>
        <CodeMirror
          value={query}
          height="150px"
          extensions={[sql()]}
          onChange={(val) => setQuery(val)}
        />
      </div>

      {/* Run Button */}
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
          marginBottom: '1.5rem',
          fontSize: '14px'
        }}
      >
        {loading ? 'Running...' : 'Run Query'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', padding: '1rem', marginBottom: '1rem', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Results Table */}
      {results && (
        <div style={{ marginBottom: '2rem' }}>
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

      {/* Raw Plan — just show JSON for now, Day 4 makes this visual */}
      {plan && (
        <div>
          <h3 style={{ marginBottom: '0.5rem' }}>Query Plan (raw — visualizer coming Day 4)</h3>
          <pre style={{
            background: '#1e293b',
            color: '#94a3b8',
            padding: '1rem',
            borderRadius: '6px',
            fontSize: '12px',
            overflowX: 'auto',
            maxHeight: '300px'
          }}>
            {JSON.stringify(plan, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default App