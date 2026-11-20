import { Hono } from 'hono';
import type { AppEnv } from './types';
import { hashPassword, verifyPassword } from './auth';
import { logAction } from './db';

const profile = new Hono<AppEnv>();

profile.put('/password', async (c) => {
  const body = await c.req.json<{ old_password?: string; new_password?: string }>();
  if (!body.new_password || body.new_password.length < 6) {
    return c.json({ message: '新密码至少 6 位' }, 400);
  }
  const user = c.get('user');
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.sub)
    .first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(body.old_password || '', row.password_hash))) {
    return c.json({ message: '原密码错误' }, 400);
  }
  const passwordHash = await hashPassword(body.new_password);
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, user.sub)
    .run();
  await logAction(c.env.DB, null, user.sub, 'password', '修改登录密码');
  return c.json({ success: true });
});

export default profile;
