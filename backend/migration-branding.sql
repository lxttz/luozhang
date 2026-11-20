-- 旧版本升级：补充系统名称默认配置。全新部署无需执行。
INSERT OR IGNORE INTO settings(key, value) VALUES ('system_name', '洛账');
