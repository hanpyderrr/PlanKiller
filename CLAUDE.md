# CLAUDE.md

Claude Code 在本仓库的工作指南。

---

## 项目概览

**Daily Companion** — 个人日常管理工具，单用户使用，无需登录认证。

核心功能：
- 每日计划（焦点 + 任务清单 + 打勾执行）
- 下班复盘（完成情况 / 阻碍 / 明日提示）
- 习惯打卡（done / skip，每天一条，可改）
- 定时提醒（工作日早晚默认两条，支持 once/daily/workday/weekly）
- QQ bot 推送提醒（QQ 开放平台 v2 API，主动消息）
- AI 陪伴监督（OpenAI gpt-4o-mini，无 key 时本地兜底，拒绝医疗建议）

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | FastAPI + SQLAlchemy + SQLite + uvicorn |
| 前端 | React + TypeScript + Vite |
| 桌面壳 | Tauri v2（待安装 Rust 后启用，开发期直接用浏览器）|
| QQ bot | QQ 开放平台 v2 API（bots.qq.com），httpx 异步请求 |
| AI | OpenAI Responses API（gpt-4o-mini），无 key 降级为本地回复 |
| 部署 | Docker Compose，目标 NAS 192.168.31.26:8710 |

---

## 目录结构

```
daily-companion/
├── apps/
│   ├── api/                      # FastAPI 后端
│   │   ├── app/
│   │   │   ├── main.py           # 入口：路由注册、启动时建表+默认提醒
│   │   │   ├── config.py         # .env 配置，lru_cache 单例
│   │   │   ├── database.py       # SQLAlchemy 引擎和 Session
│   │   │   ├── models.py         # 数据库表结构（ORM）
│   │   │   ├── schemas.py        # Pydantic 请求/响应模型
│   │   │   ├── services.py       # 核心逻辑：AI、QQ token 缓存、提醒调度
│   │   │   └── routers/
│   │   │       ├── health.py     # GET /health
│   │   │       ├── plans.py      # /plans — 每日计划 CRUD
│   │   │       ├── habits.py     # /habits — 习惯 + 打卡
│   │   │       ├── reminders.py  # /reminders — 提醒管理 + 调度触发
│   │   │       ├── ai.py         # /ai — 聊天 + 日报 + 周报
│   │   │       └── qq.py         # /qq — webhook + 挑战验证 + 发消息
│   │   ├── tests/test_api.py     # pytest，6 个测试，应全部通过
│   │   ├── requirements.txt
│   │   └── .env                  # 本机密钥（gitignored，见下方说明）
│   └── desktop/                  # React 前端
│       └── src/
│           ├── main.tsx          # 全部页面组件（单文件结构）
│           └── api.ts            # 类型定义 + apiRequest() 统一请求
├── infra/
│   └── docker-compose.yml        # NAS 部署配置
├── AI_HANDOFF.md                 # AI 协作交接记录（每次改代码必须更新）
├── AI_REVIEW.md                  # Codex 审查记录
└── AGENTS.md                     # 多 AI 协作规范
```

---

## 本地启动

**后端**（端口 8710，支持热重载）：
```powershell
cd apps\api
.\.venv\Scripts\uvicorn app.main:app --reload --port 8710
```

**前端**（端口 5173，浏览器访问）：
```powershell
cd apps\desktop
npm run dev
```

访问 `http://localhost:5173`，设置页可切换 API 地址。

**测试**：
```powershell
cd apps\api
.\.venv\Scripts\python -m pytest -v
```

---

## 环境变量（apps/api/.env）

```
QQ_BOT_APP_ID=1903622059
QQ_BOT_SECRET=<已配置>
QQ_BOT_TARGET_ID=<待填写，用户先给 bot 发消息，从 webhook 响应取 sender_openid>
QQ_BOT_ENABLED=true
OPENAI_API_KEY=<可选，不填则使用本地兜底回复>
OPENAI_MODEL=gpt-4o-mini
TIMEZONE=Asia/Shanghai
API_PORT=8710
```

---

## 当前进度

| 步骤 | 内容 | 状态 |
|------|------|------|
| Step 1 | 项目骨架 + 本地运行 | ✅ 完成 |
| Step 2 | pytest 6/6 通过 | ✅ 完成 |
| Step 3 | 历史记录 30 天查询修复 | ✅ 完成 |
| Step 4 | NAS 部署 | ⏳ 暂缓，先本地跑通 |
| Step 5 | 默认提醒（08:30 / 18:30 工作日）| ✅ 完成 |
| Step 6 | QQ bot 真实接入 | ✅ 代码完成，待配置 TARGET_ID |

**下一步**：获取 QQ_BOT_TARGET_ID → 用户给 bot 发一条消息 → webhook 返回 `sender_openid` → 填入 .env 重启。

---

## 已知限制

- **Tauri 桌面壳**：需要 Rust/Cargo，当前跳过，用浏览器开发即可
- **QQ 主动消息权限**：需在 q.qq.com 后台确认 bot 已开启「主动消息」权限
- **QQ TARGET_ID**：尚未配置，QQ 发送功能暂时无效
- **NAS 部署**：Windows 本机无 Docker，待本地验证完成后再上 NAS
- **公网 webhook**：QQ 回调需要公网 HTTPS 地址，网络方案待定（有公网 IP，需域名 + Caddy）

---

## 角色定位

Claude Code 负责实现：

- 实现计划功能和 UI 流程
- 改动范围严格限制在当前请求步骤内
- 优先沿用项目已有结构和模式
- 每次改完代码必须写交接记录
- 功能未经人工或 Codex 验证前不视为完成

---

## 交接记录规范

每次修改文件后，在回复前必须更新 `AI_HANDOFF.md`，格式如下：

```markdown
## YYYY-MM-DD HH:mm - Claude 交接

### 摘要
- ...

### 修改文件
- `path/to/file`

### 验证方式
- `命令`

### 已知问题
- ...
```

---

## Review 流程

Codex 审查完成后继续开发前：

1. 读 `AI_REVIEW.md`
2. 按严重程度顺序修复 OPEN 问题
3. 在 `AI_REVIEW.md` 中将已修复项标记为 `[x] FIXED`
4. 在 `AI_HANDOFF.md` 中记录本次修复内容
5. 未解决的问题明确留存，不要隐藏

---

## 项目约束

- 不提交任何密钥或 secret
- OpenAI API key 不放进桌面前端代码
- AI 访问数据库必须通过后端汇总函数，不直接暴露原始数据
- 不提供医疗诊断、用药建议或疾病判断
- v1 保持单用户个人使用假设，不加认证层
- NAS 部署地址固定为 `192.168.31.26:8710`

---

## 质量标准

- 后端 API 改动必须有对应测试
- 前端改动必须通过 `npm run build`
- 数据模型变更必须包含迁移或初始化逻辑
- 提醒和 QQ 推送流程必须幂等
- 错误应优雅降级，不影响核心计划和习惯功能
