const assert = require('node:assert/strict');
const test = require('node:test');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');

process.env.EVO_API_URL = 'http://127.0.0.1:1/api';
process.env.EVO_MCP_TOKEN = 'test-only-evo-mcp-token';

const { createEvoMcpServer } = require('../dist/mcp/geminiEvoMcpServer.js');

test('all registered MCP tools call the backend and return results', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    const path = new URL(String(url)).pathname;
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    requests.push({ path, method, body, authorization: options.headers?.Authorization, signal: options.signal });

    let result = {};
    if (path.endsWith('/dashboard')) result = { overallScore: 75, todayStats: { totalTasks: 1 } };
    else if (path.endsWith('/tasks') && method === 'GET') result = { tasks: [] };
    else if (path.endsWith('/tasks') && method === 'POST') result = { ...body, title: body.title, priority: body.priority, dueDate: body.dueDate };
    else if (/\/tasks\/.+\/toggle$/.test(path)) result = { title: 'EVO test task', status: 'completed' };
    else if (path.endsWith('/goals') && method === 'GET') result = { goals: [] };
    else if (path.endsWith('/goals') && method === 'POST') result = { ...body, title: body.title, category: body.category };
    else if (path.endsWith('/habits') && method === 'GET') result = { habits: [] };
    else if (path.endsWith('/habits') && method === 'POST') result = { ...body, id: '22222222-2222-4222-8222-222222222222' };
    else if (path.endsWith('/habits/22222222-2222-4222-8222-222222222222/archive')) result = { name: 'EVO test habit' };
    else if (path.endsWith('/habits/22222222-2222-4222-8222-222222222222/restore')) result = { name: 'EVO test habit' };
    else if (path.endsWith('/learning/subjects') && method === 'POST') result = { ...body, id: '33333333-3333-4333-8333-333333333333' };
    else if (/\/learning\/subjects\/.+\/topics$/.test(path) && method === 'POST') result = { ...body, name: body.name, id: '44444444-4444-4444-8444-444444444444' };
    else if (/\/learning\/topics\/.+$/.test(path) && method === 'PATCH') result = { name: 'EVO test topic', status: 'completed' };
    else if (/\/habits\/.+\/complete$/.test(path)) result = { name: 'EVO test habit', completedToday: true };
    else if (path.endsWith('/finance/summary')) result = { totalIncome: 100, totalExpenses: 20, netSavings: 80 };
    else if (path.endsWith('/finance/expenses')) result = { amount: body.amount, description: body.description, category: body.category };
    else if (path.endsWith('/memories') && method === 'GET') result = { memories: [] };
    else if (path.endsWith('/memories') && method === 'POST') result = { text: body.text };
    else if (path.endsWith('/ai/chat')) result = { content: 'EVO coach test response' };

    if (method === 'DELETE') return new Response(null, { status: 204 });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const server = createEvoMcpServer();
  const client = new Client({ name: 'evo-tool-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const catalog = await client.listTools();
    const expectedNames = [
      'evo_get_dashboard', 'evo_list_tasks', 'evo_create_task', 'evo_toggle_task',
      'evo_list_goals', 'evo_create_goal', 'evo_list_habits', 'evo_create_habit', 'evo_toggle_habit',
      'evo_get_finance_summary', 'evo_log_expense', 'evo_get_memories',
      'evo_add_memory', 'evo_consult_ai_coach',
      'evo_delete_habit', 'evo_archive_habit', 'evo_restore_habit', 'evo_list_income', 'evo_add_income',
      'evo_get_habit_weekly_summary',
      'evo_delete_income', 'evo_list_expenses', 'evo_delete_expense', 'evo_list_savings', 'evo_add_savings_goal',
      'evo_delete_savings_goal', 'evo_list_learning_tracks', 'evo_create_learning_track', 'evo_delete_learning_track',
      'evo_list_learning_topics', 'evo_add_learning_topic', 'evo_update_learning_topic', 'evo_delete_learning_topic',
      'evo_delete_task', 'evo_delete_goal',
      'evo_list_budgets', 'evo_set_budget', 'evo_delete_budget', 'evo_add_savings_contribution',
      'evo_list_savings_contributions', 'evo_log_study_session', 'evo_list_study_sessions',
      'evo_list_projects', 'evo_create_project', 'evo_list_project_milestones', 'evo_add_project_milestone',
      'evo_update_project', 'evo_delete_project', 'evo_toggle_project_milestone', 'evo_delete_project_milestone',
      'evo_list_reminders', 'evo_create_reminder', 'evo_update_reminder',
      'evo_delete_reminder', 'evo_get_daily_review', 'evo_save_daily_review', 'evo_get_weekly_review',
      'evo_save_weekly_review', 'evo_get_progress_scores', 'evo_list_notifications',
      'evo_mark_notification_read', 'evo_mark_all_notifications_read',
      'evo_delete_notification',
      'evo_list_diary_entries', 'evo_add_diary_entry', 'evo_delete_diary_entry',
      'evo_list_movie_reviews', 'evo_add_movie_review', 'evo_delete_movie_review',
      'evo_record_goal_check_in', 'evo_list_goal_check_ins',
    ];
    assert.deepEqual(catalog.tools.map(tool => tool.name).sort(), [...expectedNames].sort());

    const calls = [
      ['evo_get_dashboard', {}],
      ['evo_list_tasks', { status: 'all' }],
      ['evo_create_task', { title: 'EVO test task' }],
      ['evo_toggle_task', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_goals', {}],
      ['evo_create_goal', { title: 'EVO test goal' }],
      ['evo_list_habits', {}],
      ['evo_create_habit', {
        name: 'EVO test habit',
        description: 'MCP creation regression test',
        frequency: 'custom',
        scheduleDays: [1, 3, 5],
        target: 2,
        unit: 'times',
      }],
      ['evo_toggle_habit', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_get_habit_weekly_summary', {}],
      ['evo_delete_habit', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_archive_habit', { id: '22222222-2222-4222-8222-222222222222' }],
      ['evo_restore_habit', { id: '22222222-2222-4222-8222-222222222222' }],
      ['evo_get_finance_summary', {}],
      ['evo_log_expense', { amount: 20, category: 'food', description: 'EVO test expense' }],
      ['evo_list_expenses', {}], ['evo_delete_expense', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_income', {}], ['evo_add_income', { amount: 100, source: 'Salary' }],
      ['evo_delete_income', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_savings', {}], ['evo_add_savings_goal', { title: 'Rainy day', targetAmount: 1000 }],
      ['evo_delete_savings_goal', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_learning_tracks', {}], ['evo_create_learning_track', { name: 'Math' }],
      ['evo_delete_learning_track', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_learning_topics', { subjectId: '11111111-1111-4111-8111-111111111111' }],
      ['evo_add_learning_topic', { subjectId: '33333333-3333-4333-8333-333333333333', name: 'Algebra' }],
      ['evo_update_learning_topic', { id: '44444444-4444-4444-8444-444444444444', status: 'completed' }],
      ['evo_delete_learning_topic', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_delete_task', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_delete_goal', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_record_goal_check_in', { id: '11111111-1111-4111-8111-111111111111', currentValue: 30, note: 'Test update' }],
      ['evo_list_goal_check_ins', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_budgets', { month: '2026-10' }],
      ['evo_set_budget', { category: 'food', month: '2026-10', limitAmount: 5000 }],
      ['evo_delete_budget', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_add_savings_contribution', { goalId: '11111111-1111-4111-8111-111111111111', amount: 200 }],
      ['evo_list_savings_contributions', { goalId: '11111111-1111-4111-8111-111111111111' }],
      ['evo_log_study_session', { subjectId: '11111111-1111-4111-8111-111111111111', durationMinutes: 25 }],
      ['evo_list_study_sessions', {}],
      ['evo_list_projects', {}], ['evo_create_project', { name: 'MCP test project' }],
      ['evo_update_project', { id: '11111111-1111-4111-8111-111111111111', status: 'paused' }],
      ['evo_delete_project', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_project_milestones', { projectId: '11111111-1111-4111-8111-111111111111' }],
      ['evo_add_project_milestone', { projectId: '11111111-1111-4111-8111-111111111111', title: 'First milestone' }],
      ['evo_toggle_project_milestone', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_delete_project_milestone', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_reminders', {}], ['evo_create_reminder', { title: 'MCP reminder', type: 'one_time', time: '10:00', scheduledDate: '2026-10-31' }],
      ['evo_update_reminder', { id: '11111111-1111-4111-8111-111111111111', active: false, type: 'one_time', scheduledDate: '2026-10-31' }],
      ['evo_delete_reminder', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_get_daily_review', {}], ['evo_save_daily_review', { completedTasks: 1, totalTasks: 2 }],
      ['evo_get_weekly_review', {}], ['evo_save_weekly_review', { overallScore: 70 }],
      ['evo_get_progress_scores', {}], ['evo_list_notifications', {}],
      ['evo_mark_notification_read', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_mark_all_notifications_read', {}],
      ['evo_delete_notification', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_diary_entries', {}], ['evo_add_diary_entry', { title: 'A day', body: 'Notes' }],
      ['evo_delete_diary_entry', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_list_movie_reviews', {}], ['evo_add_movie_review', { title: 'Film', rating: 4, review: 'Good' }],
      ['evo_delete_movie_review', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_get_memories', {}],
      ['evo_add_memory', { text: 'EVO test memory', type: 'preference', importance: 8 }],
      ['evo_consult_ai_coach', { query: 'What should I focus on?' }],
    ];

    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true, `${name} unexpectedly failed`);
      assert.ok(result.content.length > 0, `${name} returned no content`);
    }

    assert.equal(requests.length, expectedNames.length);
    assert.ok(requests.every(request => request.authorization === 'Bearer test-only-evo-mcp-token'));
    assert.ok(requests.every(request => request.signal instanceof AbortSignal), 'MCP backend requests should have a timeout signal');
    const createdHabitRequest = requests.find(request => request.path.endsWith('/habits') && request.method === 'POST');
    assert.ok(createdHabitRequest, 'evo_create_habit must POST to /api/habits');
    assert.deepEqual(
      { name: createdHabitRequest.body.name, description: createdHabitRequest.body.description, frequency: createdHabitRequest.body.frequency, scheduleDays: createdHabitRequest.body.scheduleDays, target: createdHabitRequest.body.target, unit: createdHabitRequest.body.unit },
      { name: 'EVO test habit', description: 'MCP creation regression test', frequency: 'custom', scheduleDays: [1, 3, 5], target: 2, unit: 'times' },
    );
    const oneTimeReminderRequest = requests.find(request => request.path.endsWith('/reminders') && request.method === 'POST');
    assert.equal(oneTimeReminderRequest.body.type, 'custom');
    assert.equal(oneTimeReminderRequest.body.scheduledDate, '2026-10-31');
    const personalLibraryCalls = requests.filter(request => request.path.includes('/library/'));
    assert.equal(personalLibraryCalls.length, 6);
    assert.ok(requests.some(request => request.path === '/api/projects/11111111-1111-4111-8111-111111111111' && request.method === 'PATCH'));
    assert.ok(requests.some(request => request.path === '/api/projects/11111111-1111-4111-8111-111111111111' && request.method === 'DELETE'));
  } finally {
    global.fetch = originalFetch;
    await client.close();
    await server.close();
  }
});

test('MCP reports an unconfirmed write when the backend is unavailable', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('simulated backend outage');
  };

  const server = createEvoMcpServer();
  const client = new Client({ name: 'evo-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const result = await client.callTool({
      name: 'evo_create_task',
      arguments: { title: 'Test task' },
    });
    const message = result.content.map(item => item.text || '').join(' ');

    assert.equal(result.isError, true);
    assert.match(message, /operation result could not be confirmed/);
    assert.doesNotMatch(message, /Created task/);
  } finally {
    global.fetch = originalFetch;
    await client.close();
    await server.close();
  }
});
