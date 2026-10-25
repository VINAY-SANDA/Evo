import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

// GET /api/progress/scores
router.get('/scores', async (_req: Request, res: Response) => {
  try {
    // 1. Learning progress
    const learnRes = await query(
      'SELECT COUNT(*) as count, COALESCE(AVG(progress), 0) as avg_prog FROM learning_subjects WHERE user_id = $1',
      [DEFAULT_USER_ID]
    );
    const hasLearning = Number(learnRes.rows[0]?.count) > 0;
    const learningScore = hasLearning ? Math.round(Number(learnRes.rows[0]?.avg_prog)) : 0;

    // 2. Projects progress
    const projRes = await query(
      'SELECT COUNT(*) as count, COALESCE(AVG(progress), 0) as avg_prog FROM projects WHERE user_id = $1',
      [DEFAULT_USER_ID]
    );
    const hasProjects = Number(projRes.rows[0]?.count) > 0;
    const projectsScore = hasProjects ? Math.round(Number(projRes.rows[0]?.avg_prog)) : 0;

    // 3. Habits score (active habits completion / streaks)
    const habitsRes = await query(
      `SELECT
         COUNT(*) as total,
         COALESCE(AVG(CASE WHEN current_streak > 0 THEN 100 ELSE 0 END), 0) as streak_score
       FROM habits WHERE user_id = $1 AND active = true`,
      [DEFAULT_USER_ID]
    );
    const hasHabits = Number(habitsRes.rows[0]?.total) > 0;
    const habitsScore = hasHabits ? Math.round(Number(habitsRes.rows[0]?.streak_score)) : 0;

    // 4. Goals by category
    const goalsRes = await query(
      'SELECT category, COUNT(*) as count, COALESCE(AVG(progress), 0) as avg_prog FROM goals WHERE user_id = $1 GROUP BY category',
      [DEFAULT_USER_ID]
    );
    const catMap: Record<string, { count: number; avgProg: number }> = {};
    for (const row of goalsRes.rows) {
      catMap[row.category] = {
        count: Number(row.count) || 0,
        avgProg: Math.round(Number(row.avg_prog)) || 0,
      };
    }

    const careerScore = catMap['career']?.avgProg ?? 0;
    const healthScore = catMap['health']?.avgProg ?? 0;

    // 5. Finance score (income vs expense ratio)
    const finRes = await query(
      `SELECT
         COALESCE((SELECT SUM(amount) FROM incomes WHERE user_id = $1), 0) as income,
         COALESCE((SELECT SUM(amount) FROM expenses WHERE user_id = $1), 0) as expense`,
      [DEFAULT_USER_ID]
    );
    const inc = Number(finRes.rows[0]?.income) || 0;
    const exp = Number(finRes.rows[0]?.expense) || 0;
    const hasFinance = inc > 0 || exp > 0;
    const financeRatio = inc > 0 ? Math.min(100, Math.max(0, Math.round(((inc - exp) / inc) * 100))) : 0;
    const financeScore = hasFinance ? financeRatio : 0;

    const scores = [
      { category: 'Career', score: careerScore, change: 0, icon: '💼', color: '#0A84FF' },
      { category: 'Learning', score: learningScore, change: 0, icon: '📖', color: '#5E5CE6' },
      { category: 'Finance', score: financeScore, change: 0, icon: '💰', color: '#30D158' },
      { category: 'Projects', score: projectsScore, change: 0, icon: '🚀', color: '#BF5AF2' },
      { category: 'Habits', score: habitsScore, change: 0, icon: '🔥', color: '#FF9F0A' },
      { category: 'Health', score: healthScore, change: 0, icon: '❤️', color: '#FF453A' },
    ];

    // Calculate active domain average
    const activeDomainScores: number[] = [];
    if (catMap['career'] && catMap['career'].count > 0) activeDomainScores.push(careerScore);
    if (hasLearning) activeDomainScores.push(learningScore);
    if (hasFinance) activeDomainScores.push(financeScore);
    if (hasProjects) activeDomainScores.push(projectsScore);
    if (hasHabits) activeDomainScores.push(habitsScore);
    if (catMap['health'] && catMap['health'].count > 0) activeDomainScores.push(healthScore);

    const overallScore = activeDomainScores.length > 0
      ? Math.round(activeDomainScores.reduce((s, c) => s + c, 0) / activeDomainScores.length)
      : 0;

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

    const taskTotal = Number(tasksRes.rows[0]?.total) || 0;
    const taskCompleted = Number(tasksRes.rows[0]?.completed) || 0;
    const taskRate = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

    const habitStreak = Math.round(Number(habitsRes.rows[0]?.avg_streak) || 0);
    const goalRate = Math.round(Number(goalsRes.rows[0]?.avg_prog) || 0);

    const trackedComponents = [];
    if (taskTotal > 0) trackedComponents.push(taskRate);
    if (Number(goalsRes.rows[0]?.total) > 0) trackedComponents.push(goalRate);
    if (Number(habitsRes.rows[0]?.total) > 0) trackedComponents.push(Math.min(100, habitStreak * 10));

    const overallScore = trackedComponents.length > 0
      ? Math.round(trackedComponents.reduce((a, b) => a + b, 0) / trackedComponents.length)
      : 0;

    res.json({
      overallScore,
      weeklyChange: 0,
      streak: habitStreak,
      completionRates: {
        tasks: taskRate,
        habits: Math.min(100, habitStreak * 10),
        goals: goalRate,
      },
      topPerforming: goalRate > 0 ? 'Goals' : taskRate > 0 ? 'Tasks' : 'N/A',
      needsAttention: taskRate === 0 && taskTotal > 0 ? 'Tasks' : 'None',
    });
  } catch (error) {
    console.error('Error fetching progress summary:', error);
    res.status(500).json({ error: 'Failed to fetch progress summary' });
  }
});

export default router;
