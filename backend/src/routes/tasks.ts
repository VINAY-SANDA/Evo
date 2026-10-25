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
             is_recurring as "isRecurring", is_ai_generated as "isAiGenerated",
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

    sql += ' ORDER BY due_date ASC, priority DESC, created_at DESC';

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
             is_recurring as "isRecurring", is_ai_generated as "isAiGenerated",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM tasks
      WHERE user_id = $1 AND due_date = CURRENT_DATE
      ORDER BY priority DESC, created_at DESC
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
    const { title, description, dueDate, dueTime, priority, category, estimatedMinutes, isRecurring } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const sql = `
      INSERT INTO tasks (
        user_id, title, description, due_date, due_time,
        priority, status, category, estimated_minutes, is_recurring
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'todo', $7, $8, $9)
      RETURNING id, user_id as "userId", title, description,
                to_char(due_date, 'YYYY-MM-DD') as "dueDate",
                due_time::text as "dueTime",
                priority, status, category,
                estimated_minutes as "estimatedMinutes",
                is_recurring as "isRecurring", is_ai_generated as "isAiGenerated",
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
      Boolean(isRecurring),
    ];

    const result = await query(sql, params);
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
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    const result = await query(sql, [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
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
