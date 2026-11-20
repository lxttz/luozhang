-- 从旧版本升级：为 bills 增加审核状态与软删除字段。
-- 线上数据库只需执行一次：
--   wrangler d1 execute account-book-db --remote --file=./migration.sql
ALTER TABLE bills ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE bills ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_deleted ON bills(deleted_at);
CREATE INDEX IF NOT EXISTS idx_logs_created ON bill_logs(created_at);
