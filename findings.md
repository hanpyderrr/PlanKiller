# Findings

更新时间：2026-05-14

## 仓库状态

- `E:\vs-workspace` 不是 git 仓库；主开发项目是 `daily-companion`。
- `stock-analysis` 是干净 git 仓库，当前无未提交改动。
- `quant-research` 当前仅看到 `.venv`，不是 git 仓库。

## Daily Companion 发现

- 当前分支：`master`。
- 最近提交已包含：
  - Tauri sidecar/NSIS 桌面打包。
  - `PlanItem` 时间字段从单点时间演进到 `start_time`/`end_time`。
  - 首页任务/习惯快捷交互。
  - 习惯日志撤销。
- 当前未提交改动包括：
  - `.env.example`、`config.py` 默认 OpenAI 模型改为 `gpt-4o-mini`。
  - QQ webhook challenge、C2C/群消息解析、真实 QQ 主动发送。
  - 默认提醒种子逻辑和测试。
  - Tauri CLI 脚本依赖。
  - Docker Compose `env_file.required=false` 和中文文档。
- 未跟踪文件包括交接/审查文档、PyInstaller spec/build 产物、Tauri gen/Cargo.lock、UI 设计计划和 mockup。

## 验证结果

- `apps/api`: `.\.venv\Scripts\python -m pytest -v` 通过，6 passed。
- `apps/desktop`: `npm run build` 通过，Vite 成功生成 `dist/`。
