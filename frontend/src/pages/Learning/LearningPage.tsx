import { useState, useEffect } from 'react';
import type { LearningSubject, LearningTopic } from '../../types';
import {
  createLearningSubject,
  createTopic,
  deleteLearningSubject,
  deleteLearningTopic,
  getLearningSubjects,
  getLearningTopics,
  updateTopicStatus,
} from '../../services/api';
import './LearningPage.css';

export default function LearningPage() {
  const [subjects, setSubjects] = useState<LearningSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  useEffect(() => {
    let current = true;
    getLearningSubjects().then(subjs => {
      if (!current) return;
      setSubjects(subjs);
      setSelectedSubjectId(selected => subjs.some(subject => subject.id === selected)
        ? selected
        : subjs[0]?.id || '');
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    if (!selectedSubjectId) {
      setTopics([]);
      return () => { current = false; };
    }
    getLearningTopics(selectedSubjectId).then(result => {
      if (current) setTopics(result);
    });
    return () => { current = false; };
  }, [selectedSubjectId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0] || null;

  const subjectTopics = currentSubject ? topics.filter(t => t.subjectId === currentSubject.id) : [];

  const filteredTopics = subjectTopics.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTopicStatus = async (topicId: string) => {
    const target = topics.find(t => t.id === topicId);
    if (!target) return;

    const nextStatus: LearningTopic['status'] =
      target.status === 'completed' ? 'not_started' :
      target.status === 'not_started' ? 'in_progress' : 'completed';

    const updatedTopic = await updateTopicStatus(topicId, nextStatus);
    if (!updatedTopic) {
      showToast('Could not update this topic. Please try again.');
      return;
    }
    setTopics(prev => prev.map(topic => topic.id === topicId ? updatedTopic : topic));
    const nextTopics = topics.map(topic => topic.id === topicId ? updatedTopic : topic);
    const completedCount = nextTopics.filter(topic => topic.status === 'completed').length;
    const totalCount = nextTopics.length;
    setSubjects(prev => prev.map(subject => subject.id === selectedSubjectId ? {
      ...subject,
      completedTopics: completedCount,
      totalTopics: totalCount,
      progress: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
    } : subject));
  };

  const handleAddSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newSubjectName.trim();
    if (!name || saving) return;
    setSaving(true);
    const subject = await createLearningSubject({ name, icon: '📚', color: '#0066FF' });
    setSaving(false);
    if (!subject) {
      showToast('Could not add this learning track. Please try again.');
      return;
    }
    setSubjects(prev => [...prev, subject]);
    setSelectedSubjectId(subject.id);
    setNewSubjectName('');
    setShowSubjectModal(false);
    showToast(`Learning track “${subject.name}” added.`);
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const subject = currentSubject;
    if (!newTopicName.trim() || !subject || saving) return;

    setSaving(true);
    const newTop = await createTopic(subject.id, {
      name: newTopicName.trim(),
      difficulty: newTopicDifficulty,
    });
    setSaving(false);

    if (newTop) {
      setTopics(prev => [...prev, newTop]);
      setSubjects(sList => sList.map(s => s.id === subject.id ? {
        ...s,
        totalTopics: s.totalTopics + 1,
      } : s));
      showToast(`Topic “${newTop.name}” added to ${subject.name}.`);
    } else {
      showToast('Could not add this topic. Please try again.');
      return;
    }

    setNewTopicName('');
    setShowTopicModal(false);
  };

  const handleDeleteSubject = async (subject: LearningSubject) => {
    if (!window.confirm(`Delete “${subject.name}” and all its topics? This cannot be undone.`)) return;
    const deleted = await deleteLearningSubject(subject.id);
    if (!deleted) {
      showToast('Could not delete this learning track. Please try again.');
      return;
    }
    const remaining = subjects.filter(item => item.id !== subject.id);
    setSubjects(remaining);
    if (selectedSubjectId === subject.id) setSelectedSubjectId(remaining[0]?.id || '');
    showToast(`Learning track “${subject.name}” deleted.`);
  };

  const handleDeleteTopic = async (topic: LearningTopic) => {
    if (!window.confirm(`Delete “${topic.name}”? This cannot be undone.`)) return;
    const deleted = await deleteLearningTopic(topic.id);
    if (!deleted) {
      showToast('Could not delete this topic. Please try again.');
      return;
    }
    const remaining = topics.filter(item => item.id !== topic.id);
    setTopics(remaining);
    setSubjects(prev => prev.map(subject => {
      if (subject.id !== topic.subjectId) return subject;
      const completedTopics = remaining.filter(item => item.status === 'completed').length;
      return {
        ...subject,
        totalTopics: remaining.length,
        completedTopics,
        progress: remaining.length ? Math.round((completedTopics / remaining.length) * 100) : 0,
        totalTimeMinutes: remaining.reduce((total, item) => total + item.timeSpentMinutes, 0),
      };
    }));
    showToast(`Topic “${topic.name}” deleted.`);
  };

  const totalTimeHours = Math.round(subjects.reduce((acc, s) => acc + s.totalTimeMinutes, 0) / 60);

  return (
    <div className="learning-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Learning & Skill Architecture</h1>
          <p className="page-subtitle">Curated curriculum and technical mastery roadmap</p>
        </div>
        <div className="learning-header-actions">
          <div className="learning-quick-stats">
          <div className="quick-stat-badge">
            <span className="quick-stat-icon">⏱️</span>
            <span><strong>{totalTimeHours}h</strong> Studied</span>
          </div>
          <div className="quick-stat-badge">
            <span className="quick-stat-icon">📚</span>
            <span><strong>{subjects.length}</strong> Tracks</span>
          </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowSubjectModal(true)}>
            ➕ Add Track
          </button>
        </div>
      </div>

      {/* Subject Tabs / Cards Carousel */}
      <div className="subject-cards-grid">
        {subjects.map(subj => {
          const isSelected = subj.id === currentSubject?.id;
          return (
            <div
              key={subj.id}
              className={`subject-card card ${isSelected ? 'active' : ''}`}
              onClick={() => {
                setSelectedSubjectId(subj.id);
                setSearchQuery('');
              }}
              style={{
                borderColor: isSelected ? subj.color : undefined,
                boxShadow: isSelected ? `0 0 16px ${subj.color}33` : undefined,
              }}
            >
              <div className="subject-card-top">
                <span className="subject-card-icon" style={{ backgroundColor: `${subj.color}20` }}>
                  {subj.icon}
                </span>
                <span className="subject-progress-pill" style={{ color: subj.color, borderColor: `${subj.color}40` }}>
                  {subj.progress}%
                </span>
                <button
                  className="icon-button subject-delete-button"
                  aria-label={`Delete ${subj.name} learning track`}
                  title="Delete learning track"
                  onClick={event => {
                    event.stopPropagation();
                    void handleDeleteSubject(subj);
                  }}
                >
                  ×
                </button>
              </div>
              <h3 className="subject-card-title">{subj.name}</h3>
              <p className="subject-card-stats">
                {subj.completedTopics} of {subj.totalTopics} topics • {Math.round(subj.totalTimeMinutes / 60)}h spent
              </p>
              <div className="progress-bar sm" style={{ marginTop: 'var(--space-3)' }}>
                <div
                  className="progress-bar-fill animated"
                  style={{ width: `${subj.progress}%`, backgroundColor: subj.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Subject Roadmap Section */}
      {currentSubject ? (
        <div className="card subject-details-container animate-fade-in-up">
          <div className="subject-details-header">
            <div className="flex items-center gap-3">
              <span className="subject-large-icon">{currentSubject.icon}</span>
              <div>
                <h2 className="subject-title">{currentSubject.name} Curriculum</h2>
                <span className="subject-meta">
                  {currentSubject.completedTopics} / {currentSubject.totalTopics} Completed • Track progress
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="topic-search-box">
                <input
                  type="text"
                  placeholder="Search topics..."
                  className="form-input sm"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="btn btn-primary sm" onClick={() => setShowTopicModal(true)}>
                ➕ Add Topic
              </button>
            </div>
          </div>

        {/* Topic List */}
        <div className="topics-list">
          {filteredTopics.length === 0 ? (
            <div className="empty-state">
              <p>{searchQuery ? `No topics match “${searchQuery}”.` : 'No topics in this track yet. Add one to begin.'}</p>
            </div>
          ) : (
            filteredTopics.map((topic, index) => (
              <div key={topic.id} className="topic-row">
                <div className="topic-order-badge">#{index + 1}</div>
                <div className="topic-info">
                  <h4 className="topic-name">{topic.name}</h4>
                  <div className="topic-meta-row">
                    <span className={`difficulty-badge ${topic.difficulty}`}>
                      {topic.difficulty.toUpperCase()}
                    </span>
                    <span className="topic-time">
                      ⏱️ {topic.timeSpentMinutes > 0 ? `${topic.timeSpentMinutes} mins logged` : 'Not started'}
                    </span>
                  </div>
                </div>

                <div className="topic-status-action">
                  <button
                    className={`topic-status-pill ${topic.status}`}
                    onClick={() => toggleTopicStatus(topic.id)}
                    title="Click to toggle status"
                  >
                    {topic.status === 'completed' && '✅ Completed'}
                    {topic.status === 'in_progress' && '⏳ In Progress'}
                    {topic.status === 'not_started' && '⭕ Mark Started'}
                  </button>
                  <button
                    className="icon-button topic-delete-button"
                    aria-label={`Delete topic ${topic.name}`}
                    title="Delete topic"
                    onClick={() => void handleDeleteTopic(topic)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      ) : (
        <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>📚</div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: 'var(--space-1)' }}>No Learning Tracks Established</h2>
          <p style={{ color: 'var(--evo-text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '440px', margin: '0 auto' }}>
            Add a learning track to organize subjects, then add topics and track your progress.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-5)' }} onClick={() => setShowSubjectModal(true)}>
            ➕ Add Your First Track
          </button>
        </div>
      )}

      {/* Add Topic Modal */}
      {showTopicModal && currentSubject && (
        <div className="modal-overlay" onClick={() => setShowTopicModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Topic to {currentSubject.name}</h2>
              <button className="modal-close" onClick={() => setShowTopicModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddTopic}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Topic / Concept Name *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. CompletableFuture & Executors, Graph BFS/DFS"
                      value={newTopicName}
                      onChange={e => setNewTopicName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Difficulty</label>
                    <select
                      className="form-input"
                      value={newTopicDifficulty}
                      onChange={e => setNewTopicDifficulty(e.target.value as any)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTopicModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Topic'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSubjectModal && (
        <div className="modal-overlay" onClick={() => setShowSubjectModal(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Learning Track</h2>
              <button className="modal-close" onClick={() => setShowSubjectModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubject}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="learning-track-name">Track name *</label>
                  <input
                    id="learning-track-name"
                    className="form-input"
                    placeholder="e.g. Java, Data Structures, Product Design"
                    value={newSubjectName}
                    onChange={event => setNewSubjectName(event.target.value)}
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubjectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Track'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
