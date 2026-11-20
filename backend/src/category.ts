import { Hono } from 'hono';
import type { AppEnv } from './types';
import { requireBoss } from './auth';

const categories = new Hono<AppEnv>();

type CategoryInput = { name: string; type: 'income' | 'expense'; sort?: number };

function validate(input: CategoryInput): string | null {
  if (!(input.name || '').trim()) return '分类名称不能为空';
  if (input.type !== 'income' && input.type !== 'expense') return '分类类型只能是收入或支出';
  return null;
}

categories.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    "SELECT id, name, type, sort FROM categories ORDER BY CASE type WHEN 'income' THEN 0 ELSE 1 END, sort, id",
  ).all();
  return c.json(result.results || []);
});

categories.post('/', requireBoss, async (c) => {
  const input = await c.req.json<CategoryInput>();
  const error = validate(input);
  if (error) return c.json({ message: error }, 400);
  const result = await c.env.DB.prepare('INSERT INTO categories (name, type, sort) VALUES (?, ?, ?)')
    .bind(input.name.trim(), input.type, Number(input.sort) || 0)
    .run();
  return c.json({ id: Number(result.meta.last_row_id) }, 201);
});

categories.put('/:id', requireBoss, async (c) => {
  const id = Number(c.req.param('id'));
  const input = await c.req.json<CategoryInput>();
  const error = validate(input);
  if (error) return c.json({ message: error }, 400);
  const existing = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ message: '分类不存在' }, 404);
  await c.env.DB.prepare('UPDATE categories SET name = ?, type = ?, sort = ? WHERE id = ?')
    .bind(input.name.trim(), input.type, Number(input.sort) || 0, id)
    .run();
  return c.json({ success: true });
});

categories.delete('/:id', requireBoss, async (c) => {
  const id = Number(c.req.param('id'));
  const used = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM bills WHERE category_id = ?')
    .bind(id)
    .first<{ count: number }>();
  if ((used?.count || 0) > 0) return c.json({ message: '该分类已有账单记录，不能删除' }, 400);
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

export default categories;
