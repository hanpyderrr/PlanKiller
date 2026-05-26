# AI_REVIEW.md

Codex 审查记录、验证结果和遗留风险，最新条目在最上方。

---

## 2026-05-25 - Codex Review

### 发现问题
- [x] FIXED - 高：`apps/api/tests/test_api.py` - 后端测试原本会使用运行库，可能污染本机数据。已改为 `data/test_plankiller.db`，测试启动前删除旧测试库。
- [x] FIXED - 高：`apps/api/app/routers/reminders.py` - QQ 回复解析只覆盖旧字符串，不支持真实中文 `完成/跳过/延后10` 和原因。已改为真实中文解析并保留原因。
- [x] FIXED - 中：`apps/api/app/services.py` - 周报只返回基础完成率，缺少趋势分析。已返回 repeated_blockers、skipped_habits、unfinished_categories、energy_completion_notes 和 narrative。
- [x] FIXED - 中：`apps/api/app/services.py` - 提醒发送缺少上下文。已加入习惯最近 7 天完成/跳过次数、今日高优先级未完成任务和复盘阻碍。

### 验证结果
- `E:\codex-workspace\daily-companion\apps\api\.venv\Scripts\python.exe -m pytest`（在 `E:\codex-workspace\plankiller\apps\api` 下运行）- 8 passed
- `npm run build`（在 `E:\codex-workspace\plankiller\apps\desktop` 下运行）- passed

### 遗留风险
- 尚未验证 Tauri `npm run tauri:build`，需要 Rust/Cargo、PyInstaller sidecar 重新构建。
- 尚未启动本机完整端到端流程测试；下一步应启动 API + 前端，并用浏览器实测新增记忆页。
- `AGENTS.md` 和历史 docs 仍包含旧项目历史，运行不受影响，后续可以清理。

---

## Review 模板

```markdown
## YYYY-MM-DD HH:mm - Codex Review

### 发现问题
- [ ] OPEN - 严重程度: `file:line` - 问题描述、影响、建议修复方式
- [x] FIXED - 严重程度: `file:line` - 已修复的问题

### 验证结果
- `命令` — 结果

### 遗留风险
- 未验证的内容，或因缺少本地工具无法验证的内容
```

---

## 2026-05-14 - Codex Review

### 发现问题

- [ ] OPEN - 高：`apps/desktop/src/main.tsx:8` - 前端用 `new Date().toISOString().slice(0, 10)` 计算今天，得到的是 UTC 日期。中国时区 00:00-07:59 会落到前一天，导致今日计划、今日习惯打卡、复盘写入错误日期。应改为本地日期格式化函数，或由后端 `/info` 返回服务端当前日期。
- [ ] OPEN - 高：`apps/api/app/services.py:223` - 周报习惯完成率统计了所有 HabitLog，包括 `skip`。用户点“跳过”也会提高 `habit_completion_rate` 和 `habit_logs`，数据语义错误。应只统计 `status == "done"`，并单独返回 skipped 数量。
- [ ] OPEN - 中：`apps/desktop/src/main.tsx:219` - 首页仍显示“连续打卡 N 天”，但 N 来自 `report.habit_logs`，实际是本周打卡记录数，不是真正连续天数。应先改成“本周打卡 N 次”，再增加真实 streak 计算。
- [ ] OPEN - 中：`apps/desktop/src/main.tsx:725` - 习惯排序通过交换两个习惯的 `position` 实现，但新建习惯默认 position 都是 0，首次排序时交换 0 和 0 没有效果。应在前端重排后写入连续位置 0..n-1，或后端创建时自动分配最大 position + 1。
- [ ] OPEN - 中：`apps/api/app/routers/health.py:13` - `/info` 只返回 `DC_DATA_DIR`，开发模式或 NAS 部署时为空，设置页会提示“由 DC_DATA_DIR 决定”，但实际数据库可能在 `./data/daily_companion.db`。应返回有效数据目录、数据库文件路径和运行模式。
- [ ] OPEN - 中：`apps/api/app/routers/habits.py:39`、`apps/api/app/routers/ai.py:36`、`apps/api/app/services.py:17` - 后端多处使用 `date.today()`，没有按 `Settings.timezone` 计算业务日期。部署在 UTC 环境或 NAS 时，今日状态、周报、AI 上下文可能跨日错位。应封装 `today_in_timezone()` 统一使用。
- [ ] OPEN - 低：`apps/api/app/schemas.py:25` - `PlanItemUpdate` 不支持 `start_time/end_time/position` 局部更新；当前前端只用它勾选完成，所以暂不影响主流程，但后续做自动保存单任务时会受限。

### 验证结果

- `cd apps\api; .\.venv\Scripts\python -m pytest -v` — 7 passed。
- `cd apps\desktop; npm run build` — 通过，Vite 成功生成生产构建。

### 建议改进顺序

1. 先修日期/时区问题：前端本地日期、后端业务日期统一，避免数据写错天。
2. 修周报统计语义：done/skip 分开统计，首页文案先从“连续打卡”改为“本周打卡”。
3. 修习惯排序：创建时分配 position，重排时写连续序号。
4. 补 `/info` 返回真实数据目录和数据库路径，设置页按返回值展示。
5. 再做往周周报、提醒 UI、系统通知等产品功能。
