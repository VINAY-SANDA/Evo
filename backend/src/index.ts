import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getAiResponse, type AiContext } from './services/aiService.js';

// ── Route Imports ──
import goalsRouter from './routes/goals.js';
import tasksRouter from './routes/tasks.js';
import habitsRouter from './routes/habits.js';
import financeRouter from './routes/finance.js';
import learningRouter from './routes/learning.js';
import projectsRouter from './routes/projects.js';
import remindersRouter from './routes/reminders.js';
import notificationsRouter from './routes/notifications.js';
import progressRouter from './routes/progress.js';
import reviewsRouter from './routes/reviews.js';
import mcpRouter from './routes/mcp.js';
import authRouter from './routes/auth.js';
import personalLibraryRouter from './routes/personalLibrary.js';
import userExportRouter from './routes/userExport.js';
import { testConnection, query } from './db/connection.js';
import { DEFAULT_USER_ID, ensureDefaultUser } from './db/userHelper.js';
import { authenticateApiRequest, authenticateRequest } from './middleware/auth.js';
import { createEvoMcpOAuthRouter } from './routes/mcpOAuth.js';
import { ensureMcpOAuthTables } from './services/mcpOAuth.js';
import { ensureFeatureTables } from './services/featureMigrations.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
let backendReady = process.env.NODE_ENV === 'test';
let backendStartupMessage = 'EVO is preparing its database and required services.';

// Render terminates TLS and forwards requests through one trusted proxy hop.
// This lets rate limiters read the forwarded client IP without trusting headers locally.
if (process.env.RENDER === 'true') {
  app.set('trust proxy', 1);
}

// ── Middleware ──
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'mcp-session-id', 'x-requested-with'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Health Check ──
app.get('/api/health', async (_req: Request, res: Response) => {
  if (!backendReady) {
    return res.status(503).json({ status: 'starting', message: backendStartupMessage, system: 'EVO Personal AI Operating System API' });
  }
  try {
    await query('SELECT 1');
    res.json({
      status: 'online',
      system: 'EVO Personal AI Operating System API',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      routes: [
      'GET /api/health',
      'POST /api/ai/chat',
      'GET|POST /api/memories',
      'GET|POST|PATCH|DELETE /api/goals',
      'GET|POST|PATCH|DELETE /api/tasks',
      'GET|POST|PATCH|DELETE /api/habits',
      'GET|POST /api/finance/expenses',
      'GET|POST /api/finance/income',
      'GET|POST|PATCH /api/finance/savings',
      'GET /api/finance/summary',
      'GET /api/learning/subjects',
      'GET|POST /api/learning/subjects/:id/topics',
      'PATCH /api/learning/topics/:id',
      'GET|POST|PATCH /api/projects',
      'GET|POST|PATCH /api/projects/:id/milestones',
      'GET|POST|PATCH|DELETE /api/reminders',
      'GET|PATCH|DELETE /api/notifications',
      'GET /api/progress/scores',
      'GET|POST /api/reviews/daily',
      'GET|POST /api/reviews/weekly',
      ],
    });
  } catch {
    res.status(503).json({ status: 'starting', system: 'EVO Personal AI Operating System API' });
  }
});

// ── Route Mounts ──
app.use('/api/auth', authRouter);
app.use('/api', authenticateApiRequest);
app.use('/api/user/export', userExportRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/finance', financeRouter);
app.use('/api/learning', learningRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/library', personalLibraryRouter);

// ── MCP Server Endpoints (for Google Gemini & Remote AI Clients) ──
app.use(createEvoMcpOAuthRouter());
app.use('/mcp', authenticateRequest);
app.use('/sse', authenticateRequest);
app.use('/mcp', mcpRouter);
app.use('/api/mcp', mcpRouter);
app.use('/sse', mcpRouter);

// ── AI Conversation & Strategy ──
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body;

  let allowAiContext = false;
  let savedTone: AiContext['tone'] = 'rigorous';
  try {
    const preference = await query('SELECT ai_context_enabled, ai_tone FROM users WHERE id = $1', [DEFAULT_USER_ID]);
    allowAiContext = preference.rows[0]?.ai_context_enabled === true;
    savedTone = preference.rows[0]?.ai_tone || 'rigorous';
  } catch (err) {
    console.warn('Could not query EVO AI privacy preferences:', err);
  }

  let activeGoals: any[] = [];
  let todayTasks: any[] = [];
  let userHabits: any[] = [];
  let storedMemories: string[] = [];
  let monthlySavings = { income: 0, expenses: 0, net: 0 };
  if (allowAiContext) {
    try {
      const [goalsRes, tasksRes, habitsRes, memsRes, finRes] = await Promise.all([
      query('SELECT title, progress, deadline FROM goals WHERE user_id = $1 AND status = $2 LIMIT 5', [DEFAULT_USER_ID, 'active']),
      query('SELECT title, status, priority FROM tasks WHERE user_id = $1 AND due_date = CURRENT_DATE LIMIT 5', [DEFAULT_USER_ID]),
      query('SELECT name, current_streak FROM habits WHERE user_id = $1 AND active = true LIMIT 5', [DEFAULT_USER_ID]),
      query('SELECT text FROM memories WHERE user_id = $1 ORDER BY importance DESC LIMIT 5', [DEFAULT_USER_ID]),
      query(
        `SELECT
           COALESCE((SELECT SUM(amount) FROM incomes WHERE user_id = $1 AND date >= date_trunc('month', CURRENT_DATE) AND date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'), 0) as income,
           COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = $1 AND date >= date_trunc('month', CURRENT_DATE) AND date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'), 0) as expense`,
        [DEFAULT_USER_ID]
      ),
      ]);
      activeGoals = goalsRes.rows.map((g: any) => ({ title: g.title, progress: Number(g.progress) || 0, deadline: g.deadline }));
      todayTasks = tasksRes.rows.map((t: any) => ({ title: t.title, status: t.status, priority: t.priority }));
      userHabits = habitsRes.rows.map((h: any) => ({ name: h.name, currentStreak: Number(h.current_streak) || 0, completedToday: false }));
      storedMemories = memsRes.rows.map((m: any) => m.text);
      const inc = Number(finRes.rows[0]?.income) || 0;
      const exp = Number(finRes.rows[0]?.expense) || 0;
      monthlySavings = { income: inc, expenses: exp, net: inc - exp };
    } catch (err) {
      console.warn('Could not query opted-in EVO AI context:', err);
    }
  }

  const liveContext: AiContext = allowAiContext ? context || {
    userName: 'Vinay',
    tone: savedTone,
    activeGoals,
    todayTasks,
    habits: userHabits,
    monthlySavings,
    memories: storedMemories,
  } : {
    userName: 'the user',
    tone: savedTone,
    activeGoals: [],
    todayTasks: [],
    habits: [],
    monthlySavings: { income: 0, expenses: 0, net: 0 },
    memories: [],
  };

  const response = await getAiResponse(message || '', liveContext);

  res.json({
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: response.reply,
    actions: response.actions,
    timestamp: new Date().toISOString(),
  });
});

// ── Memory Vector Store ──
app.get('/api/memories', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, text, memory_type, importance, created_at, updated_at FROM memories WHERE user_id = $1 ORDER BY importance DESC, created_at DESC',
      [DEFAULT_USER_ID]
    );
    const mapped = result.rows.map((row: any) => ({
      id: row.id,
      text: row.text,
      type: row.memory_type,
      importance: Number(row.importance) || 7,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    res.json({ memories: mapped, total: mapped.length });
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

app.post('/api/memories', async (req: Request, res: Response) => {
  try {
    const { text, type, importance } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const result = await query(
      `INSERT INTO memories (user_id, text, memory_type, importance)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [DEFAULT_USER_ID, text, type || 'preference', Number(importance) || 7]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      text: row.text,
      type: row.memory_type,
      importance: Number(row.importance) || 7,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Error creating memory:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

app.patch('/api/memories/:id', async (req: Request, res: Response) => {
  try {
    const { text, type, importance } = req.body;
    if (text !== undefined && !String(text).trim()) return res.status(400).json({ error: 'text is required' });
    const result = await query(`UPDATE memories SET text = COALESCE($1, text), memory_type = COALESCE($2, memory_type),
      importance = COALESCE($3, importance), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5 RETURNING id, text, memory_type as type, importance, created_at as "createdAt", updated_at as "updatedAt"`,
    [text === undefined ? null : String(text).trim(), type || null, importance === undefined ? null : Math.max(1, Math.min(10, Number(importance) || 7)), req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Memory not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating memory:', error);
    res.status(500).json({ error: 'Failed to update memory' });
  }
});

app.delete('/api/memories/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM memories WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, DEFAULT_USER_ID]);
    if (!result.rowCount) return res.status(404).json({ error: 'Memory not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

// ── User Profile ──
app.get('/api/user/profile', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, name, email, timezone, ai_tone, ai_context_enabled FROM users WHERE id = $1',
      [DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.json({
        id: DEFAULT_USER_ID,
        name: 'Vinay',
        email: 'vinay@example.com',
        timezone: 'Asia/Kolkata',
        aiTone: 'rigorous',
        aiContextEnabled: true,
      });
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      timezone: u.timezone || 'Asia/Kolkata',
      aiTone: u.ai_tone || 'rigorous',
      aiContextEnabled: u.ai_context_enabled !== false,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.patch('/api/user/profile', async (req: Request, res: Response) => {
  try {
    const { name, email, timezone, aiTone, aiContextEnabled } = req.body;
    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           timezone = COALESCE($3, timezone),
           ai_tone = COALESCE($4, ai_tone),
           ai_context_enabled = COALESCE($5, ai_context_enabled),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, name, email, timezone, ai_tone, ai_context_enabled`,
      [name || null, email || null, timezone || null, aiTone || null, typeof aiContextEnabled === 'boolean' ? aiContextEnabled : null, DEFAULT_USER_ID]
    );
    const u = result.rows[0];
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      timezone: u.timezone,
      aiTone: u.ai_tone,
      aiContextEnabled: u.ai_context_enabled !== false,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// ── Dashboard Summary (Homepage) ──
app.get('/api/dashboard', async (_req: Request, res: Response) => {
  try {
    // 1. User
    const userRes = await query('SELECT id, name, email, timezone, ai_tone FROM users WHERE id = $1', [DEFAULT_USER_ID]);
    const user = userRes.rows[0] ? {
      id: userRes.rows[0].id,
      name: userRes.rows[0].name,
      email: userRes.rows[0].email,
      timezone: userRes.rows[0].timezone,
      aiTone: userRes.rows[0].ai_tone,
    } : {
      id: DEFAULT_USER_ID,
      name: 'Vinay',
      email: 'vinay@example.com',
      timezone: 'Asia/Kolkata',
      aiTone: 'rigorous',
    };

    // 2. Today's task stats
    const taskStatsRes = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM tasks WHERE user_id = $1 AND due_date = CURRENT_DATE`,
      [DEFAULT_USER_ID]
    );
    const tasksTotal = Number(taskStatsRes.rows[0]?.total) || 0;
    const tasksCompleted = Number(taskStatsRes.rows[0]?.completed) || 0;

    // 3. Habits stats
    const habitsRes = await query(
      `SELECT
         COUNT(*) as total,
         (SELECT COUNT(DISTINCT habit_id) FROM habit_logs hl JOIN habits h ON hl.habit_id = h.id WHERE h.user_id = $1 AND hl.log_date = CURRENT_DATE AND hl.completed = true) as completed_today
       FROM habits WHERE user_id = $1 AND active = true`,
      [DEFAULT_USER_ID]
    );
    const totalHabits = Number(habitsRes.rows[0]?.total) || 0;
    const habitsCompleted = Number(habitsRes.rows[0]?.completed_today) || 0;

    // 4. Today spend
    const spendRes = await query(
      'SELECT COALESCE(SUM(amount), 0) as spend FROM expenses WHERE user_id = $1 AND date = CURRENT_DATE',
      [DEFAULT_USER_ID]
    );
    const todaySpend = Number(spendRes.rows[0]?.spend) || 0;

    // 5. Top streaks
    const streaksRes = await query(
      'SELECT name, current_streak, icon FROM habits WHERE user_id = $1 AND active = true ORDER BY current_streak DESC LIMIT 3',
      [DEFAULT_USER_ID]
    );
    const topStreaks = streaksRes.rows.map((r: any) => ({
      name: r.name,
      streak: Number(r.current_streak) || 0,
      icon: r.icon || '🔥',
    }));

    // 6. Overall score
    const taskPct = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;
    const habitPct = totalHabits > 0 ? (habitsCompleted / totalHabits) * 100 : 0;
    const hasActivity = tasksTotal > 0 || totalHabits > 0;
    const overallScore = hasActivity
      ? Math.round((taskPct + habitPct) / (tasksTotal > 0 && totalHabits > 0 ? 2 : 1))
      : 0;

    const remainingTasks = Math.max(0, tasksTotal - tasksCompleted);
    const aiInsight = remainingTasks > 0
      ? `Good day, ${user.name}. You have ${remainingTasks} task${remainingTasks > 1 ? 's' : ''} remaining today. Focus on your highest-priority items to maintain your momentum.`
      : totalHabits > 0 || tasksTotal > 0
      ? `All planned execution for today is up to date, ${user.name}. Continue building consistent momentum.`
      : `Welcome to EVO, ${user.name}. Initialize your first goals, habits, and tasks to begin tracking execution velocity.`;

    res.json({
      user,
      overallScore: Math.min(100, Math.max(0, overallScore)),
      weeklyChange: 0,
      todayStats: {
        tasksCompleted,
        totalTasks: tasksTotal,
        habitsCompleted,
        totalHabits,
        todaySpend,
      },
      topStreaks,
      aiInsight,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export { app };

// Keep imports side-effect free so the complete HTTP app can be exercised by tests.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 EVO Backend Server online at http://localhost:${PORT}`);
    console.log(`📋 Readiness endpoint available at http://localhost:${PORT}/api/health`);
    void initializeBackend();
  });
}

async function initializeBackend(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  try {
    if (!process.env.EVO_AUTH_SECRET || (isProduction && !process.env.EVO_MASTER_PASSCODE)) {
      backendStartupMessage = 'EVO authentication is not configured on the server.';
      console.error(backendStartupMessage);
      return;
    }
    if (isProduction) {
      if (!process.env.DATABASE_URL?.trim()) {
        backendStartupMessage = 'DATABASE_URL is missing. Add the Render Postgres connection URL to the backend service.';
        console.error(backendStartupMessage);
        return;
      }
      if (!process.env.CORS_ORIGIN?.split(',').some(origin => origin.trim())) {
        backendStartupMessage = 'The deployment must configure CORS_ORIGIN with the exact web app address.';
        console.error(backendStartupMessage);
        return;
      }
    }
    if (!await testConnection()) throw new Error('Database connection is unavailable.');
    await ensureDefaultUser();
    await ensureFeatureTables();
    await ensureMcpOAuthTables();
    backendReady = true;
    backendStartupMessage = 'EVO is ready.';
    console.log('✅ EVO backend is ready; database and required migrations are available.');
  } catch (error) {
    backendReady = false;
    backendStartupMessage = 'EVO is waiting for the database and schema setup to finish.';
    console.error('EVO startup is not ready:', error instanceof Error ? error.message : error);
    setTimeout(() => { void initializeBackend(); }, 5000).unref();
  }
}
