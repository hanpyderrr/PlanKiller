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
            // 获取用户数据目录：%APPDATA%\com.plankiller.app
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
        .expect("error while running PlanKiller");
}
