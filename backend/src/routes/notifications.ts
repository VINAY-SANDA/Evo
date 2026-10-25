import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

function mapNotification(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    readAt: row.read_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM notifications WHERE user_id = $1';
    const params: any[] = [DEFAULT_USER_ID];

    if (status) {
      sql += ' AND status = $2';
      params.push(status);
    }
    sql += ' ORDER BY scheduled_at DESC';

    const result = await query(sql, params);

    const unreadRes = await query(
      "SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND status != 'read'",
      [DEFAULT_USER_ID]
    );

    const unreadCount = Number(unreadRes.rows[0]?.unread) || 0;

    res.json({
      notifications: result.rows.map(mapNotification),
      total: result.rows.length,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (_req: Request, res: Response) => {
  try {
    await query(
      "UPDATE notifications SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status != 'read'",
      [DEFAULT_USER_ID]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const result = await query(
      "UPDATE notifications SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(mapNotification(result.rows[0]));
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;
