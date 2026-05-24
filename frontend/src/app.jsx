import { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import axios from 'axios'
import './App.css'
import PlanVisualizer from './PlanVisualizer'
import IndexAdvisor from './IndexAdvisor'
import SlowQueryDashboard from './SlowQueryDashboard'
import Sandbox from './Sandbox'
import SchemaDesigner from './SchemaDesigner'

function NavBar() {
  const location = useLocation()

  const linkStyle = (path) => ({
    textDecoration: 'none',
    fontSize: '14px',
    fontFamily: 'monospace',
    color: location.pathname === path ? '#2563eb' : '#64748b',
    fontWeight: location.pathname === path ? '600' : '400',
    borderBottom: location.pathname === path ? '2px solid #2563eb' : '2px solid transparent',
    paddingBottom: '4px'
  })

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2rem',
      marginBottom: '2rem',
      borderBottom: '1px solid #e2e8f0',
      paddingBottom: '1rem'
    }}>
      <h1 style={{ margin: 0, fontFamily: 'monospace' }}>QueryLab</h1>
      <Link to="/" style={linkStyle('/')}>Editor</Link>
      <Link to="/dashboard" style={linkStyle('/dashboard')}>Slow Queries</Link>
      <Link to="/sandbox" style={linkStyle('/sandbox')}>Sandbox</Link>
      <Link to="/schema" style={linkStyle('/schema')}>Schema</Link>
    </div>
  )
}

function Editor() {
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(null)
  const [lastQuery, setLastQuery] = useState(null)

  const isSelect = (q) => q.trim().toLowerCase().startsWith('select')

  const runQuery = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    setPlan(null)
    setLastQuery(null)

    try {
      const res = await axios.post('http://localhost:3000/query', { sql: query })
      setResults(res.data)

      if (isSelect(query)) {
        setLastQuery(query)
        const explainRes = await axios.post('http://localhost:3000/explain', { sql: query })
        setPlan(explainRes.data.plan)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
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
        <div style={{
          background: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#b91c1c'
        }}>
          {error}
        </div>
      )}

      {/* DDL success message */}
      {results && (!results.fields || results.fields.length === 0) && (
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '6px',
          padding: '1rem',
          color: '#166534',
          fontSize: '13px',
          marginBottom: '1.5rem'
        }}>
          ✅ Query executed successfully. {results.rowCount} rows affected.
        </div>
      )}

      {/* Results Table */}
      {results && results.fields && results.fields.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Results — {results.rowCount} rows</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {results.fields.map(f => (
                    <th key={f} style={{
                      background: '#f1f5f9',
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      textAlign: 'left'
                    }}>
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

      {plan && <PlanVisualizer plan={plan} />}
      {lastQuery && <IndexAdvisor sql={lastQuery} />}
    </div>
  )
}

function App() {
  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'monospace',
      maxWidth: '1000px',
      margin: '0 auto'
    }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<Editor />} />
        <Route path="/dashboard" element={<SlowQueryDashboard />} />
        <Route path="/sandbox" element={<Sandbox />} />
        <Route path="/schema" element={<SchemaDesigner />} />
      </Routes>
    </div>
  )
}

export default App