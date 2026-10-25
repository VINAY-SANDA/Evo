import express, { Request, Response, Router } from 'express';
import { query } from '../db/connection.js';
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

export default router;
