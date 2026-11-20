import { Hono } from 'hono';
import type { AppEnv } from './types';
import { requireFinance } from './auth';
import { logAction } from './db';

const bills = new Hono<AppEnv>();

type BillInput = {
  category_id: number;
  amount: number;
  bill_date: string;
  remark?: string;
};

function validate(input: BillInput): string | null {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return '金额必须大于 0';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.bill_date || '')) return '记账日期格式应为 yyyy-MM-dd';
  if (!input.category_id) return '请选择收支分类';
  return null;
}

bills.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') || 20) || 20));
  const startDate = c.req.query('startDate') || '';
  const endDate = c.req.query('endDate') || '';
  const categoryId = c.req.query('categoryId') || '';
  const type = c.req.query('type') || '';
  const keyword = c.req.query('keyword') || '';

  const conditions: string[] = [];
  const binds: (string | number)[] = [];
  if (startDate) {
    conditions.push('b.bill_date >= ?');
    binds.push(startDate);
  }
  if (endDate) {
    conditions.push('b.bill_date <= ?');
    binds.push(endDate);
  }
  if (categoryId) {
    conditions.push('b.category_id = ?');
    binds.push(Number(categoryId));
  }
  if (type) {
    conditions.push('c.type = ?');
    binds.push(type);
  }
  if (keyword) {
    conditions.push('(b.remark LIKE ? OR c.name LIKE ?)');
    binds.push(`%${keyword}%`, `%${keyword}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM bills b LEFT JOIN categories c ON b.category_id = c.id ${where}`,
  )
    .bind(...binds)
    .first<{ count: number }>();

  const result = await c.env.DB.prepare(
    `SELECT b.id, b.user_id, b.category_id, b.amount, b.bill_date, b.remark, b.created_at, b.updated_at,
            c.name AS category_name, c.type AS category_type, u.name AS user_name
     FROM bills b
     LEFT JOIN categories c ON b.category_id = c.id
     LEFT JOIN users u ON b.user_id = u.id
     ${where}
     ORDER BY b.bill_date DESC, b.id DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds, pageSize, (page - 1) * pageSize)
    .all();

  return c.json({ list: result.results || [], total: countRow?.count || 0, page, pageSize });
});

bills.post('/', requireFinance, async (c) => {
  const input = await c.req.json<BillInput>();
  const error = validate(input);
  if (error) return c.json({ message: error }, 400);

  const category = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?')
    .bind(Number(input.category_id))
    .first();
  if (!category) return c.json({ message: '分类不存在' }, 400);

  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'INSERT INTO bills (user_id, category_id, amount, bill_date, remark) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(user.sub, Number(input.category_id), Number(input.amount), input.bill_date, input.remark || '')
    .run();
  await logAction(c.env.DB, Number(result.meta.last_row_id), user.sub, 'add', `新增账单 ${Number(input.amount)} 元`);
  return c.json({ id: Number(result.meta.last_row_id) }, 201);
});

bills.put('/:id', requireFinance, async (c) => {
  const id = Number(c.req.param('id'));
  const input = await c.req.json<BillInput>();
  const error = validate(input);
  if (error) return c.json({ message: error }, 400);

  const user = c.get('user');
  const existing = await c.env.DB.prepare('SELECT user_id FROM bills WHERE id = ?').bind(id).first<{ user_id: number }>();
  if (!existing) return c.json({ message: '账单不存在' }, 404);
  if (existing.user_id !== user.sub) return c.json({ message: '只能编辑自己录入的账单' }, 403);

  const category = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?')
    .bind(Number(input.category_id))
    .first();
  if (!category) return c.json({ message: '分类不存在' }, 400);

  await c.env.DB.prepare(
    'UPDATE bills SET category_id = ?, amount = ?, bill_date = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  )
    .bind(Number(input.category_id), Number(input.amount), input.bill_date, input.remark || '', id)
    .run();
  await logAction(c.env.DB, id, user.sub, 'edit', `修改账单 #${id} 金额为 ${Number(input.amount)} 元`);
  return c.json({ success: true });
});

bills.delete('/:id', requireFinance, async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');

  const existing = await c.env.DB.prepare('SELECT user_id FROM bills WHERE id = ?').bind(id).first<{ user_id: number }>();
  if (!existing) return c.json({ message: '账单不存在' }, 404);
  if (existing.user_id !== user.sub) return c.json({ message: '只能删除自己录入的账单' }, 403);

  const setting = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'allow_finance_delete'").first<{
    value: string;
  }>();
  if (setting?.value !== '1') return c.json({ message: '老板已关闭财务删除权限' }, 403);

  await c.env.DB.prepare('DELETE FROM bills WHERE id = ?').bind(id).run();
  await logAction(c.env.DB, id, user.sub, 'delete', `删除账单 #${id}`);
  return c.json({ success: true });
});

export default bills;
