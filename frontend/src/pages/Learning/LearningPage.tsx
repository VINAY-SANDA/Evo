import { useState, useEffect } from 'react';
import type { LearningSubject, LearningTopic } from '../../types';
import { getLearningSubjects, getLearningTopics, createTopic } from '../../services/api';
import './LearningPage.css';

export default function LearningPage() {
  const [subjects, setSubjects] = useState<LearningSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  useEffect(() => {
    getLearningSubjects().then(subjs => {
      setSubjects(subjs);
      if (subjs.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subjs[0].id);
      }
    });
    getLearningTopics().then(tops => setTopics(tops));
  }, [selectedSubjectId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0] || {
    id: 'sub_default',
    name: 'Curriculum',
    icon: '📚',
    color: '#00D2FF',
    progress: 50,
    totalTopics: 10,
    completedTopics: 5,
    totalTimeMinutes: 600,
  };

  const subjectTopics = topics.filter(t => t.subjectId === currentSubject.id);

  const filteredTopics = subjectTopics.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTopicStatus = (topicId: string) => {
    setTopics(prev => {
      const updated = prev.map(t => {
        if (t.id === topicId) {
          const nextStatus: LearningTopic['status'] = 
            t.status === 'completed' ? 'not_started' :
            t.status === 'not_started' ? 'in_progress' : 'completed';
          return { ...t, status: nextStatus };
        }
        return t;
      });

      // Recalculate subject progress
      const currentSubjectTopics = updated.filter(t => t.subjectId === currentSubject.id);
      const completedCount = currentSubjectTopics.filter(t => t.status === 'completed').length;
      const totalCount = Math.max(1, currentSubjectTopics.length);
      const newProgress = Math.round((completedCount / totalCount) * 100);

      setSubjects(sList => sList.map(s => s.id === currentSubject.id ? {
        ...s,
        completedTopics: completedCount,
        totalTopics: totalCount,
        progress: newProgress,
      } : s));

      return updated;
    });
  };

  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim() || !currentSubject.id) return;

    const newTop = await createTopic(currentSubject.id, {
      name: newTopicName.trim(),
      difficulty: newTopicDifficulty,
    });

    if (newTop) {
      setTopics(prev => [...prev, newTop]);
      setSubjects(sList => sList.map(s => s.id === currentSubject.id ? {
        ...s,
        totalTopics: s.totalTopics + 1,
      } : s));
      showToast(`✓ Topic "${newTop.name}" added to ${currentSubject.name}`);
    }

    setNewTopicName('');
    setShowModal(false);
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
      </div>

      {/* Subject Tabs / Cards Carousel */}
      <div className="subject-cards-grid">
        {subjects.map(subj => {
          const isSelected = subj.id === currentSubject.id;
          return (
            <div
              key={subj.id}
              className={`subject-card card ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedSubjectId(subj.id)}
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
            <button className="btn btn-primary sm" onClick={() => setShowModal(true)}>
              ➕ Add Topic
            </button>
          </div>
        </div>

        {/* Topic List */}
        <div className="topics-list">
          {filteredTopics.length === 0 ? (
            <div className="empty-state">
              <p>No topics matching "{searchQuery}"</p>
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
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Topic Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Topic to {currentSubject.name}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Topic</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
