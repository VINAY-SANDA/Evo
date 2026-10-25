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
    requests.push({ path, method, authorization: options.headers?.Authorization });

    let result = {};
    if (path.endsWith('/dashboard')) result = { overallScore: 75, todayStats: { totalTasks: 1 } };
    else if (path.endsWith('/tasks') && method === 'GET') result = { tasks: [] };
    else if (path.endsWith('/tasks') && method === 'POST') result = { ...body, title: body.title, priority: body.priority, dueDate: body.dueDate };
    else if (/\/tasks\/.+\/toggle$/.test(path)) result = { title: 'EVO test task', status: 'completed' };
    else if (path.endsWith('/goals') && method === 'GET') result = { goals: [] };
    else if (path.endsWith('/goals') && method === 'POST') result = { ...body, title: body.title, category: body.category };
    else if (path.endsWith('/habits') && method === 'GET') result = { habits: [] };
    else if (/\/habits\/.+\/complete$/.test(path)) result = { name: 'EVO test habit', completedToday: true };
    else if (path.endsWith('/finance/summary')) result = { totalIncome: 100, totalExpenses: 20, netSavings: 80 };
    else if (path.endsWith('/finance/expenses')) result = { amount: body.amount, description: body.description, category: body.category };
    else if (path.endsWith('/memories') && method === 'GET') result = { memories: [] };
    else if (path.endsWith('/memories') && method === 'POST') result = { text: body.text };
    else if (path.endsWith('/ai/chat')) result = { content: 'EVO coach test response' };

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
      'evo_list_goals', 'evo_create_goal', 'evo_list_habits', 'evo_toggle_habit',
      'evo_get_finance_summary', 'evo_log_expense', 'evo_get_memories',
      'evo_add_memory', 'evo_consult_ai_coach',
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
      ['evo_toggle_habit', { id: '11111111-1111-4111-8111-111111111111' }],
      ['evo_get_finance_summary', {}],
      ['evo_log_expense', { amount: 20, category: 'food', description: 'EVO test expense' }],
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
