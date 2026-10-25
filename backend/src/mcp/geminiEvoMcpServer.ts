#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

dotenv.config();

export function createEvoMcpServer(customApiUrl?: string): Server {
  const EVO_API_URL = (customApiUrl || process.env.EVO_API_URL || `http://localhost:${process.env.PORT || 5000}/api`).replace(/\/+$/, '');

  async function fetchEvo<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const serviceToken = process.env.EVO_MCP_TOKEN;
    if (!serviceToken) {
      throw new Error('EVO_MCP_TOKEN is not configured for the MCP server.');
    }

    try {
      const res = await fetch(`${EVO_API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
          ...(options.headers || {}),
        },
      });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json() as { error?: string };
          detail = typeof body.error === 'string' ? `: ${body.error}` : '';
        } catch {
          // Keep the status as the useful, safe error detail.
        }
        throw new Error(`EVO request failed (${res.status})${detail}`);
      }
      if (res.status === 204) return undefined as T;
      return await res.json() as T;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('EVO request failed')) throw error;
      throw new Error('EVO backend is unreachable; the operation result could not be confirmed. Check EVO before retrying.');
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
            recurrenceFrequency: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'monthly'], description: 'Optional repeat schedule' },
            projectId: { type: 'string', description: 'Optional project ID to link this task to' },
            goalId: { type: 'string', description: 'Optional goal ID to link this task to' },
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
        name: 'evo_create_habit',
        description: 'Create a tracked habit in EVO. Provide a short name and optionally a description, icon, color, frequency, target, and unit.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Habit name, such as Read for 20 minutes' },
            description: { type: 'string', description: 'Optional details about the habit' },
            icon: { type: 'string', description: 'Optional emoji icon' },
            color: { type: 'string', description: 'Optional hex color, such as #6C5CE7' },
            frequency: { type: 'string', enum: ['daily', 'weekly', 'custom'] },
            scheduleDays: { type: 'array', items: { type: 'number', minimum: 0, maximum: 6 }, description: 'Custom days, 0 Sunday through 6 Saturday' },
            target: { type: 'number', description: 'Target count for each frequency period' },
            unit: { type: 'string', description: 'Target unit, such as times or minutes' },
          },
          required: ['name'],
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
      { name: 'evo_get_habit_weekly_summary', description: 'Get seven-day habit consistency, completion counts, and streaks.', inputSchema: { type: 'object', properties: {} } },
      {
        name: 'evo_delete_habit',
        description: 'Permanently delete a habit by ID. Use archive when the user wants to keep its history. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Habit ID' } }, required: ['id'] },
      },
      {
        name: 'evo_archive_habit',
        description: 'Archive a habit while keeping its history.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Habit ID' } }, required: ['id'] },
      },
      {
        name: 'evo_restore_habit',
        description: 'Restore an archived habit.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Habit ID' } }, required: ['id'] },
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
        name: 'evo_list_income',
        description: 'List income entries in EVO.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'evo_add_income',
        description: 'Record income in EVO.',
        inputSchema: { type: 'object', properties: {
          amount: { type: 'number', description: 'Income amount in ₹' },
          source: { type: 'string', description: 'Income source' },
          category: { type: 'string', description: 'Income category' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD' },
        }, required: ['amount'] },
      },
      {
        name: 'evo_delete_income',
        description: 'Delete an income entry by ID. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Income entry ID' } }, required: ['id'] },
      },
      {
        name: 'evo_list_expenses',
        description: 'List expense entries in EVO.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'evo_delete_expense',
        description: 'Delete an expense entry by ID. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Expense entry ID' } }, required: ['id'] },
      },
      {
        name: 'evo_list_savings',
        description: 'List savings goals in EVO.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'evo_add_savings_goal',
        description: 'Create a savings goal in EVO.',
        inputSchema: { type: 'object', properties: {
          title: { type: 'string', description: 'Savings goal name' },
          targetAmount: { type: 'number', description: 'Target amount in ₹' },
          currentAmount: { type: 'number', description: 'Amount already saved in ₹' },
          deadline: { type: 'string', description: 'Deadline in YYYY-MM-DD' },
        }, required: ['title', 'targetAmount'] },
      },
      {
        name: 'evo_delete_savings_goal',
        description: 'Delete a savings goal by ID. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Savings goal ID' } }, required: ['id'] },
      },
      {
        name: 'evo_list_learning_tracks',
        description: 'List learning tracks and their progress.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'evo_create_learning_track',
        description: 'Create a learning track.',
        inputSchema: { type: 'object', properties: {
          name: { type: 'string', description: 'Track or subject name' },
          icon: { type: 'string', description: 'Optional emoji icon' },
          color: { type: 'string', description: 'Optional hex color' },
        }, required: ['name'] },
      },
      {
        name: 'evo_delete_learning_track',
        description: 'Delete a learning track by ID. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Learning track ID' } }, required: ['id'] },
      },
      {
        name: 'evo_list_learning_topics',
        description: 'List topics in a learning track.',
        inputSchema: { type: 'object', properties: { subjectId: { type: 'string', description: 'Learning track ID' } }, required: ['subjectId'] },
      },
      {
        name: 'evo_add_learning_topic',
        description: 'Add a topic to a learning track.',
        inputSchema: { type: 'object', properties: {
          subjectId: { type: 'string', description: 'Learning track ID' },
          name: { type: 'string', description: 'Topic name' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          timeSpentMinutes: { type: 'number' },
          notes: { type: 'string' }, resourceUrl: { type: 'string' }, nextReviewDate: { type: 'string' },
        }, required: ['subjectId', 'name'] },
      },
      {
        name: 'evo_update_learning_topic',
        description: 'Update a learning topic status, name, difficulty, or time spent.',
        inputSchema: { type: 'object', properties: {
          id: { type: 'string', description: 'Topic ID' },
          name: { type: 'string' }, status: { type: 'string', enum: ['not_started', 'in_progress', 'completed'] },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, timeSpentMinutes: { type: 'number' },
          notes: { type: 'string' }, resourceUrl: { type: 'string' }, nextReviewDate: { type: 'string' },
        }, required: ['id'] },
      },
      {
        name: 'evo_delete_learning_topic',
        description: 'Delete a learning topic by ID. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Topic ID' } }, required: ['id'] },
      },
      {
        name: 'evo_delete_task',
        description: 'Delete a task by ID. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Task ID' } }, required: ['id'] },
      },
      {
        name: 'evo_delete_goal',
        description: 'Delete a goal by ID. Only call after the user explicitly confirms this deletion.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Goal ID' } }, required: ['id'] },
      },
      { name: 'evo_record_goal_check_in', description: 'Record goal progress with an optional note.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, currentValue: { type: 'number' }, note: { type: 'string' } }, required: ['id', 'currentValue'] } },
      { name: 'evo_list_goal_check_ins', description: 'List progress check-ins for a goal.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      { name: 'evo_list_budgets', description: 'List monthly category budgets and spending.', inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'Month in YYYY-MM format' } } } },
      { name: 'evo_set_budget', description: 'Set or update a monthly category spending limit.', inputSchema: { type: 'object', properties: { category: { type: 'string' }, month: { type: 'string', description: 'YYYY-MM' }, limitAmount: { type: 'number' }, alertPercent: { type: 'number' } }, required: ['category', 'month', 'limitAmount'] } },
      { name: 'evo_delete_budget', description: 'Delete a monthly budget by ID. Only call after the user explicitly confirms this deletion.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      { name: 'evo_add_savings_contribution', description: 'Record money added to a savings goal.', inputSchema: { type: 'object', properties: { goalId: { type: 'string' }, amount: { type: 'number' }, date: { type: 'string' }, note: { type: 'string' } }, required: ['goalId', 'amount'] } },
      { name: 'evo_list_savings_contributions', description: 'List contributions recorded for a savings goal.', inputSchema: { type: 'object', properties: { goalId: { type: 'string' } }, required: ['goalId'] } },
      { name: 'evo_log_study_session', description: 'Log study time for a learning track or topic.', inputSchema: { type: 'object', properties: { subjectId: { type: 'string' }, topicId: { type: 'string' }, durationMinutes: { type: 'number' }, note: { type: 'string' } }, required: ['subjectId', 'durationMinutes'] } },
      { name: 'evo_list_study_sessions', description: 'List recent study sessions, optionally for one learning track.', inputSchema: { type: 'object', properties: { subjectId: { type: 'string' } } } },
      { name: 'evo_list_projects', description: 'List projects and their current status.', inputSchema: { type: 'object', properties: {} } },
      { name: 'evo_create_project', description: 'Create a project.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] }, deadline: { type: 'string' } }, required: ['name'] } },
      { name: 'evo_list_project_milestones', description: 'List milestones for a project.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } },
      { name: 'evo_add_project_milestone', description: 'Add a milestone to a project.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, title: { type: 'string' }, orderIndex: { type: 'number' } }, required: ['projectId', 'title'] } },
      { name: 'evo_toggle_project_milestone', description: 'Toggle a project milestone between pending and completed.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      { name: 'evo_list_reminders', description: 'List reminders.', inputSchema: { type: 'object', properties: {} } },
      { name: 'evo_create_reminder', description: 'Create a reminder.', inputSchema: { type: 'object', properties: { title: { type: 'string' }, type: { type: 'string', enum: ['daily', 'weekly', 'custom', 'one_time'] }, time: { type: 'string', description: '24-hour HH:MM time' }, daysOfWeek: { type: 'array', items: { type: 'number' } }, goalId: { type: 'string' } }, required: ['title', 'time'] } },
      { name: 'evo_update_reminder', description: 'Update a reminder, including enabling or disabling it.', inputSchema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, type: { type: 'string' }, time: { type: 'string' }, daysOfWeek: { type: 'array', items: { type: 'number' } }, active: { type: 'boolean' }, goalId: { type: 'string' } }, required: ['id'] } },
      { name: 'evo_delete_reminder', description: 'Delete a reminder. Only call after the user explicitly confirms this deletion.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      { name: 'evo_get_daily_review', description: 'Get recent daily review history.', inputSchema: { type: 'object', properties: {} } },
      { name: 'evo_save_daily_review', description: 'Save or update a daily review.', inputSchema: { type: 'object', properties: { date: { type: 'string' }, completedTasks: { type: 'number' }, totalTasks: { type: 'number' }, completedHabits: { type: 'number' }, totalHabits: { type: 'number' }, whatWentWell: { type: 'array', items: { type: 'string' } }, whatWentWrong: { type: 'array', items: { type: 'string' } }, suggestions: { type: 'array', items: { type: 'string' } }, aiSummary: { type: 'string' } } } },
      { name: 'evo_get_weekly_review', description: 'Get recent weekly review history.', inputSchema: { type: 'object', properties: {} } },
      { name: 'evo_save_weekly_review', description: 'Save a weekly review and next-week priorities.', inputSchema: { type: 'object', properties: { weekStart: { type: 'string' }, weekEnd: { type: 'string' }, overallScore: { type: 'number' }, biggestAchievement: { type: 'string' }, biggestProblem: { type: 'string' }, nextWeekPriorities: { type: 'array', items: { type: 'string' } }, categoryScores: { type: 'array', items: { type: 'object' } } } } },
      { name: 'evo_get_progress_scores', description: 'Get progress scores by life area.', inputSchema: { type: 'object', properties: {} } },
      { name: 'evo_list_notifications', description: 'List notifications.', inputSchema: { type: 'object', properties: {} } },
      { name: 'evo_mark_notification_read', description: 'Mark a notification as read.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
      { name: 'evo_mark_all_notifications_read', description: 'Mark all notifications as read.', inputSchema: { type: 'object', properties: {} } },
      { name: 'evo_delete_notification', description: 'Permanently delete a notification. Only use after the user has explicitly confirmed the deletion.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
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
        const data = await fetchEvo<any>('/dashboard');
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      case 'evo_list_tasks': {
        const remote = await fetchEvo<{ tasks: any[] }>('/tasks');
        let tasks = remote.tasks;
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
          recurrenceFrequency: args.recurrenceFrequency,
          isRecurring: Boolean(args.recurrenceFrequency),
          projectId: args.projectId,
          goalId: args.goalId,
          status: 'todo',
        };
        const created = await fetchEvo<any>('/tasks', {
          method: 'POST',
          body: JSON.stringify(taskPayload),
        });
        return {
          content: [{ type: 'text', text: `✓ Created task: "${created.title}" [${created.priority.toUpperCase()}] Due: ${created.dueDate}` }],
        };
      }

      case 'evo_toggle_task': {
        const id = String(args.id);
        const updated = await fetchEvo<any>(`/tasks/${id}/toggle`, { method: 'POST' });
        return {
          content: [{ type: 'text', text: `Task "${updated.title}" is now ${updated.status}.` }],
        };
      }

      case 'evo_delete_task': {
        await fetchEvo<any>(`/tasks/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted task ${args.id}.` }] };
      }

      case 'evo_list_goals': {
        const remote = await fetchEvo<{ goals: any[] }>('/goals');
        const goals = remote.goals;
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
        const created = await fetchEvo<any>('/goals', {
          method: 'POST',
          body: JSON.stringify(goalPayload),
        });
        return {
          content: [{ type: 'text', text: `✓ Created goal: "${created.title}" (${created.category})` }],
        };
      }

      case 'evo_delete_goal': {
        await fetchEvo<any>(`/goals/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted goal ${args.id}.` }] };
      }

      case 'evo_record_goal_check_in': {
        const { id, ...body } = args;
        const saved = await fetchEvo<any>(`/goals/${encodeURIComponent(String(id))}/check-ins`, { method: 'POST', body: JSON.stringify(body) });
        return { content: [{ type: 'text', text: `Recorded goal check-in at ${saved.currentValue}.` }] };
      }
      case 'evo_list_goal_check_ins': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>(`/goals/${encodeURIComponent(String(args.id))}/check-ins`), null, 2) }] };
      }

      case 'evo_list_budgets': {
        const suffix = args.month ? `?month=${encodeURIComponent(String(args.month))}` : '';
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>(`/finance/budgets${suffix}`), null, 2) }] };
      }
      case 'evo_set_budget': {
        const saved = await fetchEvo<any>('/finance/budgets', { method: 'PUT', body: JSON.stringify(args) });
        return { content: [{ type: 'text', text: `Budget saved for ${saved.category} in ${saved.month}: ₹${saved.limitAmount}.` }] };
      }
      case 'evo_delete_budget': {
        await fetchEvo<any>(`/finance/budgets/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted budget ${args.id}.` }] };
      }
      case 'evo_add_savings_contribution': {
        const { goalId, ...body } = args;
        const created = await fetchEvo<any>(`/finance/savings/${encodeURIComponent(String(goalId))}/contributions`, { method: 'POST', body: JSON.stringify(body) });
        return { content: [{ type: 'text', text: `Added ₹${created.amount} to ${created.title}; saved so far: ₹${created.currentAmount}.` }] };
      }
      case 'evo_list_savings_contributions': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>(`/finance/savings/${encodeURIComponent(String(args.goalId))}/contributions`), null, 2) }] };
      }
      case 'evo_log_study_session': {
        const created = await fetchEvo<any>('/learning/study-sessions', { method: 'POST', body: JSON.stringify(args) });
        return { content: [{ type: 'text', text: `Logged ${created.durationMinutes} study minutes (session ${created.id}).` }] };
      }
      case 'evo_list_study_sessions': {
        const suffix = args.subjectId ? `?subjectId=${encodeURIComponent(String(args.subjectId))}` : '';
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>(`/learning/study-sessions${suffix}`), null, 2) }] };
      }
      case 'evo_list_projects':
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/projects'), null, 2) }] };
      case 'evo_create_project': {
        const created = await fetchEvo<any>('/projects', { method: 'POST', body: JSON.stringify(args) });
        return { content: [{ type: 'text', text: `Created project "${created.name}" (ID: ${created.id}).` }] };
      }
      case 'evo_list_project_milestones':
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>(`/projects/${encodeURIComponent(String(args.projectId))}/milestones`), null, 2) }] };
      case 'evo_add_project_milestone': {
        const { projectId, ...body } = args;
        const created = await fetchEvo<any>(`/projects/${encodeURIComponent(String(projectId))}/milestones`, { method: 'POST', body: JSON.stringify(body) });
        return { content: [{ type: 'text', text: `Added project milestone "${created.title}".` }] };
      }
      case 'evo_toggle_project_milestone': {
        const updated = await fetchEvo<any>(`/projects/milestones/${encodeURIComponent(String(args.id))}/toggle`, { method: 'PATCH' });
        return { content: [{ type: 'text', text: `Milestone "${updated.title}" is ${updated.status}.` }] };
      }
      case 'evo_list_reminders':
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/reminders'), null, 2) }] };
      case 'evo_create_reminder': {
        const created = await fetchEvo<any>('/reminders', { method: 'POST', body: JSON.stringify(args) });
        return { content: [{ type: 'text', text: `Created reminder "${created.title}" at ${created.time}.` }] };
      }
      case 'evo_update_reminder': {
        const { id, ...body } = args;
        const updated = await fetchEvo<any>(`/reminders/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(body) });
        return { content: [{ type: 'text', text: `Updated reminder "${updated.title}".` }] };
      }
      case 'evo_delete_reminder': {
        await fetchEvo<any>(`/reminders/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted reminder ${args.id}.` }] };
      }
      case 'evo_get_daily_review':
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/reviews/daily'), null, 2) }] };
      case 'evo_save_daily_review': {
        const saved = await fetchEvo<any>('/reviews/daily', { method: 'POST', body: JSON.stringify(args) });
        return { content: [{ type: 'text', text: `Saved daily review with score ${saved.score}/100.` }] };
      }
      case 'evo_get_weekly_review':
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/reviews/weekly'), null, 2) }] };
      case 'evo_save_weekly_review': {
        const saved = await fetchEvo<any>('/reviews/weekly', { method: 'POST', body: JSON.stringify(args) });
        return { content: [{ type: 'text', text: `Saved weekly review with score ${saved.overallScore}/100.` }] };
      }
      case 'evo_get_progress_scores':
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/progress/scores'), null, 2) }] };
      case 'evo_list_notifications':
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/notifications'), null, 2) }] };
      case 'evo_mark_notification_read': {
        await fetchEvo<any>(`/notifications/${encodeURIComponent(String(args.id))}/read`, { method: 'PATCH' });
        return { content: [{ type: 'text', text: `Marked notification ${args.id} as read.` }] };
      }
      case 'evo_mark_all_notifications_read': {
        await fetchEvo<any>('/notifications/read-all', { method: 'PATCH' });
        return { content: [{ type: 'text', text: 'Marked all notifications as read.' }] };
      }
      case 'evo_delete_notification': {
        await fetchEvo<any>(`/notifications/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted notification ${args.id}.` }] };
      }

      case 'evo_list_habits': {
        const remote = await fetchEvo<{ habits: any[] }>('/habits');
        const habits = remote.habits;
        return {
          content: [{ type: 'text', text: JSON.stringify(habits, null, 2) }],
        };
      }

      case 'evo_create_habit': {
        const name = String(args.name || '').trim();
        if (!name) throw new Error('A habit name is required.');
        const habitPayload = {
          name,
          description: args.description,
          icon: args.icon,
          color: args.color,
          frequency: args.frequency,
          scheduleDays: args.scheduleDays,
          target: args.target,
          unit: args.unit,
        };
        const created = await fetchEvo<any>('/habits', {
          method: 'POST',
          body: JSON.stringify(habitPayload),
        });
        return {
          content: [{ type: 'text', text: `Created habit "${created.name}" (ID: ${created.id}).` }],
        };
      }

      case 'evo_toggle_habit': {
        const id = String(args.id);
        const updated = await fetchEvo<any>(`/habits/${id}/complete`, { method: 'POST' });
        return {
          content: [{ type: 'text', text: `"${updated.name}" is ${updated.completedToday ? 'complete' : 'not complete'} today.` }],
        };
      }

      case 'evo_get_habit_weekly_summary': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/habits/summary/weekly'), null, 2) }] };
      }

      case 'evo_delete_habit':
      case 'evo_archive_habit':
      case 'evo_restore_habit': {
        const id = encodeURIComponent(String(args.id));
        if (name === 'evo_delete_habit') {
          await fetchEvo<any>(`/habits/${id}`, { method: 'DELETE' });
          return { content: [{ type: 'text', text: `Deleted habit ${args.id}.` }] };
        }
        const action = name === 'evo_archive_habit' ? 'archive' : 'restore';
        const updated = await fetchEvo<any>(`/habits/${id}/${action}`, { method: 'PATCH' });
        return { content: [{ type: 'text', text: `Habit "${updated.name}" ${action === 'archive' ? 'archived' : 'restored'}.` }] };
      }

      case 'evo_get_finance_summary': {
        const summary = await fetchEvo<any>('/finance/summary');
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
        const created = await fetchEvo<any>('/finance/expenses', {
          method: 'POST',
          body: JSON.stringify(expPayload),
        });
        return {
          content: [{ type: 'text', text: `Logged ₹${created.amount} for ${created.description} (${created.category}).` }],
        };
      }

      case 'evo_list_expenses': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/finance/expenses'), null, 2) }] };
      }

      case 'evo_delete_expense': {
        await fetchEvo<any>(`/finance/expenses/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted expense ${args.id}.` }] };
      }

      case 'evo_list_income': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/finance/income'), null, 2) }] };
      }

      case 'evo_add_income': {
        const created = await fetchEvo<any>('/finance/income', { method: 'POST', body: JSON.stringify({
          amount: Number(args.amount), source: args.source, category: args.category, date: args.date,
        }) });
        return { content: [{ type: 'text', text: `Recorded ₹${created.amount} income from ${created.source}.` }] };
      }

      case 'evo_delete_income': {
        await fetchEvo<any>(`/finance/income/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted income ${args.id}.` }] };
      }

      case 'evo_list_savings': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/finance/savings'), null, 2) }] };
      }

      case 'evo_add_savings_goal': {
        const created = await fetchEvo<any>('/finance/savings', { method: 'POST', body: JSON.stringify({
          title: args.title, targetAmount: Number(args.targetAmount), currentAmount: args.currentAmount, deadline: args.deadline,
        }) });
        return { content: [{ type: 'text', text: `Created savings goal "${created.title}" with target ₹${created.targetAmount} (ID: ${created.id}).` }] };
      }

      case 'evo_delete_savings_goal': {
        await fetchEvo<any>(`/finance/savings/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted savings goal ${args.id}.` }] };
      }

      case 'evo_list_learning_tracks': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>('/learning/subjects'), null, 2) }] };
      }

      case 'evo_create_learning_track': {
        const created = await fetchEvo<any>('/learning/subjects', { method: 'POST', body: JSON.stringify({ name: args.name, icon: args.icon, color: args.color }) });
        return { content: [{ type: 'text', text: `Created learning track "${created.name}" (ID: ${created.id}).` }] };
      }

      case 'evo_delete_learning_track': {
        await fetchEvo<any>(`/learning/subjects/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted learning track ${args.id}.` }] };
      }

      case 'evo_list_learning_topics': {
        return { content: [{ type: 'text', text: JSON.stringify(await fetchEvo<any>(`/learning/subjects/${encodeURIComponent(String(args.subjectId))}/topics`), null, 2) }] };
      }

      case 'evo_add_learning_topic': {
        const { subjectId, ...body } = args;
        const created = await fetchEvo<any>(`/learning/subjects/${encodeURIComponent(String(subjectId))}/topics`, { method: 'POST', body: JSON.stringify(body) });
        return { content: [{ type: 'text', text: `Added topic "${created.name}" (ID: ${created.id}).` }] };
      }

      case 'evo_update_learning_topic': {
        const { id, ...body } = args;
        const updated = await fetchEvo<any>(`/learning/topics/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: JSON.stringify(body) });
        return { content: [{ type: 'text', text: `Updated learning topic "${updated.name}" (${updated.status}).` }] };
      }

      case 'evo_delete_learning_topic': {
        await fetchEvo<any>(`/learning/topics/${encodeURIComponent(String(args.id))}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Deleted learning topic ${args.id}.` }] };
      }

      case 'evo_get_memories': {
        const remote = await fetchEvo<{ memories: any[] }>('/memories');
        const memories = remote.memories;
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
        const created = await fetchEvo<any>('/memories', {
          method: 'POST',
          body: JSON.stringify(memPayload),
        });
        return {
          content: [{ type: 'text', text: `Saved memory: "${created.text}".` }],
        };
      }

      case 'evo_consult_ai_coach': {
        const query = String(args.query);
        const remote = await fetchEvo<any>('/ai/chat', {
          method: 'POST',
          body: JSON.stringify({ message: query }),
        });
        const reply = remote.content;
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

