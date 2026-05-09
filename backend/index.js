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

app.listen(process.env.PORT, () => {
  console.log(`Server running on http://localhost:${process.env.PORT}`)
})