# Tauri Desktop Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Daily Companion 打包成单一 Windows 桌面 .exe，用户双击安装后无需手动启动任何终端。

**Architecture:** Tauri v2 作为窗口壳包裹 React 前端；Python FastAPI 后端用 PyInstaller `--onefile` 打成 `api-server.exe` sidecar；Tauri 启动时自动用 `tauri-plugin-shell` 拉起 sidecar，关窗口时自动终止。数据库存储路径通过环境变量 `DC_DATA_DIR` 注入，指向用户 `AppData\Roaming\daily-companion`，避免数据写入到 .exe 同目录。

**Tech Stack:** Tauri v2, tauri-plugin-shell v2, Rust stable, PyInstaller, React + Vite

---

## 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/api/app/database.py` | Modify | 支持 `DC_DATA_DIR` 环境变量覆盖数据库路径 |
| `apps/api/run_server.py` | Create | PyInstaller 打包入口（standalone uvicorn 启动） |
| `apps/api/build.ps1` | Create | PyInstaller 打包脚本 |
| `apps/desktop/src-tauri/Cargo.toml` | Modify | 添加 `tauri-plugin-shell = "2"` 依赖 |
| `apps/desktop/src-tauri/tauri.conf.json` | Modify | 更新标题、声明 externalBin sidecar |
| `apps/desktop/src-tauri/src/lib.rs` | Modify | sidecar 启动/终止逻辑 |
| `apps/desktop/src-tauri/capabilities/default.json` | Modify | 添加 shell sidecar 权限 |
| `apps/desktop/src-tauri/binaries/` | Create dir | 存放 api-server sidecar exe |

---

## Task 1：激活 Rust stable 工具链

**Files:**
- 无代码改动，仅环境配置

- [ ] **Step 1：设置 Rust stable 为默认工具链**

```powershell
rustup default stable
```

期望输出：`info: installing component 'rustc'` 等安装信息，最后 `info: default toolchain set to 'stable-x86_64-pc-windows-msvc'`。首次运行会下载约 200MB，需要几分钟。

- [ ] **Step 2：验证工具链可用**

```powershell
cargo --version
rustc --version
```

期望：`cargo 1.x.x` 和 `rustc 1.x.x` 各一行，无报错。

---

## Task 2：后端支持 DC_DATA_DIR 路径注入

**Files:**
- Modify: `apps/api/app/database.py`

当前 `database.py` 直接使用 `settings.database_url`，固定指向 `./data/daily_companion.db`（相对路径）。打包后的 .exe 运行在临时目录，相对路径会失效。改为：若环境变量 `DC_DATA_DIR` 存在，则将数据库存到该目录下；否则保持原来的相对路径（开发模式不受影响）。

- [ ] **Step 1：修改 database.py**

将 `apps/api/app/database.py` 中：

```python
settings = get_settings()
_ensure_sqlite_dir(settings.database_url)
engine = create_engine(settings.database_url, connect_args=_connect_args(settings.database_url))
```

替换为：

```python
import os as _os

settings = get_settings()

# 打包为桌面 .exe 时，Tauri 注入 DC_DATA_DIR 指向用户 AppData 目录
# 开发模式下不设置此变量，沿用 settings.database_url（相对路径）
_dc_data_dir = _os.environ.get("DC_DATA_DIR")
if _dc_data_dir:
    _db_file = Path(_dc_data_dir) / "daily_companion.db"
    _db_file.parent.mkdir(parents=True, exist_ok=True)
    _effective_url = f"sqlite:///{_db_file}"
else:
    _effective_url = settings.database_url

_ensure_sqlite_dir(_effective_url)
engine = create_engine(_effective_url, connect_args=_connect_args(_effective_url))
```

- [ ] **Step 2：验证开发模式不受影响**

```powershell
cd apps\api
.\.venv\Scripts\python -m pytest tests/ -v
```

期望：所有测试仍通过（6/6）。

- [ ] **Step 3：Commit**

```powershell
git add apps/api/app/database.py
git commit -m "feat: support DC_DATA_DIR env var for packaged desktop database path"
```

---

## Task 3：PyInstaller 打包后端

**Files:**
- Create: `apps/api/run_server.py`
- Create: `apps/api/build.ps1`

- [ ] **Step 1：安装 PyInstaller**

```powershell
cd apps\api
.\.venv\Scripts\pip install pyinstaller
```

期望：`Successfully installed pyinstaller-x.x.x`

- [ ] **Step 2：创建 PyInstaller 启动入口**

创建 `apps/api/run_server.py`：

```python
import os
import sys

# 当 PyInstaller 以 --onefile 打包时，临时解压目录会加入 sys.path
# 这里确保 app 包能被正确 import
if getattr(sys, "frozen", False):
    sys.path.insert(0, sys._MEIPASS)  # noqa: SLF001

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("API_PORT", "8710"))
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        log_level="warning",
    )
```

- [ ] **Step 3：创建 PyInstaller 打包脚本**

创建 `apps/api/build.ps1`：

```powershell
# PyInstaller 打包脚本：将 FastAPI 后端打包为单文件 api-server.exe
# 运行前确保在 apps/api 目录下，且 .venv 已激活
# 输出：dist/api-server.exe

Set-Location $PSScriptRoot

.\.venv\Scripts\pyinstaller `
    --onefile `
    --name api-server `
    --noconfirm `
    --hidden-import uvicorn.logging `
    --hidden-import uvicorn.loops `
    --hidden-import uvicorn.loops.auto `
    --hidden-import uvicorn.protocols `
    --hidden-import uvicorn.protocols.http `
    --hidden-import uvicorn.protocols.http.auto `
    --hidden-import uvicorn.protocols.http.httptools_impl `
    --hidden-import uvicorn.protocols.http.h11_impl `
    --hidden-import uvicorn.protocols.websockets `
    --hidden-import uvicorn.protocols.websockets.auto `
    --hidden-import uvicorn.lifespan `
    --hidden-import uvicorn.lifespan.on `
    --hidden-import sqlalchemy.dialects.sqlite `
    --hidden-import sqlalchemy.dialects.sqlite.pysqlite `
    --hidden-import apscheduler.jobstores.memory `
    --hidden-import apscheduler.executors.pool `
    --collect-all app `
    run_server.py

Write-Host "Build complete: dist/api-server.exe"
```

- [ ] **Step 4：执行打包**

```powershell
cd apps\api
.\build.ps1
```

期望：打包过程约 1-3 分钟，最终输出 `dist/api-server.exe`，无 ERROR 级别报错（WARNING 可忽略）。

- [ ] **Step 5：验证 sidecar exe 能独立运行**

在新 PowerShell 窗口（不激活 venv）：

```powershell
$env:DC_DATA_DIR = "$env:TEMP\dc-test"
E:\vs-workspace\daily-companion\apps\api\dist\api-server.exe
```

然后在另一个窗口：

```powershell
Invoke-RestMethod http://127.0.0.1:8710/health
```

期望：返回 `{"status":"ok"}`。验证后 `Ctrl+C` 停止。

- [ ] **Step 6：复制到 Tauri binaries 目录**

```powershell
New-Item -ItemType Directory -Force "E:\vs-workspace\daily-companion\apps\desktop\src-tauri\binaries"
Copy-Item `
    "E:\vs-workspace\daily-companion\apps\api\dist\api-server.exe" `
    "E:\vs-workspace\daily-companion\apps\desktop\src-tauri\binaries\api-server-x86_64-pc-windows-msvc.exe"
```

期望：文件存在于 `apps/desktop/src-tauri/binaries/api-server-x86_64-pc-windows-msvc.exe`。

- [ ] **Step 7：Commit**

```powershell
cd E:\vs-workspace\daily-companion
git add apps/api/run_server.py apps/api/build.ps1
git commit -m "feat: add PyInstaller entry point and build script for api-server sidecar"
```

（不 commit `dist/` 目录和 `binaries/*.exe`，它们应已在 .gitignore 中。）

---

## Task 4：更新 Tauri 配置与 Cargo.toml

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/capabilities/default.json`

- [ ] **Step 1：更新 Cargo.toml**

将 `apps/desktop/src-tauri/Cargo.toml` 的 `[dependencies]` 部分改为：

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2：更新 tauri.conf.json**

将 `apps/desktop/src-tauri/tauri.conf.json` 完整替换为：

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "简伴",
  "version": "0.1.0",
  "identifier": "com.daily-companion.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "简伴 Daily Companion",
        "label": "main",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 640
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [],
    "externalBin": [
      "binaries/api-server"
    ]
  }
}
```

- [ ] **Step 3：更新 capabilities/default.json**

读取现有文件 `apps/desktop/src-tauri/capabilities/default.json`，将其内容替换为：

```json
{
  "identifier": "default",
  "description": "Default capability for Daily Companion",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```

> 注意：sidecar 完全由 Rust 代码管理（`app.shell().sidecar()`），不通过 JS IPC，因此无需在 capabilities 里声明 shell 权限。

- [ ] **Step 4：Commit**

```powershell
cd E:\vs-workspace\daily-companion
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/capabilities/default.json
git commit -m "feat: configure Tauri v2 sidecar for api-server bundle"
```

---

## Task 5：实现 sidecar 启动/终止逻辑

**Files:**
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1：重写 lib.rs**

将 `apps/desktop/src-tauri/src/lib.rs` 完整替换为：

```rust
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::{process::CommandChild, ShellExt};

pub struct ApiServer(pub Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 获取用户数据目录：%APPDATA%\com.daily-companion.app
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");

            // 启动后端 sidecar，注入数据库路径
            let (_rx, child) = app
                .shell()
                .sidecar("api-server")
                .expect("api-server sidecar not found in bundle")
                .env("DC_DATA_DIR", data_dir.to_string_lossy().as_ref())
                .spawn()
                .expect("failed to spawn api-server");

            app.manage(ApiServer(Mutex::new(Some(child))));
            Ok(())
        })
        .on_window_event(|window, event| {
            // 主窗口关闭时终止后端进程，防止 api-server.exe 成为僵尸进程
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.app_handle().try_state::<ApiServer>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Daily Companion");
}
```

- [ ] **Step 2：在 apps/desktop 目录做 cargo check 预检**

```powershell
cd E:\vs-workspace\daily-companion\apps\desktop\src-tauri
cargo check
```

期望：`Finished` 无 error（首次运行会下载 crates，需要几分钟；warning 可忽略）。

- [ ] **Step 3：Commit**

```powershell
cd E:\vs-workspace\daily-companion
git add apps/desktop/src-tauri/src/lib.rs
git commit -m "feat: spawn and auto-kill api-server sidecar in Tauri setup"
```

---

## Task 6：完整构建与安装测试

**Files:**
- 无新文件，验证整体 build 流程

- [ ] **Step 1：确认 sidecar exe 已在正确位置**

```powershell
Test-Path "E:\vs-workspace\daily-companion\apps\desktop\src-tauri\binaries\api-server-x86_64-pc-windows-msvc.exe"
```

期望：`True`。若为 `False`，重新执行 Task 3 Step 6。

- [ ] **Step 2：执行 Tauri build**

```powershell
cd E:\vs-workspace\daily-companion\apps\desktop
npm run tauri:build
```

首次构建需要编译 Rust，约 5-15 分钟。期望最终输出：
```
    Finished 2 bundles at:
        E:\vs-workspace\daily-companion\apps\desktop\src-tauri\target\release\bundle\msi\简伴_0.1.0_x64_en-US.msi
        E:\vs-workspace\daily-companion\apps\desktop\src-tauri\target\release\bundle\nsis\简伴_0.1.0_x64-setup.exe
```

常见失败处理：
- **`api-server sidecar not found`**：检查 binaries 目录文件名，必须精确匹配 `api-server-x86_64-pc-windows-msvc.exe`
- **`shell:allow-spawn` permission error**：检查 capabilities/default.json 格式
- **Rust compile error**：按报错信息修复 lib.rs 类型问题

- [ ] **Step 3：安装并测试**

双击 `src-tauri/target/release/bundle/nsis/简伴_0.1.0_x64-setup.exe` 安装。

安装后从开始菜单或桌面图标启动「简伴」：
- [ ] 窗口正常打开（无黑屏、无崩溃）
- [ ] 状态栏显示「后端已连接」（约 3-5 秒后）
- [ ] 首页 Dashboard 正常渲染
- [ ] 添加一条计划并勾选，数据持久化
- [ ] 关闭窗口后在任务管理器确认无残留 `api-server.exe` 进程

- [ ] **Step 4：确认数据目录**

```powershell
Test-Path "$env:APPDATA\com.daily-companion.app\daily_companion.db"
```

期望：`True`（数据库已在用户 AppData 目录创建）。

- [ ] **Step 5：最终 Commit**

```powershell
cd E:\vs-workspace\daily-companion
git add apps/desktop/src-tauri/binaries/.gitkeep 2>$null; true
git commit -m "chore: finalize Tauri desktop bundle build and verify" --allow-empty
```
