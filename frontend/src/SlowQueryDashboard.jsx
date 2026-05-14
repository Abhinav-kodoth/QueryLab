import { useState, useEffect } from 'react'
import axios from 'axios'

function CacheBar({ ratio }) {
  const pct = ratio ?? 0
  const color = pct > 90 ? '#22c55e' : pct > 70 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '4px', height: '6px', minWidth: '60px' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '4px' }} />
      </div>
      <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
        {pct ?? 'N/A'}%
      </span>
    </div>
  )
}

function SpeedBadge({ ms }) {
  const color = ms > 100 ? '#ef4444' : ms > 10 ? '#f59e0b' : '#22c55e'
  const bg = ms > 100 ? '#fee2e2' : ms > 10 ? '#fff7ed' : '#f0fdf4'
  return (
    <span style={{
      background: bg,
      color: color,
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500'
    }}>
      {ms}ms
    </span>
  )
}

export default function SlowQueryDashboard() {
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const fetchStats = () => {
    setLoading(true)
    axios.get('http://localhost:3000/stats/slow-queries')
      .then(res => setQueries(res.data.queries))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchStats() }, [])

  if (loading) return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      Loading query stats...
    </div>
  )

  if (error) return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#ef4444' }}>
      Error: {error}
    </div>
  )

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>Slow Query Dashboard</h2>
          <p style={{ fontSize: '12px', color: '#64748b' }}>
            Top 5 slowest queries from pg_stat_statements
          </p>
        </div>
        <button
          onClick={fetchStats}
          style={{
            padding: '6px 16px',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Refresh
        </button>
      </div>

      {queries.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '13px' }}>
          No query stats yet. Run some queries first.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {queries.map((q, i) => (
            <div
              key={i}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'white'
              }}
            >
              {/* Row header */}
              <div
                onClick={() => setExpanded(expanded === i ? null : i)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 80px 80px 120px',
                  gap: '12px',
                  padding: '12px 16px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: expanded === i ? '#f8fafc' : 'white'
                }}
              >
                {/* Query preview */}
                <div style={{
                  fontSize: '12px',
                  color: '#1e293b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {q.query}
                </div>

                {/* Avg time */}
                <SpeedBadge ms={q.avg_time_ms} />

                {/* Calls */}
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  {Number(q.calls).toLocaleString()} calls
                </div>

                {/* Rows */}
                <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                  {Number(q.rows).toLocaleString()} rows
                </div>

                {/* Cache hit */}
                <CacheBar ratio={q.cache_hit_ratio} />
              </div>

              {/* Expanded detail */}
              {expanded === i && (
                <div style={{
                  borderTop: '1px solid #e2e8f0',
                  padding: '12px 16px',
                  background: '#f8fafc'
                }}>
                  {/* Full query */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                      FULL QUERY
                    </div>
                    <pre style={{
                      background: '#1e293b',
                      color: '#94a3b8',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      overflowX: 'auto',
                      margin: 0,
                      whiteSpace: 'pre-wrap'
                    }}>
                      {q.query}
                    </pre>
                  </div>

                  {/* Stats grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px'
                  }}>
                    {[
                      { label: 'Avg Time', value: `${q.avg_time_ms}ms` },
                      { label: 'Min Time', value: `${q.min_time_ms}ms` },
                      { label: 'Max Time', value: `${q.max_time_ms}ms` },
                      { label: 'Total Time', value: `${q.total_time_ms}ms` },
                      { label: 'Total Calls', value: Number(q.calls).toLocaleString() },
                      { label: 'Total Rows', value: Number(q.rows).toLocaleString() },
                      { label: 'Cache Hit', value: `${q.cache_hit_ratio ?? 'N/A'}%` },
                      { label: 'Rows/Call', value: q.calls > 0 ? Math.round(q.rows / q.calls) : 0 },
                    ].map(stat => (
                      <div key={stat.label} style={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '8px 12px'
                      }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>
                          {stat.label}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '1.5rem', fontSize: '11px', color: '#94a3b8' }}>
        <span>🔴 &gt;100ms — slow</span>
        <span>🟡 10–100ms — moderate</span>
        <span>🟢 &lt;10ms — fast</span>
        <span style={{ marginLeft: 'auto' }}>Cache hit: higher is better</span>
      </div>
    </div>
  )
}