import { useState, useEffect } from 'react';
import type { Reminder, Goal } from '../../types';
import { getReminders, createReminder, getGoals } from '../../services/api';
import './RemindersPage.css';

const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    time: string;
    type: 'daily' | 'weekly' | 'custom';
    goalId: string;
  }>({
    title: '',
    time: '09:00',
    type: 'daily',
    goalId: '',
  });

  useEffect(() => {
    getReminders().then(res => setReminders(res));
    getGoals().then(res => setGoals(res));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleReminder = (id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const newRem = await createReminder({
      title: formData.title.trim(),
      time: formData.time,
      type: formData.type,
      goalId: formData.goalId || undefined,
      active: true,
    });

    if (newRem) {
      setReminders(prev => [newRem, ...prev]);
      showToast(`✓ Reminder "${newRem.title}" set for ${newRem.time}`);
    }
    setShowModal(false);
    setFormData({
      title: '',
      time: '09:00',
      type: 'daily',
      goalId: '',
    });
  };

  return (
    <div className="reminders-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Reminders & Nudges</h1>
          <p className="page-subtitle">Context-aware triggers, schedule alarms, and AI daily cues</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ New Reminder
        </button>
      </div>

      <div className="reminders-grid">
        {reminders.map(rem => {
          const linkedGoal = goals.find(g => g.id === rem.goalId);
          return (
            <div key={rem.id} className={`card reminder-card ${rem.active ? 'active' : 'inactive'}`}>
              <div className="reminder-header">
                <span className="reminder-time-badge">⏰ {rem.time}</span>
                <button
                  className={`toggle-switch ${rem.active ? 'on' : 'off'}`}
                  onClick={() => toggleReminder(rem.id)}
                  aria-label="Toggle reminder"
                >
                  <span className="toggle-switch-thumb" />
                </button>
              </div>

              <div className="reminder-content">
                <h3 className="reminder-title">{rem.title}</h3>
                <span className="reminder-recurrence">
                  {rem.type === 'daily' && '🔁 Daily Nudge'}
                  {rem.type === 'weekly' && `📅 Weekly on ${rem.daysOfWeek?.map(d => daysMap[d]).join(', ')}`}
                  {rem.type === 'custom' && '📌 Custom Schedule'}
                </span>
                {linkedGoal && (
                  <div className="reminder-goal-link">
                    <span>🎯 Goal: </span>
                    <strong>{linkedGoal.title}</strong>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Reminder</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateReminder}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Reminder Title *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Evening Reflection & Plan, Drink Water"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Time</label>
                      <input
                        className="form-input"
                        type="time"
                        value={formData.time}
                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Recurrence</label>
                      <select
                        className="form-input"
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="custom">Once</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Link to Goal (Optional)</label>
                    <select
                      className="form-input"
                      value={formData.goalId}
                      onChange={e => setFormData({ ...formData, goalId: e.target.value })}
                    >
                      <option value="">None</option>
                      {goals.map(g => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
