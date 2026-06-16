# QueryLab

A self-hosted SQL playground that exposes PostgreSQL internals visually — query plan trees, index advisor, slow query analytics, isolated sandboxes, and schema designer.

**Live Demo:** http://98.70.98.138

---

## What it does

Most developers write SQL queries without seeing what the database actually does to execute them. QueryLab makes that visible.

- Write a query → see the execution plan as a color-coded tree
- Get automatic index suggestions when a sequential scan is detected
- Experiment in an isolated PostgreSQL container that auto-destroys after 15 minutes
- Design schemas visually with foreign key relationships and schema issue detection
- Monitor slow queries with execution stats pulled from pg_stat_statements

---

## Features

**SQL Editor**
Write and execute SQL queries against a real PostgreSQL database with syntax highlighting.

**Query Plan Visualizer**
Every SELECT query automatically runs EXPLAIN ANALYZE behind the scenes. The execution plan is parsed and rendered as a D3.js tree — each node shows its operation type, actual execution time, and rows processed. Slow nodes are highlighted in red, fast nodes in green.

**Index Advisor**
After every query the plan tree is walked recursively to detect sequential scans. When found, the advisor extracts the filter columns from the plan's Filter node and generates the exact CREATE INDEX statement that would fix it. Before/after comparison shows the plan change visually.

**Slow Query Dashboard**
Pulls from pg_stat_statements to show the top 10 slowest queries — average execution time, call count, cache hit ratio, and min/max timing. Expandable rows show full query text and detailed stats.

**Isolated Sandbox**
Each user gets a fresh PostgreSQL container spawned on demand via dockerode (Docker SDK for Node.js). Queries run in complete isolation — one user's DROP TABLE never affects another. Containers are automatically destroyed after 15 minutes of inactivity using BullMQ job queues backed by Redis.

**Schema Designer**
Visual drag-and-drop ERD builder using React Flow. Add tables, define columns with types, mark primary keys, draw foreign key relationships. Detects structural issues (duplicate columns, missing primary keys), transitive dependencies, and derived value anti-patterns. Exports valid CREATE TABLE SQL with foreign key constraints.

---

## Architecture

```bash
Browser
│
▼
Nginx (port 80) ─── reverse proxy
│
├── /api/*  ──→  Express backend (Node.js)
│                    │
│                    ├── PostgreSQL (persistent data)
│                    ├── Redis + BullMQ (sandbox cleanup jobs)
│                    └── Docker socket (sandbox container spawning)
│
└── /*  ──→  React frontend (Vite)

```

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
git clone https://github.com/Abhinav-kodoth/querylab.git
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
