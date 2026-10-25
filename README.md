# EVO — Personal AI Operating System

EVO is a comprehensive personal AI operating system built to manage and optimize life performance across multiple areas:
- 🎯 **Goals & Milestones**: Multi-year vision breakdown with progress tracking.
- ⚡ **Daily Tasks**: High-leverage task scheduling with priority and time estimates.
- 🔥 **Habit Loops**: Daily consistency tracker with streak preservation.
- 💰 **Personal Finance**: Income, expenses, category breakdowns, and goal-directed savings.
- 📊 **Progress & Life Mastery**: Holistic performance score index across life dimensions.
- 📖 **Learning Curriculum**: Technical tracks (Java, DSA, System Design, Spring Boot) with status workflows.
- 🚀 **Projects & Ventures**: Venture deliverables (Vyralabs, EVO App) with milestone roadmaps.
- ⏰ **Reminders & Nudges**: Context-aware scheduling alarms and triggers.
- 📝 **Reviews & Retrospectives**: Daily reflection scorecards & weekly strategic planning.
- ✨ **EVO AI Strategist**: Conversational agent that connects long-term vision to daily execution.
- 🧠 **Long-Term Memory Store**: Semantic vector knowledge store (`pgvector`) that remembers preferences and decisions.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, React Router 7, Vanilla CSS design system.
- **Backend**: Node.js, Express, TypeScript, REST API.
- **Database**: PostgreSQL with `pgvector` for vector similarity memory retrieval.

---

## 🚀 Quick Start Guide

### 1. Frontend Web App
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Backend API
```bash
cd backend
npm install
npm run dev
```
The API server runs on [http://localhost:5000](http://localhost:5000).

### 3. Database Setup (PostgreSQL + pgvector)
Run the SQL schema located at `backend/src/db/schema.sql` against your PostgreSQL database to initialize all tables, relations, and the vector cosine similarity index.

### 4. Backend Authentication
Set these environment variables for the backend before signing in:

- `EVO_MASTER_PASSCODE`: the owner passcode (local development defaults to `Vinay@2026`; production must set this value).
- `EVO_AUTH_SECRET`: a long, random secret used to sign seven-day sessions.
- `EVO_MCP_PUBLIC_URL`: the full public MCP URL, ending in `/mcp` (for example `https://your-backend.example.com/mcp`). Render deployments can use the service's `RENDER_EXTERNAL_URL` automatically.
- `EVO_MCP_TOKEN`: a separate secret used by the local stdio MCP bridge when it calls the backend API.
- `CORS_ORIGIN`: comma-separated frontend origins; local development defaults to `http://localhost:5173`.

The frontend also needs `VITE_API_URL` set to the backend origin when it is hosted separately. The remote Streamable HTTP MCP endpoint publishes OAuth discovery, dynamic client registration, and an authorization-code flow with PKCE. Gemini users approve access by entering the same EVO owner passcode used by the web app. Gemini must reach the MCP endpoint over public HTTPS; `localhost` works only for local clients running on the same machine. The stdio MCP bridge continues to use `EVO_MCP_TOKEN` for backend requests. Local login uses `Vinay@2026` unless `EVO_MASTER_PASSCODE` overrides it; production requires an explicitly configured passcode and `EVO_AUTH_SECRET`. Offline frontend login remains disabled.

Run the backend regression checks with `npm --prefix backend test`.
