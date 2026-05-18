const Docker = require('dockerode')
const { Queue, Worker } = require('bullmq')
const { v4: uuidv4 } = require('uuid')
const { Pool } = require('pg')

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379
}

const cleanupQueue = new Queue('sandbox-cleanup', { connection: redisConnection })

// sessionId → { containerId, port, pool, createdAt }
const activeSessions = new Map()


async function getFreePort() {
  return new Promise((resolve, reject) => {
    const net = require('net')
    const server = net.createServer()
    server.listen(0, () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

async function createSandbox(sessionId) {
  try {
    const port = await getFreePort()
    const password = uuidv4()

    // Pull image (skipped if already cached)
    await new Promise((resolve, reject) => {
      docker.pull('postgres:16-alpine', (err, stream) => {
        if (err) return reject(err)
        docker.modem.followProgress(stream, (err, output) => {
          if (err) return reject(err)
          resolve(output)
        })
      })
    })

    // Create isolated container with resource limits
    const container = await docker.createContainer({
      Image: 'postgres:16-alpine',
      Env: [
        `POSTGRES_PASSWORD=${password}`,
        'POSTGRES_DB=sandbox'
      ],
      HostConfig: {
        PortBindings: {
          '5432/tcp': [{ HostPort: String(port) }]
        },
        Memory: 256 * 1024 * 1024, // 256MB RAM limit
        CpuPeriod: 100000,
        CpuQuota: 50000             // 50% of one CPU core
      },
      ExposedPorts: { '5432/tcp': {} }
    })

    await container.start()

    // Poll until postgres inside the container is ready
    await waitForPostgres(port, password)

    // Connection pool pointing to this specific sandbox
    const pool = new Pool({
      host: 'host.docker.internal',
      port,
      user: 'postgres',
      password,
      database: 'sandbox',
      max: 3
    })

    // Store session info in memory
    activeSessions.set(sessionId, {
      containerId: container.id,
      port,
      password,
      pool,
      createdAt: new Date()
    })

    // Schedule auto-cleanup after 15 min idle
    await scheduleCleanup(sessionId)

    console.log(`Sandbox created: ${sessionId} on port ${port}`)
    return { sessionId, port }

  } catch (err) {
    console.error(`createSandbox failed: ${err.message}`)
    throw err
  }
}

// Poll every 1s until postgres accepts connections (max 30 attempts)
async function waitForPostgres(port, password) {
  const maxAttempts = 30
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const testPool = new Pool({
        host: 'host.docker.internal',
        port,
        user: 'postgres',
        password,
        database: 'sandbox',
        connectionTimeoutMillis: 1000
      })
      await testPool.query('SELECT 1')
      await testPool.end()
      return
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error('Sandbox postgres failed to start in time')
}

// Reset the 15min TTL — removes old job and adds a fresh one
async function scheduleCleanup(sessionId) {
  const existingJob = await cleanupQueue.getJob(sessionId)
  if (existingJob) await existingJob.remove()

  await cleanupQueue.add(
    'cleanup',
    { sessionId },
    {
      jobId: sessionId,
      delay: 15 * 60 * 1000
    }
  )
}

async function destroySandbox(sessionId) {
  const session = activeSessions.get(sessionId)
  if (!session) return

  try {
    await session.pool.end()
    const container = docker.getContainer(session.containerId)
    await container.stop()
    await container.remove()
    activeSessions.delete(sessionId)
    console.log(`Sandbox destroyed: ${sessionId}`)
  } catch (err) {
    console.error(`destroySandbox failed for ${sessionId}: ${err.message}`)
  }
}

// Returns pool and resets TTL timer on every query
async function getSandboxPool(sessionId) {
  const session = activeSessions.get(sessionId)
  if (!session) return null
  await scheduleCleanup(sessionId)
  return session.pool
}

// BullMQ worker — fires when TTL expires, kills the container
const cleanupWorker = new Worker('sandbox-cleanup', async (job) => {
  await destroySandbox(job.data.sessionId)
}, { connection: redisConnection })

cleanupWorker.on('failed', (job, err) => {
  console.error(`Cleanup job failed for ${job.data.sessionId}: ${err.message}`)
})

module.exports = { createSandbox, destroySandbox, getSandboxPool, activeSessions }