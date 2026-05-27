1. Project Overview

PlanKiller 是一个单仓库个人日常管理应用：

- 后端：FastAPI + SQLAlchemy + SQLite，入口在 `apps/api/app/main.py`，路由在 `apps/api/app/routers/*`，核心逻辑集中在 `apps/api/app/services.py` 和 `apps/api/app/memory.py`。
- 前端：React + TypeScript + Vite，入口已拆为 `apps/desktop/src/main.tsx`，页面在 `apps/desktop/src/pages/*`，API 封装在 `apps/desktop/src/api.ts`。
- 桌面：Tauri v2 通过 `apps/desktop/src-tauri/src/lib.rs` 启动 Python sidecar，并注入 `DC_DATA_DIR`。
- 部署：`infra/docker-compose.yml` 运行 `api` 和 `worker` 两个容器，共享 SQLite 数据目录。
- 当前只读审计未修改文件，未读取 `.env`、数据库、token、credential 文件；未运行会写入数据库或构建产物的测试/构建命令。

2. Architecture Assessment

整体分层已经比旧状态清晰：前端页面拆分完成，`main.tsx` 主要承担 App shell、全局状态和路由切换；后端路由、模型、schema、服务层分工基本明确。

主要架构风险：

- 桌面版提醒不会自动派发。Tauri sidecar 只启动 `uvicorn app.main:app`，见 `apps/api/run_server.py:26-31` 和 `apps/desktop/src-tauri/src/lib.rs:20-27`；自动轮询只存在于 `apps/api/app/worker.py:11-18`，但桌面打包未启动 worker。结果是桌面用户不手动调用 `/reminders/dispatch-due` 时，定时提醒不会按时发送。
- 迁移逻辑仍是 ad hoc SQL 且静默吞异常：`apps/api/app/main.py:18-53`。这会掩盖真实迁移失败，并且 `worker` 只调用 `init_db()`，不走同一迁移路径。
- Docker 中 API 与 worker 两个进程共享 SQLite：`infra/docker-compose.yml:1-27`。当前数据库连接未配置 WAL、busy timeout 或任务级锁；提醒派发、RAG 全量重建、前端写入并发时有锁竞争和重复派发风险。
- RAG 重建是同步全量重建：`apps/api/app/memory.py:202-232` 删除非手动记忆后重建。数据变多或 embedding 可用时，会阻塞 HTTP 请求并放大外部 API 成本。
- 后端服务层职责偏宽：`apps/api/app/services.py` 同时处理 AI、QQ、提醒、报表、时区、记忆重建触发，后续变更容易互相牵连。

3. Code Quality Issues

- 输入校验不足：`apps/api/app/schemas.py:107-110` 允许任意 `HabitLog.status`，`apps/api/app/schemas.py:120-128` 允许任意 `schedule_type`、`scheduled_time`，`apps/api/app/schemas.py:67-75` 允许任意 `schedule_days`。这些自由字符串会进入数据库，部分路径才兜底。
- 调度错误不可观测：`apps/api/app/services.py:238` 直接解析 `scheduled_time`，非法值会抛异常；`apps/api/app/worker.py:14-18` 没有 try/except 包住 `dispatch_due_reminders`，一个坏提醒可能终止 worker。
- 用户可见错误过细：`apps/api/app/services.py:129-130` 把 AI 调用异常文本拼进回复；`apps/desktop/src/api.ts:109-111` 把后端完整错误 body 直接抛给 UI。开发期方便，NAS/LAN 场景下不利于安全和体验。
- `ReviewPage` 缺少 props 同步：`apps/desktop/src/pages/ReviewPage.tsx:6-8` 只用初始 `plan` 初始化 state，不像 `PlanPage` 在 `apps/desktop/src/pages/PlanPage.tsx:23-28` 用 `useEffect` 同步。若用户在数据刷新前进入复盘页，后续 plan 到达后表单不会自动填充已有复盘。
- 文档有滞后信息：`CLAUDE.md` 仍描述 `Daily Companion`、`main.tsx` 单文件结构和 6 个测试；当前代码已经是 PlanKiller、页面拆分、测试数也已变化。

4. Potential Bugs

- 高: 桌面版自动提醒缺失。证据同上：Tauri sidecar 只启动 API，worker 只在 Docker Compose 中定义。影响是桌面安装版的核心提醒功能可能静默失效。
- 高: 坏提醒数据可能让 worker 崩溃。`ReminderCreate` 不校验时间格式，`next_run_after` 在 `apps/api/app/services.py:238` 直接 split/int；worker 没有异常保护。
- 中: 首页“连续打卡 N 天”语义错误。`apps/desktop/src/pages/HomePage.tsx:91-94` 显示连续打卡，但使用的是 `report.habit_logs`；该字段在 `apps/api/app/services.py:373-397` 是报告周期内 done 日志数，不是连续天数。
- 中: `/info` 的 `db_path` 在 sidecar 模式不准确。实际数据库路径由 `DC_DATA_DIR` 覆盖，见 `apps/api/app/database.py:37-43`；但 `/info` 仍从 `settings.database_url` 计算，见 `apps/api/app/routers/health.py:19-26`。
- 中: 前端 `today` 是模块加载时常量：`apps/desktop/src/utils.ts:8`。应用跨午夜不刷新时，`main.tsx:56-57`、`PlanPage.tsx:47`、`ReviewPage.tsx:13`、习惯打卡路径会继续写入旧日期。
- 中: 提醒派发缺少幂等/并发保护。`apps/api/app/services.py:258-270` 先查 due reminders，再发送，再更新；多个进程或手动 endpoint 与 worker 并发时可能重复发送。

5. Security Concerns

- API 无认证且 Docker 暴露端口：`infra/docker-compose.yml:9-10`。任何能访问 NAS/LAN 端口的人都能读写计划、记忆、复盘，触发 AI、QQ、reindex。
- CORS 全开放并允许 credentials：`apps/api/app/main.py:61-67`。配合无认证 API，任意网页可从用户浏览器访问本机/NAS API。
- QQ webhook 缺少事件来源校验：`apps/api/app/routers/qq.py:31-67` 只处理 challenge 签名，没有对普通事件做签名/来源验证。攻击者可伪造消息写入记忆或触发 AI 调用。
- `/qq/send-test` 未鉴权：`apps/api/app/routers/qq.py:25-28`，可被任意可访问 API 的请求触发 QQ 发送。
- 用户 AI Key 存在 `localStorage` 并会转发到用户配置的 API 地址：`apps/desktop/src/api.ts:117-124`、`apps/desktop/src/pages/SettingsPage.tsx:27-31`。若 API 地址被改为不可信服务，key 会泄露。
- Tauri CSP 关闭：`apps/desktop/src-tauri/tauri.conf.json:23-25`。当前前端没有明显 `dangerouslySetInnerHTML`，但 CSP 为 null 会扩大未来 XSS 的影响面。

6. Prioritized Recommendations

1. 先修桌面提醒架构：Tauri sidecar 同时启动 worker，或把调度 loop 纳入 API lifespan，并确保关闭窗口时一起退出。
2. 给 API 加最小访问控制：至少为写接口、AI、QQ、memory reindex 增加本地 token；同时收窄 CORS 到 Vite、本机 Tauri、NAS 前端来源。
3. 正规化迁移：引入 schema version 表或 Alembic；API 和 worker 共用迁移入口；迁移失败记录日志并阻止继续启动。
4. 加强提醒健壮性：校验 `scheduled_time`、`schedule_type`、`HabitLog.status`、`schedule_days`；worker loop 捕获单轮异常并记录，不让一个坏数据终止进程。
5. 修复当前 UI 语义 bug：把“连续打卡”改成“本周打卡次数”，或后端增加真正 streak 字段；`ReviewPage` 按 `plan` 变化同步表单。
6. 降低 SQLite 并发风险：配置 WAL/busy timeout；提醒派发增加领取/锁定状态；RAG reindex 改后台任务或增量更新。
7. 补测试：桌面提醒启动路径、非法提醒数据、重复派发、`/info` sidecar 路径、首页 streak 文案、ReviewPage 异步加载回填。

未运行测试/构建：本次按要求只读审计；后端 pytest 会写 `apps/api/data/test_plankiller.db`，前端 build 会写 Vite/dist 临时产物，不适合在本轮执行。