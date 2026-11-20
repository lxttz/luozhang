import { Hono } from 'hono';
import type { AppEnv } from './types';
import { requireBoss } from './auth';

const logs = new Hono<AppEnv>();

logs.get('/', requireBoss, async (c) => {
  const page = Math.max(1, Number(c.req.query('page') || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query('pageSize') || 20) || 20));
  const action = c.req.query('action') || '';
  const keyword = c.req.query('keyword') || '';
  const startDate = c.req.query('startDate') || '';
  const endDate = c.req.query('endDate') || '';

  const conditions: string[] = [];
  const binds: (string | number)[] = [];
  if (action) {
    conditions.push('l.action = ?');
    binds.push(action);
  }
  if (keyword) {
    conditions.push('(l.content LIKE ? OR u.name LIKE ?)');
    binds.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (startDate) {
    conditions.push('l.created_at >= ?');
    binds.push(startDate);
  }
  if (endDate) {
    conditions.push('l.created_at <= ?');
    binds.push(`${endDate} 23:59:59`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM bill_logs l LEFT JOIN users u ON l.user_id = u.id ${where}`,
  )
    .bind(...binds)
    .first<{ count: number }>();

  const result = await c.env.DB.prepare(
    `SELECT l.id, l.bill_id, l.user_id, l.action, l.content, l.created_at, u.name AS user_name
     FROM bill_logs l LEFT JOIN users u ON l.user_id = u.id
     ${where}
     ORDER BY l.id DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds, pageSize, (page - 1) * pageSize)
    .all();

  return c.json({ list: result.results || [], total: countRow?.count || 0, page, pageSize });
});

export default logs;
