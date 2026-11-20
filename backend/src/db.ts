import type { D1Database } from '@cloudflare/workers-types';

export async function logAction(
  db: D1Database,
  billId: number | null,
  userId: number,
  action: 'add' | 'edit' | 'delete',
  content: string,
): Promise<void> {
  await db
    .prepare('INSERT INTO bill_logs (bill_id, user_id, action, content) VALUES (?, ?, ?, ?)')
    .bind(billId, userId, action, content)
    .run();
}
