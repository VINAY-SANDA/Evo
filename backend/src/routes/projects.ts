import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

// GET /api/projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const sql = `
      SELECT id, user_id as "userId", name, description, status, priority,
             to_char(deadline, 'YYYY-MM-DD') as deadline, progress,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM projects
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await query(sql, [DEFAULT_USER_ID]);
    res.json({ projects: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, priority, deadline } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const sql = `
      INSERT INTO projects (user_id, name, description, status, priority, deadline, progress)
      VALUES ($1, $2, $3, 'active', $4, $5, 0)
      RETURNING id, user_id as "userId", name, description, status, priority,
                to_char(deadline, 'YYYY-MM-DD') as deadline, progress,
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    const params = [
      DEFAULT_USER_ID,
      String(name).trim(),
      description ? String(description).trim() : '',
      priority || 'medium',
      deadline || new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
    ];

    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/milestones
router.get('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.id);
    const sql = `
      SELECT id, project_id as "projectId", title, order_index as "orderIndex",
             status, to_char(completed_at, 'YYYY-MM-DD') as "completedAt",
             created_at as "createdAt"
      FROM project_milestones
      WHERE project_id = $1
      ORDER BY order_index ASC, created_at ASC
    `;
    const result = await query(sql, [projectId]);
    res.json({ milestones: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/milestones
router.post('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.id);
    const { title, orderIndex } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const sql = `
      INSERT INTO project_milestones (project_id, title, order_index, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id, project_id as "projectId", title, order_index as "orderIndex",
                status, to_char(completed_at, 'YYYY-MM-DD') as "completedAt",
                created_at as "createdAt"
    `;
    const params = [projectId, String(title).trim(), Number(orderIndex) || 1];

    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/projects/milestones/:id/toggle
router.patch('/milestones/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sql = `
      UPDATE project_milestones
      SET status = CASE WHEN status = 'completed' THEN 'pending' ELSE 'completed' END,
          completed_at = CASE WHEN status = 'completed' THEN NULL ELSE CURRENT_DATE END
      WHERE id = $1
      RETURNING id, project_id as "projectId", title, status, to_char(completed_at, 'YYYY-MM-DD') as "completedAt"
    `;
    const result = await query(sql, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Milestone not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
