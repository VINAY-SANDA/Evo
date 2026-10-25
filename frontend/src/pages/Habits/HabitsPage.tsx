import { useState, useEffect } from 'react';
import type { Habit } from '../../types';
import { getHabits, createHabit, toggleHabitComplete } from '../../services/api';
import './HabitsPage.css';

const presetColors = ['#2997FF', '#5E5CE6', '#64D2FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2'];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    icon: string;
    color: string;
    frequency: 'daily' | 'weekly';
    target: number;
    unit: string;
  }>({
    name: '',
    description: '',
    icon: '⚡',
    color: '#2997FF',
    frequency: 'daily',
    target: 1,
    unit: 'session',
  });

  useEffect(() => {
    getHabits().then(res => setHabits(res));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const completed = habits.filter(h => h.completedToday).length;

  const toggleHabit = async (id: string) => {
    // Optimistic local update
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const nextCompleted = !h.completedToday;
        return {
          ...h,
          completedToday: nextCompleted,
          currentStreak: nextCompleted ? h.currentStreak + 1 : Math.max(0, h.currentStreak - 1),
          longestStreak: nextCompleted ? Math.max(h.longestStreak, h.currentStreak + 1) : h.longestStreak,
        };
      }
      return h;
    }));

    await toggleHabitComplete(id);
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newHabit = await createHabit({
      name: formData.name.trim(),
      description: formData.description.trim(),
      icon: formData.icon.trim() || '🎯',
      color: formData.color,
      frequency: formData.frequency,
      target: Number(formData.target) || 1,
      unit: formData.unit.trim() || 'times',
      currentStreak: 0,
      longestStreak: 0,
      completedToday: false,
    });

    if (newHabit) {
      setHabits(prev => [newHabit, ...prev]);
      showToast(`✓ Habit "${newHabit.name}" activated`);
    }
    setShowModal(false);
    setFormData({
      name: '',
      description: '',
      icon: '⚡',
      color: '#2997FF',
      frequency: 'daily',
      target: 1,
      unit: 'session',
    });
  };

  // Generate last 7 days for heatmap preview
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="habits-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Habits & Rituals</h1>
          <p className="page-subtitle">{completed} of {habits.length} rituals completed today</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ New Habit
        </button>
      </div>

      {/* Today's Progress */}
      <div className="habits-today-bar card animate-fade-in-up">
        <div className="habits-today-info">
          <span className="habits-today-label">Today's Consistency Velocity</span>
          <span className="habits-today-count">{completed}/{habits.length}</span>
        </div>
        <div className="progress-bar lg">
          <div
            className="progress-bar-fill green animated"
            style={{ width: `${habits.length ? (completed / habits.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Habits Grid */}
      <div className="habits-card-grid">
        {habits.map((habit, i) => (
          <div
            key={habit.id}
            className={`habit-card card animate-fade-in-up stagger-${(i % 6) + 1} ${habit.completedToday ? 'habit-completed' : ''}`}
            style={{ '--habit-accent': habit.color } as React.CSSProperties}
          >
            <div className="habit-card-header">
              <div className="habit-card-icon" style={{ background: `${habit.color}22` }}>
                {habit.icon}
              </div>
              <div className="habit-card-streak">
                <span className="habit-card-streak-value">🔥 {habit.currentStreak}</span>
                <span className="habit-card-streak-label">day streak</span>
              </div>
            </div>

            <h3 className="habit-card-name">{habit.name}</h3>
            {habit.description && (
              <p className="habit-card-desc">{habit.description}</p>
            )}

            <div className="habit-card-week">
              {last7Days.map((day, di) => {
                const isToday = di === 6;
                const wasCompleted = isToday ? habit.completedToday : ((di + habit.name.length) % 3 !== 0);
                return (
                  <div
                    key={day}
                    className={`habit-day-dot ${wasCompleted ? 'filled' : ''} ${isToday ? 'today' : ''}`}
                    style={{ '--dot-fill': habit.color } as React.CSSProperties}
                    title={day}
                  >
                    <span className="habit-day-label">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(day).getDay()]}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="habit-card-footer">
              <div className="habit-card-stats">
                <span>Best: {habit.longestStreak} days</span>
                <span>•</span>
                <span>{habit.target} {habit.unit}/day</span>
              </div>
              <button
                className={`btn sm ${habit.completedToday ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => toggleHabit(habit.id)}
              >
                {habit.completedToday ? '✓ Done Today' : 'Mark Done'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Habit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Habit</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateHabit}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Habit Name *</label>
                    <input
                      className="form-input"
                      placeholder="e.g., Morning Meditation, LeetCode"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input
                      className="form-input"
                      placeholder="Why is this habit critical for your trajectory?"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Frequency</label>
                      <select
                        className="form-input"
                        value={formData.frequency}
                        onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Accent Color</label>
                      <div className="flex gap-2" style={{ marginTop: 6 }}>
                        {presetColors.map(c => (
                          <div
                            key={c}
                            onClick={() => setFormData({ ...formData, color: c })}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              backgroundColor: c,
                              cursor: 'pointer',
                              border: formData.color === c ? '2px solid white' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Daily Target</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="1"
                        value={formData.target}
                        onChange={e => setFormData({ ...formData, target: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <input
                        className="form-input"
                        placeholder="e.g., minutes, sessions, problems"
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Icon (Emoji)</label>
                    <input
                      className="form-input"
                      placeholder="e.g., 💪, 📚, 💧, 🧩, ☕"
                      value={formData.icon}
                      onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Habit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
