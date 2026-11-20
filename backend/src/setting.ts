import { Hono } from 'hono';
import type { AppEnv } from './types';
import { requireBoss } from './auth';

const settings = new Hono<AppEnv>();

settings.get('/', async (c) => {
  const result = await c.env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const values: Record<string, string> = {};
  for (const row of result.results || []) values[row.key] = row.value;
  return c.json({ allow_finance_delete: values.allow_finance_delete === '1' });
});

settings.put('/', requireBoss, async (c) => {
  const input = await c.req.json<{ allow_finance_delete?: boolean }>();
  const value = input.allow_finance_delete ? '1' : '0';
  await c.env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('allow_finance_delete', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(value)
    .run();
  return c.json({ allow_finance_delete: value === '1' });
});

export default settings;
