import { Hono } from 'hono';
import type { AppEnv } from './types';
import { requireBoss } from './auth';

const settings = new Hono<AppEnv>();

const DEFAULT_SYSTEM_NAME = '洛账';

settings.get('/', async (c) => {
  const result = await c.env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const values: Record<string, string> = {};
  for (const row of result.results || []) values[row.key] = row.value;
  return c.json({
    allow_finance_delete: values.allow_finance_delete === '1',
    system_name: values.system_name || DEFAULT_SYSTEM_NAME,
  });
});

settings.put('/', requireBoss, async (c) => {
  const input = await c.req.json<{ allow_finance_delete?: boolean; system_name?: string }>();
  const upsert = async (key: string, value: string) => {
    await c.env.DB.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
      .bind(key, value)
      .run();
  };

  if (input.allow_finance_delete !== undefined) {
    await upsert('allow_finance_delete', input.allow_finance_delete ? '1' : '0');
  }

  if (input.system_name !== undefined) {
    const name = input.system_name.trim();
    if (!name || name.length > 30) return c.json({ message: '系统名称需为 1-30 个字符' }, 400);
    await upsert('system_name', name);
  }

  return c.json({
    allow_finance_delete: input.allow_finance_delete !== undefined ? !!input.allow_finance_delete : undefined,
    system_name: input.system_name?.trim() || undefined,
  });
});

export default settings;
