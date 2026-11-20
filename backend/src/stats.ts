import { Hono } from 'hono';
import type { AppEnv } from './types';
import { requireBoss } from './auth';

const stats = new Hono<AppEnv>();

type AmountRow = { type: 'income' | 'expense'; total: number };
type CategoryRow = { id: number; name: string; type: 'income' | 'expense'; total: number };

const APPROVED = "b.status = 'approved' AND b.deleted_at IS NULL";

function changeRate(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

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
     WHERE ${APPROVED} AND b.bill_date >= ? AND b.bill_date < ?
     GROUP BY c.type`,
  )
    .bind(start, end)
    .all<AmountRow>();

  const byCategory = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE ${APPROVED} AND b.bill_date >= ? AND b.bill_date < ?
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
    categories: byCategory.results || [],
  });
});

stats.get('/range', async (c) => {
  const startDate = c.req.query('startDate') || '';
  const endDate = c.req.query('endDate') || '';
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) return c.json({ message: '请选择正确的起止日期' }, 400);

  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const prevEnd = new Date(start.getTime() - 86400000).toISOString().slice(0, 10);
  const prevStart = new Date(start.getTime() - days * 86400000).toISOString().slice(0, 10);

  const queryTotals = async (from: string, to: string) => {
    const rows = await c.env.DB.prepare(
      `SELECT c.type, COALESCE(SUM(b.amount), 0) AS total
       FROM bills b JOIN categories c ON b.category_id = c.id
       WHERE ${APPROVED} AND b.bill_date >= ? AND b.bill_date <= ?
       GROUP BY c.type`,
    )
      .bind(from, to)
      .all<AmountRow>();
    let income = 0;
    let expense = 0;
    for (const row of rows.results || []) {
      if (row.type === 'income') income = row.total;
      if (row.type === 'expense') expense = row.total;
    }
    return { income, expense, balance: income - expense };
  };

  const [current, previous, categoryRows] = await Promise.all([
    queryTotals(startDate, endDate),
    queryTotals(prevStart, prevEnd),
    c.env.DB.prepare(
      `SELECT c.id, c.name, c.type, COALESCE(SUM(b.amount), 0) AS total
       FROM bills b JOIN categories c ON b.category_id = c.id
       WHERE ${APPROVED} AND b.bill_date >= ? AND b.bill_date <= ?
       GROUP BY c.id, c.name, c.type
       ORDER BY total DESC
       LIMIT 10`,
    )
      .bind(startDate, endDate)
      .all<CategoryRow>(),
  ]);

  return c.json({
    startDate,
    endDate,
    ...current,
    previous,
    incomeChange: changeRate(current.income, previous.income),
    expenseChange: changeRate(current.expense, previous.expense),
    categories: categoryRows.results || [],
  });
});

stats.get('/dashboard', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1))
    .toISOString()
    .slice(0, 7);

  const totals = await c.env.DB.prepare(
    `SELECT c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE ${APPROVED} AND b.bill_date >= ? AND b.bill_date < ?
     GROUP BY c.type`,
  )
    .bind(monthStart, `${nextMonth}-01`)
    .all<AmountRow>();

  const todayTotals = await c.env.DB.prepare(
    `SELECT c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE ${APPROVED} AND b.bill_date = ?
     GROUP BY c.type`,
  )
    .bind(today)
    .all<AmountRow>();

  const recent = await c.env.DB.prepare(
    `SELECT b.id, b.amount, b.bill_date, b.remark, b.status,
            c.name AS category_name, c.type AS category_type, u.name AS user_name
     FROM bills b
     LEFT JOIN categories c ON b.category_id = c.id
     LEFT JOIN users u ON b.user_id = u.id
     WHERE ${APPROVED}
     ORDER BY b.bill_date DESC, b.id DESC
     LIMIT 5`,
  ).all();

  const ranking = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE ${APPROVED} AND b.bill_date >= ? AND b.bill_date < ?
     GROUP BY c.id, c.name, c.type
     ORDER BY total DESC
     LIMIT 5`,
  )
    .bind(monthStart, `${nextMonth}-01`)
    .all<CategoryRow>();

  const sumByType = (rows: AmountRow[]) => {
    let income = 0;
    let expense = 0;
    for (const row of rows) {
      if (row.type === 'income') income = row.total;
      if (row.type === 'expense') expense = row.total;
    }
    return { income, expense, balance: income - expense };
  };

  return c.json({
    date: today,
    month,
    today: sumByType(todayTotals.results || []),
    monthTotals: sumByType(totals.results || []),
    recent: recent.results || [],
    ranking: ranking.results || [],
  });
});

stats.get('/year', requireBoss, async (c) => {
  const rawYear = Number(c.req.query('year'));
  const year = Number.isInteger(rawYear) && rawYear > 0 ? rawYear : new Date().getFullYear();

  const monthly = await c.env.DB.prepare(
    `SELECT substr(b.bill_date, 1, 7) AS month, c.type, COALESCE(SUM(b.amount), 0) AS total
     FROM bills b JOIN categories c ON b.category_id = c.id
     WHERE ${APPROVED} AND b.bill_date >= ? AND b.bill_date < ?
     GROUP BY month, c.type
     ORDER BY month`,
  )
    .bind(`${year}-01-01`, `${year + 1}-01-01`)
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
