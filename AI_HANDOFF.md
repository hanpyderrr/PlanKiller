# AI_HANDOFF.md

Claude Code 与 Codex 之间的实现交接记录，最新条目在最上方。

## 2026-05-25 - Codex 交接（PlanKiller 新项目 + RAG 合入）

### 摘要
- 从 `E:\vs-workspace\daily-companion` 复制产品化底座到 `E:\codex-workspace\plankiller`，初始化独立 git 仓库。
- 项目运行名改为 `PlanKiller`，包括 Tauri productName、identifier、前端包名、API title、Docker 容器名、SQLite 文件名、localStorage key。
- 合入长期记忆/RAG 后端：`memory.py`、`routers/memory.py`、`MemoryDocument`、`MemoryChunk`、`/memory/reindex`、`/memory/search`、`/memory/manual`。
- 合入 AI 增强：`/ai/chat` 返回 `memory_hits`，周报返回模式分析，`/ai/insights/weekly` 写入长期记忆。
- 合入提醒增强：中文回复 `完成` / `跳过 原因` / `延后10`，提醒回复写入记忆，习惯提醒带最近 7 天上下文。
- 前端新增“长期记忆”页，AI 页显示本次参考记忆。

### 验证
```powershell
cd E:\codex-workspace\plankiller\apps\api
E:\codex-workspace\daily-companion\apps\api\.venv\Scripts\python.exe -m pytest
# 8 passed

cd E:\codex-workspace\plankiller\apps\desktop
npm run build
# passed
```

### 备注
- 新项目没有复制 `.venv`，后端测试暂时复用了 `daily-companion` 的虚拟环境。
- 前端 `node_modules` 从 `E:\vs-workspace\daily-companion\apps\desktop\node_modules` 复制，`.gitignore` 已忽略。
- 下一步建议：给 `plankiller` 建自己的 `.venv`，跑本机端到端服务，然后验证 Tauri sidecar 打包。

## 2026-05-14 - Claude 交接（计划时间 + 首页交互 + 重建）

### 摘要
- PlanItem 新增 `planned_time` 字段（HH:MM，可选），含启动迁移兼容老数据库
- 今日计划页任务输入改为逐行动态列表（时间选择器 + 标题 + 删除）
- 首页任务行点击可直接勾选完成，习惯卡新增 ✓/— 快速打卡按钮
- 重新 PyInstaller 打包后端，重新 tauri build，新安装包 24.5 MB

### 修改文件
- `apps/api/app/models.py` — PlanItem 加 planned_time 字段
- `apps/api/app/schemas.py` — PlanItemCreate/Read 加 planned_time
- `apps/api/app/routers/plans.py` — upsert 保留 planned_time
- `apps/api/app/main.py` — 启动时 ALTER TABLE 迁移（幂等）
- `apps/desktop/src/api.ts` — PlanItem 类型加 planned_time
- `apps/desktop/src/main.tsx` — PlanPage 动态列表、首页 toggleItem/logHabit
- `apps/desktop/src/styles.css` — 12 个新 CSS 类

### Git 提交记录
- `99dd89d` feat: add planned_time to PlanItem with startup migration
- `82774a3` feat: planned_time in PlanPage dynamic list; homepage interactive task/habit

### 验证
```powershell
# 安装包路径
dir "E:\vs-workspace\daily-companion\apps\desktop\src-tauri\target\release\bundle\nsis\"
# 后端测试
cd apps\api && .\.venv\Scripts\python -m pytest -v   # 6/6
```

### 已知问题
- 老数据库里已有 plan_items 的 planned_time 默认为 NULL（正常）
- 安装包图标仍为占位 icon.ico，视觉上较简陋

---

## 2026-05-14 - Claude 交接（Tauri 桌面打包完成）

### 摘要
- 4 个并行/串行子 agent 完成 Tauri v2 桌面打包全流程
- Python 后端用 PyInstaller 打包为独立 sidecar（22.3 MiB）
- lib.rs 实现 sidecar 自动启动（注入 DC_DATA_DIR）和关窗口自动 kill
- 成功生成 Windows NSIS 安装包（24.5 MB，含内嵌 sidecar）
- MSI 格式跳过：WiX 3.x 不支持 CJK 产品名，改用 NSIS（支持 Unicode）

### 修改文件
- `apps/api/run_server.py` — PyInstaller 入口（新增）
- `apps/api/build.ps1` — PyInstaller 打包脚本（新增）
- `apps/desktop/src-tauri/Cargo.toml` — 添加 tauri-plugin-shell = "2"
- `apps/desktop/src-tauri/tauri.conf.json` — productName 改为"简伴"，externalBin sidecar，icon，targets=["nsis"]
- `apps/desktop/src-tauri/capabilities/default.json` — 精简权限（core:default + opener:default）
- `apps/desktop/src-tauri/src/lib.rs` — sidecar 启动/终止完整逻辑
- `apps/desktop/src-tauri/icons/icon.ico` — 最小有效 ICO（待替换为真实图标）
- `.gitignore` — 添加 apps/api/dist/ 和 binaries/*.exe 规则

### Git 提交记录
- `0f5e526` feat: configure Tauri v2 sidecar for api-server bundle
- `3378d31` feat: spawn and auto-kill api-server sidecar in Tauri setup
- `65705f5` feat: add PyInstaller entry point and build script for api-server sidecar
- `9ca049c` chore: add app icon and finalize Tauri desktop bundle build

### 验证方式
```powershell
# 安装包位置
dir "E:\vs-workspace\daily-companion\apps\desktop\src-tauri\target\release\bundle\nsis\"
# 双击安装后从开始菜单启动「简伴」，验证后端自动连接
```

### 已知问题 / 待处理
- `icons/icon.ico` 是最小占位文件（16x16 单色），发布前需替换为正式图标
- MSI 格式不可用（WiX + CJK 兼容问题），仅提供 NSIS 安装包
- `QQ_BOT_TARGET_ID` 仍未配置（与桌面打包无关，用户需给 bot 发消息取 sender_openid）
- 安装后需人工验证：窗口、后端连接、数据持久化、关窗口无残留进程

## 2026-05-13 - Claude 交接（项目初始化完成）

### 摘要
- 项目骨架已完整搭建并在本地验证通过
- 后端 pytest 6/6 通过，前端 npm run build 通过
- QQ bot 已接入 QQ 开放平台 v2 API（token 缓存 + 真实发送）
- webhook 支持挑战验证（HMAC-SHA256）和 C2C / 群消息事件解析
- 默认提醒（08:30 / 18:30 工作日）在启动时幂等写入
- 所有源文件已添加中文注释
- 所有 md 文档已转为中文

### 当前文件状态
- `apps/api/app/main.py` — 入口，lifespan 建表 + 默认提醒
- `apps/api/app/config.py` — .env 配置读取
- `apps/api/app/database.py` — SQLAlchemy 连接管理
- `apps/api/app/models.py` — 数据库表结构
- `apps/api/app/schemas.py` — Pydantic 校验模型
- `apps/api/app/services.py` — AI 调用、QQ 发消息、提醒调度
- `apps/api/app/routers/` — 6 个路由（health / plans / habits / reminders / ai / qq）
- `apps/desktop/src/main.tsx` — 全部前端页面
- `apps/desktop/src/api.ts` — 类型定义 + 请求函数
- `apps/api/.env` — 已配置 QQ 凭证，TARGET_ID 待填

### 验证方式
```powershell
cd apps\api
.\.venv\Scripts\python -m pytest -v   # 6/6 通过
```

### 待处理
- `QQ_BOT_TARGET_ID` 未配置：用户需给 bot 发一条消息，从 webhook 响应的 `sender_openid` 获取后填入 `.env`
- QQ 主动消息权限：需在 q.qq.com 后台确认已开启
- NAS 部署暂缓，先在本机跑通全流程
- Tauri 桌面壳暂缓，需要安装 Rust/Cargo
