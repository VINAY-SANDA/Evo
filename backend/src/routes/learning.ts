import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

function mapSubject(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon || '📖',
    color: row.color || '#00D2FF',
    progress: Number(row.progress) || 0,
    totalTopics: Number(row.total_topics) || 0,
    completedTopics: Number(row.completed_topics) || 0,
    totalTimeMinutes: Number(row.total_time_minutes) || 0,
    createdAt: row.created_at,
  };
}

function mapTopic(row: any) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    status: row.status,
    difficulty: row.difficulty,
    timeSpentMinutes: Number(row.time_spent_minutes) || 0,
    createdAt: row.created_at,
  };
}

// GET /api/learning/subjects
router.get('/subjects', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM learning_subjects WHERE user_id = $1 ORDER BY created_at ASC',
      [DEFAULT_USER_ID]
    );
    res.json({ subjects: result.rows.map(mapSubject) });
  } catch (error) {
    console.error('Error fetching learning subjects:', error);
    res.status(500).json({ error: 'Failed to fetch learning subjects' });
  }
});

// GET /api/learning/subjects/:id/topics
router.get('/subjects/:id/topics', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM learning_topics WHERE subject_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ topics: result.rows.map(mapTopic) });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// PATCH /api/learning/topics/:id
router.patch('/topics/:id', async (req: Request, res: Response) => {
  try {
    const { name, status, difficulty, timeSpentMinutes } = req.body;
    const existing = await query('SELECT * FROM learning_topics WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const current = existing.rows[0];
    const newName = name !== undefined ? name : current.name;
    const newStatus = status !== undefined ? status : current.status;
    const newDifficulty = difficulty !== undefined ? difficulty : current.difficulty;
    const newTime = timeSpentMinutes !== undefined ? timeSpentMinutes : current.time_spent_minutes;

    const updated = await query(
      `UPDATE learning_topics
       SET name = $1, status = $2, difficulty = $3, time_spent_minutes = $4
       WHERE id = $5
       RETURNING *`,
      [newName, newStatus, newDifficulty, newTime, req.params.id]
    );

    // Recalculate subject progress
    const subjectId = current.subject_id;
    const allTopics = await query('SELECT * FROM learning_topics WHERE subject_id = $1', [subjectId]);
    const totalCount = allTopics.rows.length;
    const completedCount = allTopics.rows.filter((t: any) => t.status === 'completed').length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const totalTime = allTopics.rows.reduce((sum: number, t: any) => sum + (Number(t.time_spent_minutes) || 0), 0);

    await query(
      `UPDATE learning_subjects
       SET total_topics = $1, completed_topics = $2, progress = $3, total_time_minutes = $4
       WHERE id = $5`,
      [totalCount, completedCount, progress, totalTime, subjectId]
    );

    res.json(mapTopic(updated.rows[0]));
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ error: 'Failed to update topic' });
  }
});

// POST /api/learning/subjects
router.post('/subjects', async (req: Request, res: Response) => {
  try {
    const { name, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await query(
      `INSERT INTO learning_subjects (user_id, name, icon, color, progress, total_topics, completed_topics, total_time_minutes)
       VALUES ($1, $2, $3, $4, 0, 0, 0, 0)
       RETURNING *`,
      [DEFAULT_USER_ID, name, icon || '📖', color || '#6C5CE7']
    );

    res.status(201).json(mapSubject(result.rows[0]));
  } catch (error) {
    console.error('Error creating learning subject:', error);
    res.status(500).json({ error: 'Failed to create learning subject' });
  }
});

// POST /api/learning/subjects/:id/topics
router.post('/subjects/:id/topics', async (req: Request, res: Response) => {
  try {
    const { name, difficulty, timeSpentMinutes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const subjectId = req.params.id;
    const result = await query(
      `INSERT INTO learning_topics (subject_id, name, status, difficulty, time_spent_minutes)
       VALUES ($1, $2, 'not_started', $3, $4)
       RETURNING *`,
      [subjectId, name, difficulty || 'medium', timeSpentMinutes || 0]
    );

    // Update subject total topics
    await query(
      'UPDATE learning_subjects SET total_topics = total_topics + 1 WHERE id = $1',
      [subjectId]
    );

    res.status(201).json(mapTopic(result.rows[0]));
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

// GET /api/learning/stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const subjectsRes = await query(
      'SELECT COUNT(*) as count, COALESCE(SUM(total_time_minutes), 0) as total_time FROM learning_subjects WHERE user_id = $1',
      [DEFAULT_USER_ID]
    );
    const topicsRes = await query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE t.status = 'completed') as completed,
         COUNT(*) FILTER (WHERE t.status = 'in_progress') as in_progress
       FROM learning_topics t
       JOIN learning_subjects s ON t.subject_id = s.id
       WHERE s.user_id = $1`,
      [DEFAULT_USER_ID]
    );

    const subCount = Number(subjectsRes.rows[0]?.count) || 0;
    const totalMinutes = Number(subjectsRes.rows[0]?.total_time) || 0;
    const totalHours = Math.round(totalMinutes / 60);

    const totalTopics = Number(topicsRes.rows[0]?.total) || 0;
    const completedTopics = Number(topicsRes.rows[0]?.completed) || 0;
    const inProgressTopics = Number(topicsRes.rows[0]?.in_progress) || 0;

    res.json({
      totalHours,
      totalTopics,
      completedTopics,
      inProgressTopics,
      subjects: subCount,
    });
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    res.status(500).json({ error: 'Failed to fetch learning stats' });
  }
});

export default router;
