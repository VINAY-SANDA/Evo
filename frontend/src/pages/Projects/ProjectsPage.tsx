import { useState, useEffect } from 'react';
import type { Project, ProjectMilestone, Priority, Task } from '../../types';
import { getProjects, createProject, createProjectMilestone, getProjectMilestones, toggleProjectMilestone, getTasks } from '../../services/api';
import './ProjectsPage.css';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Project Form
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    priority: Priority;
    deadline: string;
  }>({
    name: '',
    description: '',
    priority: 'high',
    deadline: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
  });

  // New Milestone Form
  const [milestoneTitle, setMilestoneTitle] = useState('');

  const projectTemplates = [
    { name: 'Product launch', icon: '🚀', description: 'Plan, build, validate, and launch a product.', milestones: ['Define the user and problem', 'Build the first usable version', 'Test with early users', 'Launch and review results'] },
    { name: 'Learning sprint', icon: '📚', description: 'A focused learning project with practice and review.', milestones: ['Set the learning outcome', 'Study the core concepts', 'Complete a practical exercise', 'Review and capture lessons'] },
    { name: 'Business experiment', icon: '🧪', description: 'Validate a business idea with a small, measurable test.', milestones: ['Write the hypothesis', 'Talk to target customers', 'Run a small experiment', 'Decide whether to scale or adjust'] },
  ];

  useEffect(() => {
    getProjects().then(res => {
      setProjects(res);
      if (res.length > 0 && !selectedProjectId) {
        setSelectedProjectId(res[0].id);
      }
    });
    getTasks().then(setTasks);
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      getProjectMilestones(selectedProjectId).then(res => {
        setMilestones(prev => {
          const others = prev.filter(m => m.projectId !== selectedProjectId);
          return [...others, ...res];
        });
      });
    }
  }, [selectedProjectId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  const projectMilestones = currentProject ? milestones.filter(m => m.projectId === currentProject.id) : [];
  const projectTasks = currentProject ? tasks.filter(t => t.projectId === currentProject.id) : [];

  const toggleMilestone = async (milestoneId: string) => {
    setMilestones(prev => {
      const updated = prev.map(m => {
        if (m.id === milestoneId) {
          const isDone = m.status === 'completed';
          return {
            ...m,
            status: (isDone ? 'pending' : 'completed') as ProjectMilestone['status'],
            completedAt: isDone ? undefined : new Date().toISOString().split('T')[0],
          };
        }
        return m;
      });

      // Recalculate project progress
      if (currentProject) {
        const currentMilestones = updated.filter(m => m.projectId === currentProject.id);
        if (currentMilestones.length > 0) {
          const doneCount = currentMilestones.filter(m => m.status === 'completed').length;
          const newProgress = Math.round((doneCount / currentMilestones.length) * 100);
          setProjects(pList => pList.map(p => p.id === currentProject.id ? { ...p, progress: newProgress } : p));
        }
      }

      return updated;
    });

    await toggleProjectMilestone(milestoneId);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newProj = await createProject({
      name: formData.name.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      deadline: formData.deadline,
      status: 'active',
      progress: 0,
    });

    if (newProj) {
      setProjects(prev => [newProj, ...prev]);
      setSelectedProjectId(newProj.id);
      showToast(`✓ Project "${newProj.name}" created`);
    }
    setShowModal(false);
    setFormData({
      name: '',
      description: '',
      priority: 'high',
      deadline: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
    });
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneTitle.trim() || !currentProject) return;

    const newM = await createProjectMilestone(currentProject.id, {
      title: milestoneTitle.trim(),
    });

    if (newM) {
      setMilestones(prev => [...prev, newM]);
      showToast(`✓ Milestone "${newM.title}" added to ${currentProject.name}`);
    }
    setMilestoneTitle('');
    setShowMilestoneModal(false);
  };

  const createFromTemplate = async (template: typeof projectTemplates[number]) => {
    const created = await createProject({ name: template.name, description: template.description, priority: 'high', deadline: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10) });
    if (!created) { showToast('Template project could not be created. Please try again.'); return; }
    setProjects(current => [created, ...current]);
    setSelectedProjectId(created.id);
    const createdMilestones = await Promise.all(template.milestones.map((title, index) => createProjectMilestone(created.id, { title, orderIndex: index + 1 })));
    setMilestones(current => [...current, ...createdMilestones.filter((item): item is ProjectMilestone => Boolean(item))]);
    showToast(`Started ${template.name} with ${createdMilestones.filter(Boolean).length} milestones.`);
  };

  return (
    <div className="projects-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Projects & Execution</h1>
          <p className="page-subtitle">Track milestones, deliverables, and team/individual ventures</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          ➕ New Project
        </button>
      </div>

      <section className="card project-template-section">
        <div><h2 className="card-title">Start with a playbook</h2><p className="project-template-caption">Turn an idea into a clear sequence of outcomes.</p></div>
        <div className="project-template-actions">{projectTemplates.map(template => <button key={template.name} className="btn btn-secondary" onClick={() => void createFromTemplate(template)}>{template.icon} {template.name}</button>)}</div>
      </section>

      {/* Projects Overview Row */}
      <div className="projects-grid">
        {projects.map(proj => {
          const isSelected = proj.id === currentProject?.id;
          return (
            <div
              key={proj.id}
              className={`card project-overview-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedProjectId(proj.id)}
            >
              <div className="project-overview-header">
                <div>
                  <span className={`priority-tag ${proj.priority}`}>{proj.priority.toUpperCase()}</span>
                  <h3 className="project-name">{proj.name}</h3>
                </div>
                <div className="project-progress-circle">
                  <span>{proj.progress}%</span>
                </div>
              </div>
              <p className="project-desc">{proj.description}</p>
              
              <div className="project-progress-track">
                <div className="progress-bar sm">
                  <div className="progress-bar-fill primary animated" style={{ width: `${proj.progress}%` }} />
                </div>
              </div>

              <div className="project-footer">
                <span className="project-due">
                  🏁 {proj.deadline ? `Due ${new Date(proj.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Ongoing'}
                </span>
                <span className="project-status-badge">{proj.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Project Workspace */}
      {currentProject ? (
        <div className="card project-detail-view animate-fade-in-up">
          <div className="project-detail-header">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="project-detail-title">{currentProject.name}</h2>
              <span className="badge badge-success">{currentProject.status || 'Active Venture'}</span>
            </div>
            <p className="project-detail-sub">{currentProject.description}</p>
          </div>
          <div className="project-action-buttons">
            <button className="btn btn-secondary sm" onClick={() => setShowMilestoneModal(true)}>
              ➕ Add Milestone
            </button>
          </div>
        </div>

        <div className="project-detail-layout">
          {/* Milestones Pipeline */}
          <div className="project-milestones-column">
            <div className="column-header">
              <h3>🎯 Milestones & Roadmap</h3>
              <span className="count-badge">
                {projectMilestones.filter(m => m.status === 'completed').length} / {projectMilestones.length}
              </span>
            </div>

            <div className="milestone-timeline">
              {projectMilestones.length === 0 ? (
                <div className="empty-state sm">
                  <p>No milestones created yet. Add one to track progress.</p>
                </div>
              ) : (
                projectMilestones.map((m, idx) => {
                  const isDone = m.status === 'completed';
                  return (
                    <div key={m.id} className={`milestone-item ${isDone ? 'done' : ''}`}>
                      <button
                        className={`milestone-checkbox ${isDone ? 'checked' : ''}`}
                        onClick={() => toggleMilestone(m.id)}
                        title="Click to mark complete"
                      >
                        {isDone ? '✓' : idx + 1}
                      </button>
                      <div className="milestone-content">
                        <span className="milestone-title">{m.title}</span>
                        <span className="milestone-meta">
                          {isDone ? `Completed on ${m.completedAt || 'Recently'}` : 'Pending execution'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Project Linked Tasks */}
          <div className="project-tasks-column">
            <div className="column-header">
              <h3>⚡ Linked Tasks</h3>
              <span className="count-badge">{projectTasks.length}</span>
            </div>

            <div className="project-tasks-list">
              {projectTasks.length === 0 ? (
                <div className="empty-state sm">
                  <p>No active tasks explicitly linked to this project</p>
                </div>
              ) : (
                projectTasks.map(t => (
                  <div key={t.id} className="project-task-row">
                    <span className={`task-status-indicator ${t.status}`} />
                    <div className="project-task-info">
                      <span className="project-task-name">{t.title}</span>
                      <span className="project-task-due">Due: {t.dueDate} {t.dueTime || ''}</span>
                    </div>
                    <span className={`badge ${t.priority === 'high' ? 'badge-danger' : 'badge-warning'}`}>
                      {t.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>🚀</div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-1)' }}>No Active Projects Initialized</h2>
          <p style={{ color: 'var(--evo-text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '440px', margin: '0 auto var(--space-4) auto' }}>
            Initialize your software ventures, engineering projects, or initiatives to track milestone completion.
          </p>
          <button className="btn btn-primary sm" onClick={() => setShowModal(true)}>
            ➕ Create First Project
          </button>
        </div>
      )}

      {/* New Project Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Project</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Project Name *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. AI SaaS MVP, Vyralabs Redesign"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="What is the scope, market angle, and key deliverable?"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-input"
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Target Deadline</label>
                      <input
                        className="form-input"
                        type="date"
                        value={formData.deadline}
                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {showMilestoneModal && currentProject && (
        <div className="modal-overlay" onClick={() => setShowMilestoneModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Milestone to {currentProject.name}</h2>
              <button className="modal-close" onClick={() => setShowMilestoneModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddMilestone}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Milestone Title *</label>
                  <input
                    className="form-input"
                    placeholder="e.g., Deploy MVP backend to VPS, Onboard 3 beta clients"
                    value={milestoneTitle}
                    onChange={e => setMilestoneTitle(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMilestoneModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Milestone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
