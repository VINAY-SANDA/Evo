import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

router.get('/diary', async (_req: Request, res: Response) => {
  try {
    const result = await query(`SELECT id, title, body, to_char(entry_date, 'YYYY-MM-DD') AS date,
      created_at AS "createdAt", updated_at AS "updatedAt" FROM diary_entries
      WHERE user_id = $1 ORDER BY entry_date DESC, updated_at DESC`, [DEFAULT_USER_ID]);
    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Error fetching diary entries:', error);
    res.status(500).json({ error: 'Could not load diary entries' });
  }
});

router.post('/diary', async (req: Request, res: Response) => {
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  if (!title) return res.status(400).json({ error: 'A title is required' });
  try {
    const result = await query(`INSERT INTO diary_entries (user_id, title, body, entry_date)
      VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE))
      RETURNING id, title, body, to_char(entry_date, 'YYYY-MM-DD') AS date,
      created_at AS "createdAt", updated_at AS "updatedAt"`,
    [DEFAULT_USER_ID, title, body, req.body.date || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving diary entry:', error);
    res.status(500).json({ error: 'Could not save diary entry' });
  }
});

router.delete('/diary/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM diary_entries WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Diary entry not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting diary entry:', error);
    res.status(500).json({ error: 'Could not delete diary entry' });
  }
});

router.get('/movies', async (_req: Request, res: Response) => {
  try {
    const result = await query(`SELECT id, title, release_year AS year, rating, review,
      to_char(watched_at, 'YYYY-MM-DD') AS "watchedAt", created_at AS "createdAt"
      FROM movie_reviews WHERE user_id = $1 ORDER BY watched_at DESC, created_at DESC`, [DEFAULT_USER_ID]);
    res.json({ entries: result.rows });
  } catch (error) {
    console.error('Error fetching movie reviews:', error);
    res.status(500).json({ error: 'Could not load movie reviews' });
  }
});

router.post('/movies', async (req: Request, res: Response) => {
  const title = String(req.body.title || '').trim();
  const rating = Number(req.body.rating);
  const year = req.body.year === '' || req.body.year == null ? null : Number(req.body.year);
  if (!title || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'A title and rating from 1 to 5 are required' });
  }
  if (year !== null && (!Number.isInteger(year) || year < 1888 || year > 2100)) {
    return res.status(400).json({ error: 'Release year must be between 1888 and 2100' });
  }
  try {
    const result = await query(`INSERT INTO movie_reviews (user_id, title, release_year, rating, review, watched_at)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE))
      RETURNING id, title, release_year AS year, rating, review,
      to_char(watched_at, 'YYYY-MM-DD') AS "watchedAt", created_at AS "createdAt"`,
    [DEFAULT_USER_ID, title, year, rating, String(req.body.review || '').trim(), req.body.watchedAt || null]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving movie review:', error);
    res.status(500).json({ error: 'Could not save movie review' });
  }
});

router.delete('/movies/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM movie_reviews WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Movie review not found' });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting movie review:', error);
    res.status(500).json({ error: 'Could not delete movie review' });
  }
});

export default router;
