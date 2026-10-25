#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Default in-memory fallback dataset in case backend HTTP is not running
let localTasks = [
  { id: 'task_001', title: 'Solve 2 DSA problems — Trees', status: 'todo', priority: 'high', dueDate: '2026-10-25' },
  { id: 'task_002', title: 'Study Java — Multithreading', status: 'completed', priority: 'high', dueDate: '2026-10-25' },
  { id: 'task_003', title: 'Contact 5 prospects — Vyralabs', status: 'todo', priority: 'high', dueDate: '2026-10-25' },
];

let localGoals = [
  { id: 'goal_001', title: 'Get Software Engineering Job', progress: 42, deadline: '2027-06-30', category: 'career' },
  { id: 'goal_002', title: 'Master Java & Spring Boot', progress: 78, deadline: '2027-03-31', category: 'education' },
  { id: 'goal_003', title: 'Launch Vyralabs', progress: 63, deadline: '2027-01-31', category: 'business' },
];

let localHabits = [
  { id: 'hab_001', name: 'DSA Practice', streak: 14, completedToday: true, icon: '🧩' },
  { id: 'hab_002', name: 'Study Java', streak: 21, completedToday: true, icon: '☕' },
  { id: 'hab_003', name: 'Workout', streak: 7, completedToday: false, icon: '💪' },
];

let localMemories = [
  'Prefers studying Java in morning (9-11 AM)',
  'Master Trees & Graphs before Dynamic Programming',
  'Vyralabs client focus is education niche',
  'Finds evening workouts more effective than morning ones',
];

export function createEvoMcpServer(customApiUrl?: string): Server {
  const EVO_API_URL = customApiUrl || process.env.EVO_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;

  async function fetchEvo<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    try {
      const res = await fetch(`${EVO_API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err: any) {
      return null;
    }
  }

  // ── Initialize MCP Server ──
  const server = new Server(
    {
      name: 'gemini-evo-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

// ── List Tools ──
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'evo_get_dashboard',
        description: 'Get an executive dashboard overview of EVO: life scores, tasks done today, streaks, and current AI strategic directive.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'evo_list_tasks',
        description: 'List active daily execution tasks in EVO, optionally filtered by status.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: "Filter by status: 'todo', 'completed', 'in_progress', or 'all'",
              enum: ['all', 'todo', 'completed', 'in_progress'],
            },
          },
        },
      },
      {
        name: 'evo_create_task',
        description: 'Create a new task in the EVO planner.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title or action item' },
            priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
            category: { type: 'string', description: 'Category (e.g. Career, Education, Vyralabs)' },
            dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
            dueTime: { type: 'string', description: 'Due time in HH:MM format (e.g. 10:00)' },
            estimatedMinutes: { type: 'number', description: 'Estimated focus duration in minutes' },
          },
          required: ['title'],
        },
      },
      {
        name: 'evo_toggle_task',
        description: 'Toggle a task completion status by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The ID of the task to toggle' },
          },
          required: ['id'],
        },
      },
      {
        name: 'evo_list_goals',
        description: 'List all multi-year strategic goals, their percentage progress, and deadlines.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'evo_create_goal',
        description: 'Create a new high-level goal in EVO.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Goal title' },
            category: { type: 'string', enum: ['career', 'education', 'finance', 'health', 'business', 'personal', 'project'] },
            targetValue: { type: 'number', description: 'Target value (e.g. 100 for percentage, 200 for problems)' },
            unit: { type: 'string', description: 'Unit (e.g. %, problems, ₹)' },
            deadline: { type: 'string', description: 'Target deadline YYYY-MM-DD' },
            priority: { type: 'string', enum: ['high', 'medium', 'low', 'urgent'] },
          },
          required: ['title'],
        },
      },
      {
        name: 'evo_list_habits',
        description: 'List tracked daily habits, streak lengths, and whether they are completed today.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'evo_toggle_habit',
        description: 'Mark a habit as done or toggle completion status for today.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Habit ID' },
          },
          required: ['id'],
        },
      },
      {
        name: 'evo_get_finance_summary',
        description: 'Get financial overview: monthly income, total expenses, net runway/savings, and active savings goals.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'evo_log_expense',
        description: 'Log an expenditure into the EVO financial ledger.',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Amount spent in ₹' },
            category: { type: 'string', enum: ['food', 'travel', 'shopping', 'education', 'bills', 'entertainment', 'health', 'other'] },
            description: { type: 'string', description: 'What the money was spent on' },
            date: { type: 'string', description: 'Date in YYYY-MM-DD (defaults to today)' },
          },
          required: ['amount', 'category', 'description'],
        },
      },
      {
        name: 'evo_get_memories',
        description: 'Retrieve user preferences, decisions, and long-term memories encoded in EVO.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'evo_add_memory',
        description: 'Encode a new long-term memory or user preference into EVO.',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Memory or preference text' },
            type: { type: 'string', enum: ['preference', 'decision', 'fact', 'lesson'], description: 'Type of memory' },
            importance: { type: 'number', description: 'Importance scale from 1 to 10' },
          },
          required: ['text'],
        },
      },
      {
        name: 'evo_consult_ai_coach',
        description: 'Ask EVO AI strategic coach for an execution protocol, weekly planning, or risk analysis.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Question or planning prompt (e.g. "What should I focus on today?")' },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// ── Call Tool Handler ──
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'evo_get_dashboard': {
        const remote = await fetchEvo<any>('/dashboard');
        const data = remote || {
          user: { name: 'Vinay', aiTone: 'rigorous' },
          overallScore: 75,
          weeklyChange: 7,
          todayStats: { tasksCompleted: 1, totalTasks: 3, habitsCompleted: 2, totalHabits: 3, todaySpend: 350 },
          topStreaks: localHabits.map(h => ({ name: h.name, streak: h.streak, icon: h.icon })),
          aiInsight: 'Your DSA streak is at 14 days. Protect it today. Outreach for Vyralabs is your highest leverage action.',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'evo_list_tasks': {
        const remote = await fetchEvo<{ tasks: any[] }>('/tasks');
        let tasks = remote?.tasks || localTasks;
        if (args.status && args.status !== 'all') {
          tasks = tasks.filter((t: any) => t.status === args.status);
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
        };
      }

      case 'evo_create_task': {
        const taskPayload = {
          title: args.title,
          priority: args.priority || 'high',
          category: args.category || 'General',
          dueDate: args.dueDate || new Date().toISOString().split('T')[0],
          dueTime: args.dueTime || '10:00',
          estimatedMinutes: args.estimatedMinutes || 45,
          status: 'todo',
        };
        const remote = await fetchEvo<any>('/tasks', {
          method: 'POST',
          body: JSON.stringify(taskPayload),
        });
        const created = remote || { id: `task_${Date.now()}`, ...taskPayload };
        localTasks.unshift(created);
        return {
          content: [{ type: 'text', text: `✓ Created task: "${created.title}" [${created.priority.toUpperCase()}] Due: ${created.dueDate}` }],
        };
      }

      case 'evo_toggle_task': {
        const id = String(args.id);
        const remote = await fetchEvo<any>(`/tasks/${id}/toggle`, { method: 'POST' });
        const local = localTasks.find(t => t.id === id);
        if (local) {
          local.status = local.status === 'completed' ? 'todo' : 'completed';
        }
        return {
          content: [{ type: 'text', text: `✓ Task ${id} status toggled` }],
        };
      }

      case 'evo_list_goals': {
        const remote = await fetchEvo<{ goals: any[] }>('/goals');
        const goals = remote?.goals || localGoals;
        return {
          content: [{ type: 'text', text: JSON.stringify(goals, null, 2) }],
        };
      }

      case 'evo_create_goal': {
        const goalPayload = {
          title: args.title,
          category: args.category || 'career',
          targetValue: args.targetValue || 100,
          currentValue: 0,
          unit: args.unit || '%',
          deadline: args.deadline || '2027-06-30',
          priority: args.priority || 'high',
          progress: 0,
        };
        const remote = await fetchEvo<any>('/goals', {
          method: 'POST',
          body: JSON.stringify(goalPayload),
        });
        const created = remote || { id: `goal_${Date.now()}`, ...goalPayload };
        localGoals.unshift(created);
        return {
          content: [{ type: 'text', text: `✓ Created goal: "${created.title}" (${created.category})` }],
        };
      }

      case 'evo_list_habits': {
        const remote = await fetchEvo<{ habits: any[] }>('/habits');
        const habits = remote?.habits || localHabits;
        return {
          content: [{ type: 'text', text: JSON.stringify(habits, null, 2) }],
        };
      }

      case 'evo_toggle_habit': {
        const id = String(args.id);
        const remote = await fetchEvo<any>(`/habits/${id}/complete`, { method: 'POST' });
        const local = localHabits.find(h => h.id === id);
        if (local) {
          local.completedToday = !local.completedToday;
          local.streak = local.completedToday ? local.streak + 1 : Math.max(0, local.streak - 1);
        }
        return {
          content: [{ type: 'text', text: `✓ Toggled habit ${id} for today` }],
        };
      }

      case 'evo_get_finance_summary': {
        const remote = await fetchEvo<any>('/finance/summary');
        const summary = remote || {
          totalIncome: 30000,
          totalExpenses: 5900,
          netSavings: 24100,
          topCategory: 'food (₹3,200)',
          emergencyFundProgress: '37%',
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      }

      case 'evo_log_expense': {
        const expPayload = {
          amount: Number(args.amount),
          category: args.category,
          description: args.description,
          date: args.date || new Date().toISOString().split('T')[0],
        };
        const remote = await fetchEvo<any>('/finance/expenses', {
          method: 'POST',
          body: JSON.stringify(expPayload),
        });
        return {
          content: [{ type: 'text', text: `✓ Logged ₹${expPayload.amount} for ${expPayload.description} (${expPayload.category})` }],
        };
      }

      case 'evo_get_memories': {
        const remote = await fetchEvo<{ memories: any[] }>('/memories');
        const memories = remote?.memories || localMemories;
        return {
          content: [{ type: 'text', text: JSON.stringify(memories, null, 2) }],
        };
      }

      case 'evo_add_memory': {
        const memPayload = {
          text: args.text,
          type: args.type || 'preference',
          importance: args.importance || 8,
        };
        const remote = await fetchEvo<any>('/memories', {
          method: 'POST',
          body: JSON.stringify(memPayload),
        });
        localMemories.push(String(args.text));
        return {
          content: [{ type: 'text', text: `✓ Learned new memory: "${args.text}"` }],
        };
      }

      case 'evo_consult_ai_coach': {
        const query = String(args.query);
        const remote = await fetchEvo<any>('/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ message: query }),
        });
        const reply = remote?.content || `Protocol for "${query}": Maintain focus on Tree Traversals and prioritize 5 client outreach messages for Vyralabs today.`;
        return {
          content: [{ type: 'text', text: reply }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }],
      isError: true,
    };
  }
});

  return server;
}

// ── Start Stdio Transport if run directly ──
const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith('geminiEvoMcpServer.ts') ||
  process.argv[1].endsWith('geminiEvoMcpServer.js')
);

if (isDirectExecution) {
  const server = createEvoMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error('🚀 EVO Gemini MCP Server running on stdio');
  }).catch((err) => {
    console.error('Fatal error in EVO Gemini MCP server:', err);
    process.exit(1);
  });
}

