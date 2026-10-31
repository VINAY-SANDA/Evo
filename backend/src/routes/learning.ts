import express, { Request, Response, Router } from 'express';
import { pool, query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

const TOPIC_STATUSES = new Set(['not_started', 'in_progress', 'completed']);
const TOPIC_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validResourceUrl(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function validMinutes(value: unknown): boolean {
  return Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 1_000_000;
}

function mapSubject(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon || '📖',
    color: row.color || '#2997FF',
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
    notes: row.notes || '',
    resourceUrl: row.resource_url || '',
    nextReviewDate: row.next_review_date ? (typeof row.next_review_date === 'string' ? row.next_review_date.split('T')[0] : row.next_review_date.toISOString?.().split('T')[0]) : null,
    lastReviewedAt: row.last_reviewed_at ? (typeof row.last_reviewed_at === 'string' ? row.last_reviewed_at.split('T')[0] : row.last_reviewed_at.toISOString?.().split('T')[0]) : null,
    reviewIntervalDays: Number(row.review_interval_days) || 3,
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
      `SELECT t.*
       FROM learning_topics t
       JOIN learning_subjects s ON s.id = t.subject_id
       WHERE t.subject_id = $1 AND s.user_id = $2
       ORDER BY t.created_at ASC`,
      [req.params.id, DEFAULT_USER_ID]
    );
    res.json({ topics: result.rows.map(mapTopic) });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// PATCH /api/learning/topics/:id
router.patch('/topics/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { name, status, difficulty, timeSpentMinutes, notes, resourceUrl, nextReviewDate, lastReviewedAt, reviewIntervalDays } = req.body;
    if (status !== undefined && !TOPIC_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid topic status' });
    if (difficulty !== undefined && !TOPIC_DIFFICULTIES.has(difficulty)) return res.status(400).json({ error: 'Invalid topic difficulty' });
    if (timeSpentMinutes !== undefined && !validMinutes(timeSpentMinutes)) return res.status(400).json({ error: 'timeSpentMinutes must be a whole number from 0 to 1000000' });
    if (reviewIntervalDays !== undefined && (!Number.isInteger(Number(reviewIntervalDays)) || Number(reviewIntervalDays) < 1 || Number(reviewIntervalDays) > 365)) return res.status(400).json({ error: 'reviewIntervalDays must be from 1 to 365' });
    if (nextReviewDate !== undefined && nextReviewDate !== null && !validDate(nextReviewDate)) return res.status(400).json({ error: 'nextReviewDate must be YYYY-MM-DD' });
    if (lastReviewedAt !== undefined && lastReviewedAt !== null && !validDate(lastReviewedAt)) return res.status(400).json({ error: 'lastReviewedAt must be YYYY-MM-DD' });
    if (!validResourceUrl(resourceUrl)) return res.status(400).json({ error: 'resourceUrl must be a valid HTTP(S) URL' });

    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT t.*
       FROM learning_topics t
       JOIN learning_subjects s ON s.id = t.subject_id
       WHERE t.id = $1 AND s.user_id = $2`,
      [req.params.id, DEFAULT_USER_ID]
    );
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Topic not found' });
    }

    const current = existing.rows[0];
    const newName = name !== undefined ? String(name).trim() : current.name;
    if (!newName || newName.length > 255) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'name must contain 1 to 255 characters' });
    }
    const newStatus = status !== undefined ? status : current.status;
    const newDifficulty = difficulty !== undefined ? difficulty : current.difficulty;
    const newTime = timeSpentMinutes !== undefined ? Number(timeSpentMinutes) : current.time_spent_minutes;

    const updated = await client.query(
      `UPDATE learning_topics
       SET name = $1, status = $2, difficulty = $3, time_spent_minutes = $4,
            notes = $5, resource_url = $6, next_review_date = $7,
            last_reviewed_at = $8, review_interval_days = $9
        WHERE id = $10 AND EXISTS (
         SELECT 1 FROM learning_subjects s
          WHERE s.id = learning_topics.subject_id AND s.user_id = $11
       )
       RETURNING *`,
      [newName, newStatus, newDifficulty, newTime, notes !== undefined ? String(notes || '').trim() : current.notes || '', resourceUrl !== undefined ? String(resourceUrl || '').trim() : current.resource_url || '', nextReviewDate !== undefined ? nextReviewDate || null : current.next_review_date || null, lastReviewedAt !== undefined ? lastReviewedAt || null : current.last_reviewed_at || null, reviewIntervalDays !== undefined ? Number(reviewIntervalDays) : current.review_interval_days || 3, req.params.id, DEFAULT_USER_ID]
    );

    // Recalculate subject progress
    const subjectId = current.subject_id;
    const allTopics = await client.query(
      `SELECT t.* FROM learning_topics t
       JOIN learning_subjects s ON s.id = t.subject_id
       WHERE t.subject_id = $1 AND s.user_id = $2`,
      [subjectId, DEFAULT_USER_ID]
    );
    const totalCount = allTopics.rows.length;
    const completedCount = allTopics.rows.filter((t: any) => t.status === 'completed').length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const topicTime = allTopics.rows.reduce((sum: number, t: any) => sum + (Number(t.time_spent_minutes) || 0), 0);
    const unassignedSessionTime = await client.query('SELECT COALESCE(SUM(duration_minutes), 0)::int as minutes FROM learning_study_sessions WHERE subject_id = $1 AND topic_id IS NULL', [subjectId]);
    const totalTime = topicTime + (Number(unassignedSessionTime.rows[0]?.minutes) || 0);

    await client.query(
      `UPDATE learning_subjects
       SET total_topics = $1, completed_topics = $2, progress = $3, total_time_minutes = $4
       WHERE id = $5 AND user_id = $6`,
      [totalCount, completedCount, progress, totalTime, subjectId, DEFAULT_USER_ID]
    );

    await client.query('COMMIT');
    res.json(mapTopic(updated.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error updating topic:', error);
    res.status(500).json({ error: 'Failed to update topic' });
  } finally {
    client.release();
  }
});

router.delete('/subjects/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM learning_subjects WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Learning track not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting learning track:', error);
    res.status(500).json({ error: 'Failed to delete learning track' });
  }
});

router.delete('/topics/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `DELETE FROM learning_topics t
       USING learning_subjects s
       WHERE t.id = $1 AND t.subject_id = s.id AND s.user_id = $2
       RETURNING t.id, t.subject_id as "subjectId"`,
      [req.params.id, DEFAULT_USER_ID]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Topic not found' });
    }

    const subjectId = result.rows[0].subjectId;
    const stats = await client.query(
      `SELECT COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
              COALESCE(SUM(time_spent_minutes), 0)::int as total_time
       FROM learning_topics WHERE subject_id = $1`,
      [subjectId]
    );
    const total = Number(stats.rows[0]?.total) || 0;
    const completed = Number(stats.rows[0]?.completed) || 0;
    const totalTime = Number(stats.rows[0]?.total_time) || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const unassignedSessionTime = await client.query('SELECT COALESCE(SUM(duration_minutes), 0)::int as minutes FROM learning_study_sessions WHERE subject_id = $1 AND topic_id IS NULL', [subjectId]);
    const preservedSessionTime = Number(unassignedSessionTime.rows[0]?.minutes) || 0;
    await client.query(
      `UPDATE learning_subjects
       SET total_topics = $1, completed_topics = $2, progress = $3, total_time_minutes = $4
       WHERE id = $5 AND user_id = $6`,
      [total, completed, progress, totalTime + preservedSessionTime, subjectId, DEFAULT_USER_ID]
    );

    await client.query('COMMIT');
    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error deleting learning topic:', error);
    res.status(500).json({ error: 'Failed to delete learning topic' });
  } finally {
    client.release();
  }
});

// POST /api/learning/subjects
router.post('/subjects', async (req: Request, res: Response) => {
  try {
    const { name, icon, color } = req.body;
    const subjectName = typeof name === 'string' ? name.trim() : '';
    if (!subjectName || subjectName.length > 255) return res.status(400).json({ error: 'name must contain 1 to 255 characters' });

    const result = await query(
      `INSERT INTO learning_subjects (user_id, name, icon, color, progress, total_topics, completed_topics, total_time_minutes)
       VALUES ($1, $2, $3, $4, 0, 0, 0, 0)
       RETURNING *`,
      [DEFAULT_USER_ID, subjectName, typeof icon === 'string' ? icon.slice(0, 32) : '📖', typeof color === 'string' ? color.slice(0, 32) : '#6C5CE7']
    );

    res.status(201).json(mapSubject(result.rows[0]));
  } catch (error) {
    console.error('Error creating learning subject:', error);
    res.status(500).json({ error: 'Failed to create learning subject' });
  }
});

// POST /api/learning/subjects/:id/topics
router.post('/subjects/:id/topics', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { name, difficulty, timeSpentMinutes, notes, resourceUrl, nextReviewDate, reviewIntervalDays } = req.body;
    const topicName = typeof name === 'string' ? name.trim() : '';
    if (!topicName || topicName.length > 255) return res.status(400).json({ error: 'name must contain 1 to 255 characters' });
    if (difficulty !== undefined && !TOPIC_DIFFICULTIES.has(difficulty)) return res.status(400).json({ error: 'Invalid topic difficulty' });
    if (timeSpentMinutes !== undefined && !validMinutes(timeSpentMinutes)) return res.status(400).json({ error: 'timeSpentMinutes must be a whole number from 0 to 1000000' });
    if (reviewIntervalDays !== undefined && (!Number.isInteger(Number(reviewIntervalDays)) || Number(reviewIntervalDays) < 1 || Number(reviewIntervalDays) > 365)) return res.status(400).json({ error: 'reviewIntervalDays must be from 1 to 365' });
    if (nextReviewDate !== undefined && nextReviewDate !== null && !validDate(nextReviewDate)) return res.status(400).json({ error: 'nextReviewDate must be YYYY-MM-DD' });
    if (!validResourceUrl(resourceUrl)) return res.status(400).json({ error: 'resourceUrl must be a valid HTTP(S) URL' });

    const subjectId = req.params.id;
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO learning_topics (subject_id, name, status, difficulty, time_spent_minutes, notes, resource_url, next_review_date, review_interval_days)
        SELECT $1, $2, 'not_started', $3, $4, $6, $7, $8, $9
       WHERE EXISTS (SELECT 1 FROM learning_subjects WHERE id = $1 AND user_id = $5)
       RETURNING *`,
      [subjectId, topicName, difficulty || 'medium', timeSpentMinutes === undefined ? 0 : Number(timeSpentMinutes), DEFAULT_USER_ID, String(notes || '').trim(), String(resourceUrl || '').trim(), nextReviewDate || null, reviewIntervalDays === undefined ? 3 : Number(reviewIntervalDays)]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Update subject total topics
    await client.query(
      `UPDATE learning_subjects
       SET total_topics = total_topics + 1,
           total_time_minutes = total_time_minutes + $1
       WHERE id = $2 AND user_id = $3`,
      [Number(timeSpentMinutes || 0), subjectId, DEFAULT_USER_ID]
    );

    await client.query('COMMIT');
    res.status(201).json(mapTopic(result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Error creating topic:', error);
    res.status(500).json({ error: 'Failed to create topic' });
  } finally {
    client.release();
  }
});

// GET /api/learning/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const timeZone = typeof req.query.timeZone === 'string' ? req.query.timeZone : 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone }); } catch { return res.status(400).json({ error: 'Invalid time zone' }); }
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
    const studyDaysRes = await query(
      'SELECT COUNT(DISTINCT (studied_at AT TIME ZONE $2)::date) AS count FROM learning_study_sessions WHERE user_id = $1',
      [DEFAULT_USER_ID, timeZone]
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
      daysWorked: Number(studyDaysRes.rows[0]?.count) || 0,
    });
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    res.status(500).json({ error: 'Failed to fetch learning stats' });
  }
});

router.get('/study-sessions', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT ss.id, ss.subject_id as "subjectId", ss.topic_id as "topicId",
        ss.duration_minutes as "durationMinutes", ss.note, ss.studied_at as "studiedAt",
        s.name as "subjectName", t.name as "topicName"
      FROM learning_study_sessions ss
      JOIN learning_subjects s ON s.id = ss.subject_id
      LEFT JOIN learning_topics t ON t.id = ss.topic_id
      WHERE ss.user_id = $1 AND ($2::uuid IS NULL OR ss.subject_id = $2)
      ORDER BY ss.studied_at DESC LIMIT 100`, [DEFAULT_USER_ID, req.query.subjectId || null]);
    const totalMinutes = result.rows.reduce((sum: number, session: any) => sum + Number(session.durationMinutes), 0);
    res.json({ sessions: result.rows, totalMinutes });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/study-sessions', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { subjectId, topicId, durationMinutes, note } = req.body;
    const duration = Math.floor(Number(durationMinutes));
    if (!subjectId || !Number.isFinite(duration) || duration < 1 || duration > 1440) {
      return res.status(400).json({ error: 'subjectId and durationMinutes from 1 to 1440 are required' });
    }
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO learning_study_sessions (user_id, subject_id, topic_id, duration_minutes, note)
      SELECT $1, s.id, CASE WHEN $3::uuid IS NULL THEN NULL ELSE t.id END, $4, NULLIF($5, '')
      FROM learning_subjects s
      LEFT JOIN learning_topics t ON t.id = $3 AND t.subject_id = s.id
      WHERE s.id = $2 AND s.user_id = $1 AND ($3::uuid IS NULL OR t.id IS NOT NULL)
      RETURNING id, subject_id as "subjectId", topic_id as "topicId",
        duration_minutes as "durationMinutes", note, studied_at as "studiedAt"`,
      [DEFAULT_USER_ID, subjectId, topicId || null, duration, String(note || '').trim()]);
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Learning track or topic not found' });
    }
    await client.query('UPDATE learning_subjects SET total_time_minutes = total_time_minutes + $1 WHERE id = $2 AND user_id = $3', [duration, subjectId, DEFAULT_USER_ID]);
    if (topicId) await client.query('UPDATE learning_topics SET time_spent_minutes = time_spent_minutes + $1 WHERE id = $2 AND subject_id = $3', [duration, topicId, subjectId]);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
