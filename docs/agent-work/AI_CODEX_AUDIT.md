1. Project Overview

PlanKiller 是一个单仓库个人日常管理应用：

- 后端：FastAPI + SQLAlchemy + SQLite，入口在 `apps/api/app/main.py`，路由在 `apps/api/app/routers/*`，核心业务集中在 `services.py` 和 `memory.py`。
- 前端：React + TypeScript + Vite，主要 UI 全在 `apps/desktop/src/main.tsx`，API 封装在 `apps/desktop/src/api.ts`。
- 桌面：Tauri v2 启动 Python sidecar，`apps/desktop/src-tauri/src/lib.rs` 注入 `DC_DATA_DIR`。
- 部署：`infra/docker-compose.yml` 启动 `api` 和 `worker` 两个容器，共享 SQLite 数据目录。
- 当前工作树已有未提交修改，且 `docs/agent-work/` 为未跟踪目录；本次只读审计未修改文件，也未读取 `.env` 等凭据文件。

2. Architecture Assessment

整体分层清晰：前端通过 `apiRequest`/`aiRequest` 调 FastAPI，FastAPI 路由调用 SQLAlchemy Session 和服务函数，AI/RAG/QQ/Reminder 逻辑在服务层，SQLite 作为单用户持久化。

主要架构风险：

- 前端边界过厚：`apps/desktop/src/main.tsx` 有 1456 行，页面、状态、表单、业务调用、展示逻辑全部在一个文件，后续功能变更容易产生回归。
- 后端服务层过宽：`apps/api/app/services.py` 同时负责 AI、QQ token、提醒调度、报表、时区、记忆索引触发，模块职责已经混杂。
- 数据迁移是启动时 ad hoc SQL：`apps/api/app/main.py:18-53` 连续 `ALTER TABLE` 并吞掉所有异常，没有版本表、没有失败可观测性，也只在 API lifespan 执行。`worker` 只调用 `init_db()`，不会执行这些迁移。
- Docker 中 API 和 worker 两个进程共享 SQLite：`infra/docker-compose.yml:1-27`，但数据库未配置 WAL/busy timeout。提醒派发、RAG 重建、前端写入并发时，SQLite 锁竞争风险较高。
- RAG 重建是同步全量重建：`apps/api/app/memory.py:202-232` 删除所有非手动 memory 后重新索引；由 HTTP `/memory/reindex` 直接触发，数据多时会阻塞请求并放大 OpenAI embedding 调用成本。

3. Code Quality Issues

- `apps/api/app/main.py:22-52` 捕获 `Exception` 后静默 `pass`，会掩盖真实迁移失败、权限问题或 SQL 兼容问题。建议至少只捕获预期的 duplicate-column/rename-failed 情况并记录日志。
- `apps/api/app/schemas.py:66-74`、`apps/api/app/schemas.py:106-109` 对 `schedule_days`、`reminder_time`、`HabitLog.status` 等使用自由字符串，缺少枚举和格式校验。坏数据会一路进入数据库，只在部分读取路径中兜底。
- `apps/api/app/services.py:129-130` 把底层 AI 异常文本拼进用户可见回复，可能泄露供应商错误、网络细节或请求形态。
- `apps/desktop/src/api.ts:109-111` 直接把完整后端错误 body 放进 Error，前端多处展示该字符串；这对个人本地工具可接受，但面向 NAS/LAN 时不利于安全和 UX。
- `apps/api/tests/test_api.py` 覆盖了核心 API，但缺少迁移失败、SQLite 并发、鉴权/跨域、worker 与 API 启动顺序、前端构建/交互层测试。

4. Potential Bugs

- 优先级语义反了：模型注释写 `priority: 1=低 2=中 3=高`，见 `apps/api/app/models.py:45`；前端也是 `3=高`，见 `apps/desktop/src/main.tsx:581-583`。但提醒上下文把 `priority == 1` 当作“高优先级未完成任务”，见 `apps/api/app/services.py:188`。这会导致提醒推送低优先级任务。
- 周报习惯完成率没有考虑 `schedule_days`：`apps/api/app/services.py:372-390` 用 `active_habits * day_count` 作为分母。每周只安排 3 天的习惯会被按 7 天计算，完成率偏低。
- `snooze_reminder` 使用 naive `datetime.now()`：`apps/api/app/routers/reminders.py:35`，而其他提醒调度使用配置时区 `ZoneInfo`。在 NAS/UTC 或混合 aware/naive datetime 下可能导致比较错误或延后时间偏移。
- `/info` 在桌面 sidecar 下返回的 `db_path` 不是真实有效路径：`apps/api/app/routers/health.py:20-26` 用 `settings.database_url`，但实际数据库路径在 `apps/api/app/database.py:37-43` 会被 `DC_DATA_DIR` 覆盖。
- `update_manual_memory` 无法清空 `target_date`：`apps/api/app/memory.py:252-269` 只有 `target_date is not None` 才更新，所以用户无法把已有日期改回空值。
- `upsert_plan` 用 title 匹配保留 done 状态：`apps/api/app/routers/plans.py:34-59`。同一天重复标题会互相覆盖/丢失状态，重命名任务也会丢 done 状态。

5. Security Concerns

- API 基本无认证，且 Docker 暴露 `8710:8710`：`infra/docker-compose.yml:9-10`。任何能访问 NAS/LAN 端口的人都可以读写计划、记忆、复盘，触发 AI、QQ 发送、重建索引。
- CORS 全开放且允许 credentials：`apps/api/app/main.py:61-67`。配合无认证 API，任意网页可从用户浏览器访问本机/NAS API 并读取响应。
- `/qq/webhook` 没有校验事件来源或签名，只处理 challenge 签名：`apps/api/app/routers/qq.py:31-67`。攻击者可伪造消息写入记忆、触发 AI 调用。
- `/qq/send-test` 未鉴权：`apps/api/app/routers/qq.py:25-28`，可被任意请求触发 QQ 主动消息。
- 前端把用户 AI Key 存在 `localStorage` 并通过 `X-AI-Key` 发送：`apps/desktop/src/api.ts:117-124`、`apps/desktop/src/main.tsx:1360-1368`。这符合当前需求，但如果用户把 API 地址改到不可信服务，会直接把 key 发给对方；同时 localStorage 对 XSS 没有防护。
- Tauri CSP 关闭：`apps/desktop/src-tauri/tauri.conf.json:23-25`。当前权限较少，但 CSP 为 null 会扩大未来 XSS 的影响面。

6. Prioritized Recommendations

1. 先补最小访问控制：至少为 NAS/API 写接口、AI、QQ、memory reindex 增加本地 token 或配置型 API key；同时把 CORS 收敛到桌面/Vite/NAS 前端来源。
2. 修复真实行为 bug：`priority == 1` 改为 `priority == 3`；周报习惯分母按 `schedule_days` 计算；snooze 使用 `today_in_timezone` 同源时区。
3. 把迁移机制正规化：引入轻量 schema version 表或 Alembic；API 和 worker 启动共用迁移路径；迁移失败必须日志可见。
4. 降低 SQLite 并发风险：配置 WAL/busy timeout，避免 HTTP 请求中长时间同步 reindex；必要时把 RAG 重建放进后台任务。
5. 拆分大文件：前端按页面拆 `HomePage/PlanPage/HabitPage/MemoryPage/SettingsPage`；后端把 AI、QQ、reminder、report、time 分成独立 service 模块。
6. 增加测试：优先覆盖 priority 提醒、schedule_days 周报分母、`/info` 桌面路径、webhook 鉴权、手动记忆清空日期、重复标题 upsert 行为。

未运行测试或构建：本次按你的规则做只读审计，且现有交接记录显示当前环境对 pytest 数据库目录和 Vite 临时目录有写权限限制。