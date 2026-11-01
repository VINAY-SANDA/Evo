import { useState, useEffect } from 'react';
import type { Task, TaskStatus, Priority, Project } from '../../types';
import { getTasks, createTask, toggleTaskStatus, deleteTask as apiDeleteTask, getProjects, updateTask } from '../../services/api';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickTask, setQuickTask] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    priority: Priority;
    estimatedMinutes: number;
    category: string;
    recurrenceFrequency: '' | 'daily' | 'weekly' | 'weekdays' | 'monthly';
    projectId: string;
  }>({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '10:00',
    priority: 'high',
    estimatedMinutes: 45,
    category: 'Career',
    recurrenceFrequency: '',
    projectId: '',
  });

  useEffect(() => {
    getTasks().then(res => setTasks(res));
    getProjects().then(setProjects);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const statusFilteredTasks = filter === 'all'
    ? tasks
    : filter === 'today'
    ? tasks.filter(t => t.dueDate === todayStr)
    : filter === 'week'
    ? tasks.filter(t => Boolean(t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr && (!selectedWeekDay || t.dueDate === selectedWeekDay)))
    : tasks.filter(t => t.status === filter);
  const filteredTasks = statusFilteredTasks.filter(task => projectFilter === 'all' || (projectFilter === 'unlinked' ? !task.projectId : task.projectId === projectFilter));

  const toggleTask = async (id: string) => {
    const previousTasks = tasks;
    setTasks(prev => prev.map(t =>
      t.id === id
        ? { ...t, status: (t.status === 'completed' ? 'todo' : 'completed') as TaskStatus }
        : t
    ));
    const savedTask = await toggleTaskStatus(id);
    if (!savedTask) {
      setTasks(previousTasks);
      showToast('Task update could not be saved. Please try again.');
    } else {
      setTasks(prev => prev.map(task => task.id === id ? savedTask : task));
    }
  };

  const deleteTask = async (id: string) => {
    const prevTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast('Task removed');
    const ok = await apiDeleteTask(id);
    if (!ok) {
      setTasks(prevTasks);
      showToast('❌ Failed to delete task on server');
    }
  };

  const getStatusCount = (status: string) => {
    if (status === 'all') return tasks.length;
    if (status === 'today') return tasks.filter(t => t.dueDate === todayStr).length;
    if (status === 'week') return tasks.filter(t => Boolean(t.dueDate && t.dueDate >= todayStr && t.dueDate <= weekEndStr)).length;
    return tasks.filter(t => t.status === status).length;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const taskValues = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      dueDate: formData.dueDate,
      dueTime: formData.dueTime,
      priority: formData.priority,
      estimatedMinutes: Number(formData.estimatedMinutes) || 30,
      category: formData.category.trim() || 'General',
      status: 'todo' as const,
      recurrenceFrequency: formData.recurrenceFrequency || undefined,
      isRecurring: Boolean(formData.recurrenceFrequency),
      projectId: formData.projectId || undefined,
    };
    const newTask = editingTaskId
      ? await updateTask(editingTaskId, { ...taskValues, projectId: formData.projectId || null, recurrenceFrequency: formData.recurrenceFrequency || null })
      : await createTask(taskValues);

    if (newTask) {
      setTasks(prev => editingTaskId ? prev.map(task => task.id === editingTaskId ? newTask : task) : [newTask, ...prev]);
      showToast(editingTaskId ? `Task "${newTask.title}" updated.` : `✓ Task "${newTask.title}" added to planner`);
      setShowModal(false);
      setEditingTaskId(null);
      setFormData({
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '10:00',
        priority: 'high',
        estimatedMinutes: 45,
        category: 'Career',
        recurrenceFrequency: '',
        projectId: '',
      });
    } else {
      showToast(editingTaskId ? 'Task changes could not be saved. Please try again.' : 'Task could not be created. Please try again.');
    }
  };

  const editTask = (task: Task) => {
    setEditingTaskId(task.id);
    setFormData({
      title: task.title, description: task.description || '', dueDate: task.dueDate || '', dueTime: task.dueTime || '',
      priority: task.priority, estimatedMinutes: task.estimatedMinutes || 30, category: task.category || 'General',
      recurrenceFrequency: task.recurrenceFrequency || '', projectId: task.projectId || '',
    });
    setShowModal(true);
  };

  const openCreateTask = () => {
    setEditingTaskId(null);
    setFormData({ title: '', description: '', dueDate: new Date().toISOString().slice(0, 10), dueTime: '10:00', priority: 'high', estimatedMinutes: 45, category: 'Career', recurrenceFrequency: '', projectId: '' });
    setShowModal(true);
  };

  const captureQuickTask = async (event: React.FormEvent) => {
    event.preventDefault();
    const dueDate = /\btomorrow\b/i.test(quickTask)
      ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      : todayStr;
    const title = quickTask.replace(/\b(add task|remind me to|tomorrow|today)\b/gi, '').trim();
    if (!title) { showToast('Type a task, such as “Study physics tomorrow”.'); return; }
    const created = await createTask({ title, dueDate, priority: 'medium', category: 'General', estimatedMinutes: 30, status: 'todo' });
    if (!created) { showToast('Task could not be added. Please try again.'); return; }
    setTasks(current => [created, ...current]);
    setQuickTask('');
    showToast(`Added “${created.title}” for ${dueDate}.`);
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
        <button className="btn btn-primary" onClick={openCreateTask}>
          ➕ New Task
        </button>
      </div>

      <form className="card task-quick-capture" onSubmit={captureQuickTask}>
        <div><strong>Quick plan</strong><p>Try “Study physics tomorrow”.</p></div>
        <input className="form-input" aria-label="Quick task" value={quickTask} onChange={event => setQuickTask(event.target.value)} placeholder="What do you need to do?" />
        <button className="btn btn-primary" type="submit">Add to plan</button>
      </form>

      {/* Filters */}
      <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
        {['all', 'today', 'week', 'todo', 'in_progress', 'completed'].map(f => (
          <button
            key={f}
            className={`tab ${filter === f ? 'active' : ''}`}
            onClick={() => { setFilter(f); if (f !== 'week') setSelectedWeekDay(null); }}
          >
            {f === 'all' ? 'All' : f === 'today' ? 'Today' : f === 'week' ? 'Next 7 days' : statusLabels[f as TaskStatus] || f}
            <span style={{ opacity: 0.6, marginLeft: 6 }}>({getStatusCount(f)})</span>
          </button>
        ))}
      </div>

      <div className="task-project-filter"><label className="form-label" htmlFor="task-project-filter">Project</label><select id="task-project-filter" className="form-input" value={projectFilter} onChange={event => setProjectFilter(event.target.value)}><option value="all">All projects</option><option value="unlinked">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>

      {filter === 'week' && <div className="week-calendar-strip" aria-label="Next seven days">
        <button className={`week-calendar-day ${selectedWeekDay === null ? 'selected' : ''}`} onClick={() => setSelectedWeekDay(null)}><span>All</span><strong>{getStatusCount('week')}</strong><small>7 days</small></button>
        {Array.from({ length: 7 }, (_, index) => {
          const date = new Date(); date.setDate(date.getDate() + index);
          const key = date.toISOString().slice(0, 10);
          const count = tasks.filter(task => task.dueDate === key).length;
          return <button key={key} className={`week-calendar-day ${selectedWeekDay === key ? 'selected' : ''}`} onClick={() => setSelectedWeekDay(key)}><span>{date.toLocaleDateString('en-IN', { weekday: 'short' })}</span><strong>{date.getDate()}</strong><small>{count} task{count === 1 ? '' : 's'}</small></button>;
        })}
      </div>}

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
                  {task.projectId && <span className="task-project-link">🚀 {projects.find(project => project.id === task.projectId)?.name || 'Linked project'}</span>}
                  {task.isRecurring && <span>🔄 Recurring</span>}
                </div>
              </div>

              <div className="task-card-actions"><button className="btn btn-secondary sm" onClick={() => editTask(task)}>Edit</button><button
                className="btn btn-ghost btn-icon"
                title="Delete task"
                onClick={() => deleteTask(task.id)}
                style={{ color: 'var(--evo-text-tertiary)', fontSize: '1.1rem' }}
              >
                ✕
              </button></div>
            </div>
          ))
        )}
      </div>

      {/* New Task Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingTaskId ? 'Edit Task' : 'Create New Task'}</h2>
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
                  <div className="form-group">
                    <label className="form-label" htmlFor="task-repeat">Repeat</label>
                    <select id="task-repeat" className="form-input" value={formData.recurrenceFrequency} onChange={e => setFormData({ ...formData, recurrenceFrequency: e.target.value as typeof formData.recurrenceFrequency })}>
                      <option value="">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Every weekday</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <small className="form-hint">Completing a repeating task schedules its next occurrence.</small>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="task-project">Project</label>
                    <select id="task-project" className="form-input" value={formData.projectId} onChange={e => setFormData({ ...formData, projectId: e.target.value })}>
                      <option value="">No project</option>
                      {projects.map(project => <option key={project.id} value={project.id}>{project.name}{project.status !== 'active' ? ` (${project.status})` : ''}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingTaskId(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingTaskId ? 'Save Task' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
