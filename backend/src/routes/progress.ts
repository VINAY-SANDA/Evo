import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

// GET /api/progress/scores
router.get('/scores', async (_req: Request, res: Response) => {
  try {
    // 1. Learning progress
    const learnRes = await query(
      'SELECT COALESCE(AVG(progress), 0) as avg_prog FROM learning_subjects WHERE user_id = $1',
      [DEFAULT_USER_ID]
    );
    const learningScore = Math.round(Number(learnRes.rows[0]?.avg_prog) || 75);

    // 2. Projects progress
    const projRes = await query(
      'SELECT COALESCE(AVG(progress), 0) as avg_prog FROM projects WHERE user_id = $1',
      [DEFAULT_USER_ID]
    );
    const projectsScore = Math.round(Number(projRes.rows[0]?.avg_prog) || 65);

    // 3. Habits score (active habits completion / streaks)
    const habitsRes = await query(
      `SELECT
         COUNT(*) as total,
         COALESCE(AVG(CASE WHEN current_streak > 0 THEN 100 ELSE 30 END), 70) as streak_score
       FROM habits WHERE user_id = $1 AND active = true`,
      [DEFAULT_USER_ID]
    );
    const habitsScore = Math.round(Number(habitsRes.rows[0]?.streak_score) || 75);

    // 4. Goals by category
    const goalsRes = await query(
      'SELECT category, COALESCE(AVG(progress), 0) as avg_prog FROM goals WHERE user_id = $1 GROUP BY category',
      [DEFAULT_USER_ID]
    );
    const catMap: Record<string, number> = {};
    for (const row of goalsRes.rows) {
      catMap[row.category] = Math.round(Number(row.avg_prog));
    }

    const careerScore = catMap['career'] ?? 80;
    const healthScore = catMap['health'] ?? 70;

    // 5. Finance score (income vs expense ratio)
    const finRes = await query(
      `SELECT
         COALESCE((SELECT SUM(amount) FROM incomes WHERE user_id = $1), 30000) as income,
         COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = $1), 5900) as expense`,
      [DEFAULT_USER_ID]
    );
    const inc = Number(finRes.rows[0]?.income) || 30000;
    const exp = Number(finRes.rows[0]?.expense) || 5900;
    const financeRatio = inc > 0 ? Math.min(100, Math.round(((inc - exp) / inc) * 100)) : 70;
    const financeScore = Math.max(40, financeRatio);

    const scores = [
      { category: 'Career', score: careerScore, change: 12, icon: '💼', color: '#6C5CE7' },
      { category: 'Learning', score: learningScore, change: 8, icon: '📖', color: '#00D2FF' },
      { category: 'Finance', score: financeScore, change: -4, icon: '💰', color: '#00E676' },
      { category: 'Projects', score: projectsScore, change: 15, icon: '🚀', color: '#AB47BC' },
      { category: 'Habits', score: habitsScore, change: 5, icon: '🔥', color: '#FFA726' },
      { category: 'Health', score: healthScore, change: 3, icon: '❤️', color: '#FF6B6B' },
    ];

    const overallScore = Math.round(scores.reduce((s, c) => s + c.score, 0) / scores.length);
    res.json({ scores, overallScore, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Error calculating progress scores:', error);
    res.status(500).json({ error: 'Failed to calculate progress scores' });
  }
});

// GET /api/progress/summary
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const tasksRes = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM tasks WHERE user_id = $1`,
      [DEFAULT_USER_ID]
    );
    const habitsRes = await query(
      `SELECT
         COUNT(*) as total,
         COALESCE(AVG(current_streak), 0) as avg_streak
       FROM habits WHERE user_id = $1 AND active = true`,
      [DEFAULT_USER_ID]
    );
    const goalsRes = await query(
      `SELECT
         COUNT(*) as total,
         COALESCE(AVG(progress), 0) as avg_prog
       FROM goals WHERE user_id = $1`,
      [DEFAULT_USER_ID]
    );

    const taskTotal = Number(tasksRes.rows[0]?.total) || 1;
    const taskCompleted = Number(tasksRes.rows[0]?.completed) || 0;
    const taskRate = Math.round((taskCompleted / taskTotal) * 100);

    const habitStreak = Math.round(Number(habitsRes.rows[0]?.avg_streak) || 14);
    const goalRate = Math.round(Number(goalsRes.rows[0]?.avg_prog) || 70);

    const overallScore = Math.round((taskRate + goalRate + Math.min(100, habitStreak * 5)) / 3);

    res.json({
      overallScore: Math.max(50, Math.min(100, overallScore)),
      weeklyChange: 7,
      streak: habitStreak,
      completionRates: {
        tasks: taskRate,
        habits: Math.min(100, habitStreak * 6),
        goals: goalRate,
      },
      topPerforming: 'Career',
      needsAttention: 'Finance',
    });
  } catch (error) {
    console.error('Error fetching progress summary:', error);
    res.status(500).json({ error: 'Failed to fetch progress summary' });
  }
});

export default router;
