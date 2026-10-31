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

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, priority, deadline, status } = req.body;
    const result = await query(`UPDATE projects SET
      name = COALESCE(NULLIF($1, ''), name), description = COALESCE($2, description),
      priority = COALESCE($3, priority), deadline = COALESCE($4::date, deadline),
      status = COALESCE($5, status), updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
      RETURNING id, user_id as "userId", name, description, status, priority,
        to_char(deadline, 'YYYY-MM-DD') as deadline, progress, created_at as "createdAt", updated_at as "updatedAt"`,
    [name ? String(name).trim() : null, description ?? null, priority ?? null, deadline || null, status ?? null, req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Could not update project' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Project not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Could not delete project' });
  }
});

// GET /api/projects/:id/milestones
router.get('/:id/milestones', async (req: Request, res: Response) => {
  try {
    const projectId = String(req.params.id);
    const sql = `
      SELECT pm.id, pm.project_id as "projectId", pm.title, pm.order_index as "orderIndex",
             pm.status, to_char(pm.completed_at, 'YYYY-MM-DD') as "completedAt",
             pm.created_at as "createdAt"
      FROM project_milestones pm
      JOIN projects p ON p.id = pm.project_id
      WHERE p.id = $1 AND p.user_id = $2
      ORDER BY pm.order_index ASC, pm.created_at ASC
    `;
    const result = await query(sql, [projectId, DEFAULT_USER_ID]);
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
      SELECT $1, $3, $4, 'pending'
      WHERE EXISTS (SELECT 1 FROM projects WHERE id = $1 AND user_id = $2)
      RETURNING id, project_id as "projectId", title, order_index as "orderIndex",
                status, to_char(completed_at, 'YYYY-MM-DD') as "completedAt",
                created_at as "createdAt"
    `;
    const params = [projectId, DEFAULT_USER_ID, String(title).trim(), Number(orderIndex) || 1];

    const result = await query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    await query(`UPDATE projects p SET progress = COALESCE((
      SELECT ROUND(COUNT(*) FILTER (WHERE pm.status = 'completed') * 100.0 / NULLIF(COUNT(*), 0))
      FROM project_milestones pm WHERE pm.project_id = p.id
    ), 0) WHERE p.id = $1`, [projectId]);
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
      UPDATE project_milestones pm
      SET status = CASE WHEN pm.status = 'completed' THEN 'pending' ELSE 'completed' END,
          completed_at = CASE WHEN pm.status = 'completed' THEN NULL ELSE CURRENT_DATE END
      FROM projects p
      WHERE pm.id = $1 AND pm.project_id = p.id AND p.user_id = $2
      RETURNING pm.id, pm.project_id as "projectId", pm.title, pm.status,
                to_char(pm.completed_at, 'YYYY-MM-DD') as "completedAt"
    `;
    const result = await query(sql, [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Milestone not found' });
    await query(`UPDATE projects p SET progress = COALESCE((
      SELECT ROUND(COUNT(*) FILTER (WHERE pm.status = 'completed') * 100.0 / NULLIF(COUNT(*), 0))
      FROM project_milestones pm WHERE pm.project_id = p.id
    ), 0), updated_at = CURRENT_TIMESTAMP WHERE p.id = $1`, [result.rows[0].projectId]);
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/milestones/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(`DELETE FROM project_milestones pm USING projects p
      WHERE pm.id = $1 AND pm.project_id = p.id AND p.user_id = $2
      RETURNING pm.project_id as "projectId"`, [req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Milestone not found' });
    await query(`UPDATE projects p SET progress = COALESCE((
      SELECT ROUND(COUNT(*) FILTER (WHERE pm.status = 'completed') * 100.0 / NULLIF(COUNT(*), 0))
      FROM project_milestones pm WHERE pm.project_id = p.id
    ), 0), updated_at = CURRENT_TIMESTAMP WHERE p.id = $1`, [result.rows[0].projectId]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Could not delete milestone' });
  }
});

export default router;
