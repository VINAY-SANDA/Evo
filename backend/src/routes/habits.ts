import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

// GET /api/habits
router.get('/', async (_req: Request, res: Response) => {
  try {
    const includeArchived = String(_req.query.includeArchived || '').toLowerCase() === 'true';
    const sql = `
      SELECT h.id, h.user_id as "userId", h.name, h.description, h.icon, h.color,
             h.frequency, h.schedule_days as "scheduleDays", h.target, h.unit, h.current_streak as "currentStreak",
             h.longest_streak as "longestStreak", h.active,
             to_char(h.created_at, 'YYYY-MM-DD') as "createdAt",
             COALESCE(hl.completed, FALSE) as "completedToday"
      FROM habits h
      LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.log_date = CURRENT_DATE
      WHERE h.user_id = $1 AND ($2::boolean OR h.active = TRUE)
      ORDER BY h.created_at ASC
    `;
    const result = await query(sql, [DEFAULT_USER_ID, includeArchived]);
    res.json({ habits: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function setHabitActive(req: Request, res: Response, active: boolean) {
  try {
    const result = await query(
      `UPDATE habits
       SET active = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id as "userId", name, description, icon, color,
                 frequency, target, unit, current_streak as "currentStreak",
                 longest_streak as "longestStreak", active`,
      [active, String(req.params.id), DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

router.patch('/:id/archive', (req: Request, res: Response) => setHabitActive(req, res, false));
router.patch('/:id/restore', (req: Request, res: Response) => setHabitActive(req, res, true));

// POST /api/habits
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, icon, color, frequency, scheduleDays, target, unit } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const sql = `
      INSERT INTO habits (
        user_id, name, description, icon, color, frequency, schedule_days, target, unit,
        current_streak, longest_streak, active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, TRUE)
      RETURNING id, user_id as "userId", name, description, icon, color,
                frequency, schedule_days as "scheduleDays", target, unit, current_streak as "currentStreak",
                longest_streak as "longestStreak", active,
                to_char(created_at, 'YYYY-MM-DD') as "createdAt"
    `;
    const params = [
      DEFAULT_USER_ID,
      String(name).trim(),
      description ? String(description).trim() : '',
      icon || '🎯',
      color || '#6C5CE7',
      frequency || 'daily',
      Array.isArray(scheduleDays) ? [...new Set(scheduleDays.map(Number).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6))] : null,
      Number(target) || 1,
      unit || 'times',
    ];

    const result = await query(sql, params);
    res.status(201).json({ ...result.rows[0], completedToday: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary/weekly', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT h.id, h.name, h.icon, h.current_streak as "currentStreak",
        h.schedule_days as "scheduleDays",
        COUNT(hl.id)::int as "completedDays"
      FROM habits h
      LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.log_date >= CURRENT_DATE - INTERVAL '6 days' AND hl.log_date <= CURRENT_DATE AND hl.completed = TRUE
      WHERE h.user_id = $1 AND h.active = TRUE
      GROUP BY h.id ORDER BY "completedDays" DESC, h.name`, [DEFAULT_USER_ID]);
    const totalExpected = result.rows.reduce((sum: number, habit: any) => {
      const expectedDays = Array.isArray(habit.scheduleDays) ? habit.scheduleDays.length : (habit.frequency === 'weekly' ? 1 : 7);
      return sum + Math.min(expectedDays, 7);
    }, 0);
    const completed = result.rows.reduce((sum: number, habit: any) => sum + Number(habit.completedDays || 0), 0);
    res.json({ habits: result.rows, completed, expected: totalExpected, completionRate: totalExpected ? Math.round(completed / totalExpected * 100) : 0 });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/habits/:id/complete
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const habitCheck = await query(
      'SELECT id FROM habits WHERE id = $1 AND user_id = $2',
      [id, DEFAULT_USER_ID]
    );
    if (habitCheck.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });

    // Check today's log status
    const logCheck = await query(`
      SELECT completed FROM habit_logs
      WHERE habit_id = $1 AND log_date = CURRENT_DATE
    `, [id]);

    const wasCompleted = logCheck.rows.length > 0 && logCheck.rows[0].completed;
    const newCompleted = !wasCompleted;

    // Upsert habit_log
    await query(`
      INSERT INTO habit_logs (habit_id, log_date, completed, value)
      VALUES ($1, CURRENT_DATE, $2, 1)
      ON CONFLICT (habit_id, log_date)
      DO UPDATE SET completed = EXCLUDED.completed
    `, [id, newCompleted]);

    // Update streak on habit
    const updateSql = newCompleted
      ? `
        UPDATE habits
        SET current_streak = current_streak + 1,
            longest_streak = GREATEST(longest_streak, current_streak + 1)
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id as "userId", name, description, icon, color,
                  frequency, target, unit, current_streak as "currentStreak",
                  longest_streak as "longestStreak", active
      `
      : `
        UPDATE habits
        SET current_streak = GREATEST(0, current_streak - 1)
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id as "userId", name, description, icon, color,
                  frequency, target, unit, current_streak as "currentStreak",
                  longest_streak as "longestStreak", active
      `;

    const result = await query(updateSql, [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    res.json({ ...result.rows[0], completedToday: newCompleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/habits/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await query('DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING id', [id, DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
