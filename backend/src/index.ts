import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './types';
import { requireAuth, signToken, verifyPassword } from './auth';
import billRoutes from './bill';
import categoryRoutes from './category';
import userRoutes from './user';
import statsRoutes from './stats';
import settingRoutes from './setting';
import logRoutes from './log';
import profileRoutes from './profile';

type LoginInput = { username?: string; password?: string };
type LoginUser = { id: number; username: string; role: 'boss' | 'finance'; name: string | null };

const app = new Hono<AppEnv>();

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/', (c) => c.json({ name: 'account-book-api', status: 'ok' }));

app.post('/api/login', async (c) => {
  const input = await c.req.json<LoginInput>();
  const username = (input.username || '').trim();
  if (!username || !input.password) return c.json({ message: '请输入用户名和密码' }, 400);

  const row = await c.env.DB.prepare(
    'SELECT id, username, password_hash, role, name FROM users WHERE username = ?',
  )
    .bind(username)
    .first<LoginUser & { password_hash: string }>();

  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    return c.json({ message: '用户名或密码错误' }, 401);
  }

  const user = { id: row.id, username: row.username, role: row.role, name: row.name || '' };
  const token = await signToken(
    { sub: user.id, username: user.username, role: user.role, name: user.name },
    c.env.JWT_SECRET,
  );
  return c.json({ token, user });
});

const api = new Hono<AppEnv>();
api.use('*', requireAuth);

api.get('/me', (c) => {
  const user = c.get('user');
  return c.json({ id: user.sub, username: user.username, role: user.role, name: user.name || '' });
});

api.route('/bills', billRoutes);
api.route('/categories', categoryRoutes);
api.route('/users', userRoutes);
api.route('/stats', statsRoutes);
api.route('/settings', settingRoutes);
api.route('/logs', logRoutes);
api.route('/profile', profileRoutes);

app.route('/api', api);

app.notFound((c) => c.json({ message: '接口不存在' }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ message: '服务器内部错误' }, 500);
});

export default app;
