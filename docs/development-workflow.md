# 开发流程

1. 在 `E:\vs-workspace\daily-companion` 本地开发、测试
2. 每个验证通过的步骤提交一次 commit
3. 将项目同步到 NAS：`ding@192.168.31.26`
4. 在 NAS 上运行 Docker Compose
5. 桌面前端的 API 地址切换到 `http://192.168.31.26:8710`

## 验证命令

**后端测试：**
```powershell
cd apps\api
.\.venv\Scripts\python -m pytest
```

**前端构建：**
```powershell
cd apps\desktop
npm install
npm run build
```

**Tauri 桌面壳**（需先安装 Rust/Cargo）：
```powershell
cd apps\desktop
npm run tauri:dev
```
