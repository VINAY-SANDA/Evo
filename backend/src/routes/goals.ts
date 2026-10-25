import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

router.get('/:id/check-ins', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT c.id, c.goal_id as "goalId", c.value::float as value, c.note, c.created_at as "createdAt"
      FROM goal_check_ins c JOIN goals g ON g.id = c.goal_id
      WHERE c.goal_id = $1 AND g.user_id = $2 ORDER BY c.created_at DESC LIMIT 50`,
    [req.params.id, DEFAULT_USER_ID]);
    res.json({ checkIns: result.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/check-ins', async (req: Request, res: Response) => {
  try {
    const value = Number(req.body.currentValue);
    if (!Number.isFinite(value) || value < 0) return res.status(400).json({ error: 'currentValue must be zero or greater' });
    const result = await query(`
      WITH updated_goal AS (
        UPDATE goals SET current_value = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $3
        RETURNING id, target_value, current_value
      )
      INSERT INTO goal_check_ins (goal_id, value, note)
      SELECT id, current_value, NULLIF($4, '') FROM updated_goal
      RETURNING id, goal_id as "goalId", value::float as value, note, created_at as "createdAt"`,
    [req.params.id, value, DEFAULT_USER_ID, String(req.body.note || '').trim()]);
    if (!result.rows.length) return res.status(404).json({ error: 'Goal not found' });
    res.status(201).json({ ...result.rows[0], currentValue: value });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

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
    const { title, description, category, currentValue, targetValue, unit, deadline, status, priority, progress } = req.body;

    // Check if goal exists first
    const existingRes = await query('SELECT * FROM goals WHERE id = $1 AND user_id = $2', [id, DEFAULT_USER_ID]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
    const existing = existingRes.rows[0];

    const finalTargetValue = targetValue !== undefined ? Number(targetValue) : Number(existing.target_value) || 100;
    let finalCurrentValue: number | null = null;

    if (progress !== undefined && !isNaN(Number(progress))) {
      const cleanProgress = Math.min(100, Math.max(0, Number(progress)));
      finalCurrentValue = (cleanProgress / 100) * finalTargetValue;
    } else if (currentValue !== undefined && !isNaN(Number(currentValue))) {
      finalCurrentValue = Number(currentValue);
    }

    const sql = `
      UPDATE goals
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          target_value = COALESCE($4, target_value),
          current_value = COALESCE($5, current_value),
          unit = COALESCE($6, unit),
          deadline = COALESCE($7::date, deadline),
          status = COALESCE($8, status),
          priority = COALESCE($9, priority),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND user_id = $11
      RETURNING id, user_id as "userId", title, description, category,
                target_value::float as "targetValue", current_value::float as "currentValue",
                unit, to_char(deadline, 'YYYY-MM-DD') as "deadline",
                priority, status, progress,
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    const params = [
      title !== undefined ? String(title).trim() : null,
      description !== undefined ? String(description).trim() : null,
      category || null,
      targetValue !== undefined ? finalTargetValue : null,
      finalCurrentValue !== null ? finalCurrentValue : null,
      unit || null,
      deadline || null,
      status || null,
      priority || null,
      id,
      DEFAULT_USER_ID,
    ];

    const result = await query(sql, params);
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
      SELECT gm.id, gm.goal_id as "goalId", gm.title, gm.order_index as "orderIndex",
             gm.status, to_char(gm.due_date, 'YYYY-MM-DD') as "dueDate",
             gm.completed_at as "completedAt", gm.created_at as "createdAt"
      FROM goal_milestones gm
      JOIN goals g ON g.id = gm.goal_id
      WHERE g.id = $1 AND g.user_id = $2
      ORDER BY gm.order_index ASC, gm.created_at ASC
    `;
    const result = await query(sql, [id, DEFAULT_USER_ID]);
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
      SELECT $1, $3, $4, $5, 'pending'
      WHERE EXISTS (SELECT 1 FROM goals WHERE id = $1 AND user_id = $2)
      RETURNING id, goal_id as "goalId", title, order_index as "orderIndex",
                status, to_char(due_date, 'YYYY-MM-DD') as "dueDate",
                completed_at as "completedAt", created_at as "createdAt"
    `;
    const params = [
      goalId,
      DEFAULT_USER_ID,
      String(title).trim(),
      dueDate || null,
      Number(orderIndex) || 1,
    ];

    const result = await query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
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

// PATCH /api/goals/milestones/:mId/toggle
router.patch('/milestones/:mId/toggle', async (req: Request, res: Response) => {
  try {
    const mId = String(req.params.mId);
    const sql = `
      UPDATE goal_milestones gm
      SET status = CASE WHEN gm.status = 'completed' THEN 'pending' ELSE 'completed' END,
          completed_at = CASE WHEN gm.status = 'completed' THEN NULL ELSE CURRENT_TIMESTAMP END
      FROM goals g
      WHERE gm.id = $1 AND gm.goal_id = g.id AND g.user_id = $2
      RETURNING gm.id, gm.goal_id as "goalId", gm.title, gm.status,
                to_char(gm.due_date, 'YYYY-MM-DD') as "dueDate",
                gm.completed_at as "completedAt", gm.created_at as "createdAt"
    `;
    const result = await query(sql, [mId, DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Milestone not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/milestones/:mId
router.delete('/milestones/:mId', async (req: Request, res: Response) => {
  try {
    const mId = String(req.params.mId);
    const result = await query(
      `DELETE FROM goal_milestones gm
       USING goals g
       WHERE gm.id = $1 AND gm.goal_id = g.id AND g.user_id = $2
       RETURNING gm.id`,
      [mId, DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Milestone not found' });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
