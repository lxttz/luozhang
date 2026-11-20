# 洛账（LuoZhang）

基于 Cloudflare 免费栈的企业简易记账系统。老板只读查看全部流水与统计并审核单据，财务多人录入单据，所有权限校验都在后端完成。

![Vue3](https://img.shields.io/badge/Frontend-Vue3-42b883)
![Hono](https://img.shields.io/badge/Backend-Hono-000000)
![Cloudflare D1](https://img.shields.io/badge/Database-Cloudflare%20D1-f6821f)
![License](https://img.shields.io/badge/License-MIT-blue)

**线上地址**：https://account-book-frontend-c16.pages.dev

## 功能特性

- 首页看板：今日 / 本月收支卡片、最近流水、分类排行
- 收支流水：按日期、分类、类型、审核状态、关键词筛选，分页展示
- 单据管理：财务新增 / 编辑自己的账单，新增和修改后进入待审核
- 审核流程：老板通过或驳回财务提交的单据，只有已通过的单据计入统计
- 回收站：删除的单据可恢复，老板可彻底删除
- 批量操作：财务可批量选择单据删除（受删单开关控制）
- 导入导出：CSV 批量导入账单、按当前筛选条件导出 CSV
- 删单开关：老板可配置是否允许财务删除自己的单据
- 统计报表：本月收支、分类占比饼图、年度趋势图、自定义日期区间与环比对比
- 分类管理：老板维护收支分类
- 用户管理：老板创建财务账号，角色与密码均可维护
- 操作日志：老板可查看谁在何时新增、编辑、删除、导入、审核、恢复单据
- 个人设置：所有角色都能自助修改自己的登录密码
- 响应式布局：侧栏可折叠，手机端表单与卡片自动堆叠

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue3 + Vite + TypeScript + Element Plus + ECharts |
| 后端 | Hono（Cloudflare Workers） |
| 数据库 | Cloudflare D1（SQLite） |
| 部署 | Cloudflare Pages（前端）+ Workers（后端） |
| 鉴权 | JWT（HMAC-SHA256）+ PBKDF2 密码哈希 |

全部跑在 Cloudflare 免费额度内，无需购买服务器。

## 权限设计

| 功能 | 老板 | 财务 |
|---|---|---|
| 查看流水、看板、月度统计 | 支持 | 支持 |
| 新增账单 | 不支持 | 支持 |
| 编辑自己的账单 | 不支持 | 支持（修改后重新待审核） |
| 删除自己的账单 | 不支持 | 支持（受老板配置的开关控制，移入回收站） |
| 审核单据 | 支持 | 不支持 |
| 查看年度报表、操作日志 | 支持 | 不支持 |
| 分类管理、用户管理 | 支持 | 不支持 |
| 修改自己的密码 | 支持 | 支持 |

系统不开放注册，所有账号由老板创建。前端隐藏按钮只是体验优化，真正的权限判断在后端。

## 项目结构

```text
.
├── backend/
│   ├── src/
│   │   ├── index.ts        # 入口与路由装配
│   │   ├── auth.ts         # JWT、密码哈希、鉴权中间件
│   │   ├── bill.ts         # 账单 CRUD、审核、回收站、导入导出、批量删除
│   │   ├── category.ts     # 分类管理
│   │   ├── user.ts         # 用户管理
│   │   ├── stats.ts        # 看板、月度、区间、年度统计
│   │   ├── setting.ts      # 系统配置
│   │   ├── log.ts          # 操作日志
│   │   ├── profile.ts      # 自助改密
│   │   ├── db.ts           # 操作日志写入
│   │   └── types.ts        # 类型定义
│   ├── schema.sql          # D1 建表脚本
│   ├── migration.sql       # 旧库升级脚本
│   ├── wrangler.toml       # Worker 与 D1 配置
│   └── scripts/
│       └── hash-password.mjs  # 生成初始密码哈希
├── frontend/
│   ├── src/
│   │   ├── views/          # 看板、流水、统计、日志、分类、用户、个人设置
│   │   ├── layouts/        # 响应式主布局
│   │   ├── router/         # 路由与登录守卫
│   │   ├── api/            # axios 封装
│   │   └── stores/         # 登录状态
│   └── public/_redirects   # Pages SPA 路由回退
├── 信息.md                   # 原始方案
└── 部署文档.md               # 完整部署文档
```

## 接口列表

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/login` | 公开 | 登录，返回 JWT |
| GET | `/api/me` | 登录用户 | 获取当前用户 |
| GET | `/api/bills` | 老板 / 财务 | 分页流水，支持筛选与状态过滤 |
| POST | `/api/bills` | 财务 | 新增账单（待审核） |
| POST | `/api/bills/import` | 财务 | CSV 批量导入 |
| GET | `/api/bills/export` | 老板 / 财务 | 按筛选条件导出 CSV |
| DELETE | `/api/bills/batch-delete` | 财务 | 批量移入回收站 |
| GET | `/api/bills/recycle` | 老板 / 财务 | 回收站列表 |
| PUT | `/api/bills/:id` | 财务 | 修改自己的账单 |
| PUT | `/api/bills/:id/review` | 老板 | 通过 / 驳回 |
| PUT | `/api/bills/:id/restore` | 老板 / 财务 | 恢复回收站单据 |
| DELETE | `/api/bills/:id/purge` | 老板 | 彻底删除 |
| DELETE | `/api/bills/:id` | 财务 | 移入回收站 |
| GET/POST/PUT/DELETE | `/api/categories` | GET 登录用户 / 其余老板 | 分类维护 |
| GET/POST/PUT/DELETE | `/api/users` | 老板 | 用户维护 |
| GET | `/api/stats/dashboard` | 老板 / 财务 | 首页看板数据 |
| GET | `/api/stats/month` | 老板 / 财务 | 当月收支汇总 |
| GET | `/api/stats/range` | 老板 / 财务 | 自定义区间与环比 |
| GET | `/api/stats/year` | 老板 | 年度报表 |
| GET | `/api/logs` | 老板 | 操作日志 |
| PUT | `/api/profile/password` | 登录用户 | 修改自己密码 |
| GET/PUT | `/api/settings` | GET 登录用户 / PUT 老板 | 删单权限配置 |

## 本地运行

需要 Node.js 18+。

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 配置本地环境变量
cd ../backend
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，把 JWT_SECRET 改成随机字符串

# 3. 初始化本地 D1
npx wrangler d1 execute account-book-db --local --file=./schema.sql

# 4. 生成老板密码哈希并插入本地库（详见部署文档）
node scripts/hash-password.mjs "你的密码"

# 5. 启动后端（终端 1）
npm run dev

# 6. 启动前端（终端 2）
cd ../frontend
npm run dev
```

前端开发服务器默认把 `/api` 代理到 `http://127.0.0.1:8787`，所以 `frontend/.env` 留空即可。

## 部署

完整步骤见 [部署文档.md](部署文档.md)。概要：

1. Cloudflare 创建 D1 数据库，把 ID 填进 `backend/wrangler.toml`
2. 执行 `schema.sql` 建表；**旧库升级需执行 `migration.sql`**
3. 插入老板账号，设置 `JWT_SECRET`
4. `wrangler deploy` 发布后端
5. 前端 `.env` 填入 Worker 地址，`npm run build`
6. 把 `frontend/dist` 上传到 Cloudflare Pages

## 安全说明

- 密码使用 Web Crypto PBKDF2 加盐哈希，不存明文
- JWT 密钥通过 Cloudflare Secret 注入，不写进代码
- 不提供公开注册接口，账号由老板统一分配
- 只有已审核单据计入统计，编辑后自动回到待审核
- HTTPS 由 Cloudflare 默认提供
- D1 免费版没有自动备份，建议老板定期用 `wrangler d1 export` 导出 SQL

## License

[MIT](LICENSE)
