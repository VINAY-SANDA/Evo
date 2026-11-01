import { Router, type Request, type Response } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router = Router();

const exportQueries: Record<string, string> = {
  profile: 'SELECT id, name, email, timezone, ai_tone, ai_context_enabled FROM users WHERE id = $1',
  goals: 'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at',
  goalMilestones: `SELECT gm.* FROM goal_milestones gm JOIN goals g ON g.id = gm.goal_id WHERE g.user_id = $1 ORDER BY gm.created_at`,
  goalCheckIns: `SELECT ci.* FROM goal_check_ins ci JOIN goals g ON g.id = ci.goal_id WHERE g.user_id = $1 ORDER BY ci.created_at`,
  projects: 'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at',
  projectMilestones: `SELECT pm.* FROM project_milestones pm JOIN projects p ON p.id = pm.project_id WHERE p.user_id = $1 ORDER BY pm.created_at`,
  tasks: 'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at',
  habits: 'SELECT * FROM habits WHERE user_id = $1 ORDER BY created_at',
  habitLogs: `SELECT hl.* FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = $1 ORDER BY hl.log_date`,
  reminders: 'SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at',
  expenses: 'SELECT * FROM expenses WHERE user_id = $1 ORDER BY date',
  incomes: 'SELECT * FROM incomes WHERE user_id = $1 ORDER BY date',
  savingsGoals: 'SELECT * FROM savings_goals WHERE user_id = $1 ORDER BY created_at',
  financeBudgets: 'SELECT * FROM finance_budgets WHERE user_id = $1 ORDER BY month',
  savingsContributions: `SELECT sc.* FROM savings_contributions sc JOIN savings_goals sg ON sg.id = sc.savings_goal_id WHERE sg.user_id = $1 ORDER BY sc.date`,
  learningSubjects: 'SELECT * FROM learning_subjects WHERE user_id = $1 ORDER BY created_at',
  learningTopics: `SELECT lt.* FROM learning_topics lt JOIN learning_subjects ls ON ls.id = lt.subject_id WHERE ls.user_id = $1 ORDER BY lt.created_at`,
  studySessions: 'SELECT * FROM learning_study_sessions WHERE user_id = $1 ORDER BY studied_at',
  dailyReviews: 'SELECT * FROM daily_reviews WHERE user_id = $1 ORDER BY date',
  weeklyReviews: 'SELECT * FROM weekly_reviews WHERE user_id = $1 ORDER BY week_start',
  notifications: 'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at',
  memories: 'SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at',
  diaryEntries: 'SELECT * FROM diary_entries WHERE user_id = $1 ORDER BY entry_date, created_at',
  movieReviews: 'SELECT * FROM movie_reviews WHERE user_id = $1 ORDER BY watched_at, created_at',
};

router.get('/', async (_req: Request, res: Response) => {
  let client: PoolClient | undefined;
  try {
    const connectedClient = await pool.connect();
    client = connectedClient;
    await connectedClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const data: Record<string, unknown[]> = {};
    for (const [key, sql] of Object.entries(exportQueries)) {
      const result = await connectedClient.query(sql, [DEFAULT_USER_ID]);
      data[key] = result.rows;
    }
    await connectedClient.query('COMMIT');
    res.setHeader('Content-Disposition', 'attachment; filename="evo-data-export.json"');
    res.json({ format: 'evo-data-export-v1', exportedAt: new Date().toISOString(), data });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    console.error('Could not export EVO data:', error);
    res.status(500).json({ error: 'EVO could not prepare your data export. Please try again.' });
  } finally {
    client?.release();
  }
});

export default router;
