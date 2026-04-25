# Nexatech 学生邮箱系统

面向学校的 **$0 成本无服务器邮箱方案**。学生通过大学官网点击 "Student Login" 即可登录专属邮箱，仅可收信和修改密码，无发信、无注册、无管理员权限。

---

## 技术栈

| 组件 | 服务 | 免费额度 |
|------|------|---------|
| **前端展示** | Next.js 15 + Tailwind CSS 4 + shadcn/ui | — |
| **部署平台** | Vercel / Cloudflare Pages | 100GB 带宽/月 |
| **数据库 + 鉴权** | Supabase | 500MB 存储 + 5 万活跃用户 |
| **邮件接收** | Cloudflare Email Routing + Email Worker | 10 万次请求/天 |
| **DNS 解析** | Cloudflare DNS | 无限 |

> 以上所有服务的免费额度完全满足一所学校的日常使用。

---

## 架构概览

```
┌──────────────────────────────────────────────────────────┐
│                   大学官网 (静态页面)                      │
│  点击右上角 "Student Login" ─→ 弹出登录弹窗                │
│                        │                                 │
│                        ▼                                 │
│        跳转至 www.nexatech.edu.kg/mail/login             │
└────────────────────────┬─────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ Next.js │ ← 认证 (Supabase Auth)
                    │  前端   │ ← 收件箱 / 邮件详情 / 改密码
                    └────┬────┘
                         │
                    ┌────▼─────┐
                    │ Supabase │ ← mailbox_accounts 表
                    │ Database │ ← mail_messages 表 (RLS 隔离)
                    └──────────┘

                    外部邮件 ─→ Cloudflare MX 记录
                              → Email Routing
                              → Email Worker (解析 MIME)
                              → 写入 Supabase 数据库
```

---

## 前提条件

1. **拥有域名控制权**：你必须能管理 `nexatech.edu.kg` 域名的 DNS，并能将 DNS 托管到 Cloudflare
2. **Node.js 环境**：本地开发需要 Node.js 18+
3. **Cloudflare 账号**：用于 DNS + Email Routing + Worker
4. **Supabase 账号**：用于数据库和身份认证

---

## 第一步：创建 Supabase 项目

1. 登录 [supabase.com](https://supabase.com)，新建项目
2. 等待数据库初始化完成
3. 进入 **SQL Editor**，将 `supabase/migrations/001_initial_schema.sql` 的全部内容粘贴进去并执行
4. 这会创建以下表和行级安全策略：
   - `mailbox_accounts` —— 学生邮箱账号表
   - `mail_messages` —— 收件存储表
   - RLS 策略：每个学生只能查看自己的邮箱和邮件
5. 进入 **Authentication → Providers → Email**，确保 Email 登录已启用
6. 进入 **Authentication → URL Configuration**，将站点 URL 设为 `https://www.nexatech.edu.kg/mail`

### 获取 API 密钥

进入 **Project Settings → API**，记下以下值：

| 参数 | 说明 |
|------|------|
| `Project URL` | 类似 `https://xxxxx.supabase.co` |
| `anon public` | 公开 anon key |
| `service_role` | 服务角色密钥（仅管理脚本使用，切勿泄露） |

---

## 第二步：配置 Cloudflare DNS 和 Email Routing

### 2.1 添加 DNS 记录

在 Cloudflare 域名管理页面（`nexatech.edu.kg`），添加以下记录：

| 类型 | 名称 | 值 | 代理 |
|------|------|----|------|
| CNAME | `email` | 你的 Vercel/Cloudflare Pages 部署域名 | 关闭代理（DNS only）|

> 如果你使用 Vercel 部署前端，Vercel 会提示你添加其分配的 CNAME 目标。

### 2.2 启用 Email Routing

1. 进入 Cloudflare 仪表板 → **Email → Email Routing**
2. 点击 **Get Started**
3. Cloudflare 会自动要求你添加 MX 记录，确认添加
4. 添加路由规则：
   - **Destination address（目标地址）**：添加一个真实邮箱（如管理员 Gmail）用于接收投递失败的退信通知
   - **Custom addresses（自定义地址）**：添加你需要的学生邮箱前缀，如 `student001` → 路由到 **Email Worker**
   - 或者设置 **Catch-all**：将所有发往 `*@nexatech.edu.kg` 的邮件路由到 **Email Worker**

### 2.3 绑定 Email Worker

1. 在 Email Routing 页面，点击 **Workers 路由**
2. 选择 **Create new worker**（或使用我们项目中的 worker 代码）
3. Worker 将收到所有入站邮件

---

## 第三步：部署前端 (Next.js)

### 方案 A：部署到 Vercel（推荐）

1. 将代码仓库推送到 GitHub
2. 在 [vercel.com](https://vercel.com) 导入该仓库
3. 设置环境变量（对应 `.env.example` 中的值）：

| 变量名 | 值 |
|--------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `MAIL_DOMAIN` | `nexatech.edu.kg` |

4. 在 Vercel 项目设置中添加自定义域名 `www.nexatech.edu.kg`
5. 点击 Deploy

### 方案 B：部署到 Cloudflare Pages

```bash
npx wrangler pages deploy .next --project-name=nexatech-mail --branch=main
```

环境变量在 Cloudflare Pages 项目设置的 **Settings → Environment Variables** 中添加。

---

## 第四步：部署 Email Worker

### 4.1 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 4.2 登录 Cloudflare

```bash
wrangler login
```

### 4.3 部署 Worker

```bash
cd mail-app/worker
wrangler deploy --env production
```

### 4.4 设置 Worker 密钥

```bash
wrangler secret put SUPABASE_URL    # 填入 Supabase 项目 URL
wrangler secret put SUPABASE_SERVICE_KEY  # 填入 service_role key
```

### 4.5 在 Email Routing 中绑定 Worker

回到 Cloudflare Email Routing 页面，将所有入站邮件路由到这个刚部署的 Worker。

---

## 第五步：创建学生账号

### 方式一：逐个创建

```bash
cd mail-app

# 设置环境变量
export SUPABASE_URL="https://你的项目.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="你的service_role密钥"

# 创建学生账号
npm run create-student -- student001 "初始密码123!" "S-2025-001"
```

输出：
```
Created student account: student001@nexatech.edu.kg
  Student ID: S-2025-001
  Initial password: 初始密码123!
  (Student should change password on first login)
```

### 方式二：CSV 批量导入

准备 CSV 文件 `students.csv`：

```csv
email_prefix,password,student_id
student001,SecurePass1!,S-2025-001
student002,SecurePass2!,S-2025-002
student003,SecurePass3!,S-2025-003
```

```bash
npm run import-csv -- students.csv
```

### 域名迁移

先预览即将变更的账号：
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain -- --dry-run
```

确认无误后正式执行：
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MAIL_DOMAIN=nexatech.edu.kg \
  npm run migrate-mail-domain
```

输出示例：
```
Found 3 students to import from students.csv
[OK] student001@nexatech.edu.kg
[OK] student002@nexatech.edu.kg
[SKIP] student003@nexatech.edu.kg - already exists

--- Summary ---
Created: 2
Skipped: 1
Failed:  0
Total:   3
```

> CSV 支持 `#` 注释行，也支持带表头行（自动跳过）。

---

## 第六步：验证完整流程

### 测试登录

1. 打开大学官网，点击右上角 **Student Login**
2. 输入学生的邮箱和密码
3. 确认跳转到邮箱系统并进入收件箱

### 测试收信

1. 从任意外部邮箱（如 Gmail）发送一封邮件到 `student001@nexatech.edu.kg`
2. 等待几秒
3. 登录该学生账号，检查收件箱是否出现该邮件

### 测试安全隔离

1. 用 `student001` 登录后，确认只能看到 `student001` 的邮件
2. 用 `student002` 登录后，确认只能看到 `student002` 的邮件
3. 确认页面上**没有**写邮件、注册账号、邀请用户等操作入口

### 测试改密码

1. 登录后进入 Settings → Change Password
2. 修改密码后用新密码重新登录，确认成功

---

## 学生功能清单 (v1)

| 功能 | 状态 |
|------|------|
| 使用管理员分配的账号密码登录 | ✅ |
| 查看收件箱列表 | ✅ |
| 阅读邮件正文 | ✅ |
| 自动标记已读 | ✅ |
| 修改密码 | ✅ |
| 登出 | ✅ |
| ~~发送邮件~~ | ❌ 不支持 |
| ~~注册账号~~ | ❌ 禁止 |
| ~~修改邮箱地址~~ | ❌ 禁止 |
| ~~邀请用户~~ | ❌ 禁止 |
| ~~管理员面板~~ | ❌ 禁止 |

---

## 安全设计

- **行级安全 (RLS)**：每个学生只能查询自己的 `mailbox_accounts` 和 `mail_messages` 行
- **邮件内容消毒**：HTML 邮件在存储时移除 script、iframe、event handler 等危险元素
- **禁止自助注册**：Supabase Auth 关闭了公开注册
- **无发信能力**：系统未配置任何 SMTP 出站服务
- **服务端密钥隔离**：service_role key 仅存在于 Cloudflare Worker 和管理脚本中，不会泄露到前端
- **中间件鉴权**：Next.js middleware 拦截所有未认证请求并跳转至登录页

---

## 目录结构

```
mail-app/
├── app/                          # Next.js App Router 页面
│   ├── layout.tsx                # 根布局
│   ├── login/page.tsx            # 登录页
│   ├── inbox/page.tsx            # 收件箱列表
│   ├── inbox/[messageId]/page.tsx # 邮件详情
│   └── settings/password/page.tsx # 修改密码
├── components/
│   ├── ui/                       # UI 基础组件
│   ├── mail-layout.tsx           # 认证页面侧边栏
│   ├── inbox-list.tsx            # 收件箱列表组件
│   └── message-view.tsx          # 邮件详情组件
├── lib/
│   ├── supabase/client.ts        # 浏览器端 Supabase 客户端
│   ├── supabase/server.ts        # 服务端 Supabase 客户端
│   ├── auth/require-session.ts   # 鉴权守卫
│   ├── mail/sanitize-message.ts  # 邮件 HTML 消毒
│   └── utils.ts                  # 样式合并工具
├── scripts/
│   ├── create-student-account.ts # 管理员脚本：单个创建
│   └── import-students-csv.ts    # 管理员脚本：批量导入
├── supabase/migrations/
│   └── 001_initial_schema.sql    # 数据库建表 + RLS 策略
├── worker/
│   ├── email-ingest.ts           # Cloudflare 邮件解析 Worker
│   └── wrangler.toml             # Worker 配置
├── middleware.ts                 # Next.js 路由鉴权中间件
└── .env.example                  # 环境变量模板
```

大学官网文件（同级目录）：

```
nexatech/
├── index.html                    # 首页
├── programs.html
├── admissions.html
├── campus.html
├── faculty.html
├── news.html
├── contact.html
├── css/style.css                 # 全局样式（含弹窗样式）
└── js/student-login.js           # 登录弹窗脚本
```

---

## 常见问题

### Q: 免费额度够多少学生用？

| 限制 | 额度 | 换算 |
|------|------|------|
| Supabase 存储 | 500MB | 约 50 万封纯文本邮件 |
| Supabase 活跃用户 | 5 万 | 同时在线 5 万学生 |
| Cloudflare Worker | 10 万次/天 | 每天收 10 万封邮件 |
| Vercel 带宽 | 100GB/月 | 约百万次页面访问 |

对于大多数学校，这些额度绰绰有余。

### Q: 学生忘记密码怎么办？

管理员可通过 Supabase 后台重置密码，或使用脚本重新创建账号。v1 不支持学生自助找回密码。

### Q: 能不能加发信功能？

可以，但需要额外配置 SMTP 发信服务（如 Resend、SendGrid 等免费版），不属于 $0 Stack 范围。

### Q: 附件支持呢？

v1 暂不支持附件。如需附件，可以后续添加 Supabase Storage 桶来存储文件，并在 `mail_attachments` 表中记录元数据。

### Q: 本地开发怎么跑？

```bash
cd mail-app
npm install
cp .env.example .env.local  # 填入你的 Supabase 配置
npm run dev
```

然后访问 http://localhost:3000/login
