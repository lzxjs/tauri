use arboard::{Clipboard, ImageData};
use base64::{engine::general_purpose, Engine as _};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use serde::Serialize;

// 全局剪贴板监听状态
static CLIPBOARD_MONITOR_RUNNING: Mutex<bool> = Mutex::new(false);
// 全局剪贴板访问锁 (避免多线程竞争导致 os error 1418)
static CLIPBOARD_LOCK: Mutex<()> = Mutex::new(());

// 剪贴板内容类型
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum ClipboardContent {
    Text(String),
    Image(String), // Base64 编码的图片
}

/// 获取当前剪贴板文本内容
#[tauri::command]
pub fn get_clipboard_text() -> Result<String, String> {
    let _lock = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    let mut clipboard = Clipboard::new().map_err(|e| format!("无法访问剪贴板: {}", e))?;

    clipboard
        .get_text()
        .map_err(|e| format!("读取剪贴板失败: {}", e))
}

/// 获取当前剪贴板图片内容（Base64编码）
#[tauri::command]
pub fn get_clipboard_image() -> Result<String, String> {
    let _lock = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    let mut clipboard = Clipboard::new().map_err(|e| format!("无法访问剪贴板: {}", e))?;

    let image = clipboard
        .get_image()
        .map_err(|e| format!("读取剪贴板图片失败: {}", e))?;

    // 转换为 RGBA 字节数组
    let width = image.width;
    let height = image.height;
    let bytes = image.bytes.into_owned();

    // 简单的 PNG 编码（使用 image crate 会更好，但这里先用简单方案）
    // 将 RGBA 数据编码为 Base64
    let base64_data = general_purpose::STANDARD.encode(&bytes);

    // 返回格式：width,height,base64data
    Ok(format!("{},{},{}", width, height, base64_data))
}

/// 获取当前剪贴板内容（自动检测类型）
#[tauri::command]
pub fn get_clipboard_content() -> Result<ClipboardContent, String> {
    let _lock = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    let mut clipboard = Clipboard::new().map_err(|e| format!("无法访问剪贴板: {}", e))?;

    // 优先尝试获取图片
    if let Ok(image) = clipboard.get_image() {
        let width = image.width;
        let height = image.height;
        let bytes = image.bytes.into_owned();
        let base64_data = general_purpose::STANDARD.encode(&bytes);
        let image_data = format!("{},{},{}", width, height, base64_data);
        return Ok(ClipboardContent::Image(image_data));
    }

    // 如果没有图片，尝试获取文本
    if let Ok(text) = clipboard.get_text() {
        return Ok(ClipboardContent::Text(text));
    }

    Err("剪贴板为空或不支持的类型".to_string())
}

/// 设置剪贴板文本内容
#[tauri::command]
pub fn set_clipboard_text(text: String) -> Result<(), String> {
    let _lock = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    let mut last_error = String::new();

    // 重试机制 (解决 os error 1418)
    for _ in 0..5 {
        let mut clipboard = match Clipboard::new() {
            Ok(c) => c,
            Err(e) => {
                last_error = format!("无法访问剪贴板: {}", e);
                thread::sleep(Duration::from_millis(100));
                continue;
            }
        };

        match clipboard.set_text(text.clone()) {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_error = format!("设置剪贴板失败: {}", e);
                thread::sleep(Duration::from_millis(100));
            }
        }
    }

    Err(last_error)
}

/// 设置剪贴板图片内容（从Base64）
#[tauri::command]
pub fn set_clipboard_image(image_data: String) -> Result<(), String> {
    let _lock = CLIPBOARD_LOCK.lock().map_err(|e| e.to_string())?;
    // 解析格式：width,height,base64data
    let parts: Vec<&str> = image_data.splitn(3, ',').collect();
    if parts.len() != 3 {
        return Err("图片数据格式错误".to_string());
    }

    let width: usize = parts[0].parse().map_err(|_| "宽度解析失败")?;
    let height: usize = parts[1].parse().map_err(|_| "高度解析失败")?;
    let bytes = general_purpose::STANDARD
        .decode(parts[2])
        .map_err(|e| format!("Base64解码失败: {}", e))?;

    // ImageData 中的 bytes 是 Cow<'a, [u8]>，我们需要在这里拥有它以便重试时克隆
    // 但 ImageData 自身不容易深拷贝（arboard::ImageData 字段是 pub 的但 bytes 是 Cow）
    // 所以我们每次重试都构建一个新的 ImageData
    let bytes_vec = bytes;

    let mut last_error = String::new();

    // 重试机制
    for _ in 0..5 {
        let mut clipboard = match Clipboard::new() {
            Ok(c) => c,
            Err(e) => {
                last_error = format!("无法访问剪贴板: {}", e);
                thread::sleep(Duration::from_millis(100));
                continue;
            }
        };

        let image = ImageData {
            width,
            height,
            bytes: std::borrow::Cow::Borrowed(&bytes_vec),
        };

        match clipboard.set_image(image) {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_error = format!("设置剪贴板图片失败: {}", e);
                thread::sleep(Duration::from_millis(100));
            }
        }
    }

    Err(last_error)
}

/// 启动剪贴板监听服务
#[tauri::command]
pub fn start_clipboard_monitor(app: AppHandle) -> Result<(), String> {
    let mut running = CLIPBOARD_MONITOR_RUNNING
        .lock()
        .map_err(|e| format!("锁定失败: {}", e))?;

    if *running {
        return Ok(()); // 已经在运行
    }

    *running = true;
    drop(running); // 释放锁

    // 在新线程中运行监听服务
    thread::spawn(move || {
        let mut clipboard = match Clipboard::new() {
            Ok(cb) => cb,
            Err(e) => {
                eprintln!("创建剪贴板实例失败: {}", e);
                return;
            }
        };

        let mut last_text_content = String::new();
        let mut last_image_hash: Option<u64> = None;

        loop {
            // 检查是否应该停止
            {
                let running = CLIPBOARD_MONITOR_RUNNING.lock().unwrap();
                if !*running {
                    break;
                }
            }

            // 使用作用域来控制锁的生命周期
            {
                let _lock = match CLIPBOARD_LOCK.lock() {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("获取剪贴板锁失败: {}", e);
                        thread::sleep(Duration::from_millis(500));
                        continue;
                    }
                };

                // 优先检查图片
                if let Ok(image) = clipboard.get_image() {
                    // 计算图片简单哈希（避免重复）
                    let image_hash = calculate_image_hash(&image);

                    if last_image_hash != Some(image_hash) {
                        let width = image.width;
                        let height = image.height;
                        let bytes = image.bytes.into_owned();
                        let base64_data = general_purpose::STANDARD.encode(&bytes);
                        let image_data = format!("{},{},{}", width, height, base64_data);

                        let content = ClipboardContent::Image(image_data);

                        // 发送事件到前端
                        if let Err(e) = app.emit("clipboard-changed", &content) {
                            eprintln!("发送剪贴板事件失败: {}", e);
                        }

                        last_image_hash = Some(image_hash);
                        last_text_content.clear(); // 清空文本缓存
                    }
                }
                // 如果没有图片，检查文本
                else if let Ok(current_content) = clipboard.get_text() {
                    // 如果内容发生变化且不为空
                    if !current_content.is_empty() && current_content != last_text_content {
                        let content = ClipboardContent::Text(current_content.clone());

                        // 发送事件到前端
                        if let Err(e) = app.emit("clipboard-changed", &content) {
                            eprintln!("发送剪贴板事件失败: {}", e);
                        }

                        last_text_content = current_content;
                        last_image_hash = None; // 清空图片缓存
                    }
                }
            } // 锁在这里释放

            // 每500ms检查一次
            thread::sleep(Duration::from_millis(500));
        }

        println!("剪贴板监听服务已停止");
    });

    Ok(())
}

/// 停止剪贴板监听服务
#[tauri::command]
pub fn stop_clipboard_monitor() -> Result<(), String> {
    let mut running = CLIPBOARD_MONITOR_RUNNING
        .lock()
        .map_err(|e| format!("锁定失败: {}", e))?;

    *running = false;
    Ok(())
}

// 计算图片简单哈希（用于检测重复）
fn calculate_image_hash(image: &ImageData) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    image.width.hash(&mut hasher);
    image.height.hash(&mut hasher);

    // 只哈希前1000字节以提高性能
    let sample_size = image.bytes.len().min(1000);
    image.bytes[..sample_size].hash(&mut hasher);

    hasher.finish()
}
