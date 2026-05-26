# PyInstaller 打包脚本：将 FastAPI 后端打包为单文件 api-server.exe
# 运行前确保在 apps/api 目录下，且 .venv 已激活
# 输出：dist/api-server.exe

Set-Location $PSScriptRoot

.\.venv\Scripts\pyinstaller `
    --onefile `
    --noconsole `
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
