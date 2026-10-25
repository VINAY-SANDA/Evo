import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

function mapDailyReview(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    date: typeof row.date === 'string' ? row.date.split('T')[0] : row.date?.toISOString?.().split('T')[0] || row.date,
    completedTasks: Number(row.completed_tasks) || 0,
    totalTasks: Number(row.total_tasks) || 0,
    completedHabits: Number(row.completed_habits) || 0,
    totalHabits: Number(row.total_habits) || 0,
    score: Number(row.score) || 0,
    aiSummary: row.ai_summary || '',
    whatWentWell: row.what_went_well || [],
    whatWentWrong: row.what_went_wrong || [],
    suggestions: row.suggestions || [],
    createdAt: row.created_at,
  };
}

function mapWeeklyReview(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: typeof row.week_start === 'string' ? row.week_start.split('T')[0] : row.week_start?.toISOString?.().split('T')[0] || row.week_start,
    weekEnd: typeof row.week_end === 'string' ? row.week_end.split('T')[0] : row.week_end?.toISOString?.().split('T')[0] || row.week_end,
    overallScore: Number(row.overall_score) || 0,
    categoryScores: row.category_scores || [],
    biggestAchievement: row.biggest_achievement || '',
    biggestProblem: row.biggest_problem || '',
    nextWeekPriorities: row.next_week_priorities || [],
    createdAt: row.created_at,
  };
}

// GET /api/reviews/daily
router.get('/daily', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM daily_reviews WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
      [DEFAULT_USER_ID]
    );
    const mapped = result.rows.map(mapDailyReview);
    res.json({ reviews: mapped, latest: mapped[0] || null });
  } catch (error) {
    console.error('Error fetching daily reviews:', error);
    res.status(500).json({ error: 'Failed to fetch daily reviews' });
  }
});

// POST /api/reviews/daily
router.post('/daily', async (req: Request, res: Response) => {
  try {
    const { date, completedTasks, totalTasks, completedHabits, totalHabits, whatWentWell, whatWentWrong, suggestions, aiSummary } = req.body;
    const taskScore = Number(totalTasks) > 0 ? (Number(completedTasks) / Number(totalTasks)) * 50 : 0;
    const habitScore = Number(totalHabits) > 0 ? (Number(completedHabits) / Number(totalHabits)) * 50 : 0;
    const score = Math.round(taskScore + habitScore);
    const reviewDate = date || new Date().toISOString().split('T')[0];
    const summary = aiSummary || `Daily review recorded with score ${score}/100. Keep up the high leverage momentum!`;

    const result = await query(
      `INSERT INTO daily_reviews
        (user_id, date, completed_tasks, total_tasks, completed_habits, total_habits, score, ai_summary, what_went_well, what_went_wrong, suggestions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (user_id, date) DO UPDATE SET
        completed_tasks = EXCLUDED.completed_tasks,
        total_tasks = EXCLUDED.total_tasks,
        completed_habits = EXCLUDED.completed_habits,
        total_habits = EXCLUDED.total_habits,
        score = EXCLUDED.score,
        ai_summary = EXCLUDED.ai_summary,
        what_went_well = EXCLUDED.what_went_well,
        what_went_wrong = EXCLUDED.what_went_wrong,
        suggestions = EXCLUDED.suggestions
       RETURNING *`,
      [
        DEFAULT_USER_ID,
        reviewDate,
        Number(completedTasks) || 0,
        Number(totalTasks) || 0,
        Number(completedHabits) || 0,
        Number(totalHabits) || 0,
        score,
        summary,
        JSON.stringify(whatWentWell || []),
        JSON.stringify(whatWentWrong || []),
        JSON.stringify(suggestions || []),
      ]
    );

    res.status(201).json(mapDailyReview(result.rows[0]));
  } catch (error) {
    console.error('Error saving daily review:', error);
    res.status(500).json({ error: 'Failed to save daily review' });
  }
});

// GET /api/reviews/weekly
router.get('/weekly', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM weekly_reviews WHERE user_id = $1 ORDER BY week_start DESC LIMIT 12',
      [DEFAULT_USER_ID]
    );
    const mapped = result.rows.map(mapWeeklyReview);
    res.json({ reviews: mapped, latest: mapped[0] || null });
  } catch (error) {
    console.error('Error fetching weekly reviews:', error);
    res.status(500).json({ error: 'Failed to fetch weekly reviews' });
  }
});

// POST /api/reviews/weekly
router.post('/weekly', async (req: Request, res: Response) => {
  try {
    const { weekStart, weekEnd, overallScore, biggestAchievement, biggestProblem, nextWeekPriorities, categoryScores } = req.body;

    const result = await query(
      `INSERT INTO weekly_reviews
        (user_id, week_start, week_end, overall_score, category_scores, biggest_achievement, biggest_problem, next_week_priorities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        DEFAULT_USER_ID,
        weekStart || new Date().toISOString().split('T')[0],
        weekEnd || new Date().toISOString().split('T')[0],
        Number(overallScore) || 0,
        JSON.stringify(categoryScores || []),
        biggestAchievement || '',
        biggestProblem || '',
        JSON.stringify(nextWeekPriorities || []),
      ]
    );

    res.status(201).json(mapWeeklyReview(result.rows[0]));
  } catch (error) {
    console.error('Error saving weekly review:', error);
    res.status(500).json({ error: 'Failed to save weekly review' });
  }
});

export default router;
