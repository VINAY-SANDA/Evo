import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

// GET /api/tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, category } = req.query;
    let sql = `
      SELECT id, user_id as "userId", title, description,
             to_char(due_date, 'YYYY-MM-DD') as "dueDate",
             due_time::text as "dueTime",
             priority, status, goal_id as "goalId", project_id as "projectId",
             category, estimated_minutes as "estimatedMinutes",
             is_recurring as "isRecurring", recurrence_frequency as "recurrenceFrequency",
             is_ai_generated as "isAiGenerated",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM tasks
      WHERE user_id = $1
    `;
    const params: any[] = [DEFAULT_USER_ID];
    let pIdx = 2;

    if (status && status !== 'all') {
      sql += ` AND status = $${pIdx++}`;
      params.push(status);
    }
    if (priority) {
      sql += ` AND priority = $${pIdx++}`;
      params.push(priority);
    }
    if (category) {
      sql += ` AND category = $${pIdx++}`;
      params.push(category);
    }

    sql += ` ORDER BY due_date ASC,
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      created_at DESC`;

    const result = await query(sql, params);
    res.json({ tasks: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/today
router.get('/today', async (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT id, user_id as "userId", title, description,
             to_char(due_date, 'YYYY-MM-DD') as "dueDate",
             due_time::text as "dueTime",
             priority, status, goal_id as "goalId", project_id as "projectId",
             category, estimated_minutes as "estimatedMinutes",
             is_recurring as "isRecurring", recurrence_frequency as "recurrenceFrequency",
             is_ai_generated as "isAiGenerated",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM tasks
      WHERE user_id = $1 AND due_date = CURRENT_DATE
      ORDER BY CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END, created_at DESC
    `;
    const result = await query(sql, [DEFAULT_USER_ID]);
    res.json({ tasks: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, dueDate, dueTime, priority, category, estimatedMinutes, isRecurring, recurrenceFrequency, projectId, goalId } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const frequency = ['daily', 'weekly', 'weekdays', 'monthly'].includes(recurrenceFrequency) ? recurrenceFrequency : null;
    const recurring = Boolean(frequency);

    const sql = `
      WITH new_task AS (SELECT uuid_generate_v4() AS id)
      INSERT INTO tasks (
        id, recurrence_series_id, user_id, title, description, due_date, due_time,
        priority, status, category, estimated_minutes, is_recurring, recurrence_frequency, project_id, goal_id
      )
      SELECT new_task.id, CASE WHEN $9 THEN new_task.id ELSE NULL END, $1, $2, $3, $4, $5, $6, 'todo', $7, $8, $9, $10, $11, $12
      FROM new_task
      WHERE ($11::uuid IS NULL OR EXISTS (SELECT 1 FROM projects WHERE id = $11 AND user_id = $1))
        AND ($12::uuid IS NULL OR EXISTS (SELECT 1 FROM goals WHERE id = $12 AND user_id = $1))
      RETURNING id, user_id as "userId", title, description,
                to_char(due_date, 'YYYY-MM-DD') as "dueDate",
                due_time::text as "dueTime",
                priority, status, category,
                estimated_minutes as "estimatedMinutes",
                is_recurring as "isRecurring", recurrence_frequency as "recurrenceFrequency",
                project_id as "projectId", goal_id as "goalId", is_ai_generated as "isAiGenerated",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    const params = [
      DEFAULT_USER_ID,
      String(title).trim(),
      description ? String(description).trim() : null,
      dueDate || new Date().toISOString().split('T')[0],
      dueTime || null,
      priority || 'medium',
      category || 'General',
      Number(estimatedMinutes) || 30,
      recurring,
      frequency,
      projectId || null,
      goalId || null,
    ];

    const result = await query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project or goal not found' });
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/toggle
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sql = `
      UPDATE tasks
      SET status = CASE WHEN status = 'completed' THEN 'todo' ELSE 'completed' END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id as "userId", title, description,
                to_char(due_date, 'YYYY-MM-DD') as "dueDate",
                due_time::text as "dueTime",
                priority, status, category,
                estimated_minutes as "estimatedMinutes",
                is_recurring as "isRecurring", recurrence_frequency as "recurrenceFrequency",
                project_id as "projectId", goal_id as "goalId",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    const result = await query(sql, [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = result.rows[0];
    if (task.status === 'completed' && task.isRecurring && task.recurrenceFrequency) {
      const nextDate = new Date(`${task.dueDate}T12:00:00Z`);
      if (task.recurrenceFrequency === 'daily') nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      if (task.recurrenceFrequency === 'weekly') nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      if (task.recurrenceFrequency === 'weekdays') {
        const weekday = nextDate.getUTCDay();
        nextDate.setUTCDate(nextDate.getUTCDate() + (weekday === 5 ? 3 : weekday === 6 ? 2 : 1));
      }
      if (task.recurrenceFrequency === 'monthly') {
        const dayOfMonth = nextDate.getUTCDate();
        nextDate.setUTCDate(1);
        nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
        const lastDay = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
        nextDate.setUTCDate(Math.min(dayOfMonth, lastDay));
      }
      const dueDate = nextDate.toISOString().slice(0, 10);
      await query(`
        INSERT INTO tasks (recurrence_series_id, user_id, title, description, due_date, due_time,
          priority, status, category, estimated_minutes, is_recurring, recurrence_frequency, project_id, goal_id)
        SELECT recurrence_series_id, user_id, title, description, $1, due_time,
          priority, 'todo', category, estimated_minutes, TRUE, recurrence_frequency, project_id, goal_id
        FROM tasks WHERE id = $2 AND user_id = $3
        ON CONFLICT (recurrence_series_id, due_date) WHERE recurrence_series_id IS NOT NULL DO NOTHING
      `, [dueDate, id, DEFAULT_USER_ID]);
    }
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id', [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
