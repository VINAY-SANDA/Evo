import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Goal, Habit, Task, ProgressScore } from '../../types';
import { getProgressScores, getGoals, getHabits, getTasks } from '../../services/api';
import './ProgressPage.css';

const categoryRoutes: Record<string, string> = {
  Career: '/goals',
  Learning: '/learning',
  Finance: '/finance',
  Projects: '/projects',
  Habits: '/habits',
};

export default function ProgressPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('week');
  const [scores, setScores] = useState<ProgressScore[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    getProgressScores().then(setScores);
    getGoals().then(setGoals);
    getHabits().then(setHabits);
    getTasks().then(setTasks);
  }, []);

  const overallScore = scores.length > 0
    ? (() => {
        const activeScores = scores.filter(s => s.score > 0);
        return activeScores.length > 0
          ? Math.round(activeScores.reduce((s, c) => s + c.score, 0) / activeScores.length)
          : 0;
      })()
    : 0;

  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
  const activeGoalsCount = goals.filter(g => g.status === 'active').length;
  const activeHabitsCount = habits.filter(h => h.active).length;

  return (
    <div className="progress-page">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Life Progress & Mastery</h1>
          <p className="page-subtitle">Unified progress index across your personal operating system</p>
        </div>
        <div className="filter-pill-group">
          {(['week', 'month', 'quarter'] as const).map(range => (
            <button
              key={range}
              className={`filter-pill ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'This Quarter'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Score Hero Card */}
      <div className="card progress-hero-card animate-fade-in-up">
        <div className="progress-hero-main">
          <div className="progress-circle-wrapper">
            <svg className="progress-circle-svg" viewBox="0 0 120 120">
              <circle
                className="progress-circle-bg"
                cx="60"
                cy="60"
                r="52"
              />
              <circle
                className="progress-circle-fill"
                cx="60"
                cy="60"
                r="52"
                style={{
                  strokeDasharray: 326.7,
                  strokeDashoffset: 326.7 * (1 - overallScore / 100),
                }}
              />
            </svg>
            <div className="progress-circle-content">
              <span className="progress-score-num">{overallScore}</span>
              <span className="progress-score-total">/100</span>
            </div>
          </div>

          <div className="progress-hero-info">
            <div className="badge badge-primary" style={{ alignSelf: 'flex-start', marginBottom: 'var(--space-2)' }}>
              {overallScore >= 75 ? '⚡ High Momentum' : overallScore > 0 ? '📈 Active Trajectory' : '🎯 Baseline Initialized'}
            </div>
            <h2 className="progress-hero-title">Overall Life Performance Score</h2>
            <p className="progress-hero-desc">
              Your overall score is synthesized from goal advancement (40%), habit adherence (30%), 
              daily task velocity (20%), and financial discipline (10%).
            </p>
            <div className="progress-hero-stats">
              <div className="progress-hero-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/goals')}>
                <span className="stat-label">Active Goals</span>
                <span className="stat-val">{activeGoalsCount}</span>
              </div>
              <div className="progress-hero-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                <span className="stat-label">Completed Tasks</span>
                <span className="stat-val">{completedTasksCount} / {tasks.length}</span>
              </div>
              <div className="progress-hero-stat" style={{ cursor: 'pointer' }} onClick={() => navigate('/habits')}>
                <span className="stat-label">Tracked Habits</span>
                <span className="stat-val">{activeHabitsCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown Grid */}
      <div className="section-title-group">
        <h2 className="section-title">Life Area Performance</h2>
        <span className="section-subtitle">Real-time breakdown of all key dimensions</span>
      </div>

      <div className="progress-category-grid">
        {scores.map((cat, idx) => (
          <div key={cat.category} className={`card category-progress-card animate-fade-in-up stagger-${idx + 1}`}>
            <div className="category-progress-header">
              <div className="category-icon-title">
                <span className="category-emoji-badge" style={{ backgroundColor: `${cat.color}20` }}>
                  {cat.icon}
                </span>
                <div>
                  <h3 className="category-name">{cat.category}</h3>
                  <span className={`category-delta ${cat.change > 0 ? 'positive' : cat.change < 0 ? 'negative' : ''}`}>
                    {cat.change > 0 ? `▲ +${cat.change}% vs last week` : cat.change < 0 ? `▼ ${cat.change}% vs last week` : `• Baseline trajectory`}
                  </span>
                </div>
              </div>
              <div className="category-score-badge" style={{ borderColor: `${cat.color}40`, color: cat.color }}>
                {cat.score}
              </div>
            </div>

            <div className="category-progress-bar-container">
              <div className="progress-bar">
                <div
                  className="progress-bar-fill animated"
                  style={{
                    width: `${cat.score}%`,
                    background: cat.color,
                  }}
                />
              </div>
            </div>

            <div className="category-progress-footer">
              <span className="category-status-text">
                {cat.score >= 80 ? '🌟 Exceptional' : cat.score >= 70 ? '🟢 Strong Pace' : cat.score > 0 ? '🟡 In Progress' : '⚪ Not Started'}
              </span>
              <button
                className="category-inspect-btn"
                onClick={() => navigate(categoryRoutes[cat.category] || '/goals')}
              >
                View Details →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* AI Performance Insights */}
      <div className="card ai-insight-banner animate-fade-in-up stagger-4">
        <div className="ai-insight-badge">
          <span>✨ EVO AI Velocity Insight</span>
        </div>
        <p className="ai-insight-text">
          "Vinay, your execution metrics are connected live to your personal database. 
          Focus on consistency across your high-leverage goals and habits to drive compounding returns."
        </p>
      </div>
    </div>
  );
}
