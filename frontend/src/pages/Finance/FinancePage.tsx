import { useState, useEffect } from 'react';
import type { Expense, ExpenseCategory } from '../../types';
import { getFinanceSummary, addExpense } from '../../services/api';
import './FinancePage.css';

const categoryEmojis: Record<string, string> = {
  food: '🍔', travel: '🚗', shopping: '🛍️', education: '📚',
  bills: '📄', entertainment: '🎬', health: '💊', other: '📌',
};

const categoryColors: Record<string, string> = {
  food: '#FF6B6B', travel: '#FFA726', shopping: '#AB47BC', education: '#00D2FF',
  bills: '#78909C', entertainment: '#FFD600', health: '#00E676', other: '#6C5CE7',
};

export default function FinancePage() {
  const [tab, setTab] = useState<'overview' | 'expenses' | 'income' | 'savings'>('overview');
  const [showModal, setShowModal] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState<number>(30000);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    amount: number;
    category: string;
    description: string;
    date: string;
  }>({
    amount: 350,
    category: 'food',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    getFinanceSummary().then(res => {
      if (res) {
        if (res.expenses) setExpenses(res.expenses);
        if (res.income) setIncomes(res.income);
        if (res.savingsGoals) setSavingsGoals(res.savingsGoals);
        if (res.totalIncome !== undefined) setTotalIncome(res.totalIncome);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Group expenses by category
  const expenseByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) return;

    const newExp = await addExpense({
      amount: formData.amount,
      category: formData.category as ExpenseCategory,
      description: formData.description.trim() || formData.category,
      date: formData.date,
    });

    if (newExp) {
      setExpenses(prev => [newExp, ...prev]);
      showToast(`✓ Logged ₹${newExp.amount} for ${newExp.category}`);
    }
    setShowModal(false);
    setFormData({
      amount: 350,
      category: 'food',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="finance-page">
      {toastMessage && (
        <div className="toast-notification animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Personal Capital & Runway</h1>
          <p className="page-subtitle">Discretionary burn tracking & financial runway management</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Log Expense
        </button>
      </div>

      {/* Metric Cards */}
      <div className="finance-metrics-grid">
        <div className="card metric-card animate-fade-in-up stagger-1">
          <div className="metric-header">
            <span className="metric-icon green">💵</span>
            <span className="metric-label">Monthly Inflow</span>
          </div>
          <div className="metric-value">₹{totalIncome.toLocaleString()}</div>
          <span className="metric-change positive">From active streams</span>
        </div>

        <div className="card metric-card animate-fade-in-up stagger-2">
          <div className="metric-header">
            <span className="metric-icon red">💳</span>
            <span className="metric-label">Monthly Burn</span>
          </div>
          <div className="metric-value">₹{totalExpenses.toLocaleString()}</div>
          <span className="metric-change">Actual live expenses</span>
        </div>

        <div className="card metric-card animate-fade-in-up stagger-3">
          <div className="metric-header">
            <span className="metric-icon purple">🛡️</span>
            <span className="metric-label">Net Surplus</span>
          </div>
          <div className="metric-value">₹{netSavings.toLocaleString()}</div>
          <span className={`metric-change ${netSavings >= 0 ? 'positive' : 'negative'}`}>
            {savingsRate}% savings rate
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="filter-pill-group" style={{ marginBottom: 'var(--space-6)' }}>
        {(['overview', 'expenses', 'income', 'savings'] as const).map(t => (
          <button
            key={t}
            className={`filter-pill ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="finance-overview-grid">
          {/* Category Breakdown */}
          <div className="card animate-fade-in-up stagger-4">
            <div className="card-header">
              <h2 className="card-title">Burn by Category</h2>
            </div>
            <div className="category-breakdown-list">
              {Object.keys(expenseByCategory).length === 0 ? (
                <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)' }}>No expenses recorded yet.</p>
              ) : (
                Object.entries(expenseByCategory).map(([cat, amount]) => {
                  const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
                  return (
                    <div key={cat} className="category-row">
                      <div className="category-row-header">
                        <span className="category-row-title">
                          {categoryEmojis[cat] || '📌'} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </span>
                        <span className="category-row-amount">₹{amount.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="progress-bar sm">
                        <div
                          className="progress-bar-fill animated"
                          style={{
                            width: `${pct}%`,
                            background: categoryColors[cat] || 'var(--evo-primary)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Outflow */}
          <div className="card animate-fade-in-up stagger-5">
            <div className="card-header">
              <h2 className="card-title">Recent Transactions</h2>
              <span className="card-action" onClick={() => setTab('expenses')} style={{ cursor: 'pointer' }}>
                All ({expenses.length}) →
              </span>
            </div>
            <div className="recent-transactions-list">
              {expenses.length === 0 ? (
                <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)' }}>No recent transactions.</p>
              ) : (
                expenses.slice(0, 5).map(exp => (
                  <div key={exp.id} className="transaction-item">
                    <span className="transaction-icon" style={{ background: `${categoryColors[exp.category] || '#6C5CE7'}22` }}>
                      {categoryEmojis[exp.category] || '📌'}
                    </span>
                    <div className="transaction-info">
                      <span className="transaction-desc">{exp.description}</span>
                      <span className="transaction-date">
                        {new Date(exp.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        {' • '}{exp.category}
                      </span>
                    </div>
                    <span className="transaction-amount expense">-₹{exp.amount.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <h2 className="card-title">All Logged Expenses</h2>
            <button className="btn btn-secondary sm" onClick={() => setShowModal(true)}>+ Add Entry</button>
          </div>
          <div className="finance-table">
            {expenses.length === 0 ? (
              <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)' }}>No expenses recorded yet.</p>
            ) : (
              expenses.map(exp => (
                <div key={exp.id} className="finance-row">
                  <span className="finance-row-icon" style={{ background: `${categoryColors[exp.category] || '#6C5CE7'}22` }}>
                    {categoryEmojis[exp.category] || '📌'}
                  </span>
                  <div className="finance-row-info">
                    <span className="finance-row-desc">{exp.description}</span>
                    <span className="finance-row-date">
                      {new Date(exp.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      {' • '}{exp.category}
                    </span>
                  </div>
                  <span className="finance-row-amount expense">-₹{exp.amount.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'income' && (
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <h2 className="card-title">Inflow Sources</h2>
          </div>
          <div className="finance-table">
            {incomes.length === 0 ? (
              <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)' }}>No income entries found.</p>
            ) : (
              incomes.map((inc: any) => (
                <div key={inc.id} className="finance-row">
                  <span className="finance-row-icon" style={{ background: 'rgba(0, 230, 118, 0.1)' }}>💵</span>
                  <div className="finance-row-info">
                    <span className="finance-row-desc">{inc.source}</span>
                    <span className="finance-row-date">
                      {new Date(inc.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      {' • '}{inc.category}
                    </span>
                  </div>
                  <span className="finance-row-amount income">+₹{Number(inc.amount).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'savings' && (
        <div className="card animate-fade-in-up">
          <div className="card-header">
            <h2 className="card-title">Emergency & Venture Runway</h2>
          </div>
          <div className="savings-goals-list">
            {savingsGoals.length === 0 ? (
              <p style={{ color: 'var(--evo-text-secondary)', padding: 'var(--space-4)' }}>No savings goals created yet.</p>
            ) : (
              savingsGoals.map((sg: any) => {
                const cur = Number(sg.currentAmount) || 0;
                const tgt = Number(sg.targetAmount) || 100000;
                const remaining = Math.max(0, tgt - cur);
                const pct = tgt > 0 ? Math.round((cur / tgt) * 100) : 0;
                const daysLeft = Math.max(1, Math.ceil((new Date(sg.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                const weeklyTarget = Math.ceil(remaining / Math.max(1, daysLeft / 7));
                const monthlyTarget = Math.ceil(remaining / Math.max(1, daysLeft / 30));

                return (
                  <div key={sg.id} className="savings-detail-card card">
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
                      {sg.title}
                    </h3>
                    <div className="savings-detail-amounts">
                      <span className="savings-current" style={{ fontSize: 'var(--text-2xl)' }}>₹{cur.toLocaleString()}</span>
                      <span className="savings-target">/ ₹{tgt.toLocaleString()}</span>
                    </div>
                    <div className="progress-bar lg" style={{ margin: 'var(--space-4) 0' }}>
                      <div className="progress-bar-fill green animated" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="savings-breakdown" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                      <div className="savings-breakdown-item">
                        <span className="savings-breakdown-label">Remaining Gap</span>
                        <span className="savings-breakdown-value">₹{remaining.toLocaleString()}</span>
                      </div>
                      <div className="savings-breakdown-item">
                        <span className="savings-breakdown-label">Days to Target</span>
                        <span className="savings-breakdown-value">{daysLeft}</span>
                      </div>
                      <div className="savings-breakdown-item">
                        <span className="savings-breakdown-label">Required / Week</span>
                        <span className="savings-breakdown-value">₹{weeklyTarget.toLocaleString()}</span>
                      </div>
                      <div className="savings-breakdown-item">
                        <span className="savings-breakdown-label">Required / Month</span>
                        <span className="savings-breakdown-value">₹{monthlyTarget.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Log Expense Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Log Expense</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLogExpense}>
              <div className="modal-body">
                <div className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="e.g., 450"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      {Object.entries(categoryEmojis).map(([key, emoji]) => (
                        <option key={key} value={key}>{emoji} {key.charAt(0).toUpperCase() + key.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input
                      className="form-input"
                      placeholder="e.g., Books & Courses, Lunch, AWS Hosting"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      className="form-input"
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
