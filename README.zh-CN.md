# Nexatech 邮箱平台

> **⚠️ 声明：** 本项目仅用作教学演示。

[English README](./README.md)

Nexatech 邮箱平台是一个面向学校场景的邮箱系统，包含：

- 仓库根目录的大学官网静态站点
- `mail-app/` 下的 Next.js 15 邮箱与管理后台
- 使用 Supabase 作为认证与数据存储
- 使用 Cloudflare Email Worker 处理入站邮件

学生从官网点击登录按钮后，会进入 `/mail` 应用查看邮件并修改密码；管理员可以在后台创建和管理邮箱账号。

## Demo 演示

在线演示地址：[https://www.nexatech.edu.kg/](https://www.nexatech.edu.kg/)

## 仓库结构

这个仓库主要由两部分组成：

1. **根目录静态网站**
   - `index.html`、`programs.html`、`admissions.html`、`campus.html`、`faculty.html`、`news.html`、`contact.html`
   - `css/style.css`
   - `js/student-login.js`
   - `images/`

2. **`mail-app/` Next.js 应用**
   - 学生收件箱与密码管理
   - 管理员登录、仪表盘、邮箱管理与保留期清理
   - 基于 Supabase 的认证与数据存储
   - Cloudflare 邮件 Worker 与运维脚本

## 核心功能

### 学生端功能
- 使用管理员分配的凭据登录
- 查看收件箱消息
- 查看邮件详情
- 修改密码

### 管理端功能
- 管理员登录流程
- 查看邮箱健康状态和最近活动指标
- 创建邮箱账号
- 查询/搜索邮箱账号
- 停用/恢复邮箱账号
- 重置邮箱密码
- 删除邮箱账号
- 手动执行数据保留清理

### 邮件接收能力
- Cloudflare Email Routing → Worker → Supabase 的投递链路
- 重放邮件时的去重保护
- 对瞬时失败的重试队列
- 基于定时任务的保留期清理
- 对纯 HTML 邮件采用安全的纯文本展示策略

## 技术栈

- **前端 / 应用**：Next.js 15、React 19、Tailwind CSS 4
- **认证 + 数据库**：Supabase
- **入站邮件**：Cloudflare Email Routing + Cloudflare Worker
- **测试**：Vitest、Playwright、k6
- **部署**：Vercel 承载 Web 应用，Cloudflare 负责邮件 / DNS / Worker

## 本地开发

大多数应用开发都在 `mail-app/` 内完成。

### 前置要求

- Node.js 18+
- npm
- 一个 Supabase 项目
- 如果要测试 Worker 部署，还需要 Cloudflare 账号

### 安装依赖

```bash
cd mail-app
npm install
```

### 配置环境变量

从示例文件创建本地环境变量文件：

```bash
cp .env.example .env.local
```

`mail-app/.env.example` 中需要的变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAIL_DOMAIN`
- `SUPABASE_URL`

### 本地启动

```bash
npm run dev
```

由于应用设置了 `basePath: "/mail"`，本地访问路径为：

- `http://localhost:3000/mail/login`
- `http://localhost:3000/mail/inbox`
- `http://localhost:3000/mail/admin/login`

## 常用命令

以下命令都在 `mail-app/` 目录下执行。

### 构建

```bash
npm run build
npm run start
```

### 代码检查

```bash
npm run lint
```

### 单元测试与集成测试

```bash
npm test
```

运行单个测试文件：

```bash
npm test -- app/api/auth/login/route.test.ts
```

### E2E 测试

```bash
npx playwright test
```

运行单个 spec：

```bash
npx playwright test ./tests/e2e/health.spec.ts
```

注意：Playwright 当前配置默认指向 `https://www.nexatech.edu.kg`，而不是 localhost，所以执行面向生产环境的 E2E 测试前请先确认。

### 管理与迁移脚本

```bash
npm run create-student -- <emailPrefix> <password> <studentId>
npm run import-csv -- <csvFile>
npm run migrate-mail-domain -- --dry-run
npm run migrate-mail-domain
npm run export-load-test-fixtures
npm run send-load-test-mails
```

### 压测脚本

```bash
npm run load:web:health
npm run load:web:login
npm run load:web:inbox
npm run load:web:message-detail
npm run load:web:admin-dashboard
npm run load:web:prod-mixed
```

## 部署总览

生产部署由三个主要部分组成：

1. **Supabase 项目**：负责认证与邮箱数据
2. **Vercel 部署**：负责网站与 Next.js 应用
3. **Cloudflare Email Routing + Worker**：负责入站邮件接收

---

## 第一步：创建并配置 Supabase

1. 创建一个新的 Supabase 项目。
2. 执行 `mail-app/supabase/migrations/` 中的 SQL 迁移。
   推荐顺序：
   - `001_initial_schema.sql`
   - `002_login_rate_limits.sql`
   - `002_mail_message_idempotency.sql`
   - `003_reliability_foundation.sql`
3. 如果你希望系统只允许管理员预先创建账号，请在 Supabase Auth 设置中关闭公开注册。
4. 记录以下信息：
   - Project URL
   - anon key
   - service role key

这些值会用于 Next 应用和管理脚本。

---

## 第二步：将 Next.js 应用部署到 Vercel

`mail-app/vercel.json` 会把顶层网站路由重写到 `/mail/...` 下的静态资源上，这样大学官网和邮箱应用就可以在一个部署中共同工作。

### 部署步骤

1. 将本仓库推送到 GitHub。
2. 在 Vercel 中导入该仓库。
3. 根据你的 Vercel 配置需要，必要时把项目根目录设置为 `mail-app/`。
4. 在 Vercel 中配置以下环境变量：

| 变量名 | 作用 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 公共项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公共 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端管理员访问密钥 |
| `SUPABASE_URL` | 服务端 / 管理脚本使用的 Supabase URL |
| `MAIL_DOMAIN` | 邮件域名，例如 `nexatech.edu.kg` |

5. 绑定生产域名，例如 `www.nexatech.edu.kg`。
6. 点击部署。

### 说明

- `mail-app/next.config.ts` 中使用了 `basePath: "/mail"`。
- `mail-app/middleware.ts` 会强制 canonical host，并保护邮箱与管理后台路由。
- 为了让 Vercel 能通过重写规则服务大学官网静态页，公共网站文件在 `mail-app/public/` 中也保留了一份副本。

---

## 第三步：在 Cloudflare 中配置 DNS 和 Email Routing

1. 如果还没有，把邮件域名 DNS 托管到 Cloudflare。
2. 添加 Cloudflare Email Routing 所需的 MX 记录。
3. 在 Cloudflare 仪表盘启用 **Email Routing**。
4. 将学校域名下的入站地址路由到下一步要部署的 Worker。

如果你想支持 catch-all 邮箱规则，也可以在这里完成配置。

---

## 第四步：部署 Cloudflare Email Worker

Worker 位于 `mail-app/worker/`，负责：

- 解析入站邮件
- 校验收件人和域名
- 将邮件写入 Supabase
- 记录投递事件与失败信息
- 定时重放瞬时失败
- 执行保留期清理

### 部署 Worker

```bash
cd mail-app/worker
wrangler login
wrangler deploy --env production
```

### 配置密钥

在 Cloudflare 中设置 service role key：

```bash
wrangler secret put SUPABASE_SERVICE_KEY --env production
```

### 配置公开变量

编辑 `mail-app/worker/wrangler.toml`，设置：

- `MAIL_DOMAIN`
- `SUPABASE_URL`

当前 cron 已定义：

- `7 * * * *` —— 重放瞬时失败的投递
- `17 3 * * *` —— 清理超出保留期的数据

---

## 第五步：创建邮箱账号

当 Supabase 和 Web 应用部署完成后，可以在 `mail-app/` 目录下创建学生邮箱账号。

### 创建单个学生账号

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run create-student -- student001 SecurePass1! S-2025-001
```

### 从 CSV 批量导入

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run import-csv -- students.csv
```

CSV 格式：

```csv
email_prefix,password,student_id
student001,SecurePass1!,S-2025-001
student002,SecurePass2!,S-2025-002
```

### 预览并执行邮箱域名迁移

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain -- --dry-run
```

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain
```

---

## 第六步：验证部署结果

### 网站与登录
- 打开大学官网
- 点击 **Student Login**
- 确认登录弹窗出现
- 使用已创建的学生账号登录
- 确认跳转到 `/mail/inbox`

### 邮件投递
- 从外部邮箱向一个已激活的学生邮箱发送测试邮件
- 确认学生收件箱里能看到该邮件

### 管理后台
- 打开 `/mail/admin/login`
- 确认仪表盘正常加载
- 验证邮箱管理和保留期清理操作

### 健康检查
- 访问 `/mail/api/health`
- 确认 Supabase 连通性正常

---

## 安全模型

- 学生不能自助注册。
- 使用 Row Level Security (RLS) 隔离邮箱数据。
- 管理员操作仅在后端使用 service role key。
- HTML 邮件会被转换为纯文本后再显示。
- 学生与管理员登录接口都带有 origin 校验和限流。
- 系统不包含发信功能。

## 其他项目文档

更多细节请参考：

- [`mail-app/README.md`](./mail-app/README.md)
- [`mail-app/README.zh-CN.md`](./mail-app/README.zh-CN.md)
- [`CLAUDE.md`](./CLAUDE.md)

## License

本仓库使用 [MIT License](./LICENSE)。
