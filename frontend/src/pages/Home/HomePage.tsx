import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, Habit, ProgressScore } from '../../types';
import {
  getHabits,
  getTasks,
  toggleHabitComplete,
  toggleTaskStatus,
  getDashboardData,
  getFinanceSummary,
  getProgressScores,
} from '../../services/api';
import './HomePage.css';

function CircularProgress({ value, size = 100, strokeWidth = 8, color = 'var(--evo-primary)' }: {
  value: number; size?: number; strokeWidth?: number; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="circle-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="circle-progress-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
        <circle
          className="circle-progress-fill"
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="circle-progress-value">{value}%</span>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [overallScore, setOverallScore] = useState<number>(0);
  const [todaySpent, setTodaySpent] = useState<number>(0);
  const [scores, setScores] = useState<ProgressScore[]>([]);
  const [savings, setSavings] = useState<{
    currentAmount: number;
    targetAmount: number;
    progress: number;
  }>({
    currentAmount: 0,
    targetAmount: 0,
    progress: 0,
  });

  useEffect(() => {
    getTasks().then(allTasks => {
      setTasks(allTasks);
    });

    getHabits().then(h => setHabits(h));

    getDashboardData().then(dash => {
      if (dash) {
        if (dash.aiInsight) setAiInsight(dash.aiInsight);
        if (dash.overallScore !== undefined) setOverallScore(dash.overallScore);
        if (dash.todayStats?.todaySpend !== undefined) {
          setTodaySpent(dash.todayStats.todaySpend);
        }
      }
    });

    getFinanceSummary().then(fin => {
      if (fin.savingsGoals && fin.savingsGoals.length > 0) {
        const sg = fin.savingsGoals[0];
        const cur = Number(sg.currentAmount) || 0;
        const tgt = Number(sg.targetAmount) || 0;
        const pct = tgt > 0 ? Math.round((cur / tgt) * 100) : 0;
        setSavings({ currentAmount: cur, targetAmount: tgt, progress: pct });
      }
    });

    getProgressScores().then(s => {
      if (s && s.length > 0) {
        setScores(s);
      }
    });
  }, []);

  const todayCompleted = tasks.filter(t => t.status === 'completed').length;
  const todayTotal = tasks.length;
  const habitsCompleted = habits.filter(h => h.completedToday).length;
  const habitsTotal = habits.length;

  const toggleTask = async (taskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed' as const, updatedAt: new Date().toISOString() }
          : t
      )
    );
    await toggleTaskStatus(taskId);
  };

  const toggleHabit = async (habitId: string) => {
    setHabits(prev =>
      prev.map(h =>
        h.id === habitId
          ? {
              ...h,
              completedToday: !h.completedToday,
              currentStreak: h.completedToday ? Math.max(0, h.currentStreak - 1) : h.currentStreak + 1,
            }
          : h
      )
    );
    await toggleHabitComplete(habitId);
  };

  const getPriorityClass = (p: string) => {
    switch (p) {
      case 'urgent': return 'urgent';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  };

  return (
    <div className="home-page">
      {/* ── Hero Stats ── */}
      <section className="home-hero animate-fade-in-up">
        <div className="hero-main">
          <div className="hero-score">
            <CircularProgress value={overallScore} size={140} strokeWidth={10} color="url(#heroGradient)" />
            <svg width="0" height="0">
              <defs>
                <linearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--evo-primary)" />
                  <stop offset="100%" stopColor="var(--evo-accent)" />
                </linearGradient>
              </defs>
            </svg>
            <p className="hero-score-label">Overall Progress</p>
          </div>
          <div className="hero-stats">
            <div className="hero-stat-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
              <span className="hero-stat-value">{todayCompleted}/{todayTotal}</span>
              <span className="hero-stat-label">Tasks Done</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/habits')}>
              <span className="hero-stat-value">{habitsCompleted}/{habitsTotal}</span>
              <span className="hero-stat-label">Habits Maintained</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/finance')}>
              <span className="hero-stat-value">₹{todaySpent.toLocaleString()}</span>
              <span className="hero-stat-label">Spent Today</span>
            </div>
          </div>
        </div>
      </section>

      <div className="home-grid">
        {/* ── Today's Priorities ── */}
        <section className="card animate-fade-in-up stagger-1">
          <div className="card-header">
            <h2 className="card-title">Today's Priorities</h2>
            <span className="card-action" onClick={() => navigate('/tasks')} style={{ cursor: 'pointer' }}>
              View All →
            </span>
          </div>
          <div className="task-list">
            {tasks.length === 0 ? (
              <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)', textAlign: 'center' }}>
                No tasks created yet. Click '+ New Task' below to add your first high-leverage task.
              </p>
            ) : (
              tasks.slice(0, 6).map((task) => (
                <div key={task.id} className="task-item">
                  <div className={`task-priority ${getPriorityClass(task.priority)}`} />
                  <div
                    className={`task-checkbox ${task.status === 'completed' ? 'checked' : ''}`}
                    onClick={() => toggleTask(task.id)}
                    title="Click to toggle"
                  />
                  <div className="task-content">
                    <div className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>
                      {task.title}
                    </div>
                    <div className="task-meta">
                      {task.dueTime && <span>⏰ {task.dueTime}</span>}
                      {task.estimatedMinutes && <span>⏱ {task.estimatedMinutes}m</span>}
                      {task.category && <span>{task.category}</span>}
                    </div>
                  </div>
                  {task.isAiGenerated && (
                    <span className="badge badge-primary" style={{ fontSize: '0.6rem' }}>AI</span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Habits ── */}
        <section className="card animate-fade-in-up stagger-2">
          <div className="card-header">
            <h2 className="card-title">Today's Habits</h2>
            <span className="card-action" onClick={() => navigate('/habits')} style={{ cursor: 'pointer' }}>
              {habitsCompleted}/{habitsTotal} →
            </span>
          </div>
          <div className="habits-grid">
            {habits.length === 0 ? (
              <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)', textAlign: 'center' }}>
                No active habits. Create habits to track your daily execution.
              </p>
            ) : (
              habits.map(habit => (
                <div
                  key={habit.id}
                  className={`habit-chip ${habit.completedToday ? 'completed' : ''}`}
                  onClick={() => toggleHabit(habit.id)}
                  style={{ '--habit-color': habit.color, cursor: 'pointer' } as React.CSSProperties}
                  title="Click to toggle habit"
                >
                  <span className="habit-chip-icon">{habit.icon}</span>
                  <span className="habit-chip-name">{habit.name}</span>
                  {habit.completedToday && <span className="habit-chip-check">✓</span>}
                  <span className="habit-chip-streak">🔥 {habit.currentStreak}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Savings ── */}
        <section className="card animate-fade-in-up stagger-3">
          <div className="card-header">
            <h2 className="card-title">Savings & Capital Target</h2>
            <span className="card-action" onClick={() => navigate('/finance')} style={{ cursor: 'pointer' }}>
              Details →
            </span>
          </div>
          {savings.targetAmount > 0 ? (
            <div className="savings-display">
              <div className="savings-amounts">
                <span className="savings-current">₹{savings.currentAmount.toLocaleString()}</span>
                <span className="savings-target">/ ₹{savings.targetAmount.toLocaleString()}</span>
              </div>
              <div className="progress-bar lg">
                <div
                  className="progress-bar-fill green animated"
                  style={{ width: `${savings.progress}%` }}
                />
              </div>
              <div className="savings-meta">
                <span className="savings-percent">{savings.progress}%</span>
                <span className="savings-remaining">₹{Math.max(0, savings.targetAmount - savings.currentAmount).toLocaleString()} remaining</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)', color: 'var(--evo-text-secondary)' }}>
              <p style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)' }}>No active capital targets established.</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/finance')}
                style={{ fontSize: 'var(--text-xs)' }}
              >
                Set Capital Target →
              </button>
            </div>
          )}
        </section>

        {/* ── Goal Progress ── */}
        <section className="card animate-fade-in-up stagger-4">
          <div className="card-header">
            <h2 className="card-title">Domain Velocity Scores</h2>
            <span className="card-action" onClick={() => navigate('/goals')} style={{ cursor: 'pointer' }}>
              All Goals →
            </span>
          </div>
          <div className="goal-progress-list">
            {scores.length === 0 ? (
              <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)', textAlign: 'center' }}>
                Loading live domain progress scores...
              </p>
            ) : (
              scores.map(score => (
                <div key={score.category} className="goal-progress-item">
                  <div className="goal-progress-header">
                    <span className="goal-progress-icon">{score.icon}</span>
                    <span className="goal-progress-name">{score.category}</span>
                    <span className="goal-progress-value">{score.score}%</span>
                    <span className={`stat-change ${score.change >= 0 ? 'positive' : 'negative'}`}>
                      {score.change >= 0 ? '↑' : '↓'} {Math.abs(score.change)}%
                    </span>
                  </div>
                  <div className="progress-bar sm">
                    <div
                      className="progress-bar-fill purple"
                      style={{ width: `${score.score}%`, background: score.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── AI Insight ── */}
      <section className="ai-insight-card animate-fade-in-up stagger-5" style={{ marginTop: 'var(--space-6)' }}>
        <div className="ai-insight-header">
          <span>✨</span>
          <span>EVO Executive Insight</span>
        </div>
        <p className="ai-insight-text">
          {aiInsight || 'Welcome to EVO. Your tasks, habits, and vision goals are synchronized with live PostgreSQL.'}
        </p>
        <div className="ai-insight-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/ai')}>
            Open AI Strategic Coach →
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tasks')}>
            Review Schedule
          </button>
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section className="quick-actions animate-fade-in-up stagger-6">
        <button className="quick-action-btn" onClick={() => navigate('/tasks')}>
          <span>➕</span>
          <span>New Task</span>
        </button>
        <button className="quick-action-btn" onClick={() => navigate('/goals')}>
          <span>🎯</span>
          <span>New Goal</span>
        </button>
        <button className="quick-action-btn" onClick={() => navigate('/finance')}>
          <span>💰</span>
          <span>Log Expense</span>
        </button>
        <button className="quick-action-btn" onClick={() => navigate('/reviews')}>
          <span>📝</span>
          <span>Daily Review</span>
        </button>
      </section>
    </div>
  );
}
