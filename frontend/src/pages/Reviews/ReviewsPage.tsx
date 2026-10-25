import { useState, useEffect } from 'react';
import type { DailyReview, WeeklyReview } from '../../types';
import { getDailyReview, getWeeklyReview, createTask, getTasks, getHabits, getGoals, sendAiChatMessage, saveDailyReview, saveWeeklyReview } from '../../services/api';
import './ReviewsPage.css';

const defaultDailyReview: DailyReview = {
  id: 'daily_today',
  userId: '00000000-0000-0000-0000-000000000001',
  date: new Date().toISOString().split('T')[0],
  completedTasks: 0,
  totalTasks: 0,
  completedHabits: 0,
  totalHabits: 0,
  score: 0,
  aiSummary: 'No daily reflection logged yet today. Click "Add Reflection" above to document your needle-moving wins and focus friction.',
  whatWentWell: [],
  whatWentWrong: [],
  suggestions: [],
};

const defaultWeeklyReview: WeeklyReview = {
  id: 'weekly_current',
  userId: '00000000-0000-0000-0000-000000000001',
  weekStart: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
  weekEnd: new Date().toISOString().split('T')[0],
  overallScore: 0,
  categoryScores: [],
  biggestAchievement: 'No weekly retrospective completed yet.',
  biggestProblem: 'None recorded.',
  nextWeekPriorities: [],
};

export default function ReviewsPage() {
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [dailyReview, setDailyReview] = useState<DailyReview>(defaultDailyReview);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview>(defaultWeeklyReview);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [winInput, setWinInput] = useState('');
  const [gapInput, setGapInput] = useState('');
  const [generatingWeeklyReview, setGeneratingWeeklyReview] = useState(false);

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

  const generateWeeklyPlan = async () => {
    if (generatingWeeklyReview) return;
    setGeneratingWeeklyReview(true);
    try {
      const [tasks, habits, goals] = await Promise.all([getTasks(), getHabits(), getGoals()]);
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const weekStart = start.toISOString().slice(0, 10);
      const weekEnd = end.toISOString().slice(0, 10);
      const weekTasks = tasks.filter(task => task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd);
      const completed = weekTasks.filter(task => task.status === 'completed').length;
      const open = weekTasks.filter(task => task.status !== 'completed');
      const habitStreaks = habits.filter(habit => habit.active).sort((a, b) => b.currentStreak - a.currentStreak);
      const aiContext = {
        userName: 'Vinay',
        tone: 'balanced' as const,
        activeGoals: goals.filter(goal => goal.status === 'active').map(goal => ({ title: goal.title, progress: goal.progress, deadline: goal.deadline })),
        todayTasks: weekTasks.map(task => ({ title: task.title, status: task.status, priority: task.priority })),
        habits: habitStreaks.map(habit => ({ name: habit.name, currentStreak: habit.currentStreak, completedToday: habit.completedToday })),
        monthlySavings: { income: 0, expenses: 0, net: 0 },
        memories: [],
      };
      const aiReply = await sendAiChatMessage(
        `Create a concise weekly review for ${weekStart} through ${weekEnd}. Use only the task, active goal, and habit data provided. This week had ${completed} of ${weekTasks.length} due tasks completed and ${open.length} unfinished. Do not invent events or progress. Return only a valid JSON object with these exact fields: {"biggestAchievement":"...", "biggestProblem":"...", "nextWeekPriorities":["...","...","..."], "overallScore":0}. Priorities must be concrete and based on the provided data.`,
        aiContext,
      );
      if (/^(EVO could not get an AI response|Gemini is not configured|Gemini is busy|Gemini API error|Gemini returned no text|Gemini took too long|Could not reach the Gemini API)/i.test(aiReply.content)) {
        showToast(aiReply.content);
        return;
      }
      const jsonText = aiReply.content.match(/\{[\s\S]*\}/)?.[0];
      if (!jsonText) { showToast('Gemini did not return a usable review. Please try again.'); return; }
      let generated: { biggestAchievement?: string; biggestProblem?: string; nextWeekPriorities?: string[]; overallScore?: number };
      try { generated = JSON.parse(jsonText); }
      catch { showToast('Gemini returned an unreadable review. Please try again.'); return; }
      const priorities = Array.isArray(generated.nextWeekPriorities) ? generated.nextWeekPriorities.filter(item => typeof item === 'string' && item.trim()).slice(0, 3) : [];
      if (!generated.biggestAchievement?.trim() || !generated.biggestProblem?.trim() || priorities.length === 0) {
        showToast('Gemini returned an incomplete review. Please try again.');
        return;
      }
      const review = await saveWeeklyReview({
        weekStart, weekEnd,
        overallScore: Number.isFinite(Number(generated.overallScore)) ? Math.max(0, Math.min(100, Math.round(Number(generated.overallScore)))) : (weekTasks.length ? Math.round(completed / weekTasks.length * 100) : 0),
        biggestAchievement: generated.biggestAchievement.trim(),
        biggestProblem: generated.biggestProblem.trim(),
        nextWeekPriorities: priorities,
        categoryScores: habitStreaks.slice(0, 3).map(habit => ({ category: habit.name, score: Math.min(100, habit.currentStreak * 10), change: 0, icon: habit.icon, color: habit.color })),
      });
      if (!review) { showToast('Weekly review could not be saved. Please try again.'); return; }
      setWeeklyReview(review);
      showToast('Gemini generated your weekly review and EVO saved it.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gemini could not generate the weekly review. Please try again.');
    } finally { setGeneratingWeeklyReview(false); }
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
          <p className="page-subtitle">{tab === 'weekly' ? 'Gemini uses your tasks, active goals, and habit streaks only when you ask it to generate a weekly review.' : 'AI-assisted reflections, honest scorecards, and trajectory correction'}</p>
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
          {tab === 'weekly' && <button className="btn btn-secondary sm" onClick={() => void generateWeeklyPlan()} disabled={generatingWeeklyReview}>{generatingWeeklyReview ? 'Asking Gemini…' : '✨ Generate with Gemini'}</button>}
          {tab === 'daily' && <button className="btn btn-primary sm" onClick={() => setShowReflectionModal(true)}>✍️ Add Reflection</button>}
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
                <span className="daily-stat-val">
                  {dailyReview.totalTasks > 0 ? `${Math.round((dailyReview.completedTasks / dailyReview.totalTasks) * 100)}%` : '0%'}
                </span>
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
              {dailyReview.whatWentWell && dailyReview.whatWentWell.length > 0 ? (
                <ul className="retro-list">
                  {dailyReview.whatWentWell.map((item, i) => (
                    <li key={i} className="retro-item win">
                      <span className="retro-icon">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--evo-text-secondary)', fontSize: 'var(--text-sm)', padding: 'var(--space-2) 0' }}>
                  No logged wins for this day yet.
                </p>
              )}
            </div>

            <div className="card retro-column gaps">
              <h3 className="retro-col-title">⚠️ What Went Wrong</h3>
              {dailyReview.whatWentWrong && dailyReview.whatWentWrong.length > 0 ? (
                <ul className="retro-list">
                  {dailyReview.whatWentWrong.map((item, i) => (
                    <li key={i} className="retro-item gap">
                      <span className="retro-icon">✗</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--evo-text-secondary)', fontSize: 'var(--text-sm)', padding: 'var(--space-2) 0' }}>
                  No blockers or focus drift logged.
                </p>
              )}
            </div>
          </div>

          {/* AI Suggestions for Tomorrow */}
          <div className="card suggestions-card">
            <h3 className="suggestions-title">💡 EVO Strategic Adjustments for Tomorrow</h3>
            {dailyReview.suggestions && dailyReview.suggestions.length > 0 ? (
              <div className="suggestions-grid">
                {dailyReview.suggestions.map((sug, i) => (
                  <div key={i} className="suggestion-box">
                    <span className="suggestion-num">0{i + 1}</span>
                    <p className="suggestion-text">{sug}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--evo-text-secondary)', fontSize: 'var(--text-sm)', padding: 'var(--space-2) 0' }}>
                Complete today's reflection using "Add Reflection" to generate prioritized adjustments.
              </p>
            )}
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
            {weeklyReview.nextWeekPriorities && weeklyReview.nextWeekPriorities.length > 0 ? (
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
            ) : (
              <p style={{ color: 'var(--evo-text-secondary)', fontSize: 'var(--text-sm)', padding: 'var(--space-4) 0', textAlign: 'center' }}>
                No weekly priorities recorded yet.
              </p>
            )}
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
