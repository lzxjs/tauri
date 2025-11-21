use serde::{Deserialize, Serialize};
use sysinfo::{System, Disks};

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

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let sys = System::new_all();
    
    SystemInfo {
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        architecture: std::env::consts::ARCH.to_string(),
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_system_info,
      get_cpu_info,
      get_memory_info,
      get_disk_info
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
