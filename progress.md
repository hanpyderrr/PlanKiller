# Progress

## 2026-05-26

- 已将 `plankiller` 复制到 `E:\vs-workspace\plankiller`，并上传到 GitHub：
  - `https://github.com/hanpyderrr/PlanKiller.git`
  - 初始提交：`37bb0d8 chore: initial PlanKiller import`
- 为本机 PC 开发版启动完成依赖准备：
  - 后端：在 `apps/api` 下创建 `.venv`。
  - 后端依赖：使用 `.venv\Scripts\python -m pip install -r requirements.txt` 安装完成。
  - 前端：`apps/desktop/node_modules` 已存在，可直接运行 `npm run dev`。
- 已启动本机服务并验证：
  - 后端 API：`http://127.0.0.1:8710`
  - 前端 PC 界面：`http://127.0.0.1:5173`
  - `/health` 返回 `status: ok`
  - 前端首页 HTTP 状态码 `200`
- 手动打开方式：
  - 后端：
    ```powershell
    cd E:\vs-workspace\plankiller\apps\api
    .\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8710
    ```
  - 前端：
    ```powershell
    cd E:\vs-workspace\plankiller\apps\desktop
    npm run dev
    ```
  - 浏览器访问：`http://127.0.0.1:5173`
- 备注：
  - 当前是浏览器/Vite 开发版，不是 Tauri 安装版。
  - `.venv`、`node_modules`、`dist`、`data/` 均应保持忽略，不提交。
  - 真正桌面安装包仍需重建 PyInstaller sidecar 和 Tauri NSIS 包。

## 2026-05-14

- 查看 `E:\vs-workspace`，确认根目录不是 git 仓库。
- 识别三个项目：
  - `daily-companion`：主开发项目，有大量未提交改动。
  - `stock-analysis`：git 状态干净。
  - `quant-research`：仅有 `.venv`，非 git 仓库。
- 读取 `daily-companion/AI_HANDOFF.md`、`AI_REVIEW.md`、README 和 UI 重设计计划。
- 检查 `daily-companion` 最近提交、当前 diff 和未跟踪文件。
- 运行验证：
  - 后端测试：6/6 通过。
  - 前端构建：通过。
- 创建 `task_plan.md`、`findings.md`、`progress.md`，记录当前进展和后续计划。
- 根据用户反馈更新 `task_plan.md`：
  - 高优先级加入习惯编辑/删除/排序/emoji、计划页自动保存和优先级展示、数据持久化路径提示。
  - 中优先级加入历史周报往周查看、真实连续打卡天数、提醒管理 UI、复盘保存反馈。
  - 低优先级加入应用图标、设置页深色模式/字体大小。
  - 将提醒系统通知拆为后续研究项，先完成桌面端提醒管理 UI。
- 完成一次代码审查并写入 `AI_REVIEW.md`：
  - 后端测试 7/7 通过。
  - 前端构建通过。
  - 主要发现：前端 UTC 日期、周报 skip 计入完成率、连续打卡文案错误、习惯排序 position 初始值问题、`/info` 路径信息不足、后端业务日期未统一时区。
- 确认桌面启动时弹出终端窗口的原因：
  - `apps/api/api-server.spec` 中 `console=True`。
  - `apps/api/build.ps1` 使用 PyInstaller `--onefile`，未设置 `--windowed/--noconsole`。
  - 已将“无控制台 sidecar 打包 + 文件日志 + 重建安装包”加入 `task_plan.md` 的 P0 发布收尾。
