import { useState, useEffect } from 'react';
import type { Notification } from '../../types';
import { getNotifications, markNotificationAsRead } from '../../services/api';
import './NotificationsPage.css';

const typeIcons: Record<Notification['type'], string> = {
  task_reminder: '✅',
  habit_reminder: '🔥',
  savings_alert: '💰',
  weekly_review: '📝',
  ai_recommendation: '✨',
  goal_deadline: '🎯',
  daily_review: '☀️',
  missed_task: '⚠️',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    getNotifications().then(res => setNotifications(res));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return n.status !== 'read';
    return true;
  });

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' as const, readAt: new Date().toISOString() })));
    for (const notif of notifications) {
      if (notif.status !== 'read') {
        await markNotificationAsRead(notif.id);
      }
    }
    showToast('✓ All notifications marked as read');
  };

  const markRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n));
    await markNotificationAsRead(id);
  };

  return (
    <div className="notifications-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Notification Stream</h1>
          <p className="page-subtitle">Proactive AI suggestions, deadlines, and schedule pings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="tabs sm">
            <button
              className={`tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              className={`tab ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({notifications.filter(n => n.status !== 'read').length})
            </button>
          </div>
          <button className="btn btn-secondary sm" onClick={markAllRead}>
            Mark All as Read
          </button>
        </div>
      </div>

      <div className="card notifications-card animate-fade-in-up">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>No notifications to display</p>
          </div>
        ) : (
          <div className="notifications-list">
            {filtered.map(notif => {
              const isUnread = notif.status !== 'read';
              return (
                <div
                  key={notif.id}
                  className={`notification-item ${isUnread ? 'unread' : ''}`}
                  onClick={() => markRead(notif.id)}
                >
                  <span className="notification-icon">
                    {typeIcons[notif.type] || '🔔'}
                  </span>
                  <div className="notification-body">
                    <div className="notification-title-row">
                      <h4 className="notification-title">{notif.title}</h4>
                      {isUnread && <span className="notification-dot" />}
                    </div>
                    <p className="notification-desc">{notif.body}</p>
                    <span className="notification-time">
                      {new Date(notif.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
