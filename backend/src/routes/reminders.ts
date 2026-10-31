import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

function mapReminder(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    type: row.type || 'daily',
    time: typeof row.time === 'string' ? row.time.slice(0, 5) : row.time,
    daysOfWeek: row.days_of_week || null,
    scheduledDate: row.scheduled_date ? (typeof row.scheduled_date === 'string' ? row.scheduled_date.split('T')[0] : row.scheduled_date.toISOString?.().split('T')[0]) : null,
    active: row.active ?? true,
    goalId: row.goal_id || null,
    createdAt: row.created_at,
  };
}

// GET /api/reminders
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM reminders WHERE user_id = $1 ORDER BY time ASC',
      [DEFAULT_USER_ID]
    );
    res.json({ reminders: result.rows.map(mapReminder), total: result.rows.length });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/reminders
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, type, time, daysOfWeek, goalId, scheduledDate } = req.body;
    if (!title || !time) return res.status(400).json({ error: 'title and time are required' });

    const result = await query(
      `INSERT INTO reminders (user_id, title, type, time, days_of_week, active, goal_id, scheduled_date)
       SELECT $1, $2, $3, $4, $5, true, $6, $7
       WHERE $6::uuid IS NULL OR EXISTS (
         SELECT 1 FROM goals WHERE id = $6 AND user_id = $1
       )
       RETURNING *`,
      [DEFAULT_USER_ID, title, type || 'daily', time, daysOfWeek || null, goalId || null, scheduledDate || null]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });

    res.status(201).json(mapReminder(result.rows[0]));
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// PATCH /api/reminders/:id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title, type, time, daysOfWeek, active, goalId, scheduledDate } = req.body;
    const existing = await query(
      'SELECT * FROM reminders WHERE id = $1 AND user_id = $2',
      [req.params.id, DEFAULT_USER_ID]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    const current = existing.rows[0];
    const newTitle = title !== undefined ? title : current.title;
    const newType = type !== undefined ? type : current.type;
    const newTime = time !== undefined ? time : current.time;
    const newDays = daysOfWeek !== undefined ? daysOfWeek : current.days_of_week;
    const newActive = active !== undefined ? active : current.active;
    const newGoalId = goalId !== undefined ? goalId : current.goal_id;
    const newScheduledDate = scheduledDate !== undefined ? scheduledDate : current.scheduled_date;

    const result = await query(
      `UPDATE reminders
       SET title = $1, type = $2, time = $3, days_of_week = $4, active = $5, goal_id = $6, scheduled_date = $7
       WHERE id = $8 AND user_id = $9
         AND ($6::uuid IS NULL OR EXISTS (
           SELECT 1 FROM goals WHERE id = $6 AND user_id = $9
         ))
       RETURNING *`,
      [newTitle, newType, newTime, newDays, newActive, newGoalId, newScheduledDate, req.params.id, DEFAULT_USER_ID]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder or goal not found' });

    res.json(mapReminder(result.rows[0]));
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reminder not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

export default router;
