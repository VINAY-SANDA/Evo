import { useState, useEffect } from 'react';
import type { LearningSubject, LearningTopic, StudySession } from '../../types';
import {
  createLearningSubject,
  createTopic,
  deleteLearningSubject,
  deleteLearningTopic,
  getLearningSubjectsWithStatus,
  getLearningDaysWorked,
  getLearningTopics,
  getLearningTopicsWithStatus,
  getStudySessions,
  logStudySession,
  updateLearningTopic,
  updateTopicStatus,
} from '../../services/api';
import './LearningPage.css';

const FOCUS_SESSION_KEY = 'evo.learning.focus-session';
const FOCUS_SPRINT_SECONDS = 25 * 60;

type ReviewTopic = LearningTopic & { subjectName: string; subjectIcon: string };

function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function focusElapsed(startedAt: number, elapsedBeforeRun: number): number {
  return Math.min(FOCUS_SPRINT_SECONDS, elapsedBeforeRun + Math.floor((Date.now() - startedAt) / 1000));
}

export default function LearningPage() {
  const [subjects, setSubjects] = useState<LearningSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [focusTopicId, setFocusTopicId] = useState<string | null>(null);
  const [focusSubjectId, setFocusSubjectId] = useState<string | null>(null);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusStartedAt, setFocusStartedAt] = useState<number | null>(null);
  const [focusElapsedBeforeRun, setFocusElapsedBeforeRun] = useState(0);
  const [recentStudyMinutes, setRecentStudyMinutes] = useState(0);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [daysWorked, setDaysWorked] = useState(0);
  const [reviewTopics, setReviewTopics] = useState<ReviewTopic[]>([]);

  const [newSubjectName, setNewSubjectName] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [newTopicNotes, setNewTopicNotes] = useState('');
  const [newTopicResource, setNewTopicResource] = useState('');
  const [newTopicReviewDate, setNewTopicReviewDate] = useState('');
  const [newTopicReviewInterval, setNewTopicReviewInterval] = useState(3);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  async function refreshSubjects() {
    const { subjects: subjs, ok } = await getLearningSubjectsWithStatus();
    if (!ok) {
      setLoadError('Learning data could not be loaded. Check your connection and try again.');
      return [];
    }
    setLoadError(null);
    setSubjects(subjs);
    setSelectedSubjectId(selected => subjs.some(subject => subject.id === selected)
      ? selected
      : (focusSubjectId && subjs.some(subject => subject.id === focusSubjectId) ? focusSubjectId : subjs[0]?.id || ''));
    return subjs;
  }

  async function refreshTopics(subjectId = selectedSubjectId) {
    if (!subjectId) {
      setTopics([]);
      return [];
    }
    const { topics: result, ok } = await getLearningTopicsWithStatus(subjectId);
    if (!ok) {
      setLoadError('Topics could not be loaded. Check your connection and try again.');
      return [];
    }
    setLoadError(null);
    setTopics(result);
    return result;
  }

  const clearFocusSession = (message?: string) => {
    setFocusTopicId(null);
    setFocusSubjectId(null);
    setFocusSeconds(0);
    setFocusElapsedBeforeRun(0);
    setFocusStartedAt(null);
    setFocusRunning(false);
    window.localStorage.removeItem(FOCUS_SESSION_KEY);
    if (message) showToast(message);
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(FOCUS_SESSION_KEY) || 'null');
      if (saved && typeof saved.topicId === 'string' && typeof saved.subjectId === 'string') {
        const elapsed = saved.running && typeof saved.startedAt === 'number'
          ? focusElapsed(saved.startedAt, Number(saved.elapsedBeforeRun) || 0)
          : Math.max(0, Number(saved.elapsedBeforeRun) || 0);
        setFocusTopicId(saved.topicId);
        setFocusSubjectId(saved.subjectId);
        setFocusElapsedBeforeRun(elapsed);
        setFocusSeconds(elapsed);
        setFocusStartedAt(saved.running && elapsed < FOCUS_SPRINT_SECONDS ? Date.now() : null);
        setFocusRunning(Boolean(saved.running) && elapsed < FOCUS_SPRINT_SECONDS);
      }
    } catch {
      window.localStorage.removeItem(FOCUS_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!focusTopicId || !focusSubjectId) return;
    window.localStorage.setItem(FOCUS_SESSION_KEY, JSON.stringify({
      topicId: focusTopicId,
      subjectId: focusSubjectId,
      elapsedBeforeRun: focusElapsedBeforeRun,
      startedAt: focusStartedAt,
      running: focusRunning,
    }));
  }, [focusTopicId, focusSubjectId, focusElapsedBeforeRun, focusStartedAt, focusRunning]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    refreshSubjects().finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    if (!selectedSubjectId) {
      setTopics([]);
      return () => { current = false; };
    }
    getLearningTopicsWithStatus(selectedSubjectId).then(({ topics: result, ok }) => {
      if (!current) return;
      if (!ok) {
        setLoadError('Topics could not be loaded. Check your connection and try again.');
        return;
      }
      setLoadError(null);
      setTopics(result);
    });
    return () => { current = false; };
  }, [selectedSubjectId]);

  useEffect(() => {
    if (focusSubjectId && subjects.some(subject => subject.id === focusSubjectId)) {
      setSelectedSubjectId(focusSubjectId);
    }
  }, [focusSubjectId, subjects]);

  useEffect(() => {
    if (!focusRunning || !focusStartedAt) return;
    const updateElapsed = () => setFocusSeconds(focusElapsed(focusStartedAt, focusElapsedBeforeRun));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning, focusStartedAt, focusElapsedBeforeRun]);

  useEffect(() => {
    if (focusRunning && focusSeconds >= FOCUS_SPRINT_SECONDS) {
      setFocusRunning(false);
      setFocusStartedAt(null);
      setFocusElapsedBeforeRun(FOCUS_SPRINT_SECONDS);
      setFocusSeconds(FOCUS_SPRINT_SECONDS);
      showToast('25-minute focus sprint complete. Save it to your study history.');
    }
  }, [focusRunning, focusSeconds]);

  useEffect(() => {
    Promise.all([getStudySessions(), getLearningDaysWorked()]).then(([sessions, days]) => {
      const weekAgo = Date.now() - 7 * 86400000;
      setStudySessions(sessions);
      if (days !== null) setDaysWorked(days);
      setRecentStudyMinutes(sessions.filter(session => new Date(session.studiedAt).getTime() >= weekAgo).reduce((sum, session) => sum + Number(session.durationMinutes), 0));
    });
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all(subjects.map(async subject => ({ subject, topics: await getLearningTopics(subject.id) }))).then(results => {
      if (!current) return;
      setReviewTopics(results.flatMap(({ subject, topics }) => topics.map(topic => ({ ...topic, subjectName: subject.name, subjectIcon: subject.icon }))));
    });
    return () => { current = false; };
  }, [subjects]);

  const currentSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0] || null;
  const currentSubjectSessions = studySessions.filter(session => session.subjectId === currentSubject?.id);
  const todayDate = localDate();
  const dueReviewTopics = reviewTopics.filter(topic => topic.nextReviewDate && topic.nextReviewDate <= todayDate);

  const startFocus = (topicId: string) => {
    if (!currentSubject) return;
    setFocusTopicId(topicId);
    setFocusSubjectId(currentSubject.id);
    setFocusSeconds(0);
    setFocusElapsedBeforeRun(0);
    setFocusStartedAt(Date.now());
    setFocusRunning(true);
  };

  const pauseOrResumeFocus = () => {
    if (focusRunning && focusStartedAt) {
      const elapsed = focusElapsed(focusStartedAt, focusElapsedBeforeRun);
      setFocusSeconds(elapsed);
      setFocusElapsedBeforeRun(elapsed);
      setFocusStartedAt(null);
      setFocusRunning(false);
      return;
    }
    setFocusElapsedBeforeRun(focusSeconds);
    setFocusStartedAt(Date.now());
    setFocusRunning(true);
  };

  const saveFocusSession = async () => {
    const topic = topics.find(item => item.id === focusTopicId);
    const subject = subjects.find(item => item.id === focusSubjectId);
    if (!topic || !subject || topic.subjectId !== subject.id) {
      clearFocusSession('This focus topic is no longer available. The unsaved session was cancelled.');
      return;
    }
    const minutes = Math.max(1, Math.round(focusSeconds / 60));
    setFocusRunning(false);
    setFocusStartedAt(null);
    setFocusElapsedBeforeRun(focusSeconds);
    const saved = await logStudySession({ subjectId: subject.id, topicId: topic.id, durationMinutes: minutes, note: 'EVO focus session' });
    if (!saved) { showToast('Focus time could not be saved. Please try again.'); return; }
    await Promise.all([refreshSubjects(), refreshTopics(subject.id)]);
    setStudySessions(items => [saved, ...items]);
    setRecentStudyMinutes(value => value + minutes);
    clearFocusSession();
    showToast(`${minutes} minutes added to ${topic.name}.`);
  };

  const finishReview = async (topic: LearningTopic) => {
    const interval = topic.reviewIntervalDays || 3;
    const updated = await updateLearningTopic(topic.id, { lastReviewedAt: localDate(), nextReviewDate: localDate(interval) });
    if (!updated) { showToast('Review schedule could not be updated.'); return; }
    setTopics(items => items.map(item => item.id === topic.id ? updated : item));
    setReviewTopics(items => items.map(item => item.id === topic.id ? { ...updated, subjectName: item.subjectName, subjectIcon: item.subjectIcon } : item));
    showToast(`Review saved. Revisit ${topic.name} in ${interval} day${interval === 1 ? '' : 's'}.`);
  };

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
    void refreshSubjects();
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
      notes: newTopicNotes.trim(),
      resourceUrl: newTopicResource.trim(),
      nextReviewDate: newTopicReviewDate || undefined,
      reviewIntervalDays: newTopicReviewInterval,
    });
    setSaving(false);

    if (newTop) {
      setTopics(prev => [...prev, newTop]);
      setSubjects(sList => sList.map(s => s.id === subject.id ? {
        ...s,
        totalTopics: s.totalTopics + 1,
      } : s));
      void refreshSubjects();
      showToast(`Topic “${newTop.name}” added to ${subject.name}.`);
    } else {
      showToast('Could not add this topic. Please try again.');
      return;
    }

    setNewTopicName('');
    setNewTopicNotes('');
    setNewTopicResource('');
    setNewTopicReviewDate('');
    setNewTopicReviewInterval(3);
    setShowTopicModal(false);
  };

  const handleDeleteSubject = async (subject: LearningSubject) => {
    if (focusSubjectId === subject.id) {
      showToast('Cancel or save the active focus session before deleting its learning track.');
      return;
    }
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
    if (focusTopicId === topic.id) {
      showToast('Cancel or save the active focus session before deleting its topic.');
      return;
    }
    if (!window.confirm(`Delete “${topic.name}”? This cannot be undone.`)) return;
    const deleted = await deleteLearningTopic(topic.id);
    if (!deleted) {
      showToast('Could not delete this topic. Please try again.');
      return;
    }
    await Promise.all([refreshSubjects(), refreshTopics(topic.subjectId)]);
    showToast(`Topic “${topic.name}” deleted.`);
  };

  const totalTimeHours = Math.round(subjects.reduce((acc, s) => acc + s.totalTimeMinutes, 0) / 60);
  const completedTopics = subjects.reduce((total, subject) => total + subject.completedTopics, 0);

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
          <div className="quick-stat-badge">
            <span className="quick-stat-icon">✅</span>
            <span><strong>{completedTopics}</strong> Topics completed</span>
          </div>
          <div className="quick-stat-badge">
            <span className="quick-stat-icon">📅</span>
            <span><strong>{daysWorked}</strong> Days studied</span>
          </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowSubjectModal(true)}>
            ➕ Add Track
          </button>
        </div>
      </div>

      {loading && <div className="card learning-loading-state" role="status">Loading learning tracks…</div>}
      {loadError && <div className="card learning-error-state" role="alert"><span>{loadError}</span><button className="btn btn-secondary sm" onClick={() => { void refreshSubjects(); void refreshTopics(); }}>Try again</button></div>}

      <section className="card study-focus-card" aria-label="Study focus timer">
        <div><span className="study-focus-eyebrow">FOCUS SPRINT</span><h2>{focusTopicId ? topics.find(topic => topic.id === focusTopicId)?.name || 'Study session' : 'Ready for a focused session?'}</h2><p>Start a 25-minute sprint from any topic. Stop early or let it run, then save the time to your study history.</p></div>
        <div className="study-focus-controls">
          <strong className="study-focus-clock">{String(Math.floor(focusSeconds / 60)).padStart(2, '0')}:{String(focusSeconds % 60).padStart(2, '0')}</strong>
          <span className="study-focus-total">Recent study time: {recentStudyMinutes} min</span>
          {focusTopicId ? <><button className="btn btn-secondary" onClick={pauseOrResumeFocus}>{focusRunning ? 'Pause' : 'Resume'}</button><button className="btn btn-primary" onClick={() => void saveFocusSession()} disabled={focusSeconds < 30}>Save session</button><button className="btn btn-ghost" onClick={() => clearFocusSession('Focus session cancelled.')}>Cancel</button></> : <span className="study-focus-hint">Choose a topic below to start</span>}
        </div>
      </section>

      {dueReviewTopics.length > 0 && <section className="card learning-review-queue">
        <div><h2 className="card-title">🧠 Ready to review</h2><p className="project-template-caption">Short retrieval practice helps topics stick. Your next review is scheduled three days after you finish.</p></div>
        <div className="learning-review-list">{dueReviewTopics.map(topic => <div className="learning-review-item" key={topic.id}><span>{topic.subjectIcon} <strong>{topic.subjectName}</strong> · {topic.name}</span><button className="btn btn-secondary sm" onClick={() => void finishReview(topic)}>Mark reviewed · next in {topic.reviewIntervalDays || 3}d</button></div>)}</div>
      </section>}

      {currentSubject && currentSubjectSessions.length > 0 && <section className="card learning-history-card" aria-label="Recent study history">
        <div><h2 className="card-title">Recent study history</h2><p className="project-template-caption">Time saved to {currentSubject.name}.</p></div>
        <div className="learning-history-list">
          {currentSubjectSessions.slice(0, 5).map(session => <div className="learning-history-item" key={session.id}>
            <span>{session.topicName || 'Track study'}{session.note ? ` · ${session.note}` : ''}</span>
            <strong>{session.durationMinutes} min</strong>
            <time>{new Date(session.studiedAt).toLocaleDateString('en-IN')}</time>
          </div>)}
        </div>
      </section>}

      {/* Subject Tabs / Cards Carousel */}
      <div className="subject-cards-grid">
        {subjects.map(subj => {
          const isSelected = subj.id === currentSubject?.id;
          return (
            <div
              key={subj.id}
              className={`subject-card card ${isSelected ? 'active' : ''}`}
              onClick={() => {
                if (focusTopicId) { showToast('Finish or save the current focus session before switching tracks.'); return; }
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
                  {topic.notes && <p className="topic-notes">{topic.notes}</p>}
                  <div className="topic-resources">
                    {topic.resourceUrl && <a href={topic.resourceUrl} target="_blank" rel="noreferrer">Open study resource ↗</a>}
                    {topic.nextReviewDate && <span>Review due {new Date(`${topic.nextReviewDate}T00:00:00`).toLocaleDateString('en-IN')}</span>}
                  </div>
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
                  <button className="btn btn-secondary sm" onClick={() => startFocus(topic.id)} disabled={Boolean(focusTopicId)} title="Start a 25-minute study sprint">25m Focus</button>
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
                  <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={newTopicNotes} onChange={event => setNewTopicNotes(event.target.value)} placeholder="Key ideas or questions to remember" /></div>
                  <div className="form-group"><label className="form-label">Study resource link</label><input className="form-input" type="url" value={newTopicResource} onChange={event => setNewTopicResource(event.target.value)} placeholder="https://…" /></div>
                  <div className="form-group"><label className="form-label">Next review date</label><input className="form-input" type="date" value={newTopicReviewDate} onChange={event => setNewTopicReviewDate(event.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Review interval</label><select className="form-input" value={newTopicReviewInterval} onChange={event => setNewTopicReviewInterval(Number(event.target.value))}><option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>1 week</option><option value={14}>2 weeks</option><option value={30}>1 month</option></select></div>
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
