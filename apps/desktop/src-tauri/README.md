# Tauri wrapper

This directory contains the Tauri v2 desktop wrapper for the React client.

Rust/Cargo is not installed on this Windows machine yet. After installing Rust and the platform prerequisites, run:

```powershell
cd apps\desktop
npm install
npm run tauri:dev
```

Keep the API URL configurable in the app settings so the packaged Windows client can connect to `http://192.168.31.26:8710`.
