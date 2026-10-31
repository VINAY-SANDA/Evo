import { useState, useEffect } from 'react';
import type { Reminder, Goal } from '../../types';
import { getReminders, createReminder, getGoals, updateReminder, deleteReminder } from '../../services/api';
import './RemindersPage.css';

const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => 'Notification' in window ? Notification.permission : 'unsupported');

  const [formData, setFormData] = useState<{
    title: string;
    time: string;
    type: 'daily' | 'weekly' | 'custom';
    goalId: string;
    daysOfWeek: number[];
    scheduledDate: string;
  }>({
    title: '',
    time: '09:00',
    type: 'daily',
    goalId: '',
    daysOfWeek: [],
    scheduledDate: '',
  });

  useEffect(() => {
    getReminders().then(res => setReminders(res));
    getGoals().then(res => setGoals(res));
  }, []);

  useEffect(() => {
    const checkDueReminders = () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const minute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (Notification.permission !== 'granted') return;
      for (const reminder of reminders) {
        const scheduledToday = reminder.type === 'daily' || (reminder.type === 'weekly' && reminder.daysOfWeek?.includes(now.getDay())) || (reminder.type === 'custom' && reminder.scheduledDate === today);
        if (!reminder.active || !scheduledToday || reminder.time !== minute) continue;
        const key = `evo.reminders.notified.${reminder.id}`;
        if (window.localStorage.getItem(key) === today) continue;
        new Notification(reminder.title, { body: 'Your EVO reminder is due.' });
        window.localStorage.setItem(key, today);
        if (reminder.type === 'custom') {
          void updateReminder(reminder.id, { active: false }).then(updated => {
            if (updated) setReminders(current => current.map(item => item.id === reminder.id ? updated : item));
          });
        }
      }
    };
    checkDueReminders();
    const timer = window.setInterval(checkDueReminders, 15000);
    return () => window.clearInterval(timer);
  }, [reminders, notificationPermission]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleReminder = async (reminder: Reminder) => {
    const updated = await updateReminder(reminder.id, { active: !reminder.active });
    if (!updated) { showToast('Could not update reminder. Please try again.'); return; }
    setReminders(prev => prev.map(item => item.id === reminder.id ? updated : item));
    showToast(updated.active ? 'Reminder turned on.' : 'Reminder paused.');
  };

  const openEditReminder = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setFormData({ title: reminder.title, time: reminder.time, type: reminder.type === 'one_time' ? 'custom' : reminder.type, goalId: reminder.goalId || '', daysOfWeek: reminder.daysOfWeek || [], scheduledDate: reminder.scheduledDate || '' });
    setShowModal(true);
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) { showToast('This browser does not support notifications.'); return; }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    showToast(permission === 'granted' ? 'Browser reminders enabled while EVO is open.' : 'Notification permission was not granted.');
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    if (formData.type === 'weekly' && formData.daysOfWeek.length === 0) { showToast('Choose at least one day for a weekly reminder.'); return; }

    const values = {
      title: formData.title.trim(),
      time: formData.time,
      type: formData.type,
      goalId: formData.goalId || undefined,
      daysOfWeek: formData.type === 'weekly' ? formData.daysOfWeek : undefined,
      scheduledDate: formData.type === 'custom' ? formData.scheduledDate : null,
      active: editingId ? reminders.find(item => item.id === editingId)?.active : true,
    };
    const newRem = editingId ? await updateReminder(editingId, values) : await createReminder(values);

    if (newRem) {
      setReminders(prev => editingId ? prev.map(item => item.id === editingId ? newRem : item) : [newRem, ...prev]);
      showToast(editingId ? 'Reminder updated.' : `Reminder "${newRem.title}" set for ${newRem.time}`);
      setShowModal(false);
      setEditingId(null);
      setFormData({ title: '', time: '09:00', type: 'daily', goalId: '', daysOfWeek: [], scheduledDate: '' });
    } else {
      showToast('Could not save reminder. Check your connection and try again.');
    }
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
        <div className="reminder-header-actions">
        {notificationPermission !== 'granted' && <button className="btn btn-secondary" onClick={() => { void enableNotifications(); }}>Enable browser alerts</button>}
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData({ title: '', time: '09:00', type: 'daily', goalId: '', daysOfWeek: [], scheduledDate: '' }); setShowModal(true); }}>
          ➕ New Reminder
        </button>
        </div>
      </div>
      <p className="reminder-delivery-note">Browser alerts run while EVO is open. Your schedule is saved to your account.</p>

      <div className="reminders-grid">
        {reminders.map(rem => {
          const linkedGoal = goals.find(g => g.id === rem.goalId);
          return (
            <div key={rem.id} className={`card reminder-card ${rem.active ? 'active' : 'inactive'}`}>
              <div className="reminder-header">
                <span className="reminder-time-badge">⏰ {rem.time}</span>
                <button
                  className={`toggle-switch ${rem.active ? 'on' : 'off'}`}
                  onClick={() => { void toggleReminder(rem); }}
                  aria-label={`${rem.active ? 'Pause' : 'Enable'} ${rem.title}`}
                >
                  <span className="toggle-switch-thumb" />
                </button>
              </div>

              <div className="reminder-content">
                <h3 className="reminder-title">{rem.title}</h3>
                <span className="reminder-recurrence">
                  {rem.type === 'daily' && '🔁 Daily Nudge'}
                  {rem.type === 'weekly' && `📅 Weekly on ${rem.daysOfWeek?.map(d => daysMap[d]).join(', ')}`}
                  {rem.type === 'custom' && `📌 Once${rem.scheduledDate ? ` · ${rem.scheduledDate}` : ''}`}
                </span>
                {linkedGoal && (
                  <div className="reminder-goal-link">
                    <span>🎯 Goal: </span>
                    <strong>{linkedGoal.title}</strong>
                  </div>
                )}
                <div className="reminder-actions">
                  <button className="btn btn-secondary sm" onClick={() => openEditReminder(rem)}>Edit</button>
                  <button className="btn btn-ghost sm" onClick={() => { void deleteReminder(rem.id).then(ok => {
                    if (ok) { setReminders(items => items.filter(item => item.id !== rem.id)); showToast('Reminder deleted.'); }
                    else showToast('Could not delete reminder. Please try again.');
                  }); }}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Reminder' : 'Create Reminder'}</h2>
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
                  {formData.type === 'weekly' && <fieldset className="form-group reminder-days-field">
                    <legend className="form-label">Repeat on</legend>
                    <div className="reminder-days-list">{daysMap.map((day, index) => <label key={day}><input type="checkbox" checked={formData.daysOfWeek.includes(index)} onChange={event => setFormData(current => ({ ...current, daysOfWeek: event.target.checked ? [...current.daysOfWeek, index].sort() : current.daysOfWeek.filter(value => value !== index) }))} />{day}</label>)}</div>
                  </fieldset>}
                  {formData.type === 'custom' && <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={formData.scheduledDate} onChange={event => setFormData(current => ({ ...current, scheduledDate: event.target.value }))} required /></div>}
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
                        <option value="custom">One time</option>
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
                <button type="submit" className="btn btn-primary">{editingId ? 'Save changes' : 'Create Reminder'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
