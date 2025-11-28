use serde::{Deserialize, Serialize};
use sysinfo::{System, Disks};
use scraper::{Html, Selector};
use std::process::Command as StdCommand;
use std::path::Path;

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
    
    disks.iter().map(|disk| {
        DiskInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            file_system: disk.file_system().to_string_lossy().to_string(),
        }
    }).collect()
}

#[tauri::command]
fn fetch_url(url: String) -> Result<String, String> {
    match reqwest::blocking::get(&url) {
        Ok(response) => {
            match response.text() {
                Ok(html) => Ok(html),
                Err(e) => Err(format!("Failed to read response: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to fetch URL: {}", e)),
    }
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
        Ok(response) => {
            match response.text() {
                Ok(html) => parse_html_by_selector(html, selector),
                Err(e) => ScrapeResult {
                    success: false,
                    data: Vec::new(),
                    error: Some(format!("Failed to read response: {}", e)),
                },
            }
        }
        Err(e) => ScrapeResult {
            success: false,
            data: Vec::new(),
            error: Some(format!("Failed to fetch URL: {}", e)),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
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
      
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_system_info,
      get_cpu_info,
      get_memory_info,
      get_disk_info,
      fetch_url,
      parse_html_by_selector,
      scrape_page,
      launch_app,
      open_app_folder
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
