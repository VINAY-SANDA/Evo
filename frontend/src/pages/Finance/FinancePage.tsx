import { useEffect, useState } from 'react';
import type { Expense, ExpenseCategory, Income, SavingsGoal } from '../../types';
import { addExpense, addIncome, addSavingsGoal, deleteExpense, deleteIncome, deleteSavingsGoal, getFinanceSummary } from '../../services/api';
import './FinancePage.css';

type FinanceTab = 'overview' | 'expenses' | 'income' | 'savings';
type FinanceModal = 'expense' | 'income' | 'savings' | null;

const categoryEmojis: Record<ExpenseCategory, string> = {
  food: '🍔', travel: '🚗', shopping: '🛍️', education: '📚',
  bills: '📄', entertainment: '🎬', health: '💊', other: '📌',
};

const categoryColors: Record<ExpenseCategory, string> = {
  food: '#E53935', travel: '#4D94FF', shopping: '#0066FF', education: '#00C853',
  bills: '#808080', entertainment: '#0052CC', health: '#35D977', other: '#CCCCCC',
};

const today = () => new Date().toISOString().slice(0, 10);

export default function FinancePage() {
  const [tab, setTab] = useState<FinanceTab>('overview');
  const [modal, setModal] = useState<FinanceModal>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'food' as ExpenseCategory, description: '', date: today() });
  const [incomeForm, setIncomeForm] = useState({ amount: '', source: '', category: 'General', date: today() });
  const [savingsForm, setSavingsForm] = useState({ title: '', targetAmount: '', currentAmount: '0', deadline: '' });

  useEffect(() => {
    getFinanceSummary().then(result => {
      if (!result) return;
      setExpenses(result.expenses);
      setIncomes(result.income);
      setSavingsGoals(result.savingsGoals);
      setTotalIncome(result.totalIncome);
    });
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const expenseByCategory = expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount);
    return totals;
  }, {} as Partial<Record<ExpenseCategory, number>>);

  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const created = await addExpense({
      amount: Number(expenseForm.amount),
      category: expenseForm.category,
      description: expenseForm.description.trim() || expenseForm.category,
      date: expenseForm.date,
    });
    setSaving(false);
    if (!created) {
      showToast('Expense was not saved. Please try again.');
      return;
    }
    setExpenses(current => [created, ...current]);
    setModal(null);
    setExpenseForm({ amount: '', category: 'food', description: '', date: today() });
    showToast(`Expense saved: ₹${Number(created.amount).toLocaleString()}.`);
  };

  const saveIncome = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const created = await addIncome({
      amount: Number(incomeForm.amount),
      source: incomeForm.source.trim(),
      category: incomeForm.category.trim() || 'General',
      date: incomeForm.date,
    });
    setSaving(false);
    if (!created) {
      showToast('Income was not saved. Please try again.');
      return;
    }
    setIncomes(current => [created, ...current]);
    setTotalIncome(current => current + Number(created.amount));
    setModal(null);
    setIncomeForm({ amount: '', source: '', category: 'General', date: today() });
    showToast(`Income saved: ₹${Number(created.amount).toLocaleString()}.`);
  };

  const saveSavingsGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const created = await addSavingsGoal({
      title: savingsForm.title.trim(),
      targetAmount: Number(savingsForm.targetAmount),
      currentAmount: Number(savingsForm.currentAmount) || 0,
      deadline: savingsForm.deadline,
    });
    setSaving(false);
    if (!created) {
      showToast('Savings goal was not saved. Please try again.');
      return;
    }
    setSavingsGoals(current => [...current, created]);
    setModal(null);
    setSavingsForm({ title: '', targetAmount: '', currentAmount: '0', deadline: '' });
    showToast(`Savings goal “${created.title}” added.`);
  };

  const removeExpense = async (expense: Expense) => {
    if (!window.confirm(`Delete the expense “${expense.description}” (₹${Number(expense.amount).toLocaleString()})?`)) return;
    const deleted = await deleteExpense(expense.id);
    if (!deleted) {
      showToast('Expense could not be deleted. Please try again.');
      return;
    }
    setExpenses(current => current.filter(item => item.id !== expense.id));
    showToast('Expense deleted.');
  };

  const removeIncome = async (income: Income) => {
    if (!window.confirm(`Delete the income entry “${income.source}” (₹${Number(income.amount).toLocaleString()})?`)) return;
    const deleted = await deleteIncome(income.id);
    if (!deleted) {
      showToast('Income could not be deleted. Please try again.');
      return;
    }
    setIncomes(current => current.filter(item => item.id !== income.id));
    setTotalIncome(current => Math.max(0, current - Number(income.amount)));
    showToast('Income deleted.');
  };

  const removeSavingsGoal = async (goal: SavingsGoal) => {
    if (!window.confirm(`Delete the savings goal “${goal.title}”?`)) return;
    const deleted = await deleteSavingsGoal(goal.id);
    if (!deleted) {
      showToast('Savings goal could not be deleted. Please try again.');
      return;
    }
    setSavingsGoals(current => current.filter(item => item.id !== goal.id));
    showToast('Savings goal deleted.');
  };

  const primaryAction = tab === 'income'
    ? { label: '+ Add Income', action: 'income' as const }
    : tab === 'savings'
      ? { label: '+ Add Savings Goal', action: 'savings' as const }
      : { label: '+ Add Expense', action: 'expense' as const };

  return (
    <div className="finance-page">
      {toastMessage && <div className="toast-notification animate-fade-in-up" role="status">{toastMessage}</div>}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Money & Savings</h1>
          <p className="page-subtitle">Track what comes in, what goes out, and what you’re building toward.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(primaryAction.action)}>
          {primaryAction.label}
        </button>
      </div>

      <div className="finance-metrics-grid">
        <div className="card metric-card">
          <div className="metric-header"><span className="metric-icon green">💵</span><span className="metric-label">Total Income</span></div>
          <div className="metric-value">₹{totalIncome.toLocaleString()}</div>
          <span className="metric-change positive">{incomes.length} income entries</span>
        </div>
        <div className="card metric-card">
          <div className="metric-header"><span className="metric-icon red">💳</span><span className="metric-label">Total Expenses</span></div>
          <div className="metric-value">₹{totalExpenses.toLocaleString()}</div>
          <span className="metric-change">{expenses.length} expense entries</span>
        </div>
        <div className="card metric-card">
          <div className="metric-header"><span className="metric-icon purple">🛡️</span><span className="metric-label">Net Savings</span></div>
          <div className="metric-value">₹{netSavings.toLocaleString()}</div>
          <span className={`metric-change ${netSavings >= 0 ? 'positive' : 'negative'}`}>{savingsRate}% savings rate</span>
        </div>
      </div>

      <div className="filter-pill-group finance-tabs" role="tablist" aria-label="Finance sections">
        {(['overview', 'expenses', 'income', 'savings'] as const).map(section => (
          <button
            key={section}
            className={`filter-pill ${tab === section ? 'active' : ''}`}
            role="tab"
            aria-selected={tab === section}
            onClick={() => setTab(section)}
          >
            {section[0].toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="finance-overview-grid">
          <div className="card">
            <div className="card-header"><h2 className="card-title">Expenses by Category</h2></div>
            <div className="category-breakdown-list">
              {Object.entries(expenseByCategory).length === 0 ? (
                <p className="finance-empty">No expenses yet. Add one to start tracking.</p>
              ) : Object.entries(expenseByCategory).map(([category, amount]) => {
                const key = category as ExpenseCategory;
                const percent = totalExpenses > 0 ? Math.round(((amount || 0) / totalExpenses) * 100) : 0;
                return (
                  <div key={category} className="category-row">
                    <div className="category-row-header">
                      <span className="category-row-title">{categoryEmojis[key] || '📌'} {category}</span>
                      <span className="category-row-amount">₹{(amount || 0).toLocaleString()} · {percent}%</span>
                    </div>
                    <div className="progress-bar sm"><div className="progress-bar-fill animated" style={{ width: `${percent}%`, background: categoryColors[key] || 'var(--evo-primary)' }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Expenses</h2>
              <button className="btn btn-secondary sm" onClick={() => setTab('expenses')}>View all →</button>
            </div>
            <FinanceRows expenses={expenses.slice(0, 5)} onDelete={removeExpense} />
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Expenses</h2>
            <button className="btn btn-primary sm" onClick={() => setModal('expense')}>+ Add Expense</button>
          </div>
          <FinanceRows expenses={expenses} onDelete={removeExpense} />
        </div>
      )}

      {tab === 'income' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Income</h2>
            <button className="btn btn-primary sm" onClick={() => setModal('income')}>+ Add Income</button>
          </div>
          {incomes.length === 0 ? <p className="finance-empty">No income yet. Add a source to see it here.</p> : (
            <div className="finance-table">
              {incomes.map(income => (
                <div key={income.id} className="finance-row">
                  <span className="finance-row-icon income-icon">💵</span>
                  <div className="finance-row-info">
                    <span className="finance-row-desc">{income.source}</span>
                    <span className="finance-row-date">{new Date(income.date).toLocaleDateString('en-IN')} · {income.category}</span>
                  </div>
                  <span className="finance-row-amount income">+₹{Number(income.amount).toLocaleString()}</span>
                  <button className="finance-delete-button" onClick={() => void removeIncome(income)} aria-label={`Delete income ${income.source}`} title="Delete income">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'savings' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Savings Goals</h2>
            <button className="btn btn-primary sm" onClick={() => setModal('savings')}>+ Add Savings Goal</button>
          </div>
          {savingsGoals.length === 0 ? <p className="finance-empty">No savings goals yet. Set a target to start building toward it.</p> : (
            <div className="savings-goals-list">
              {savingsGoals.map(goal => {
                const current = Number(goal.currentAmount) || 0;
                const target = Number(goal.targetAmount) || 0;
                const remaining = Math.max(0, target - current);
                const progress = target ? Math.min(100, Math.round((current / target) * 100)) : 0;
                const daysLeft = Math.max(0, Math.ceil((new Date(`${goal.deadline}T00:00:00`).getTime() - Date.now()) / 86400000));
                return (
                  <div key={goal.id} className="savings-detail-card card">
                    <div className="savings-goal-header">
                      <h3 className="savings-goal-name">{goal.title}</h3>
                      <div className="savings-goal-actions">
                        <span className="savings-goal-percent">{progress}%</span>
                        <button className="finance-delete-button" onClick={() => void removeSavingsGoal(goal)} aria-label={`Delete savings goal ${goal.title}`} title="Delete savings goal">Delete</button>
                      </div>
                    </div>
                    <div className="savings-detail-amounts">
                      <span className="savings-current">₹{current.toLocaleString()}</span>
                      <span className="savings-target">of ₹{target.toLocaleString()}</span>
                    </div>
                    <div className="progress-bar lg"><div className="progress-bar-fill green animated" style={{ width: `${progress}%` }} /></div>
                    <div className="savings-breakdown">
                      <div className="savings-breakdown-item"><span className="savings-breakdown-label">Left to save</span><span className="savings-breakdown-value">₹{remaining.toLocaleString()}</span></div>
                      <div className="savings-breakdown-item"><span className="savings-breakdown-label">Target date</span><span className="savings-breakdown-value">{new Date(`${goal.deadline}T00:00:00`).toLocaleDateString('en-IN')}</span></div>
                      <div className="savings-breakdown-item"><span className="savings-breakdown-label">Days left</span><span className="savings-breakdown-value">{daysLeft}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => !saving && setModal(null)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{modal === 'expense' ? 'Add Expense' : modal === 'income' ? 'Add Income' : 'Add Savings Goal'}</h2>
              <button className="modal-close" onClick={() => !saving && setModal(null)} aria-label="Close">✕</button>
            </div>

            {modal === 'expense' && (
              <form onSubmit={saveExpense}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label" htmlFor="expense-amount">Amount (₹) *</label><input id="expense-amount" className="form-input" type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={event => setExpenseForm({ ...expenseForm, amount: event.target.value })} required /></div>
                  <div className="form-group"><label className="form-label" htmlFor="expense-category">Category</label><select id="expense-category" className="form-input" value={expenseForm.category} onChange={event => setExpenseForm({ ...expenseForm, category: event.target.value as ExpenseCategory })}>{Object.entries(categoryEmojis).map(([key, emoji]) => <option key={key} value={key}>{emoji} {key[0].toUpperCase() + key.slice(1)}</option>)}</select></div>
                  <div className="form-group"><label className="form-label" htmlFor="expense-description">Description</label><input id="expense-description" className="form-input" value={expenseForm.description} onChange={event => setExpenseForm({ ...expenseForm, description: event.target.value })} placeholder="What was it for?" /></div>
                  <div className="form-group"><label className="form-label" htmlFor="expense-date">Date</label><input id="expense-date" className="form-input" type="date" value={expenseForm.date} onChange={event => setExpenseForm({ ...expenseForm, date: event.target.value })} required /></div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</button></div>
              </form>
            )}

            {modal === 'income' && (
              <form onSubmit={saveIncome}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label" htmlFor="income-amount">Amount (₹) *</label><input id="income-amount" className="form-input" type="number" min="0.01" step="0.01" value={incomeForm.amount} onChange={event => setIncomeForm({ ...incomeForm, amount: event.target.value })} required /></div>
                  <div className="form-group"><label className="form-label" htmlFor="income-source">Source *</label><input id="income-source" className="form-input" value={incomeForm.source} onChange={event => setIncomeForm({ ...incomeForm, source: event.target.value })} placeholder="Salary, freelance, interest…" required /></div>
                  <div className="form-group"><label className="form-label" htmlFor="income-category">Category</label><input id="income-category" className="form-input" value={incomeForm.category} onChange={event => setIncomeForm({ ...incomeForm, category: event.target.value })} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="income-date">Date</label><input id="income-date" className="form-input" type="date" value={incomeForm.date} onChange={event => setIncomeForm({ ...incomeForm, date: event.target.value })} required /></div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Income'}</button></div>
              </form>
            )}

            {modal === 'savings' && (
              <form onSubmit={saveSavingsGoal}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label" htmlFor="savings-title">Goal name *</label><input id="savings-title" className="form-input" value={savingsForm.title} onChange={event => setSavingsForm({ ...savingsForm, title: event.target.value })} placeholder="Emergency fund, new laptop…" required /></div>
                  <div className="form-group"><label className="form-label" htmlFor="savings-target">Target amount (₹) *</label><input id="savings-target" className="form-input" type="number" min="0.01" step="0.01" value={savingsForm.targetAmount} onChange={event => setSavingsForm({ ...savingsForm, targetAmount: event.target.value })} required /></div>
                  <div className="form-group"><label className="form-label" htmlFor="savings-current">Already saved (₹)</label><input id="savings-current" className="form-input" type="number" min="0" step="0.01" value={savingsForm.currentAmount} onChange={event => setSavingsForm({ ...savingsForm, currentAmount: event.target.value })} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="savings-deadline">Target date *</label><input id="savings-deadline" className="form-input" type="date" min={today()} value={savingsForm.deadline} onChange={event => setSavingsForm({ ...savingsForm, deadline: event.target.value })} required /></div>
                </div>
                <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Savings Goal'}</button></div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceRows({ expenses, onDelete }: { expenses: Expense[]; onDelete: (expense: Expense) => void }) {
  if (expenses.length === 0) return <p className="finance-empty">No expenses yet.</p>;
  return (
    <div className="finance-table">
      {expenses.map(expense => (
        <div key={expense.id} className="finance-row">
          <span className="finance-row-icon" style={{ background: `${categoryColors[expense.category] || '#0066FF'}22` }}>{categoryEmojis[expense.category] || '📌'}</span>
          <div className="finance-row-info">
            <span className="finance-row-desc">{expense.description}</span>
            <span className="finance-row-date">{new Date(expense.date).toLocaleDateString('en-IN')} · {expense.category}</span>
          </div>
          <span className="finance-row-amount expense">−₹{Number(expense.amount).toLocaleString()}</span>
          <button className="finance-delete-button" onClick={() => void onDelete(expense)} aria-label={`Delete expense ${expense.description}`} title="Delete expense">Delete</button>
        </div>
      ))}
    </div>
  );
}
