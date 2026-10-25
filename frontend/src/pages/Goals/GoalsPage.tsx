import { useState, useEffect } from 'react';
import type { Goal, GoalCategory, Milestone } from '../../types';
import {
  getGoals,
  createGoal,
  updateGoal,
  updateGoalProgress,
  deleteGoal,
} from '../../services/api';
import './GoalsPage.css';

const categoryIcons: Record<GoalCategory, string> = {
  career: '💼', education: '📖', finance: '💰', health: '❤️',
  personal: '🌟', business: '🏢', project: '🚀', other: '📌',
};

const categoryColors: Record<GoalCategory, string> = {
  career: '#0A84FF', education: '#5E5CE6', finance: '#30D158', health: '#FF453A',
  personal: '#FF9F0A', business: '#64D2FF', project: '#BF5AF2', other: '#8E8E93',
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State for New Goal
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    category: GoalCategory;
    targetValue: number;
    unit: string;
    deadline: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }>({
    title: '',
    description: '',
    category: 'career',
    targetValue: 100,
    unit: '%',
    deadline: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    priority: 'high',
  });

  // State for Editing Goal
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    category: GoalCategory;
    targetValue: number;
    unit: string;
    deadline: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    progress: number;
  }>({
    title: '',
    description: '',
    category: 'career',
    targetValue: 100,
    unit: '%',
    deadline: '',
    priority: 'high',
    progress: 0,
  });

  useEffect(() => {
    getGoals().then(res => setGoals(res));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const newGoal = await createGoal({
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      targetValue: Number(formData.targetValue) || 100,
      currentValue: 0,
      unit: formData.unit.trim() || '%',
      deadline: formData.deadline,
      priority: formData.priority,
      progress: 0,
    });

    if (newGoal) {
      setGoals(prev => [newGoal, ...prev]);
      showToast(`✓ Goal "${newGoal.title}" created successfully`);
      setShowModal(false);
      setFormData({
        title: '',
        description: '',
        category: 'career',
        targetValue: 100,
        unit: '%',
        deadline: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        priority: 'high',
      });
    } else {
      showToast(`❌ Failed to create goal. Check backend connection & console (F12).`);
    }
  };

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditFormData({
      title: goal.title,
      description: goal.description || '',
      category: goal.category,
      targetValue: goal.targetValue || 100,
      unit: goal.unit || '%',
      deadline: goal.deadline,
      priority: goal.priority as any,
      progress: goal.progress,
    });
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editFormData.title.trim()) return;

    // Optimistic UI update
    setGoals(prev => prev.map(g => g.id === editingGoal.id ? {
      ...g,
      title: editFormData.title.trim(),
      description: editFormData.description.trim(),
      category: editFormData.category,
      targetValue: Number(editFormData.targetValue) || 100,
      unit: editFormData.unit.trim() || '%',
      deadline: editFormData.deadline,
      priority: editFormData.priority,
      progress: Number(editFormData.progress) || 0,
    } : g));

    showToast(`✓ Goal "${editFormData.title}" updated`);
    const goalId = editingGoal.id;
    setEditingGoal(null);

    const updated = await updateGoal(goalId, {
      title: editFormData.title.trim(),
      description: editFormData.description.trim(),
      category: editFormData.category,
      targetValue: Number(editFormData.targetValue) || 100,
      unit: editFormData.unit.trim() || '%',
      deadline: editFormData.deadline,
      priority: editFormData.priority,
      progress: Number(editFormData.progress) || 0,
    });

    if (updated) {
      setGoals(prev => prev.map(g => g.id === goalId ? updated : g));
    }
  };

  const handleDeleteGoal = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove the goal "${title}"?`)) return;

    const prevGoals = [...goals];
    setGoals(prev => prev.filter(g => g.id !== id));
    showToast(`Goal "${title}" removed`);

    const ok = await deleteGoal(id);
    if (!ok) {
      setGoals(prevGoals);
      showToast('❌ Failed to delete goal on server');
    }
  };

  const handleQuickProgress = async (goalId: string, newProgress: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newProgress)));
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, progress: clamped } : g));
    await updateGoalProgress(goalId, clamped);
  };

  const toggleMilestone = (milestoneId: string, goalId: string) => {
    setMilestones(prev => {
      const updated = prev.map(m => m.id === milestoneId ? {
        ...m,
        status: (m.status === 'completed' ? 'pending' : 'completed') as Milestone['status'],
      } : m);

      // Recalculate goal progress
      const goalMilestones = updated.filter(m => m.goalId === goalId);
      if (goalMilestones.length > 0) {
        const completedCount = goalMilestones.filter(m => m.status === 'completed').length;
        const newProgress = Math.round((completedCount / goalMilestones.length) * 100);
        setGoals(gList => gList.map(g => g.id === goalId ? { ...g, progress: newProgress } : g));
        updateGoalProgress(goalId, newProgress);
      }

      return updated;
    });
  };

  const filteredGoals = filter === 'all' ? goals : goals.filter(g => g.category === filter);
  const categories = ['all', ...Array.from(new Set(goals.map(g => g.category)))];

  return (
    <div className="goals-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Goals & High Objectives</h1>
          <p className="page-subtitle">
            {goals.length} active strategic goals across {categories.length - 1} domains
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ New Goal
        </button>
      </div>

      {/* Filters */}
      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`tab ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat === 'all' ? 'All' : `${categoryIcons[cat as GoalCategory] || ''} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Goals Grid */}
      <div className="goals-grid">
        {filteredGoals.map((goal, i) => {
          const goalMilestones = milestones.filter(m => m.goalId === goal.id);
          const completedMilestones = goalMilestones.filter(m => m.status === 'completed').length;

          return (
            <div key={goal.id} className={`goal-card card animate-fade-in-up stagger-${(i % 5) + 1}`}>
              <div className="goal-card-header">
                <div
                  className="goal-card-icon"
                  style={{
                    background: `${categoryColors[goal.category] || '#2997FF'}22`,
                    color: categoryColors[goal.category] || '#2997FF',
                  }}
                >
                  {categoryIcons[goal.category] || '🎯'}
                </div>
                <div className="goal-card-badges">
                  <span className={`badge badge-${goal.priority === 'high' || goal.priority === 'urgent' ? 'danger' : goal.priority === 'medium' ? 'warning' : 'neutral'}`}>
                    {goal.priority.toUpperCase()}
                  </span>
                  <span className="badge badge-primary">{goal.category}</span>
                </div>
                <div className="goal-card-actions">
                  <button
                    type="button"
                    className="goal-action-btn edit"
                    title="Edit Goal & Progress"
                    onClick={() => openEditModal(goal)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="goal-action-btn delete"
                    title="Delete Goal"
                    onClick={() => handleDeleteGoal(goal.id, goal.title)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <h3 className="goal-card-title">{goal.title}</h3>
              {goal.description && <p className="goal-card-desc">{goal.description}</p>}

              <div className="goal-card-progress">
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <span className="goal-card-progress-label">Progress</span>
                  <span className="goal-card-progress-value" style={{ color: categoryColors[goal.category] || '#2997FF' }}>
                    {goal.progress}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill animated"
                    style={{
                      width: `${goal.progress}%`,
                      background: categoryColors[goal.category] || 'var(--evo-primary)',
                    }}
                  />
                </div>

                {/* Quick Progress Adjuster */}
                <div className="goal-progress-controls">
                  <button
                    type="button"
                    className="goal-stepper-btn"
                    title="Decrease progress by 10%"
                    onClick={() => handleQuickProgress(goal.id, goal.progress - 10)}
                    disabled={goal.progress <= 0}
                  >
                    -10%
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={goal.progress}
                    onChange={(e) => handleQuickProgress(goal.id, Number(e.target.value))}
                    className="goal-progress-slider"
                    title={`Adjust progress (currently ${goal.progress}%)`}
                  />
                  <button
                    type="button"
                    className="goal-stepper-btn"
                    title="Increase progress by 10%"
                    onClick={() => handleQuickProgress(goal.id, goal.progress + 10)}
                    disabled={goal.progress >= 100}
                  >
                    +10%
                  </button>
                </div>
              </div>

              {goalMilestones.length > 0 && (
                <div className="goal-card-milestones">
                  <span className="goal-card-milestones-label">
                    {completedMilestones}/{goalMilestones.length} milestones (click dot to toggle)
                  </span>
                  <div className="milestone-dots">
                    {goalMilestones.map(m => (
                      <div
                        key={m.id}
                        className={`milestone-dot ${m.status === 'completed' ? 'completed' : ''}`}
                        title={`${m.title} (${m.status})`}
                        onClick={() => toggleMilestone(m.id, goal.id)}
                        style={{
                          '--dot-color': categoryColors[goal.category] || '#2997FF',
                          cursor: 'pointer',
                        } as React.CSSProperties}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="goal-card-footer">
                <span className="goal-card-deadline">
                  📅 {new Date(goal.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {goal.unit === '₹' ? (
                  <span className="goal-card-values">
                    ₹{goal.currentValue.toLocaleString()} / ₹{goal.targetValue.toLocaleString()}
                  </span>
                ) : goal.unit === '%' ? null : (
                  <span className="goal-card-values">
                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Goal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Goal</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateGoal}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Goal Title *</label>
                    <input
                      className="form-input"
                      placeholder="e.g., Get Software Engineering Job"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="What is the expected outcome and roadmap?"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value as GoalCategory })}
                    >
                      {Object.entries(categoryIcons).map(([key, icon]) => (
                        <option key={key} value={key}>
                          {icon} {key.charAt(0).toUpperCase() + key.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Target Value</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="100"
                        value={formData.targetValue}
                        onChange={e => setFormData({ ...formData, targetValue: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <input
                        className="form-input"
                        placeholder="%, problems, ₹"
                        value={formData.unit}
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Deadline</label>
                      <input
                        className="form-input"
                        type="date"
                        value={formData.deadline}
                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-input"
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Goal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="modal-overlay" onClick={() => setEditingGoal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Goal: {editingGoal.title}</h2>
              <button className="modal-close" onClick={() => setEditingGoal(null)}>✕</button>
            </div>
            <form onSubmit={handleUpdateGoal}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Goal Title *</label>
                    <input
                      className="form-input"
                      value={editFormData.title}
                      onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={editFormData.description}
                      onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                    />
                  </div>

                  {/* Direct Progress Slider in Modal */}
                  <div className="form-group">
                    <div className="flex items-center justify-between">
                      <label className="form-label">Current Progress ({editFormData.progress}%)</label>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--evo-primary)', fontFamily: 'var(--font-mono)' }}>
                        {editFormData.progress}% Completed
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editFormData.progress}
                      onChange={e => setEditFormData({ ...editFormData, progress: Number(e.target.value) })}
                      className="goal-progress-slider"
                      style={{ width: '100%', marginTop: '6px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={editFormData.category}
                      onChange={e => setEditFormData({ ...editFormData, category: e.target.value as GoalCategory })}
                    >
                      {Object.entries(categoryIcons).map(([key, icon]) => (
                        <option key={key} value={key}>
                          {icon} {key.charAt(0).toUpperCase() + key.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Target Value</label>
                      <input
                        className="form-input"
                        type="number"
                        value={editFormData.targetValue}
                        onChange={e => setEditFormData({ ...editFormData, targetValue: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <input
                        className="form-input"
                        value={editFormData.unit}
                        onChange={e => setEditFormData({ ...editFormData, unit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Deadline</label>
                      <input
                        className="form-input"
                        type="date"
                        value={editFormData.deadline}
                        onChange={e => setEditFormData({ ...editFormData, deadline: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-input"
                        value={editFormData.priority}
                        onChange={e => setEditFormData({ ...editFormData, priority: e.target.value as any })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingGoal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
