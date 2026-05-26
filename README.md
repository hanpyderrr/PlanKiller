# PlanKiller

个人日常管理工具：每日计划、复盘、习惯打卡、定时提醒、QQ bot 通知、AI 陪伴监督。

## 目录结构

- `apps/api` — FastAPI 后端，SQLite 存储，提醒调度，QQ / OpenAI 接入
- `apps/desktop` — React 前端，Vite 开发服务器，Tauri 桌面壳（待 Rust 安装后启用）
- `infra` — Docker Compose 和部署脚本
- `docs` — 开发流程和 NAS 部署说明

## 快速启动

**后端：**
```powershell
cd apps\api
.\.venv\Scripts\uvicorn app.main:app --reload --port 8710
```

**前端（浏览器访问 http://localhost:5173）：**
```powershell
cd apps\desktop
npm run dev
```

**测试：**
```powershell
cd apps\api
.\.venv\Scripts\python -m pytest -v
```

**Tauri 桌面壳**（需先安装 Rust/Cargo）：
```powershell
cd apps\desktop
npm run tauri:dev
```
