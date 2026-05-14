const express = require('express')
const { Pool } = require('pg')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

// Connection pool to your Postgres container
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

// Test the connection on startup
pool.connect((err) => {
  if (err) {
    console.error('Failed to connect to database:', err.message)
  } else {
    console.log('Connected to PostgreSQL')
  }
})

// The main endpoint — takes SQL, returns results
app.post('/query', async (req, res) => {
  const { sql } = req.body

  if (!sql) {
    return res.status(400).json({ error: 'No SQL provided' })
  }

  try {
    const result = await pool.query(sql)
    res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => f.name)
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})


app.post('/explain', async (req, res) => {
  const { sql } = req.body

  if (!sql) {
    return res.status(400).json({ error: 'No SQL provided' })
  }

   const trimmed = sql.trim().toLowerCase()
  if (!trimmed.startsWith('select')) {
    return res.json({ 
      plan: null, 
      message: 'Query plan only available for SELECT statements.' 
    })
  }

  try {
    // EXPLAIN ANALYZE returns the plan as JSON — much easier to parse
    const explainSQL = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`
    const result = await pool.query(explainSQL)
    
    // The plan is nested inside result.rows[0]
    const plan = result.rows[0]['QUERY PLAN'][0]
    
    res.json({ plan })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})


// Recursively walk the plan tree and find Seq Scans
function findSeqScans(node, scans = []) {
  if (node['Node Type'] === 'Seq Scan') {
    scans.push({
      table: node['Relation Name'],
      rows: node['Actual Rows'],
      cost: node['Total Cost'],
      filter: node['Filter'] || null
    })
  }
  if (node['Plans']) {
    node['Plans'].forEach(child => findSeqScans(child, scans))
  }
  return scans
}


// Filter looks like: "(email = 'user50000@example.com')"
function extractColumns(filter) {
  if (!filter) return []
  const matches = filter.match(/\b([a-z_]+)\s*=/gi) || []
  return matches.map(m => m.replace(/\s*=.*/,'').trim())
}

app.post('/advise', async (req, res) => {
  const { sql } = req.body

  const trimmed = sql.trim().toLowerCase()
  if (!trimmed.startsWith('select')) {
    return res.json({
      advice: null,
      message: 'Index advisor only works on SELECT queries.'
    })
  }

  try {
    const explainSQL = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`
    const result = await pool.query(explainSQL)
    const plan = result.rows[0]['QUERY PLAN'][0]

    const seqScans = findSeqScans(plan['Plan'])

    if (seqScans.length === 0) {
      return res.json({
        advice: null,
        message: 'No sequential scans found. Query looks well optimized.'
      })
    }

    const suggestions = seqScans.map(scan => {
      const columns = extractColumns(scan.filter)
      return {
        table: scan.table,
        rowsScanned: scan.rows,
        cost: scan.cost,
        filter: scan.filter,
        suggestedIndex: columns.length > 0
          ? `CREATE INDEX idx_${scan.table}_${columns.join('_')} ON ${scan.table}(${columns.join(', ')});`
          : null,
        reason: columns.length > 0
          ? `Full table scan on ${scan.rows} rows. Adding an index on (${columns.join(', ')}) would allow Postgres to jump directly to matching rows.`
          : `Full table scan on ${scan.rows} rows. Check your WHERE clause columns.`
      }
    })

    res.json({ advice: suggestions })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/stats/slow-queries', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        query,
        calls,
        round(mean_exec_time::numeric, 2) AS avg_time_ms,
        round(total_exec_time::numeric, 2) AS total_time_ms,
        round(min_exec_time::numeric, 2) AS min_time_ms,
        round(max_exec_time::numeric, 2) AS max_time_ms,
        rows,
        round(100.0 * shared_blks_hit / 
          nullif(shared_blks_hit + shared_blks_read, 0), 2
        ) AS cache_hit_ratio
      FROM pg_stat_statements
      WHERE query NOT LIKE '%pg_stat_statements%' 
      AND query NOT LIKE '%EXPLAIN%'
      ORDER BY mean_exec_time DESC
      LIMIT 5
    `)
    res.json({ queries: result.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})




app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`)
})