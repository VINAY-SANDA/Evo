import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

// GET /api/goals
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, status } = req.query;
    let sql = `
      SELECT id, user_id as "userId", title, description, category,
             target_value::float as "targetValue", current_value::float as "currentValue",
             unit, to_char(deadline, 'YYYY-MM-DD') as "deadline",
             priority, status, progress,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM goals
      WHERE user_id = $1
    `;
    const params: any[] = [DEFAULT_USER_ID];
    let pIdx = 2;

    if (category && category !== 'all') {
      sql += ` AND category = $${pIdx++}`;
      params.push(category);
    }
    if (status) {
      sql += ` AND status = $${pIdx++}`;
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json({ goals: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/goals/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sql = `
      SELECT id, user_id as "userId", title, description, category,
             target_value::float as "targetValue", current_value::float as "currentValue",
             unit, to_char(deadline, 'YYYY-MM-DD') as "deadline",
             priority, status, progress,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM goals
      WHERE id = $1 AND user_id = $2
    `;
    const result = await query(sql, [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, category, targetValue, unit, deadline, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const sql = `
      INSERT INTO goals (
        user_id, title, description, category, target_value, current_value,
        unit, deadline, priority, status
      )
      VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, 'active')
      RETURNING id, user_id as "userId", title, description, category,
                target_value::float as "targetValue", current_value::float as "currentValue",
                unit, to_char(deadline, 'YYYY-MM-DD') as "deadline",
                priority, status, progress,
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    const params = [
      DEFAULT_USER_ID,
      String(title).trim(),
      description ? String(description).trim() : '',
      category || 'career',
      Number(targetValue) || 100,
      unit || '%',
      deadline || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      priority || 'medium',
    ];

    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/goals/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { title, description, category, currentValue, status, priority, progress } = req.body;

    const sql = `
      UPDATE goals
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          current_value = COALESCE($4, current_value),
          status = COALESCE($5, status),
          priority = COALESCE($6, priority),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING id, user_id as "userId", title, description, category,
                target_value::float as "targetValue", current_value::float as "currentValue",
                unit, to_char(deadline, 'YYYY-MM-DD') as "deadline",
                priority, status, progress,
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    const params = [
      title || null,
      description || null,
      category || null,
      currentValue !== undefined ? Number(currentValue) : null,
      status || null,
      priority || null,
      id,
      DEFAULT_USER_ID,
    ];

    const result = await query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/goals/:id/milestones
router.get('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sql = `
      SELECT id, goal_id as "goalId", title, order_index as "orderIndex",
             status, to_char(due_date, 'YYYY-MM-DD') as "dueDate",
             completed_at as "completedAt", created_at as "createdAt"
      FROM goal_milestones
      WHERE goal_id = $1
      ORDER BY order_index ASC, created_at ASC
    `;
    const result = await query(sql, [id]);
    res.json({ milestones: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals/:id/milestones
router.post('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const goalId = String(req.params.id);
    const { title, dueDate, orderIndex } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const sql = `
      INSERT INTO goal_milestones (goal_id, title, due_date, order_index, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, goal_id as "goalId", title, order_index as "orderIndex",
                status, to_char(due_date, 'YYYY-MM-DD') as "dueDate",
                completed_at as "completedAt", created_at as "createdAt"
    `;
    const params = [
      goalId,
      String(title).trim(),
      dueDate || null,
      Number(orderIndex) || 1,
    ];

    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
