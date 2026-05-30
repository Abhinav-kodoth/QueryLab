**Stack:**
- Frontend: React, Vite, D3.js, React Flow, CodeMirror
- Backend: Node.js, Express
- Database: PostgreSQL 16 with pg_stat_statements
- Queue: BullMQ + Redis
- Proxy: Nginx
- Containerization: Docker, Docker Compose
- SDK: dockerode (runtime container management)
- Hosting: Azure VM (Ubuntu 24.04)

---

## Features 

**Runtime container management**QueryLab uses Docker as a runtime feature. The backend programmatically spawns and destroys PostgreSQL containers using dockerode while the app is running. Each sandbox container has CPU and memory limits enforced via Docker

**Query plan parsing** — PostgreSQL's EXPLAIN (FORMAT JSON) returns a recursive tree structure. A recursive function walks every node looking for Sequential Scans, extracts filter conditions using regex, and generates index suggestions based on the actual columns being filtered.

**Container cleanup** — BullMQ stores delayed jobs in Redis. When a sandbox is created a cleanup job is scheduled 15 minutes out. Every query resets the timer. If the backend crashes and restarts, jobs survive in Redis and fire correctly when the backend comes back up.

---

## Running locally

**Prerequisites:** Docker Desktop, Node.js 20+, Git

```bash
git clone https://github.com/yourusername/querylab.git
cd querylab
docker compose up --build
```

Open http://localhost (frontend via Nginx) or http://localhost:5173 (direct).

**Environment variables** — copy and configure:
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

---

## Sandbox note

The sandbox feature spawns isolated PostgreSQL containers using the Docker socket. This requires a machine where you control the Docker daemon — it works locally and on a dedicated VM. 

---

## Project structure
```bash
querylab/
├── backend/
│   ├── index.js          # Express routes
│   ├── sandbox/
│   │   └── manager.js    # dockerode sandbox lifecycle
│   └── metrics/
│       └── index.js      # Prometheus metrics
├── frontend/
│   └── src/
│       ├── App.jsx           # Main editor
│       ├── PlanVisualizer.jsx # D3 query plan tree
│       ├── IndexAdvisor.jsx   # Index suggestions
│       ├── Sandbox.jsx        # Isolated sandbox UI
│       ├── SlowQueryDashboard.jsx
│       └── SchemaDesigner.jsx
├── nginx/
│   └── nginx.conf
├── prometheus/
│   └── prometheus.yml
├── grafana/
│   └── provisioning/
├── docker-compose.yml
└── init.sql
```

## What I learned

- How PostgreSQL executes queries internally — query planning, cost estimation, index selection
- Why indexes aren't always used (cardinality, cost model, planner statistics)
- Docker socket mounting and runtime container management
- BullMQ job queues for reliable async cleanup
- Nginx reverse proxy configuration and upstream routing
- Production deployment on a Linux VM — firewall rules, Docker socket security, environment variable management
