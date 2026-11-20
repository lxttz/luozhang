import { Hono, type Context } from 'hono';
import type { AppEnv } from './types';
import { requireBoss, requireFinance } from './auth';
import { logAction } from './db';

const bills = new Hono<AppEnv>();

type BillStatus = 'pending' | 'approved' | 'rejected';
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

function buildWhere(c: Context<AppEnv>, includeDeleted = false) {
  const conditions: string[] = [includeDeleted ? 'b.deleted_at IS NOT NULL' : 'b.deleted_at IS NULL'];
  const binds: (string | number)[] = [];
  const startDate = c.req.query('startDate') || '';
  const endDate = c.req.query('endDate') || '';
  const categoryId = c.req.query('categoryId') || '';
  const type = c.req.query('type') || '';
  const status = c.req.query('status') || '';
  const keyword = c.req.query('keyword') || '';
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
  if (status) {
    conditions.push('b.status = ?');
    binds.push(status);
  }
  if (keyword) {
    conditions.push('(b.remark LIKE ? OR c.name LIKE ?)');
    binds.push(`%${keyword}%`, `%${keyword}%`);
  }
  return { where: `WHERE ${conditions.join(' AND ')}`, binds };
}

const selectColumns = `b.id, b.user_id, b.category_id, b.amount, b.bill_date, b.remark, b.status,
  b.created_at, b.updated_at, b.deleted_at,
  c.name AS category_name, c.type AS category_type, u.name AS user_name`;

bills.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') || 20) || 20));
  const { where, binds } = buildWhere(c);

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM bills b LEFT JOIN categories c ON b.category_id = c.id ${where}`,
  )
    .bind(...binds)
    .first<{ count: number }>();

  const result = await c.env.DB.prepare(
    `SELECT ${selectColumns} FROM bills b
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

bills.get('/export', async (c) => {
  const { where, binds } = buildWhere(c);
  const result = await c.env.DB.prepare(
    `SELECT b.bill_date, c.type AS category_type, c.name AS category_name,
            b.amount, b.remark, b.status, u.name AS user_name
     FROM bills b
     LEFT JOIN categories c ON b.category_id = c.id
     LEFT JOIN users u ON b.user_id = u.id
     ${where}
     ORDER BY b.bill_date DESC, b.id DESC`,
  )
    .bind(...binds)
    .all<Record<string, string | number>>();

  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = ['日期,类型,分类,金额,备注,状态,录入人'];
  for (const row of result.results || []) {
    const typeText = row.category_type === 'income' ? '收入' : '支出';
    const statusText = row.status === 'approved' ? '已通过' : row.status === 'pending' ? '待审核' : '已驳回';
    lines.push(
      [row.bill_date, typeText, row.category_name, row.amount, row.remark, statusText, row.user_name]
        .map(escape)
        .join(','),
    );
  }
  const csv = `\ufeff${lines.join('\r\n')}`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bills.csv"',
    },
  });
});

bills.get('/recycle', async (c) => {
  const { where, binds } = buildWhere(c, true);
  const user = c.get('user');
  const ownerCondition = user.role === 'boss' ? '' : ' AND b.user_id = ?';
  const ownerBinds = user.role === 'boss' ? [] : [user.sub];
  const result = await c.env.DB.prepare(
    `SELECT ${selectColumns} FROM bills b
     LEFT JOIN categories c ON b.category_id = c.id
     LEFT JOIN users u ON b.user_id = u.id
     ${where}${ownerCondition}
     ORDER BY b.deleted_at DESC, b.id DESC
     LIMIT 200`,
  )
    .bind(...binds, ...ownerBinds)
    .all();
  return c.json(result.results || []);
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
    'INSERT INTO bills (user_id, category_id, amount, bill_date, remark, status) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(user.sub, Number(input.category_id), Number(input.amount), input.bill_date, input.remark || '', 'pending')
    .run();
  await logAction(c.env.DB, Number(result.meta.last_row_id), user.sub, 'add', `新增账单 ${Number(input.amount)} 元，待审核`);
  return c.json({ id: Number(result.meta.last_row_id) }, 201);
});

bills.post('/import', requireFinance, async (c) => {
  const body = await c.req.json<{ items?: BillInput[] }>();
  const items = body.items || [];
  if (!Array.isArray(items) || items.length === 0) return c.json({ message: '没有可导入的数据' }, 400);
  if (items.length > 500) return c.json({ message: '单次最多导入 500 条' }, 400);

  const user = c.get('user');
  const categoryRows = await c.env.DB.prepare('SELECT id FROM categories').all<{ id: number }>();
  const categoryIds = new Set((categoryRows.results || []).map((row) => row.id));
  let success = 0;
  const errors: string[] = [];

  for (let index = 0; index < items.length; index++) {
    const input = items[index];
    const error = validate(input);
    if (error) {
      errors.push(`第 ${index + 2} 行：${error}`);
      continue;
    }
    if (!categoryIds.has(Number(input.category_id))) {
      errors.push(`第 ${index + 2} 行：分类不存在`);
      continue;
    }
    await c.env.DB.prepare(
      'INSERT INTO bills (user_id, category_id, amount, bill_date, remark, status) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(user.sub, Number(input.category_id), Number(input.amount), input.bill_date, input.remark || '', 'pending')
      .run();
    success++;
  }
  await logAction(c.env.DB, null, user.sub, 'import', `批量导入 ${success} 条账单，失败 ${errors.length} 条`);
  return c.json({ success, failed: errors.length, errors });
});

bills.delete('/batch-delete', requireFinance, async (c) => {
  const body = await c.req.json<{ ids?: number[] }>();
  const ids = (body.ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return c.json({ message: '请选择要删除的账单' }, 400);
  const user = c.get('user');
  const setting = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'allow_finance_delete'").first<{
    value: string;
  }>();
  if (setting?.value !== '1') return c.json({ message: '老板已关闭财务删除权限' }, 403);

  let deleted = 0;
  for (const id of ids) {
    const existing = await c.env.DB.prepare('SELECT user_id, deleted_at FROM bills WHERE id = ?')
      .bind(id)
      .first<{ user_id: number; deleted_at: string | null }>();
    if (!existing || existing.user_id !== user.sub || existing.deleted_at) continue;
    await c.env.DB.prepare('UPDATE bills SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id)
      .run();
    await logAction(c.env.DB, id, user.sub, 'delete', `批量删除账单 #${id}`);
    deleted++;
  }
  return c.json({ deleted });
});

bills.put('/:id/restore', async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');
  const existing = await c.env.DB.prepare('SELECT user_id, deleted_at FROM bills WHERE id = ?')
    .bind(id)
    .first<{ user_id: number; deleted_at: string | null }>();
  if (!existing) return c.json({ message: '账单不存在' }, 404);
  if (user.role !== 'boss' && existing.user_id !== user.sub) {
    return c.json({ message: '只能恢复自己录入的账单' }, 403);
  }
  if (!existing.deleted_at) return c.json({ message: '该账单未被删除' }, 400);
  await c.env.DB.prepare('UPDATE bills SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(id)
    .run();
  await logAction(c.env.DB, id, user.sub, 'restore', `恢复账单 #${id}`);
  return c.json({ success: true });
});

bills.put('/:id/review', requireBoss, async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ action?: string; remark?: string }>();
  if (body.action !== 'approve' && body.action !== 'reject') {
    return c.json({ message: '审核动作只能是 approve 或 reject' }, 400);
  }
  const existing = await c.env.DB.prepare('SELECT id, deleted_at FROM bills WHERE id = ?')
    .bind(id)
    .first<{ id: number; deleted_at: string | null }>();
  if (!existing || existing.deleted_at) return c.json({ message: '账单不存在' }, 404);
  const status: BillStatus = body.action === 'approve' ? 'approved' : 'rejected';
  await c.env.DB.prepare('UPDATE bills SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, id)
    .run();
  const user = c.get('user');
  await logAction(c.env.DB, id, user.sub, 'review', `${status === 'approved' ? '通过' : '驳回'}账单 #${id}${body.remark ? `：${body.remark}` : ''}`);
  return c.json({ success: true });
});

bills.put('/:id', requireFinance, async (c) => {
  const id = Number(c.req.param('id'));
  const input = await c.req.json<BillInput>();
  const error = validate(input);
  if (error) return c.json({ message: error }, 400);

  const user = c.get('user');
  const existing = await c.env.DB.prepare('SELECT user_id, deleted_at FROM bills WHERE id = ?')
    .bind(id)
    .first<{ user_id: number; deleted_at: string | null }>();
  if (!existing || existing.deleted_at) return c.json({ message: '账单不存在' }, 404);
  if (existing.user_id !== user.sub) return c.json({ message: '只能编辑自己录入的账单' }, 403);

  const category = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?')
    .bind(Number(input.category_id))
    .first();
  if (!category) return c.json({ message: '分类不存在' }, 400);

  await c.env.DB.prepare(
    `UPDATE bills SET category_id = ?, amount = ?, bill_date = ?, remark = ?,
      status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  )
    .bind(Number(input.category_id), Number(input.amount), input.bill_date, input.remark || '', id)
    .run();
  await logAction(c.env.DB, id, user.sub, 'edit', `修改账单 #${id} 为 ${Number(input.amount)} 元，重新待审核`);
  return c.json({ success: true });
});

bills.delete('/:id/purge', requireBoss, async (c) => {
  const id = Number(c.req.param('id'));
  const existing = await c.env.DB.prepare('SELECT id FROM bills WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ message: '账单不存在' }, 404);
  await c.env.DB.prepare('DELETE FROM bills WHERE id = ?').bind(id).run();
  await logAction(c.env.DB, null, c.get('user').sub, 'purge', `彻底删除账单 #${id}`);
  return c.json({ success: true });
});

bills.delete('/:id', requireFinance, async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user');

  const existing = await c.env.DB.prepare('SELECT user_id, deleted_at FROM bills WHERE id = ?')
    .bind(id)
    .first<{ user_id: number; deleted_at: string | null }>();
  if (!existing || existing.deleted_at) return c.json({ message: '账单不存在' }, 404);
  if (existing.user_id !== user.sub) return c.json({ message: '只能删除自己录入的账单' }, 403);

  const setting = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'allow_finance_delete'").first<{
    value: string;
  }>();
  if (setting?.value !== '1') return c.json({ message: '老板已关闭财务删除权限' }, 403);

  await c.env.DB.prepare('UPDATE bills SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(id)
    .run();
  await logAction(c.env.DB, id, user.sub, 'delete', `删除账单 #${id}（移入回收站）`);
  return c.json({ success: true });
});

export default bills;
