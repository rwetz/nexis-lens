// ╔══════════════════════════════════════╗
// ║  Nexis Lens                          ║
// ║  Ryan Wetzstein · 2026               ║
// ╚══════════════════════════════════════╝
//
// The backend is deliberately thin: it reads files, lists directories and
// shells out to the git CLI. Everything about presentation, navigation and
// (later) gesture recognition lives in the webview, where the camera is.

pub mod fs;
pub mod git;

#[cfg(target_os = "linux")]
fn is_nvidia() -> bool {
    std::path::Path::new("/proc/driver/nvidia/version").exists()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // NVIDIA + Wayland: WebKitGTK's DMA-BUF renderer crashes at first paint.
    // Forcing Mesa's EGL is the only fix that stays stable *and* keeps window
    // alpha. See @nexis/design docs/PITFALLS.md §2.
    #[cfg(target_os = "linux")]
    if is_nvidia() && std::env::var_os("NEXIS_LENS_KEEP_HW_ACCEL").is_none() {
        const MESA: &str = "/usr/share/glvnd/egl_vendor.d/50_mesa.json";
        if std::env::var_os("__EGL_VENDOR_LIBRARY_FILENAMES").is_none()
            && std::path::Path::new(MESA).exists()
        {
            std::env::set_var("__EGL_VENDOR_LIBRARY_FILENAMES", MESA);
        } else if std::env::var_os("__EGL_VENDOR_LIBRARY_FILENAMES").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            fs::open_workspace,
            fs::list_dir,
            fs::read_text_file,
            git::git_repo_info,
            git::git_changes,
            git::git_diff,
            git::git_log,
            git::git_show,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nexis Lens");
}
