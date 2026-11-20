import { Hono } from 'hono';
import type { AppEnv } from './types';
import { hashPassword, requireBoss } from './auth';

const users = new Hono<AppEnv>();

type UserInput = {
  username?: string;
  password?: string;
  name?: string;
  role?: 'boss' | 'finance';
};

users.get('/', requireBoss, async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT id, username, role, name, created_at FROM users ORDER BY id',
  ).all();
  return c.json(result.results || []);
});

users.post('/', requireBoss, async (c) => {
  const input = await c.req.json<UserInput>();
  const username = (input.username || '').trim();
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return c.json({ message: '用户名需为 3-30 位字母、数字、下划线或短横线' }, 400);
  }
  if (!input.password || input.password.length < 6) return c.json({ message: '密码至少 6 位' }, 400);
  const role = input.role === 'boss' ? 'boss' : 'finance';

  const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (exists) return c.json({ message: '用户名已存在' }, 400);

  const passwordHash = await hashPassword(input.password);
  const result = await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
  )
    .bind(username, passwordHash, role, input.name || '')
    .run();
  return c.json({ id: Number(result.meta.last_row_id) }, 201);
});

users.put('/:id', requireBoss, async (c) => {
  const id = Number(c.req.param('id'));
  const input = await c.req.json<UserInput>();
  const me = c.get('user');

  const existing = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
    .bind(id)
    .first<{ id: number; role: 'boss' | 'finance' }>();
  if (!existing) return c.json({ message: '用户不存在' }, 404);
  if (id === me.sub && input.role && input.role !== 'boss') {
    return c.json({ message: '不能降级自己的角色' }, 400);
  }

  const role = input.role === 'boss' || input.role === 'finance' ? input.role : existing.role;
  if (input.password && input.password.length < 6) return c.json({ message: '密码至少 6 位' }, 400);

  if (input.password) {
    const passwordHash = await hashPassword(input.password);
    await c.env.DB.prepare('UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ?')
      .bind(input.name || '', role, passwordHash, id)
      .run();
  } else {
    await c.env.DB.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
      .bind(input.name || '', role, id)
      .run();
  }
  return c.json({ success: true });
});

users.delete('/:id', requireBoss, async (c) => {
  const id = Number(c.req.param('id'));
  const me = c.get('user');
  if (id === me.sub) return c.json({ message: '不能删除当前登录账号' }, 400);

  const target = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
    .bind(id)
    .first<{ role: 'boss' | 'finance' }>();
  if (!target) return c.json({ message: '用户不存在' }, 404);
  if (target.role === 'boss') {
    const bossCount = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'boss'")
      .first<{ count: number }>();
    if ((bossCount?.count || 0) <= 1) return c.json({ message: '至少保留一个老板账号' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

export default users;
