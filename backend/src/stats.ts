import { Hono } from 'hono';
import type { AppEnv } from './types';
import { requireBoss } from './auth';

const stats = new Hono<AppEnv>();

type AmountRow = { type: 'income' | 'expense'; total: number };
type CategoryRow = { id: number; name: number | string; type: 'income' | 'expense'; total: number };

stats.get('/month', async (c) => {
  let month = c.req.query('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) month = new Date().toISOString().slice(0, 7);
  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) return c.json({ message: '月份不合法' }, 400);

  const start = `${month}-01`;
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
  const end = `${nextMonth}-01`;

  const totals = await c.env.DB.prepare(
    `SELECT c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE b.bill_date >= ? AND b.bill_date < ?
     GROUP BY c.type`,
  )
    .bind(start, end)
    .all<AmountRow>();

  const byCategory = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE b.bill_date >= ? AND b.bill_date < ?
     GROUP BY c.id, c.name, c.type
     ORDER BY total DESC`,
  )
    .bind(start, end)
    .all<CategoryRow>();

  let income = 0;
  let expense = 0;
  for (const row of totals.results || []) {
    if (row.type === 'income') income = row.total;
    if (row.type === 'expense') expense = row.total;
  }

  return c.json({
    month,
    income,
    expense,
    balance: income - expense,
    categories: (byCategory.results || []).map((row) => ({
      id: row.id,
      name: String(row.name),
      type: row.type,
      total: row.total,
    })),
  });
});

stats.get('/year', requireBoss, async (c) => {
  const rawYear = Number(c.req.query('year'));
  const year = Number.isInteger(rawYear) && rawYear > 0 ? rawYear : new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const monthly = await c.env.DB.prepare(
    `SELECT substr(b.bill_date, 1, 7) AS month, c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE b.bill_date >= ? AND b.bill_date < ?
     GROUP BY month, c.type
     ORDER BY month`,
  )
    .bind(start, end)
    .all<{ month: string } & AmountRow>();

  const months = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, '0')}`,
    income: 0,
    expense: 0,
  }));
  const lookup = new Map(months.map((item) => [item.month, item]));
  for (const row of monthly.results || []) {
    const target = lookup.get(row.month);
    if (!target) continue;
    if (row.type === 'income') target.income = row.total;
    if (row.type === 'expense') target.expense = row.total;
  }

  const income = months.reduce((sum, item) => sum + item.income, 0);
  const expense = months.reduce((sum, item) => sum + item.expense, 0);
  return c.json({ year, income, expense, balance: income - expense, months });
});

export default stats;
