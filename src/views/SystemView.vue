<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { message } from "ant-design-vue";
import {
  DatabaseOutlined,
  HddOutlined,
  CloudServerOutlined,
  WifiOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons-vue";

const loading = ref(true);
const systemInfo = ref(null);
const cpuInfo = ref(null);
const memoryInfo = ref(null);
const diskInfo = ref([]);
const networkSpeed = ref({ upload: 0, download: 0 });

let timer = null;
let lastNetworkData = null;

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
};

const formatSpeed = (bytesPerSecond) => {
  if (bytesPerSecond === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  return (bytesPerSecond / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
};

const fetchAllInfo = async (isInitial = false) => {
  if (isInitial) {
    loading.value = true;
  }
  try {
    const [sysInfo, cpu, memory, disks, network] = await Promise.all([
      invoke("get_system_info"),
      invoke("get_cpu_info"),
      invoke("get_memory_info"),
      invoke("get_disk_info"),
      invoke("get_network_info"),
    ]);

    systemInfo.value = sysInfo;
    cpuInfo.value = cpu;
    memoryInfo.value = memory;
    diskInfo.value = disks;

    // 计算网络速度
    if (lastNetworkData && network.length > 0) {
      let totalUpload = 0;
      let totalDownload = 0;
      network.forEach((iface, index) => {
        const lastIface = lastNetworkData[index];
        if (lastIface && lastIface.interface_name === iface.interface_name) {
          totalDownload += iface.received_bytes - lastIface.received_bytes;
          totalUpload += iface.transmitted_bytes - lastIface.transmitted_bytes;
        }
      });
      networkSpeed.value = { upload: totalUpload, download: totalDownload };
    }
    lastNetworkData = network;

  } catch (error) {
    message.error("获取系统信息失败: " + error);
    console.error(error);
  } finally {
    // 只有首次进入时才控制 loading，后续定时刷新不再展示大转圈
    if (isInitial) {
      loading.value = false;
    }
  }
};

onMounted(() => {
  // 首次加载系统信息
  fetchAllInfo(true);
  // 每秒刷新一次系统信息
  timer = setInterval(() => fetchAllInfo(false), 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
</script>

<template>
  <div class="system-view">
    <a-row :gutter="[24, 24]">
            <!-- 网络监控卡片 -->
      <a-col :xs="24">
        <div class="card-wrapper">
          <div class="card-header network-header">
            <div class="icon-box">
              <WifiOutlined />
            </div>
            <span class="card-title">网络监控</span>
          </div>
          <a-card :bordered="false" class="info-card custom-card">
            <a-skeleton active :loading="loading" :paragraph="{ rows: 3 }">
              <div class="network-container">
                <!-- 实时速度 -->
                <div class="network-speed-box">
                  <div class="speed-item upload">
                    <ArrowUpOutlined class="speed-icon" />
                    <div class="speed-content">
                      <span class="speed-label">上传速度</span>
                      <span class="speed-value">{{ formatSpeed(networkSpeed.upload) }}</span>
                    </div>
                  </div>
                  <div class="speed-item download">
                    <ArrowDownOutlined class="speed-icon" />
                    <div class="speed-content">
                      <span class="speed-label">下载速度</span>
                      <span class="speed-value">{{ formatSpeed(networkSpeed.download) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </a-skeleton>
          </a-card>
        </div>
      </a-col>
      <!-- 内存信息卡片 -->
      <a-col :xs="24" :lg="12">
        <div class="card-wrapper">
          <div class="card-header mem-header">
             <div class="icon-box">
              <HddOutlined />
            </div>
            <span class="card-title">内存使用</span>
          </div>
          <a-card :bordered="false" class="info-card custom-card">
            <a-skeleton active :loading="loading" :paragraph="{ rows: 4 }">
              <div v-if="memoryInfo" class="memory-container">
                <div class="mem-circle-wrapper">
                  <a-progress
                    type="circle"
                    :percent="Number(((memoryInfo.used_memory / memoryInfo.total_memory) * 100).toFixed(1))"
                    :stroke-color="{ '0%': '#4facfe', '100%': '#00f2fe' }"
                    :stroke-width="10"
                    :width="120"
                  >
                    <template #format="percent">
                      <span class="circle-text">{{ percent }}%</span>
                      <span class="circle-sub">使用率</span>
                    </template>
                  </a-progress>
                </div>
                
                <div class="mem-details">
                  <div class="mem-stat-row">
                    <span class="mem-dot used"></span>
                    <span class="mem-label">已用</span>
                    <span class="mem-val">{{ formatBytes(memoryInfo.used_memory) }}</span>
                  </div>
                   <div class="mem-stat-row">
                    <span class="mem-dot free"></span>
                    <span class="mem-label">可用</span>
                    <span class="mem-val">{{ formatBytes(memoryInfo.available_memory) }}</span>
                  </div>
                  <div class="mem-stat-row total">
                    <span class="mem-label">总量</span>
                    <span class="mem-val">{{ formatBytes(memoryInfo.total_memory) }}</span>
                  </div>
                </div>
              </div>
            </a-skeleton>
          </a-card>
        </div>
      </a-col>
      <!-- 系统信息卡片 -->
      <a-col :xs="24" :lg="12">
        <div class="card-wrapper">
          <div class="card-header system-header">
            <div class="icon-box">
              <CloudServerOutlined />
            </div>
            <span class="card-title">系统信息</span>
          </div>
          <a-card :bordered="false" class="info-card custom-card">
            <a-skeleton active :loading="loading" :paragraph="{ rows: 4 }">
              <div v-if="systemInfo" class="detail-list">
                <div class="detail-item">
                  <span class="detail-label">操作系统</span>
                  <span class="detail-value">{{ systemInfo.os_name }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">系统版本</span>
                  <span class="detail-value">{{ systemInfo.os_version }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">内核版本</span>
                  <span class="detail-value badge">{{ systemInfo.kernel_version }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">主机名</span>
                  <span class="detail-value">{{ systemInfo.hostname }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">架构</span>
                  <span class="detail-value badge-blue">{{ systemInfo.architecture }}</span>
                </div>
              </div>
            </a-skeleton>
          </a-card>
        </div>
      </a-col>

      <!-- CPU 信息卡片 -->
      <a-col :xs="24" :lg="12">
        <div class="card-wrapper">
          <div class="card-header cpu-header">
            <div class="icon-box">
              <DatabaseOutlined />
            </div>
            <span class="card-title">CPU 状态</span>
          </div>
          <a-card :bordered="false" class="info-card custom-card">
            <a-skeleton active :loading="loading" :paragraph="{ rows: 2 }">
              <div v-if="cpuInfo" class="cpu-info">
                <div class="cpu-brand-box">
                  <span class="label">处理器</span>
                  <span class="value">{{ cpuInfo.cpu_brand }}</span>
                </div>
                <div class="stat-grid">
                  <div class="stat-box">
                    <span class="stat-label">核心数</span>
                    <span class="stat-value">{{ cpuInfo.cpu_count }} <small>核</small></span>
                  </div>
                  <div class="stat-box">
                    <span class="stat-label">频率</span>
                    <span class="stat-value">{{ cpuInfo.cpu_frequency }} <small>MHz</small></span>
                  </div>
                </div>
              </div>
            </a-skeleton>
          </a-card>
        </div>
      </a-col>

      <!-- 磁盘信息卡片 -->
      <a-col :xs="24" :lg="12">
        <div class="card-wrapper">
          <div class="card-header disk-header-bg">
            <div class="icon-box">
              <CloudServerOutlined />
            </div>
            <span class="card-title">磁盘存储</span>
          </div>
          <a-card :bordered="false" class="info-card custom-card">
            <a-skeleton active :loading="loading" :paragraph="{ rows: 4 }">
              <div v-if="diskInfo.length > 0" class="disk-list">
                <div
                  v-for="(disk, index) in diskInfo"
                  :key="index"
                  class="disk-item"
                >
                  <div class="disk-icon">
                    <HddOutlined />
                  </div>
                  <div class="disk-content">
                    <div class="disk-top">
                      <span class="disk-name">{{ disk.name || '本地磁盘' }} <span class="mount-point">({{ disk.mount_point }})</span></span>
                      <span class="disk-usage-text">
                        {{ formatBytes(disk.total_space - disk.available_space) }} / {{ formatBytes(disk.total_space) }}
                      </span>
                    </div>
                    <a-progress
                      :percent="Number(((1 - disk.available_space / disk.total_space) * 100).toFixed(1))"
                      :stroke-color="{ '0%': '#87d068', '100%': '#108ee9' }"
                      :show-info="false"
                      :stroke-width="8"
                      class="disk-progress"
                    />
                  </div>
                </div>
              </div>
              <a-empty v-else description="未检测到磁盘" />
            </a-skeleton>
          </a-card>
        </div>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.system-view {

}

.card-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--box-shadow-card);
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid var(--border-color);
}

.card-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: var(--box-shadow-hover);
  border-color: rgba(59, 130, 246, 0.3);
}

.card-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-bottom: 1px solid var(--border-color);
}

.system-header .icon-box { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.cpu-header .icon-box { color: #10b981; background: rgba(16, 185, 129, 0.1); }
.mem-header .icon-box { color: #f43f5e; background: rgba(244, 63, 94, 0.1); }
.disk-header-bg .icon-box { color: #8b5cf6; background: rgba(139, 92, 246, 0.1); }

.icon-box {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.custom-card {
  flex: 1;
  background: transparent !important;
  box-shadow: none !important;
}

:deep(.ant-card-body) {
  padding: 24px !important;
}

/* System Info Detail List */
.detail-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px dashed rgba(0,0,0,0.05);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  color: var(--text-secondary);
  font-size: 14px;
}

.detail-value {
  font-weight: 500;
  color: var(--text-primary);
}

.badge {
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.badge-blue {
  background: rgba(79, 172, 254, 0.1);
  color: #4facfe;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
}

/* CPU Info */
.cpu-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cpu-brand-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cpu-brand-box .label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.cpu-brand-box .value {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stat-box {
  background: var(--surface-hover);
  padding: 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.stat-box:hover {
  background: #fff;
  border-color: var(--primary-color);
  box-shadow: var(--box-shadow-sm);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
}

.stat-value small {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
}

/* Memory Info */
.memory-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.mem-circle-wrapper {
  flex-shrink: 0;
}

:deep(.ant-progress-circle-path) {
  stroke-linecap: round;
}

.circle-text {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.circle-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

.mem-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mem-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.mem-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.mem-dot.used { background: #4facfe; }
.mem-dot.free { background: #e2e8f0; }

.mem-label {
  flex: 1;
  color: var(--text-secondary);
}

.mem-val {
  font-weight: 600;
  color: var(--text-primary);
}

.mem-stat-row.total {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

/* Disk Info */
.disk-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}

.disk-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 8px 0;
}

.disk-icon {
  width: 40px;
  height: 40px;
  background: var(--surface-hover);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8b5cf6;
  font-size: 20px;
  flex-shrink: 0;
}

.disk-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.disk-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.disk-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.mount-point {
  color: var(--text-tertiary);
  font-weight: 400;
  font-size: 12px;
}

.disk-usage-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.disk-progress {
  line-height: 1;
}

:deep(.ant-progress-inner) {
  background-color: #f1f5f9;
}

/* Network Monitor */
.network-header .icon-box {
  color: #06b6d4;
  background: rgba(6, 182, 212, 0.1);
}

.network-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.network-speed-box {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.speed-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--surface-hover);
  border-radius: 16px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.speed-item:hover {
  background: #fff;
  border-color: var(--border-color);
  box-shadow: var(--box-shadow-sm);
  transform: translateY(-2px);
}

.speed-item.upload .speed-icon {
  font-size: 24px;
  color: #f59e0b;
}

.speed-item.download .speed-icon {
  font-size: 24px;
  color: #10b981;
}

.speed-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.speed-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.speed-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
</style>
