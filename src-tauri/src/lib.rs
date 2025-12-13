mod clipboard;
mod monitor;
mod player;
mod recorder;

use monitor::start_monitor;
use parking_lot::Mutex;
use player::Player;
use recorder::{RecordedEvent, Recorder};
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command as StdCommand;
use std::sync::Arc;
use sysinfo::{Disks, Networks, System};
use tauri::Manager;

use encoding_rs::Encoding;

#[derive(Serialize, Deserialize)]
struct SystemInfo {
    os_name: String,
    os_version: String,
    kernel_version: String,
    hostname: String,
    architecture: String,
}

#[derive(Serialize, Deserialize)]
struct CpuInfo {
    cpu_count: usize,
    cpu_brand: String,
    cpu_frequency: u64,
}

#[derive(Serialize, Deserialize)]
struct MemoryInfo {
    total_memory: u64,
    used_memory: u64,
    available_memory: u64,
    total_swap: u64,
    used_swap: u64,
}

#[derive(Serialize, Deserialize)]
struct DiskInfo {
    name: String,
    mount_point: String,
    total_space: u64,
    available_space: u64,
    file_system: String,
}

#[derive(Serialize, Deserialize)]
struct NetworkInfo {
    interface_name: String,
    received_bytes: u64,
    transmitted_bytes: u64,
    received_packets: u64,
    transmitted_packets: u64,
}

#[derive(Serialize, Deserialize)]
struct ScrapedElement {
    text: String,
    html: String,
}

#[derive(Serialize, Deserialize)]
struct ScrapeResult {
    success: bool,
    data: Vec<ScrapedElement>,
    error: Option<String>,
}

// 录制器应用状态
pub struct RecorderState {
    recorder: Arc<Mutex<Recorder>>,
    player: Arc<Mutex<Player>>,
    events: Arc<Mutex<Vec<RecordedEvent>>>,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        architecture: std::env::consts::ARCH.to_string(),
    }
}

/// 启动本地应用程序（批量打开由前端循环调用该命令实现）
///
/// 为了避免 JS 侧 shell 插件 scope、URL 校验等限制，
/// 这里直接在 Rust 端使用 `cmd /C start` 启动指定路径的程序。
#[tauri::command]
fn launch_app(path: String) -> Result<(), String> {
    // 仅在 Windows 下使用 cmd /C start 启动程序
    #[cfg(target_os = "windows")]
    {
        StdCommand::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("failed to launch app: {}", e))?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("launch_app is only implemented for Windows".to_string())
    }
}

/// 打开应用所在文件夹（在资源管理器中选中该文件/快捷方式）
#[tauri::command]
fn open_app_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let p = Path::new(&path);
        if !p.exists() {
            return Err("path does not exist".to_string());
        }

        // 使用 explorer /select, PATH 高亮该文件（或快捷方式）所在的文件夹
        StdCommand::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("failed to open folder: {}", e))?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("open_app_folder is only implemented for Windows".to_string())
    }
}

#[tauri::command]
fn get_cpu_info() -> CpuInfo {
    let mut sys = System::new_all();
    sys.refresh_cpu_all();

    let cpus = sys.cpus();
    let cpu_count = cpus.len();
    let cpu_brand = if !cpus.is_empty() {
        cpus[0].brand().to_string()
    } else {
        "Unknown".to_string()
    };
    let cpu_frequency = if !cpus.is_empty() {
        cpus[0].frequency()
    } else {
        0
    };

    CpuInfo {
        cpu_count,
        cpu_brand,
        cpu_frequency,
    }
}

#[tauri::command]
fn get_memory_info() -> MemoryInfo {
    let mut sys = System::new_all();
    sys.refresh_memory();

    MemoryInfo {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        available_memory: sys.available_memory(),
        total_swap: sys.total_swap(),
        used_swap: sys.used_swap(),
    }
}

#[tauri::command]
fn get_disk_info() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();

    disks
        .iter()
        .map(|disk| DiskInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            file_system: disk.file_system().to_string_lossy().to_string(),
        })
        .collect()
}

#[tauri::command]
fn get_network_info() -> Vec<NetworkInfo> {
    let networks = Networks::new_with_refreshed_list();

    networks
        .iter()
        .map(|(interface_name, data)| NetworkInfo {
            interface_name: interface_name.clone(),
            received_bytes: data.total_received(),
            transmitted_bytes: data.total_transmitted(),
            received_packets: data.total_packets_received(),
            transmitted_packets: data.total_packets_transmitted(),
        })
        .collect()
}

#[tauri::command]
fn fetch_url(url: String) -> Result<String, String> {
    match reqwest::blocking::get(&url) {
        Ok(response) => match response.text() {
            Ok(html) => Ok(html),
            Err(e) => Err(format!("Failed to read response: {}", e)),
        },
        Err(e) => Err(format!("Failed to fetch URL: {}", e)),
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FetchDecodedRequest {
    url: String,
    headers: Option<std::collections::HashMap<String, String>>,
    timeout_ms: Option<u64>,
    proxy_url: Option<String>,
    accept_invalid_certs: Option<bool>,
}

fn sniff_charset_from_content_type(content_type: &str) -> Option<String> {
    let ct = content_type.to_lowercase();
    let idx = ct.find("charset=")?;
    let mut s = ct[idx + "charset=".len()..].trim().to_string();
    if let Some(semi) = s.find(';') {
        s = s[..semi].to_string();
    }
    s = s.trim_matches('"').trim_matches('\'').trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

fn sniff_charset_from_html_meta(head_latin1: &str) -> Option<String> {
    // Very small/fast sniff: handle <meta charset="gbk"> and http-equiv content-type
    let s = head_latin1;
    let lower = s.to_lowercase();
    if let Some(pos) = lower.find("charset") {
        let tail = &lower[pos..];
        if let Some(eq) = tail.find('=') {
            let mut v = tail[eq + 1..].trim().to_string();
            // strip leading quotes
            v = v.trim_start_matches('"').trim_start_matches('\'').to_string();
            // read until quote/space/>
            let end = v
                .find(|c: char| c == '"' || c == '\'' || c.is_whitespace() || c == '>' || c == ';')
                .unwrap_or(v.len());
            let cs = v[..end].trim().to_string();
            if !cs.is_empty() {
                return Some(cs);
            }
        }
    }
    None
}

fn normalize_charset_label(charset: &str) -> String {
    let c = charset.trim().to_lowercase();
    if c == "gbk" || c == "gb2312" || c == "gb-2312" {
        return "gb18030".to_string();
    }
    if c == "gb18030" {
        return "gb18030".to_string();
    }
    c
}

fn decode_bytes_with_charset(bytes: &[u8], charset: Option<&str>) -> String {
    if let Some(cs) = charset {
        let label = normalize_charset_label(cs);
        if let Some(enc) = Encoding::for_label(label.as_bytes()) {
            let (cow, _, _) = enc.decode(bytes);
            return cow.into_owned();
        }
    }
    // Fallback: try utf-8 first
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    // Fallback: gb18030
    if let Some(enc) = Encoding::for_label(b"gb18030") {
        let (cow, _, _) = enc.decode(bytes);
        return cow.into_owned();
    }
    String::new()
}

fn score_decoded_html(s: &str) -> (usize, usize, bool) {
    // (replacement_count, cjk_count, has_html_marker)
    let replacement = s.chars().filter(|c| *c == '\u{FFFD}').count();
    let cjk = s
        .chars()
        .filter(|c| matches!(*c, '\u{4E00}'..='\u{9FFF}'))
        .count();
    let lower = s.to_lowercase();
    let has_html = lower.contains("<html") || lower.contains("<!doctype") || lower.contains("<head") || lower.contains("<meta");
    (replacement, cjk, has_html)
}

fn choose_best_decoding(bytes: &[u8]) -> String {
    let utf8 = decode_bytes_with_charset(bytes, Some("utf-8"));
    let gb = decode_bytes_with_charset(bytes, Some("gb18030"));
    let big5 = decode_bytes_with_charset(bytes, Some("big5"));

    let (r1, c1, h1) = score_decoded_html(&utf8);
    let (r2, c2, h2) = score_decoded_html(&gb);
    let (r3, c3, h3) = score_decoded_html(&big5);

    // Choose best among candidates.
    // 1) Prefer a candidate that looks like HTML (has markers), if others don't.
    // 2) Prefer fewer replacement characters.
    // 3) Tie-breaker: more CJK characters.
    let mut best = (utf8, r1, c1, h1);

    for (s, r, c, h) in [(gb, r2, c2, h2), (big5, r3, c3, h3)] {
        let (_, br, bc, bh) = &best;
        if *bh && !h {
            continue;
        }
        if !*bh && h {
            best = (s, r, c, h);
            continue;
        }
        if r + 2 < *br {
            best = (s, r, c, h);
            continue;
        }
        if *br + 2 < r {
            continue;
        }
        if c > *bc {
            best = (s, r, c, h);
        }
    }

    best.0
}

fn should_fallback_to_heuristic(decoded: &str) -> bool {
    let (rep, _cjk, _h) = score_decoded_html(decoded);
    if decoded.is_empty() {
        return true;
    }
    // If there are lots of U+FFFD replacement chars, it's very likely wrong charset.
    // Use both absolute and relative thresholds.
    let len = decoded.chars().count().max(1);
    rep >= 40 || (rep as f64 / len as f64) > 0.008
}

#[tauri::command]
fn fetch_url_decoded(req: FetchDecodedRequest) -> Result<String, String> {
    let mut builder = reqwest::blocking::Client::builder();
    if let Some(ms) = req.timeout_ms {
        builder = builder.timeout(std::time::Duration::from_millis(ms));
    }
    if req.accept_invalid_certs.unwrap_or(false) {
        builder = builder.danger_accept_invalid_certs(true);
    }
    if let Some(p) = req.proxy_url.as_ref() {
        if !p.trim().is_empty() {
            builder = builder
                .proxy(reqwest::Proxy::all(p).map_err(|e| format!("invalid proxy: {e}"))?);
        }
    }

    let client = builder.build().map_err(|e| format!("failed to build client: {e}"))?;
    let mut request = client.get(&req.url);
    if let Some(hdrs) = req.headers.as_ref() {
        for (k, v) in hdrs {
            if k.trim().is_empty() { continue; }
            request = request.header(k, v);
        }
    }

    let resp = request.send().map_err(|e| format!("failed to fetch: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP Error: {}", status.as_u16()));
    }
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let bytes = resp.bytes().map_err(|e| format!("failed to read bytes: {e}"))?;
    let header_charset = sniff_charset_from_content_type(&content_type);
    if header_charset.is_some() {
        let s = decode_bytes_with_charset(&bytes, header_charset.as_deref());
        if should_fallback_to_heuristic(&s) {
            return Ok(choose_best_decoding(&bytes));
        }
        return Ok(s);
    }

    // sniff from html head (latin1)
    let head_len = std::cmp::min(4096, bytes.len());
    let head = &bytes[..head_len];
    let head_latin1: String = head.iter().map(|b| *b as char).collect();
    let meta_charset = sniff_charset_from_html_meta(&head_latin1);
    if meta_charset.is_some() {
        let s = decode_bytes_with_charset(&bytes, meta_charset.as_deref());
        if should_fallback_to_heuristic(&s) {
            return Ok(choose_best_decoding(&bytes));
        }
        return Ok(s);
    }

    // fallback heuristics (webview TextDecoder may not support gbk, so do it here)
    Ok(choose_best_decoding(&bytes))
}

#[tauri::command]
fn parse_html_by_selector(html: String, selector: String) -> ScrapeResult {
    let document = Html::parse_document(&html);

    match Selector::parse(&selector) {
        Ok(css_selector) => {
            let elements: Vec<ScrapedElement> = document
                .select(&css_selector)
                .map(|element| ScrapedElement {
                    text: element.text().collect::<String>(),
                    html: element.html(),
                })
                .collect();

            ScrapeResult {
                success: true,
                data: elements,
                error: None,
            }
        }
        Err(e) => ScrapeResult {
            success: false,
            data: Vec::new(),
            error: Some(format!("Invalid CSS selector: {:?}", e)),
        },
    }
}

#[tauri::command]
fn scrape_page(url: String, selector: String) -> ScrapeResult {
    match reqwest::blocking::get(&url) {
        Ok(response) => match response.text() {
            Ok(html) => parse_html_by_selector(html, selector),
            Err(e) => ScrapeResult {
                success: false,
                data: Vec::new(),
                error: Some(format!("Failed to read response: {}", e)),
            },
        },
        Err(e) => ScrapeResult {
            success: false,
            data: Vec::new(),
            error: Some(format!("Failed to fetch URL: {}", e)),
        },
    }
}

// ========== 录制器相关命令 ==========

#[tauri::command]
fn start_record(state: tauri::State<RecorderState>) -> Result<String, String> {
    let mut recorder = state.recorder.lock();
    if recorder.is_recording() {
        return Err("已经在录制中".to_string());
    }
    recorder.start_recording();
    Ok("开始录制".to_string())
}

#[tauri::command]
fn stop_record(state: tauri::State<RecorderState>) -> Result<Vec<RecordedEvent>, String> {
    let mut recorder = state.recorder.lock();
    if !recorder.is_recording() {
        return Err("当前没有在录制".to_string());
    }
    let events = recorder.stop_recording();
    *state.events.lock() = events.clone();
    Ok(events)
}

#[tauri::command]
fn play_record(state: tauri::State<RecorderState>, repeat_count: u32) -> Result<String, String> {
    let events = state.events.lock().clone();
    if events.is_empty() {
        return Err("没有可回放的事件".to_string());
    }

    let player = state.player.lock();
    player.play_events(events, repeat_count)?;
    Ok("开始回放".to_string())
}

#[tauri::command]
fn stop_play(state: tauri::State<RecorderState>) -> Result<String, String> {
    let player = state.player.lock();
    player.stop_playing();
    Ok("停止回放".to_string())
}

#[tauri::command]
fn get_recorder_status(state: tauri::State<RecorderState>) -> Result<serde_json::Value, String> {
    let recorder = state.recorder.lock();
    let player = state.player.lock();
    let events = state.events.lock();

    Ok(serde_json::json!({
        "is_recording": recorder.is_recording(),
        "is_playing": player.is_playing(),
        "event_count": events.len()
    }))
}

#[tauri::command]
fn get_recorded_events(state: tauri::State<RecorderState>) -> Result<Vec<RecordedEvent>, String> {
    let recorder = state.recorder.lock();
    let recorder_events = recorder.get_events();

    if !recorder_events.is_empty() {
        Ok(recorder_events)
    } else {
        Ok(state.events.lock().clone())
    }
}

#[tauri::command]
fn clear_recorded_events(state: tauri::State<RecorderState>) -> Result<String, String> {
    state.events.lock().clear();
    Ok("事件已清空".to_string())
}

#[tauri::command]
fn set_recorded_events(
    state: tauri::State<RecorderState>,
    events: Vec<RecordedEvent>,
) -> Result<String, String> {
    *state.events.lock() = events;
    Ok("事件已设置".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化录制器状态
    let recorder = Arc::new(Mutex::new(Recorder::new()));
    let player = Arc::new(Mutex::new(Player::new()));
    let events = Arc::new(Mutex::new(Vec::new()));

    let recorder_state = RecorderState {
        recorder: Arc::clone(&recorder),
        player: Arc::clone(&player),
        events: Arc::clone(&events),
    };

    // 启动全局输入监控
    start_monitor(Arc::clone(&recorder), Arc::clone(&player));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .manage(recorder_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 初始化 autostart 插件
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None, // 不传递额外参数
            ))?;

            // 检查静默启动配置
            #[cfg(desktop)]
            {
                use tauri::Manager;
                use tauri_plugin_store::StoreExt;

                if let Some(store) = app.handle().store("settings.json").ok() {
                    if let Some(silent_start) = store.get("silent_start") {
                        if silent_start.as_bool().unwrap_or(false) {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                    }
                }
            }

            // 创建系统托盘
            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::{TrayIconBuilder, TrayIconEvent};
                use tauri::Manager;

                let handle = app.handle();

                // 创建托盘菜单
                let show_item = MenuItem::with_id(handle, "show", "显示窗口", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(handle, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(handle, &[&show_item, &quit_item])?;

                // 创建托盘图标
                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("小茄的工具箱")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(move |app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        use tauri::tray::MouseButton;
                        match event {
                            TrayIconEvent::Click { button, .. } => {
                                // 只处理左键点击
                                if button == MouseButton::Left {
                                    let app = tray.app_handle();
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.unminimize();
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                                // 右键点击由系统自动显示菜单，不需要处理
                            }
                            TrayIconEvent::DoubleClick { button, .. } => {
                                if button == MouseButton::Left {
                                    let app = tray.app_handle();
                                    if let Some(window) = app.get_webview_window("main") {
                                        if window.is_visible().unwrap_or(false) {
                                            let _ = window.hide();
                                        } else {
                                            let _ = window.unminimize();
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_cpu_info,
            get_memory_info,
            get_disk_info,
            get_network_info,
            fetch_url,
            fetch_url_decoded,
            parse_html_by_selector,
            scrape_page,
            launch_app,
            open_app_folder,
            start_record,
            stop_record,
            play_record,
            stop_play,
            get_recorder_status,
            get_recorded_events,
            clear_recorded_events,
            set_recorded_events,
            clipboard::get_clipboard_text,
            clipboard::set_clipboard_text,
            clipboard::get_clipboard_image,
            clipboard::set_clipboard_image,
            clipboard::get_clipboard_content,
            clipboard::start_clipboard_monitor,
            clipboard::stop_clipboard_monitor
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            use tauri::Manager;

            // 拦截窗口关闭事件
            if let tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { api, .. },
                ..
            } = event
            {
                if label == "main" {
                    let window = app.get_webview_window(&label).unwrap();
                    // 阻止默认关闭行为
                    api.prevent_close();
                    // 隐藏窗口而不是关闭
                    let _ = window.hide();
                }
            }
        });
}
