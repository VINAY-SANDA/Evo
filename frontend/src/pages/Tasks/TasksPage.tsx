import { useState, useEffect } from 'react';
import type { Task, TaskStatus, Priority } from '../../types';
import { getTasks, createTask, toggleTaskStatus } from '../../services/api';
import './TasksPage.css';

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do', in_progress: 'In Progress', completed: 'Completed',
  skipped: 'Skipped', cancelled: 'Cancelled',
};

const priorityColors: Record<Priority, string> = {
  urgent: 'var(--evo-danger)', high: 'var(--evo-warning-dark)',
  medium: 'var(--evo-info)', low: 'var(--evo-text-tertiary)',
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    priority: Priority;
    estimatedMinutes: number;
    category: string;
  }>({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '10:00',
    priority: 'high',
    estimatedMinutes: 45,
    category: 'Career',
  });

  useEffect(() => {
    getTasks().then(res => setTasks(res));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredTasks = filter === 'all'
    ? tasks
    : filter === 'today'
    ? tasks.filter(t => t.dueDate === todayStr || t.dueDate === '2026-10-24')
    : tasks.filter(t => t.status === filter);

  const toggleTask = async (id: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === id
        ? { ...t, status: (t.status === 'completed' ? 'todo' : 'completed') as TaskStatus }
        : t
    ));
    await toggleTaskStatus(id);
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast('Task removed');
  };

  const getStatusCount = (status: string) => {
    if (status === 'all') return tasks.length;
    if (status === 'today') return tasks.filter(t => t.dueDate === todayStr || t.dueDate === '2026-10-24').length;
    return tasks.filter(t => t.status === status).length;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const newTask = await createTask({
      title: formData.title.trim(),
      description: formData.description.trim(),
      dueDate: formData.dueDate,
      dueTime: formData.dueTime,
      priority: formData.priority,
      estimatedMinutes: Number(formData.estimatedMinutes) || 30,
      category: formData.category.trim() || 'General',
      status: 'todo',
    });

    if (newTask) {
      setTasks(prev => [newTask, ...prev]);
      showToast(`✓ Task "${newTask.title}" added to planner`);
      setShowModal(false);
      setFormData({
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '10:00',
        priority: 'high',
        estimatedMinutes: 45,
        category: 'Career',
      });
    } else {
      showToast(`❌ Failed to create task. Check backend connection & console (F12).`);
    }
  };

  return (
    <div className="tasks-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Tasks & Daily Execution</h1>
          <p className="page-subtitle">
            {tasks.filter(t => t.status === 'completed').length} of {tasks.length} tasks completed
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ New Task
        </button>
      </div>

      {/* Filters */}
      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        {['all', 'today', 'todo', 'in_progress', 'completed'].map(f => (
          <button
            key={f}
            className={`tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'today' ? 'Today' : statusLabels[f as TaskStatus] || f}
            <span style={{ opacity: 0.6, marginLeft: 6 }}>({getStatusCount(f)})</span>
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="tasks-list">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <h3 className="empty-state-title">No tasks found</h3>
            <p className="empty-state-text">Create a new task or change your filter.</p>
          </div>
        ) : (
          filteredTasks.map((task, i) => (
            <div
              key={task.id}
              className={`task-card card animate-fade-in-up stagger-${Math.min((i % 6) + 1, 6)}`}
            >
              <div className="task-card-left">
                <div
                  className="task-card-priority"
                  style={{ background: priorityColors[task.priority] }}
                />
                <div
                  className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`}
                  onClick={() => toggleTask(task.id)}
                  title="Click to toggle completion"
                />
              </div>

              <div className="task-card-content">
                <div className="task-card-top">
                  <h3 className={`task-card-title ${task.status === 'completed' ? 'completed' : ''}`}>
                    {task.title}
                  </h3>
                  <div className="task-card-badges">
                    <span className={`badge badge-${task.priority === 'urgent' || task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'neutral'}`}>
                      {task.priority.toUpperCase()}
                    </span>
                    {task.isAiGenerated && <span className="badge badge-primary">AI Suggested</span>}
                  </div>
                </div>
                {task.description && (
                  <p className="task-card-desc">{task.description}</p>
                )}
                <div className="task-card-meta">
                  {task.dueDate && (
                    <span>📅 {new Date(task.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                  )}
                  {task.dueTime && <span>⏰ {task.dueTime}</span>}
                  {task.estimatedMinutes && <span>⏱ {task.estimatedMinutes}m</span>}
                  {task.category && <span>📁 {task.category}</span>}
                  {task.isRecurring && <span>🔄 Recurring</span>}
                </div>
              </div>

              <button
                className="btn btn-ghost btn-icon"
                title="Delete task"
                onClick={() => deleteTask(task.id)}
                style={{ color: 'var(--evo-text-tertiary)', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* New Task Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Task</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Task Title *</label>
                    <input
                      className="form-input"
                      placeholder="e.g., Solve 2 DSA problems"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="Optional notes or sub-steps..."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Due Date</label>
                      <input
                        className="form-input"
                        type="date"
                        value={formData.dueDate}
                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Due Time</label>
                      <input
                        className="form-input"
                        type="time"
                        value={formData.dueTime}
                        onChange={e => setFormData({ ...formData, dueTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-input"
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Duration (Minutes)</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="Minutes"
                        value={formData.estimatedMinutes}
                        onChange={e => setFormData({ ...formData, estimatedMinutes: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      className="form-input"
                      placeholder="e.g., Education, Career, Health, Vyralabs"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
