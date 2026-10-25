import { useState, useEffect } from 'react';
import type { DailyReview, WeeklyReview } from '../../types';
import { getDailyReview, getWeeklyReview, createTask, saveDailyReview } from '../../services/api';
import './ReviewsPage.css';

const defaultDailyReview: DailyReview = {
  id: 'daily_today',
  userId: '00000000-0000-0000-0000-000000000001',
  date: new Date().toISOString().split('T')[0],
  completedTasks: 3,
  totalTasks: 4,
  completedHabits: 2,
  totalHabits: 3,
  score: 82,
  aiSummary: 'Daily momentum is strong. High-leverage architecture tasks completed. Maintain evening focus to close all open loops.',
  whatWentWell: [
    'Successfully verified MCP server connectivity with Google Gemini',
    'Maintained continuous focus on core systems without distraction',
  ],
  whatWentWrong: [
    'Transition between deep engineering blocks took longer than scheduled',
  ],
  suggestions: [
    'Schedule top 3 priority tasks during peak morning energy hours',
    'Preserve evening shutdown ritual to recharge executive focus',
  ],
};

const defaultWeeklyReview: WeeklyReview = {
  id: 'weekly_current',
  userId: '00000000-0000-0000-0000-000000000001',
  weekStart: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
  weekEnd: new Date().toISOString().split('T')[0],
  overallScore: 84,
  categoryScores: [
    { category: 'Career', score: 88, change: 4, icon: '💼', color: '#0A84FF' },
    { category: 'Learning', score: 82, change: 3, icon: '📖', color: '#5E5CE6' },
    { category: 'Finance', score: 90, change: 5, icon: '💰', color: '#30D158' },
    { category: 'Health', score: 76, change: -1, icon: '❤️', color: '#FF453A' },
  ],
  biggestAchievement: 'Architected enterprise single-user authentication and full MCP tool suite',
  biggestProblem: 'Balancing exploratory research with structured milestone execution',
  nextWeekPriorities: [
    'Complete full DSA graph problem track',
    'Deploy production optimizations for EVO microservices',
    'Maintain daily streak consistency across all core habits',
  ],
};

export default function ReviewsPage() {
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [dailyReview, setDailyReview] = useState<DailyReview>(defaultDailyReview);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview>(defaultWeeklyReview);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [winInput, setWinInput] = useState('');
  const [gapInput, setGapInput] = useState('');

  useEffect(() => {
    getDailyReview().then(res => {
      if (res) setDailyReview(res);
    });
    getWeeklyReview().then(res => {
      if (res) setWeeklyReview(res);
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddDirectiveToSchedule = async (directive: string) => {
    await createTask({
      title: directive,
      priority: 'high',
      category: 'Strategic Directive',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '11:00',
    });
    showToast(`✓ "${directive}" added to your Tasks schedule`);
  };

  const handleSaveReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedWins = winInput.trim() ? [winInput.trim(), ...(dailyReview.whatWentWell || [])] : (dailyReview.whatWentWell || []);
    const updatedGaps = gapInput.trim() ? [gapInput.trim(), ...(dailyReview.whatWentWrong || [])] : (dailyReview.whatWentWrong || []);
    const updated: DailyReview = {
      ...dailyReview,
      whatWentWell: updatedWins,
      whatWentWrong: updatedGaps,
    };
    setDailyReview(updated);
    setWinInput('');
    setGapInput('');
    setShowReflectionModal(false);
    showToast('✓ Daily reflection saved to database');
    await saveDailyReview(updated);
  };

  return (
    <div className="reviews-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Reviews & Retrospectives</h1>
          <p className="page-subtitle">AI-assisted reflections, honest scorecards, and trajectory correction</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="tabs">
            <button
              className={`tab ${tab === 'daily' ? 'active' : ''}`}
              onClick={() => setTab('daily')}
            >
              ☀️ Daily Review
            </button>
            <button
              className={`tab ${tab === 'weekly' ? 'active' : ''}`}
              onClick={() => setTab('weekly')}
            >
              📅 Weekly Retrospective
            </button>
          </div>
          <button className="btn btn-primary sm" onClick={() => setShowReflectionModal(true)}>
            ✍️ Add Reflection
          </button>
        </div>
      </div>

      {tab === 'daily' ? (
        <div className="review-container animate-fade-in-up">
          {/* Daily Scorecard Header */}
          <div className="card review-hero-card">
            <div className="review-hero-header">
              <div>
                <span className="badge badge-primary">Daily Scorecard</span>
                <h2 className="review-title">Reflection for {dailyReview.date}</h2>
              </div>
              <div className="review-score-badge">
                <span className="score-number">{dailyReview.score}</span>
                <span className="score-max">/100</span>
              </div>
            </div>

            <div className="daily-stats-row">
              <div className="daily-stat-box">
                <span className="daily-stat-label">Tasks Finished</span>
                <span className="daily-stat-val">{dailyReview.completedTasks} / {dailyReview.totalTasks}</span>
              </div>
              <div className="daily-stat-box">
                <span className="daily-stat-label">Habits Maintained</span>
                <span className="daily-stat-val">{dailyReview.completedHabits} / {dailyReview.totalHabits}</span>
              </div>
              <div className="daily-stat-box">
                <span className="daily-stat-label">Velocity</span>
                <span className="daily-stat-val">High (81%)</span>
              </div>
            </div>

            <div className="ai-summary-block">
              <span className="ai-summary-icon">✨</span>
              <p className="ai-summary-text">{dailyReview.aiSummary}</p>
            </div>
          </div>

          {/* Wins and Gaps Breakdown */}
          <div className="grid-2">
            <div className="card retro-column wins">
              <h3 className="retro-col-title">🏆 What Went Well</h3>
              <ul className="retro-list">
                {dailyReview.whatWentWell.map((item, i) => (
                  <li key={i} className="retro-item win">
                    <span className="retro-icon">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card retro-column gaps">
              <h3 className="retro-col-title">⚠️ What Went Wrong</h3>
              <ul className="retro-list">
                {dailyReview.whatWentWrong.map((item, i) => (
                  <li key={i} className="retro-item gap">
                    <span className="retro-icon">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* AI Suggestions for Tomorrow */}
          <div className="card suggestions-card">
            <h3 className="suggestions-title">💡 EVO Strategic Adjustments for Tomorrow</h3>
            <div className="suggestions-grid">
              {dailyReview.suggestions.map((sug, i) => (
                <div key={i} className="suggestion-box">
                  <span className="suggestion-num">0{i + 1}</span>
                  <p className="suggestion-text">{sug}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="review-container animate-fade-in-up">
          {/* Weekly Scorecard */}
          <div className="card review-hero-card">
            <div className="review-hero-header">
              <div>
                <span className="badge badge-success">Weekly Executive Summary</span>
                <h2 className="review-title">
                  {weeklyReview.weekStart} to {weeklyReview.weekEnd}
                </h2>
              </div>
              <div className="review-score-badge weekly">
                <span className="score-number">{weeklyReview.overallScore}</span>
                <span className="score-max">/100</span>
              </div>
            </div>

            <div className="weekly-highlights">
              <div className="highlight-item achievement">
                <span className="highlight-tag">🌟 Biggest Achievement</span>
                <p className="highlight-text">{weeklyReview.biggestAchievement}</p>
              </div>
              <div className="highlight-item problem">
                <span className="highlight-tag">🔴 Primary Bottleneck</span>
                <p className="highlight-text">{weeklyReview.biggestProblem}</p>
              </div>
            </div>
          </div>

          {/* Next Week Priorities */}
          <div className="card priorities-card">
            <h3 className="priorities-title">🎯 Next Week Key Directives</h3>
            <div className="priorities-list">
              {weeklyReview.nextWeekPriorities.map((p, idx) => (
                <div key={idx} className="priority-item-card">
                  <span className="priority-index">{idx + 1}</span>
                  <span className="priority-text">{p}</span>
                  <button className="btn btn-secondary sm" onClick={() => handleAddDirectiveToSchedule(p)}>
                    Add to Schedule
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reflection Modal */}
      {showReflectionModal && (
        <div className="modal-overlay" onClick={() => setShowReflectionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Log Today's Reflection</h2>
              <button className="modal-close" onClick={() => setShowReflectionModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveReflection}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">🏆 Key Win (What moved the needle?)</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Solved hard Tree problem in 25 mins"
                      value={winInput}
                      onChange={e => setWinInput(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">⚠️ Friction / Gap (Where did focus drift?)</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Spent 40 mins doom-scrolling before study session"
                      value={gapInput}
                      onChange={e => setGapInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReflectionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Reflection</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
