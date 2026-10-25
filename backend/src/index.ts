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
import { testConnection, query } from './db/connection.js';
import { DEFAULT_USER_ID, ensureDefaultUser } from './db/userHelper.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('google.com') ||
      origin.includes('googleusercontent.com')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
}));
app.options('*', cors());
app.use(express.json());

// ── Health Check ──
app.get('/api/health', (_req: Request, res: Response) => {
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
});

// ── Route Mounts ──
app.use('/api/auth', authRouter);
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

// ── MCP Server Endpoints (for Google Gemini & Remote AI Clients) ──
app.use('/mcp', mcpRouter);
app.use('/api/mcp', mcpRouter);
app.use('/sse', mcpRouter);

// ── AI Conversation & Strategy ──
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  const { message, context } = req.body;

  let activeGoals: any[] = [];
  let todayTasks: any[] = [];
  let userHabits: any[] = [];
  let storedMemories: string[] = [];

  try {
    const goalsRes = await query('SELECT title, progress, deadline FROM goals WHERE user_id = $1 AND status = $2 LIMIT 5', [DEFAULT_USER_ID, 'active']);
    activeGoals = goalsRes.rows.map((g: any) => ({ title: g.title, progress: Number(g.progress) || 0, deadline: g.deadline }));

    const tasksRes = await query('SELECT title, status, priority FROM tasks WHERE user_id = $1 AND due_date = CURRENT_DATE LIMIT 5', [DEFAULT_USER_ID]);
    todayTasks = tasksRes.rows.map((t: any) => ({ title: t.title, status: t.status, priority: t.priority }));

    const habitsRes = await query('SELECT name, current_streak FROM habits WHERE user_id = $1 AND active = true LIMIT 5', [DEFAULT_USER_ID]);
    userHabits = habitsRes.rows.map((h: any) => ({ name: h.name, currentStreak: Number(h.current_streak) || 0, completedToday: false }));

    const memsRes = await query('SELECT text FROM memories WHERE user_id = $1 ORDER BY importance DESC LIMIT 5', [DEFAULT_USER_ID]);
    storedMemories = memsRes.rows.map((m: any) => m.text);
  } catch (err) {
    console.warn('Could not query DB for AI chat context, using fallback context:', err);
  }

  const liveContext: AiContext = context || {
    userName: 'Vinay',
    tone: 'rigorous',
    activeGoals: activeGoals.length > 0 ? activeGoals : [
      { title: 'Get Software Engineering Job', progress: 42, deadline: '2027-06-30' },
      { title: 'Master Java & Spring Boot', progress: 78, deadline: '2027-03-31' },
      { title: 'Launch Vyralabs', progress: 63, deadline: '2027-01-31' },
    ],
    todayTasks: todayTasks.length > 0 ? todayTasks : [
      { title: 'Solve 2 DSA problems — Trees', status: 'todo', priority: 'high' },
      { title: 'Study Java — Multithreading', status: 'completed', priority: 'high' },
      { title: 'Contact 5 prospects — Vyralabs', status: 'todo', priority: 'high' },
    ],
    habits: userHabits.length > 0 ? userHabits : [
      { name: 'DSA Practice', currentStreak: 14, completedToday: true },
      { name: 'Study Java', currentStreak: 21, completedToday: true },
      { name: 'Workout', currentStreak: 7, completedToday: false },
    ],
    monthlySavings: {
      income: 30000,
      expenses: 5900,
      net: 24100,
    },
    memories: storedMemories.length > 0 ? storedMemories : [
      'Prefers studying Java in the morning between 9-11 AM',
      'Focus on Trees and Graphs before DP in DSA',
      'Vyralabs target market is small businesses in education',
    ],
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

// ── User Profile ──
app.get('/api/user/profile', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, name, email, timezone, ai_tone FROM users WHERE id = $1',
      [DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.json({
        id: DEFAULT_USER_ID,
        name: 'Vinay',
        email: 'vinay@example.com',
        timezone: 'Asia/Kolkata',
        aiTone: 'rigorous',
      });
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      timezone: u.timezone || 'Asia/Kolkata',
      aiTone: u.ai_tone || 'rigorous',
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.patch('/api/user/profile', async (req: Request, res: Response) => {
  try {
    const { name, email, timezone, aiTone } = req.body;
    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           timezone = COALESCE($3, timezone),
           ai_tone = COALESCE($4, ai_tone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, email, timezone, ai_tone`,
      [name || null, email || null, timezone || null, aiTone || null, DEFAULT_USER_ID]
    );
    const u = result.rows[0];
    res.json({
      id: u.id,
      name: u.name,
      email: u.email,
      timezone: u.timezone,
      aiTone: u.ai_tone,
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
    const taskPct = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 75;
    const habitPct = totalHabits > 0 ? (habitsCompleted / totalHabits) * 100 : 80;
    const overallScore = Math.round((taskPct + habitPct) / 2);

    const remainingTasks = Math.max(0, tasksTotal - tasksCompleted);
    const aiInsight = remainingTasks > 0
      ? `Good day, ${user.name}. You have ${remainingTasks} task${remainingTasks > 1 ? 's' : ''} remaining today. Focus on your highest-priority items to maintain your momentum.`
      : `Excellent work, ${user.name}! You've completed your planned tasks for today. Continue building consistent habits.`;

    res.json({
      user,
      overallScore: Math.max(40, Math.min(100, overallScore)),
      weeklyChange: 7,
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

// ── Start Server ──
app.listen(PORT, async () => {
  console.log(`🚀 EVO Backend Server online at http://localhost:${PORT}`);
  console.log(`📋 API docs available at http://localhost:${PORT}/api/health`);
  const isDbConnected = await testConnection();
  if (isDbConnected) {
    console.log(`🐘 PostgreSQL: Connected & active`);
    await ensureDefaultUser();
  } else {
    console.log(`💡 PostgreSQL: Not detected (running with in-memory persistence)`);
  }
});
