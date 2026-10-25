const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.EVO_MASTER_PASSCODE = 'Vinay@2026';
process.env.EVO_AUTH_SECRET = 'test-only-evo-auth-secret';
process.env.EVO_MCP_TOKEN = 'test-only-evo-mcp-token';
process.env.GEMINI_API_KEY = '';

const { app } = require('../dist/index.js');
const { pool } = require('../dist/db/connection.js');
const { DEFAULT_USER_ID } = require('../dist/db/userHelper.js');

const OWNED_ID = '11111111-1111-4111-8111-111111111111';
const FOREIGN_ID = '22222222-2222-4222-8222-222222222222';
const baseRow = {
  id: OWNED_ID,
  user_id: DEFAULT_USER_ID,
  userId: DEFAULT_USER_ID,
  title: 'EVO_E2E_fixture',
  name: 'EVO_E2E_fixture',
  text: 'EVO_E2E_fixture',
  description: 'EVO_E2E_fixture',
  type: 'daily',
  memory_type: 'preference',
  amount: 100,
  category: 'other',
  date: '2030-01-02',
  due_date: '2030-01-02',
  dueDate: '2030-01-02',
  due_time: '09:00',
  dueTime: '09:00',
  time: '09:00',
  days_of_week: [],
  active: true,
  completedToday: true,
  status: 'todo',
  priority: 'medium',
  goal_id: OWNED_ID,
  goalId: OWNED_ID,
  project_id: OWNED_ID,
  projectId: OWNED_ID,
  subject_id: OWNED_ID,
  subjectId: OWNED_ID,
  target_value: 100,
  current_value: 25,
  targetAmount: 1000,
  currentAmount: 100,
  unit: '%',
  progress: 25,
  difficulty: 'medium',
  time_spent_minutes: 30,
  importance: 7,
  score: 50,
  overall_score: 50,
  completed_tasks: 1,
  total_tasks: 2,
  completed_habits: 1,
  total_habits: 2,
  date: '2030-01-02',
  week_start: '2030-01-01',
  week_end: '2030-01-07',
  created_at: new Date('2030-01-01T00:00:00.000Z'),
  updated_at: new Date('2030-01-01T00:00:00.000Z'),
  timezone: 'Asia/Kolkata',
  ai_tone: 'balanced',
  email: 'vinay@example.com',
  completed: false,
  total: 0,
  count: 0,
  completed_today: 0,
  spend: 0,
  income: 0,
  expense: 0,
  avg_prog: 0,
  streak_score: 0,
  current_streak: 0,
  longest_streak: 0,
  estimated_minutes: 30,
  is_recurring: false,
  is_ai_generated: false,
  total_topics: 1,
  completed_topics: 0,
  total_time_minutes: 30,
  category_scores: [],
  what_went_well: [],
  what_went_wrong: [],
  suggestions: [],
  next_week_priorities: [],
};

test('authenticated API feature journeys work across EVO modules', async (t) => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params = []) => {
    calls.push({ sql: String(sql), params });
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    const mentionsForeignId = params.some(value => value === FOREIGN_ID);

    if (mentionsForeignId && /^(SELECT|UPDATE|DELETE|WITH)/i.test(normalized)) {
      return { rows: [], rowCount: 0 };
    }
    if (/^WITH (new_task|updated_goal|owned_goal)/i.test(normalized)) {
      return { rows: [{ ...baseRow, isRecurring: true, recurrenceFrequency: 'daily' }], rowCount: 1 };
    }
    if (/SELECT completed FROM habit_logs/i.test(normalized)) {
      return { rows: [], rowCount: 0 };
    }
    if (/SELECT id FROM habits WHERE id = \$1 AND user_id = \$2/i.test(normalized)) {
      return { rows: [{ id: OWNED_ID }], rowCount: 1 };
    }
    if (/^DELETE FROM learning_topics/i.test(normalized)) {
      return { rows: [{ id: OWNED_ID, subjectId: OWNED_ID }], rowCount: 1 };
    }
    if (/SELECT .* FROM (goals|reminders|learning_topics)/i.test(normalized) && /WHERE .*\$1/i.test(normalized)) {
      return { rows: [{ ...baseRow, target_value: 100, current_value: 25, subject_id: OWNED_ID }], rowCount: 1 };
    }
    if (/COUNT\(|SUM\(|AVG\(|FILTER \(/i.test(normalized)) {
      return { rows: [{ ...baseRow }], rowCount: 1 };
    }
    if (/^(INSERT|UPDATE|DELETE)/i.test(normalized)) {
      return { rows: [{ ...baseRow }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const server = await new Promise((resolve) => {
    const runningServer = app.listen(0, '127.0.0.1', () => resolve(runningServer));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let token = '';

  async function request(path, options = {}) {
    const { method = 'GET', body } = options;
    const authorization = Object.prototype.hasOwnProperty.call(options, 'authorization')
      ? options.authorization
      : token ? `Bearer ${token}` : undefined;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    return { status: response.status, data, headers: response.headers };
  }

  try {
    await t.test('health, login, and session protection', async () => {
      assert.equal((await request('/api/health', { authorization: undefined })).status, 200);
      assert.equal((await request('/api/tasks', { authorization: undefined })).status, 401);
      assert.equal((await request('/api/auth/login', {
        method: 'POST', authorization: undefined, body: {},
      })).status, 400);
      assert.equal((await request('/api/auth/login', {
        method: 'POST', authorization: undefined,
        body: { email: 'vinay@example.com', passcode: 'incorrect' },
      })).status, 401);
      assert.equal((await request('/api/auth/login', {
        method: 'POST', authorization: undefined,
        body: { email: 'someone-else@example.com', passcode: 'Vinay@2026' },
      })).status, 401);
      const login = await request('/api/auth/login', {
        method: 'POST',
        authorization: undefined,
        body: { email: 'vinay@example.com', passcode: 'Vinay@2026' },
      });
      assert.equal(login.status, 200);
      assert.ok(login.data.token);
      token = login.data.token;
      assert.equal((await request('/api/auth/verify')).status, 200);
    });

    await t.test('dashboard, AI coach, and memories', async () => {
      assert.equal((await request('/api/dashboard')).status, 200);
      const coach = await request('/api/ai/chat', { method: 'POST', body: { message: 'Plan today' } });
      assert.equal(coach.status, 200);
      assert.equal(coach.data.role, 'assistant');
      assert.match(coach.data.content, /GEMINI_API_KEY/);
      assert.equal((await request('/api/memories')).status, 200);
      assert.equal((await request('/api/memories', { method: 'POST', body: { text: 'EVO_E2E_fixture' } })).status, 201);
    });

    await t.test('goals, progress, milestones, and deletion', async () => {
      assert.equal((await request('/api/goals')).status, 200);
      assert.equal((await request('/api/goals', { method: 'POST', body: { title: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/goals/${OWNED_ID}`)).status, 200);
      assert.equal((await request(`/api/goals/${OWNED_ID}`, { method: 'PATCH', body: { progress: 40 } })).status, 200);
      assert.equal((await request(`/api/goals/${OWNED_ID}/milestones`)).status, 200);
      assert.equal((await request(`/api/goals/${OWNED_ID}/milestones`, { method: 'POST', body: { title: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/goals/milestones/${OWNED_ID}/toggle`, { method: 'PATCH' })).status, 200);
      assert.equal((await request(`/api/goals/milestones/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/goals/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/goals/milestones/${FOREIGN_ID}/toggle`, { method: 'PATCH' })).status, 404);
    });

    await t.test('tasks and Today view endpoint', async () => {
      assert.equal((await request('/api/tasks')).status, 200);
      assert.equal((await request('/api/tasks/today')).status, 200);
      assert.equal((await request('/api/tasks', { method: 'POST', body: { title: 'EVO_E2E_fixture' } })).status, 201);
      const recurringTask = await request('/api/tasks', { method: 'POST', body: { title: 'EVO_E2E_fixture repeat', recurrenceFrequency: 'weekdays', projectId: OWNED_ID } });
      assert.equal(recurringTask.status, 201);
      assert.match(calls.at(-1).sql, /recurrence_frequency/);
      assert.match(calls.at(-1).sql, /project_id/);
      assert.equal((await request(`/api/tasks/${OWNED_ID}/toggle`, { method: 'POST' })).status, 200);
      assert.equal((await request(`/api/tasks/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/tasks/${FOREIGN_ID}/toggle`, { method: 'POST' })).status, 404);
    });

    await t.test('habits and owner check before logging', async () => {
      assert.equal((await request('/api/habits')).status, 200);
      const activeHabitRead = calls.at(-1);
      assert.match(activeHabitRead.sql, /h\.active = TRUE/i);
      assert.equal((await request('/api/habits?includeArchived=true')).status, 200);
      assert.equal((await request('/api/habits', { method: 'POST', body: { name: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/habits/${OWNED_ID}/complete`, { method: 'POST' })).status, 200);
      assert.equal((await request(`/api/habits/${OWNED_ID}/archive`, { method: 'PATCH' })).status, 200);
      assert.equal(calls.at(-1).params[0], false);
      assert.equal((await request(`/api/habits/${OWNED_ID}/restore`, { method: 'PATCH' })).status, 200);
      assert.equal(calls.at(-1).params[0], true);
      assert.equal((await request(`/api/habits/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.match(calls.at(-1).sql, /DELETE FROM habits WHERE id = \$1 AND user_id = \$2/i);
      assert.deepEqual(calls.at(-1).params, [OWNED_ID, DEFAULT_USER_ID]);
      assert.equal((await request(`/api/habits/${FOREIGN_ID}`, { method: 'DELETE' })).status, 404);
      const beforeForeignHabit = calls.length;
      assert.equal((await request(`/api/habits/${FOREIGN_ID}/complete`, { method: 'POST' })).status, 404);
      assert.equal(calls.slice(beforeForeignHabit).some(call => /habit_logs/i.test(call.sql)), false);
    });

    await t.test('finance income, expenses, and savings', async () => {
      const summary = await request('/api/finance/summary');
      assert.equal(summary.status, 200);
      assert.ok(summary.data.summary);
      assert.equal(summary.data.summary.totalIncome, 0);
      assert.equal((await request('/api/finance/expenses')).status, 200);
      assert.equal((await request('/api/finance/expenses', { method: 'POST', body: { amount: -1 } })).status, 400);
      assert.equal((await request('/api/finance/expenses', { method: 'POST', body: { amount: 50, description: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request('/api/finance/income')).status, 200);
      assert.equal((await request('/api/finance/income', { method: 'POST', body: { amount: 0 } })).status, 400);
      assert.equal((await request('/api/finance/income', { method: 'POST', body: { amount: 100, source: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/finance/income/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.match(calls.at(-1).sql, /DELETE FROM incomes WHERE id = \$1 AND user_id = \$2/i);
      assert.deepEqual(calls.at(-1).params, [OWNED_ID, DEFAULT_USER_ID]);
      assert.equal((await request(`/api/finance/income/${FOREIGN_ID}`, { method: 'DELETE' })).status, 404);
      assert.equal((await request('/api/finance/savings')).status, 200);
      assert.equal((await request('/api/finance/savings', { method: 'POST', body: { title: 'Invalid', targetAmount: 0 } })).status, 400);
      assert.equal((await request('/api/finance/savings', { method: 'POST', body: { title: 'EVO_E2E_fixture', targetAmount: 1000 } })).status, 201);
      assert.equal((await request(`/api/finance/savings/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.match(calls.at(-1).sql, /DELETE FROM savings_goals WHERE id = \$1 AND user_id = \$2/i);
      assert.deepEqual(calls.at(-1).params, [OWNED_ID, DEFAULT_USER_ID]);
      assert.equal((await request(`/api/finance/savings/${FOREIGN_ID}`, { method: 'DELETE' })).status, 404);
      assert.equal((await request(`/api/finance/expenses/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.match(calls.at(-1).sql, /DELETE FROM expenses WHERE id = \$1 AND user_id = \$2/i);
      assert.deepEqual(calls.at(-1).params, [OWNED_ID, DEFAULT_USER_ID]);
      assert.equal((await request(`/api/finance/expenses/${FOREIGN_ID}`, { method: 'DELETE' })).status, 404);
      assert.equal((await request('/api/finance/budgets?month=2030-01')).status, 200);
      assert.equal((await request('/api/finance/budgets', { method: 'PUT', body: { category: 'food', month: '2030-01', limitAmount: 5000, alertPercent: 75 } })).status, 201);
      assert.match(calls.at(-1).sql, /ON CONFLICT \(user_id, category, month\)/);
      assert.equal((await request(`/api/finance/budgets/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/finance/savings/${OWNED_ID}/contributions`, { method: 'POST', body: { amount: 200, note: 'EVO_E2E_fixture' } })).status, 201);
      assert.match(calls.at(-1).sql, /INSERT INTO savings_contributions/);
      assert.equal((await request(`/api/finance/savings/${OWNED_ID}/contributions`)).status, 200);
    });

    await t.test('learning subjects, topics, and statistics', async () => {
      assert.equal((await request('/api/learning/subjects')).status, 200);
      assert.equal((await request('/api/learning/subjects', { method: 'POST', body: { name: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/learning/subjects/${OWNED_ID}/topics`)).status, 200);
      assert.equal((await request(`/api/learning/subjects/${OWNED_ID}/topics`, { method: 'POST', body: { name: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/learning/topics/${OWNED_ID}`, { method: 'PATCH', body: { status: 'completed' } })).status, 200);
      assert.equal((await request(`/api/learning/topics/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/learning/topics/${FOREIGN_ID}`, { method: 'DELETE' })).status, 404);
      assert.equal((await request('/api/learning/stats')).status, 200);
      assert.equal((await request('/api/learning/study-sessions')).status, 200);
      assert.equal((await request('/api/learning/study-sessions', { method: 'POST', body: { subjectId: OWNED_ID, topicId: OWNED_ID, durationMinutes: 25 } })).status, 201);
      assert.match(calls.at(-1).sql, /learning_study_sessions/);
      assert.equal((await request(`/api/learning/topics/${FOREIGN_ID}`, { method: 'PATCH', body: { status: 'completed' } })).status, 404);
      assert.equal((await request(`/api/learning/subjects/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/learning/subjects/${FOREIGN_ID}`, { method: 'DELETE' })).status, 404);
    });

    await t.test('projects and milestones', async () => {
      assert.equal((await request('/api/projects')).status, 200);
      assert.equal((await request('/api/projects', { method: 'POST', body: { name: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/projects/${OWNED_ID}/milestones`)).status, 200);
      assert.equal((await request(`/api/projects/${OWNED_ID}/milestones`, { method: 'POST', body: { title: 'EVO_E2E_fixture' } })).status, 201);
      assert.equal((await request(`/api/projects/milestones/${OWNED_ID}/toggle`, { method: 'PATCH' })).status, 200);
      assert.equal((await request(`/api/projects/milestones/${FOREIGN_ID}/toggle`, { method: 'PATCH' })).status, 404);
    });

    await t.test('goal check-ins and flexible habit summaries', async () => {
      assert.equal((await request(`/api/goals/${OWNED_ID}/check-ins`, { method: 'POST', body: { currentValue: 30, note: 'EVO_E2E_fixture' } })).status, 201);
      assert.match(calls.at(-1).sql, /INSERT INTO goal_check_ins/);
      assert.equal((await request(`/api/goals/${OWNED_ID}/check-ins`)).status, 200);
      assert.equal((await request('/api/habits/summary/weekly')).status, 200);
      const customHabit = await request('/api/habits', { method: 'POST', body: { name: 'EVO_E2E_fixture custom', frequency: 'custom', scheduleDays: [1, 3, 5] } });
      assert.equal(customHabit.status, 201);
      assert.match(calls.at(-1).sql, /schedule_days/);
      assert.deepEqual(calls.at(-1).params[6], [1, 3, 5]);
    });

    await t.test('reminders and notifications', async () => {
      assert.equal((await request('/api/reminders')).status, 200);
      assert.equal((await request('/api/reminders', { method: 'POST', body: { title: 'EVO_E2E_fixture', time: '09:00' } })).status, 201);
      assert.equal((await request(`/api/reminders/${OWNED_ID}`, { method: 'PATCH', body: { active: false } })).status, 200);
      assert.equal((await request(`/api/reminders/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/reminders/${FOREIGN_ID}`, { method: 'PATCH', body: { active: false } })).status, 404);
      assert.equal((await request('/api/notifications')).status, 200);
      assert.equal((await request('/api/notifications/read-all', { method: 'PATCH' })).status, 200);
      assert.equal((await request(`/api/notifications/${OWNED_ID}/read`, { method: 'PATCH' })).status, 200);
      assert.equal((await request(`/api/notifications/${OWNED_ID}`, { method: 'DELETE' })).status, 204);
      assert.equal((await request(`/api/notifications/${FOREIGN_ID}/read`, { method: 'PATCH' })).status, 404);
    });

    await t.test('progress and daily/weekly reviews', async () => {
      assert.equal((await request('/api/progress/scores')).status, 200);
      assert.equal((await request('/api/progress/summary')).status, 200);
      assert.equal((await request('/api/reviews/daily')).status, 200);
      assert.equal((await request('/api/reviews/daily', { method: 'POST', body: { date: '2030-01-02', totalTasks: 1 } })).status, 201);
      assert.equal((await request('/api/reviews/weekly')).status, 200);
      assert.equal((await request('/api/reviews/weekly', { method: 'POST', body: { weekStart: '2030-01-01', weekEnd: '2030-01-07' } })).status, 201);
    });

    await t.test('profile and MCP access', async () => {
      assert.equal((await request('/api/user/profile')).status, 200);
      assert.equal((await request('/api/user/profile', { method: 'PATCH', body: { aiTone: 'balanced' } })).status, 200);
      const oauthChallenge = await request('/mcp/info', { authorization: undefined });
      assert.equal(oauthChallenge.status, 401);
      assert.match(oauthChallenge.headers.get('www-authenticate'), /resource_metadata=.*oauth-protected-resource\/mcp/);
      const resourceMetadata = await request('/.well-known/oauth-protected-resource/mcp', { authorization: undefined });
      assert.equal(resourceMetadata.status, 200);
      assert.ok(resourceMetadata.data.authorization_servers.length > 0);
      assert.equal((await request('/mcp/info', { authorization: 'Bearer test-only-evo-mcp-token' })).status, 200);
      assert.equal((await request('/api/unknown', { authorization: 'Bearer test-only-evo-mcp-token' })).status, 401);
    });

    assert.ok(calls.length > 40, `expected broad feature coverage; only observed ${calls.length} SQL calls`);
    assert.ok(calls.some(call => /user_id = \$1|user_id = \$2|user_id = \$8/.test(call.sql) && call.params.includes(DEFAULT_USER_ID)), 'expected user-scoped SQL queries');
  } finally {
    pool.query = originalQuery;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
