import express, { Request, Response, Router } from 'express';
import { pool, query } from '../db/connection.js';
import { DEFAULT_USER_ID } from '../db/userHelper.js';

const router: Router = express.Router();

// GET /api/finance/summary
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const expensesRes = await query(`
      SELECT id, user_id as "userId", amount::float as amount, category,
             to_char(date, 'YYYY-MM-DD') as date, description, created_at as "createdAt"
      FROM expenses
      WHERE user_id = $1
      ORDER BY date DESC, created_at DESC
    `, [DEFAULT_USER_ID]);

    const incomeRes = await query(`
      SELECT id, user_id as "userId", amount::float as amount, source,
             to_char(date, 'YYYY-MM-DD') as date, category, created_at as "createdAt"
      FROM incomes
      WHERE user_id = $1
      ORDER BY date DESC
    `, [DEFAULT_USER_ID]);

    const savingsRes = await query(`
      SELECT id, user_id as "userId", title, target_amount::float as "targetAmount",
             current_amount::float as "currentAmount",
             to_char(deadline, 'YYYY-MM-DD') as deadline,
             CASE WHEN target_amount > 0 THEN ROUND((current_amount / target_amount) * 100) ELSE 0 END as progress
      FROM savings_goals
      WHERE user_id = $1
      ORDER BY deadline ASC
    `, [DEFAULT_USER_ID]);

    const totalIncome = incomeRes.rows.reduce((sum: number, i: any) => sum + i.amount, 0);
    const totalExpenses = expensesRes.rows.reduce((sum: number, e: any) => sum + e.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    res.json({
      summary: {
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRate: totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0,
      },
      totalIncome,
      totalExpenses,
      netSavings,
      expenses: expensesRes.rows,
      income: incomeRes.rows,
      savingsGoals: savingsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/expenses
router.get('/expenses', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, user_id as "userId", amount::float as amount, category,
             to_char(date, 'YYYY-MM-DD') as date, description, created_at as "createdAt"
      FROM expenses
      WHERE user_id = $1
      ORDER BY date DESC, created_at DESC
    `, [DEFAULT_USER_ID]);
    res.json({ expenses: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/expenses
router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const { amount, category, description, date } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount must be greater than zero' });
    }

    const sql = `
      INSERT INTO expenses (user_id, amount, category, date, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id as "userId", amount::float as amount, category,
                to_char(date, 'YYYY-MM-DD') as date, description, created_at as "createdAt"
    `;
    const params = [
      DEFAULT_USER_ID,
      Number(amount),
      category || 'other',
      date || new Date().toISOString().split('T')[0],
      description ? String(description).trim() : 'Expense',
    ];

    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { amount, category, description, date } = req.body;
    if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) return res.status(400).json({ error: 'amount must be greater than zero' });
    const result = await query(`UPDATE expenses SET amount = COALESCE($1, amount), category = COALESCE($2, category),
      description = COALESCE($3, description), date = COALESCE($4::date, date)
      WHERE id = $5 AND user_id = $6
      RETURNING id, user_id as "userId", amount::float as amount, category, to_char(date, 'YYYY-MM-DD') as date, description, created_at as "createdAt"`,
    [amount === undefined ? null : Number(amount), category || null, description === undefined ? null : String(description).trim(), date || null, req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Expense not found' });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/finance/expenses/:id
router.delete('/expenses/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING id', [String(req.params.id), DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/income
router.get('/income', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, user_id as "userId", amount::float as amount, source,
             to_char(date, 'YYYY-MM-DD') as date, category, created_at as "createdAt"
      FROM incomes
      WHERE user_id = $1
      ORDER BY date DESC
    `, [DEFAULT_USER_ID]);
    res.json({ income: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/income
router.post('/income', async (req: Request, res: Response) => {
  try {
    const { amount, source, category, date } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount must be greater than zero' });
    }

    const sql = `
      INSERT INTO incomes (user_id, amount, source, category, date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id as "userId", amount::float as amount, source,
                to_char(date, 'YYYY-MM-DD') as date, category, created_at as "createdAt"
    `;
    const params = [
      DEFAULT_USER_ID,
      Number(amount),
      source ? String(source).trim() : 'Income',
      category || 'General',
      date || new Date().toISOString().split('T')[0],
    ];

    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/income/:id', async (req: Request, res: Response) => {
  try {
    const { amount, source, category, date } = req.body;
    if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) return res.status(400).json({ error: 'amount must be greater than zero' });
    const result = await query(`UPDATE incomes SET amount = COALESCE($1, amount), source = COALESCE($2, source),
      category = COALESCE($3, category), date = COALESCE($4::date, date)
      WHERE id = $5 AND user_id = $6
      RETURNING id, user_id as "userId", amount::float as amount, source, to_char(date, 'YYYY-MM-DD') as date, category, created_at as "createdAt"`,
    [amount === undefined ? null : Number(amount), source === undefined ? null : String(source).trim(), category || null, date || null, req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Income not found' });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/finance/income/:id
router.delete('/income/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM incomes WHERE id = $1 AND user_id = $2 RETURNING id', [String(req.params.id), DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Income not found' });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/savings
router.get('/savings', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, user_id as "userId", title, target_amount::float as "targetAmount",
             current_amount::float as "currentAmount",
             to_char(deadline, 'YYYY-MM-DD') as deadline,
             CASE WHEN target_amount > 0 THEN ROUND((current_amount / target_amount) * 100) ELSE 0 END as progress
      FROM savings_goals
      WHERE user_id = $1
      ORDER BY deadline ASC
    `, [DEFAULT_USER_ID]);
    res.json({ savingsGoals: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/savings
router.post('/savings', async (req: Request, res: Response) => {
  try {
    const { title, targetAmount, currentAmount, deadline } = req.body;
    if (!String(title || '').trim() || !Number.isFinite(Number(targetAmount)) || Number(targetAmount) <= 0) {
      return res.status(400).json({ error: 'title and a positive targetAmount are required' });
    }

    const sql = `
      INSERT INTO savings_goals (user_id, title, target_amount, current_amount, deadline)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id as "userId", title, target_amount::float as "targetAmount",
                current_amount::float as "currentAmount",
                to_char(deadline, 'YYYY-MM-DD') as deadline,
                ROUND(($4::float / $3::float) * 100) as progress
    `;
    const params = [
      DEFAULT_USER_ID,
      String(title).trim(),
      Number(targetAmount),
      Number(currentAmount) || 0,
      deadline || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
    ];

    const result = await query(sql, params);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/savings/:id', async (req: Request, res: Response) => {
  try {
    const { title, targetAmount, currentAmount, deadline } = req.body;
    if (targetAmount !== undefined && (!Number.isFinite(Number(targetAmount)) || Number(targetAmount) <= 0)) return res.status(400).json({ error: 'targetAmount must be greater than zero' });
    if (currentAmount !== undefined && (!Number.isFinite(Number(currentAmount)) || Number(currentAmount) < 0)) return res.status(400).json({ error: 'currentAmount cannot be negative' });
    const result = await query(`UPDATE savings_goals SET title = COALESCE($1, title), target_amount = COALESCE($2, target_amount),
      current_amount = COALESCE($3, current_amount), deadline = COALESCE($4::date, deadline)
      WHERE id = $5 AND user_id = $6
      RETURNING id, user_id as "userId", title, target_amount::float as "targetAmount", current_amount::float as "currentAmount",
        to_char(deadline, 'YYYY-MM-DD') as deadline, CASE WHEN target_amount > 0 THEN ROUND((current_amount / target_amount) * 100) ELSE 0 END as progress`,
    [title === undefined ? null : String(title).trim(), targetAmount === undefined ? null : Number(targetAmount), currentAmount === undefined ? null : Number(currentAmount), deadline || null, req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Savings goal not found' });
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/finance/savings/:id
router.delete('/savings/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM savings_goals WHERE id = $1 AND user_id = $2 RETURNING id', [String(req.params.id), DEFAULT_USER_ID]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Savings goal not found' });
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Monthly category budgets. The same category/month pair is updated in place.
router.get('/budgets', async (req: Request, res: Response) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? `${req.query.month}-01` : new Date().toISOString().slice(0, 7) + '-01';
    const result = await query(`
      SELECT b.id, b.category, to_char(b.month, 'YYYY-MM') as month,
        b.limit_amount::float as "limitAmount", b.alert_percent as "alertPercent",
        COALESCE(SUM(e.amount), 0)::float as spent
      FROM finance_budgets b
      LEFT JOIN expenses e ON e.user_id = b.user_id AND e.category = b.category
        AND date_trunc('month', e.date) = b.month
      WHERE b.user_id = $1 AND b.month = $2::date
      GROUP BY b.id ORDER BY b.category`, [DEFAULT_USER_ID, month]);
    res.json({ budgets: result.rows, month: month.slice(0, 7) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/budgets', async (req: Request, res: Response) => {
  try {
    const { category, month, limitAmount, alertPercent } = req.body;
    if (!String(category || '').trim() || !/^\d{4}-\d{2}$/.test(String(month || '')) || !Number.isFinite(Number(limitAmount)) || Number(limitAmount) <= 0) {
      return res.status(400).json({ error: 'category, month (YYYY-MM), and a positive limitAmount are required' });
    }
    const alert = Math.max(1, Math.min(100, Number(alertPercent) || 80));
    const result = await query(`
      INSERT INTO finance_budgets (user_id, category, month, limit_amount, alert_percent)
      VALUES ($1, $2, ($3 || '-01')::date, $4, $5)
      ON CONFLICT (user_id, category, month) DO UPDATE
        SET limit_amount = EXCLUDED.limit_amount, alert_percent = EXCLUDED.alert_percent
      RETURNING id, category, to_char(month, 'YYYY-MM') as month,
        limit_amount::float as "limitAmount", alert_percent as "alertPercent"
    `, [DEFAULT_USER_ID, String(category).trim(), month, Number(limitAmount), alert]);
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/budgets/:id', async (req: Request, res: Response) => {
  try {
    const result = await query('DELETE FROM finance_budgets WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, DEFAULT_USER_ID]);
    if (!result.rows.length) return res.status(404).json({ error: 'Budget not found' });
    res.status(204).send();
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/savings/:id/contributions', async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT c.id, c.savings_goal_id as "savingsGoalId", c.amount::float as amount,
      to_char(c.date, 'YYYY-MM-DD') as date, c.note
      FROM savings_contributions c JOIN savings_goals g ON g.id = c.savings_goal_id
      WHERE g.id = $1 AND g.user_id = $2 ORDER BY c.date DESC, c.created_at DESC`, [req.params.id, DEFAULT_USER_ID]);
    res.json({ contributions: result.rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/savings/:id/contributions', async (req: Request, res: Response) => {
  try {
    const { amount, date, note } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be greater than zero' });
    const result = await query(`
      WITH owned_goal AS (
        SELECT id FROM savings_goals WHERE id = $1 AND user_id = $2
      ), added AS (
        INSERT INTO savings_contributions (savings_goal_id, amount, date, note)
        SELECT id, $3, COALESCE($4::date, CURRENT_DATE), NULLIF($5, '') FROM owned_goal
        RETURNING id, savings_goal_id, amount, date, note
      ), updated AS (
        UPDATE savings_goals SET current_amount = current_amount + $3
        WHERE id = $1 AND user_id = $2 AND EXISTS (SELECT 1 FROM added)
        RETURNING id, title, current_amount::float as "currentAmount", target_amount::float as "targetAmount"
      )
      SELECT added.id, added.savings_goal_id as "savingsGoalId", added.amount::float as amount,
        to_char(added.date, 'YYYY-MM-DD') as date, added.note, updated.title,
        updated."currentAmount", updated."targetAmount" FROM added, updated
    `, [req.params.id, DEFAULT_USER_ID, Number(amount), date || null, String(note || '').trim()]);
    if (!result.rows.length) return res.status(404).json({ error: 'Savings goal not found' });
    res.status(201).json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch('/savings/:goalId/contributions/:contributionId', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const amount = req.body.amount === undefined ? null : Number(req.body.amount);
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) return res.status(400).json({ error: 'amount must be greater than zero' });
    await client.query('BEGIN');
    const currentResult = await client.query(`SELECT c.id, c.amount, c.savings_goal_id FROM savings_contributions c JOIN savings_goals g ON g.id = c.savings_goal_id
      WHERE c.id = $1 AND c.savings_goal_id = $2 AND g.user_id = $3 FOR UPDATE`, [req.params.contributionId, req.params.goalId, DEFAULT_USER_ID]);
    const current = currentResult.rows[0];
    if (!current) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Savings contribution not found' }); }
    const nextAmount = amount ?? Number(current.amount);
    const result = await client.query(`UPDATE savings_contributions SET amount = $1, date = COALESCE($2::date, date), note = $3
      WHERE id = $4 RETURNING id, savings_goal_id as "savingsGoalId", amount::float as amount, to_char(date, 'YYYY-MM-DD') as date, note`,
    [nextAmount, req.body.date || null, req.body.note === undefined ? current.note : String(req.body.note || '').trim() || null, req.params.contributionId]);
    const goal = await client.query(`UPDATE savings_goals SET current_amount = GREATEST(0, current_amount + $1)
      WHERE id = $2 AND user_id = $3 RETURNING current_amount::float as "currentAmount"`, [nextAmount - Number(current.amount), req.params.goalId, DEFAULT_USER_ID]);
    await client.query('COMMIT');
    res.json({ ...result.rows[0], currentAmount: goal.rows[0]?.currentAmount });
  } catch (err: any) { await client.query('ROLLBACK').catch(() => undefined); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

export default router;
