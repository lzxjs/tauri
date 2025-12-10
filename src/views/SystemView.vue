<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { message } from "ant-design-vue";
import {
  DatabaseOutlined,
  HddOutlined,
  CloudServerOutlined,
} from "@ant-design/icons-vue";

const loading = ref(true);
const systemInfo = ref(null);
const cpuInfo = ref(null);
const memoryInfo = ref(null);
const diskInfo = ref([]);
let timer = null;

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
};

const fetchAllInfo = async (isInitial = false) => {
  if (isInitial) {
    loading.value = true;
  }
  try {
    const [sysInfo, cpu, memory, disks] = await Promise.all([
      invoke("get_system_info"),
      invoke("get_cpu_info"),
      invoke("get_memory_info"),
      invoke("get_disk_info"),
    ]);

    systemInfo.value = sysInfo;
    cpuInfo.value = cpu;
    memoryInfo.value = memory;
    diskInfo.value = disks;

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
  // 首次进入视图时加载一次，并提示成功
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
    <a-row :gutter="[16, 16]">
      <!-- 系统信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="系统信息" :bordered="false" class="info-card">
          <template #extra>
            <CloudServerOutlined style="font-size: 24px; color: #1890ff" />
          </template>
          <a-skeleton active :loading="loading" :paragraph="{ rows: 4 }">
            <a-descriptions :column="1" v-if="systemInfo" size="small" bordered>
              <a-descriptions-item label="操作系统">
                {{ systemInfo.os_name }}
              </a-descriptions-item>
              <a-descriptions-item label="系统版本">
                {{ systemInfo.os_version }}
              </a-descriptions-item>
              <a-descriptions-item label="内核版本">
                {{ systemInfo.kernel_version }}
              </a-descriptions-item>
              <a-descriptions-item label="主机名">
                {{ systemInfo.hostname }}
              </a-descriptions-item>
              <a-descriptions-item label="架构">
                {{ systemInfo.architecture }}
              </a-descriptions-item>
            </a-descriptions>
          </a-skeleton>
        </a-card>
      </a-col>

      <!-- CPU 信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="CPU 信息" :bordered="false" class="info-card">
          <template #extra>
            <DatabaseOutlined style="font-size: 24px; color: #52c41a" />
          </template>
          <a-skeleton active :loading="loading" :paragraph="{ rows: 2 }">
            <div v-if="cpuInfo" class="cpu-info">
              <div class="info-item">
                <span class="label">CPU 品牌</span>
                <span class="value">{{ cpuInfo.cpu_brand }}</span>
              </div>
              <div class="stat-row">
                <a-statistic title="核心数" :value="cpuInfo.cpu_count" suffix="核" />
                <a-statistic title="频率" :value="cpuInfo.cpu_frequency" suffix="MHz" />
              </div>
            </div>
          </a-skeleton>
        </a-card>
      </a-col>

      <!-- 内存信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="内存信息" :bordered="false" class="info-card">
          <template #extra>
            <HddOutlined style="font-size: 24px; color: #fa8c16" />
          </template>
          <a-skeleton active :loading="loading" :paragraph="{ rows: 4 }">
            <div v-if="memoryInfo">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-statistic
                    title="已用内存"
                    :value="formatBytes(memoryInfo.used_memory)"
                    :value-style="{ color: memoryInfo.used_memory / memoryInfo.total_memory > 0.8 ? '#cf1322' : '#3f8600' }"
                  />
                </a-col>
                <a-col :span="12">
                  <a-statistic
                    title="总内存"
                    :value="formatBytes(memoryInfo.total_memory)"
                  />
                </a-col>
              </a-row>
              <div class="progress-section">
                <div class="progress-info">
                  <span>使用率</span>
                  <span>{{ ((memoryInfo.used_memory / memoryInfo.total_memory) * 100).toFixed(1) }}%</span>
                </div>
                <a-progress
                  :percent="Number(((memoryInfo.used_memory / memoryInfo.total_memory) * 100).toFixed(1))"
                  :status="memoryInfo.used_memory / memoryInfo.total_memory > 0.8 ? 'exception' : 'active'"
                  :show-info="false"
                  :stroke-width="12"
                />
              </div>
              <div class="sub-stats">
                 <span>可用: {{ formatBytes(memoryInfo.available_memory) }}</span>
              </div>
            </div>
          </a-skeleton>
        </a-card>
      </a-col>

      <!-- 磁盘信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="磁盘信息" :bordered="false" class="info-card">
          <template #extra>
            <HddOutlined style="font-size: 24px; color: #722ed1" />
          </template>
          <a-skeleton active :loading="loading" :paragraph="{ rows: 4 }">
            <div v-if="diskInfo.length > 0" class="disk-list">
              <div
                v-for="(disk, index) in diskInfo"
                :key="index"
                class="disk-item"
              >
                <div class="disk-header">
                  <span class="disk-name">{{ disk.name || '本地磁盘' }} ({{ disk.mount_point }})</span>
                  <span class="disk-usage">
                     {{ formatBytes(disk.total_space - disk.available_space) }} / {{ formatBytes(disk.total_space) }}
                  </span>
                </div>
                <a-progress
                  :percent="Number(((1 - disk.available_space / disk.total_space) * 100).toFixed(1))"
                  :status="(1 - disk.available_space / disk.total_space) > 0.8 ? 'exception' : 'active'"
                  :stroke-width="10"
                />
              </div>
            </div>
            <a-empty v-else description="未检测到磁盘" />
          </a-skeleton>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.system-view {
  padding-bottom: 20px;
}

.info-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.ant-card-body) {
  flex: 1;
}

.cpu-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-item .label {
  color: #8c8c8c;
}

.info-item .value {
  font-weight: 500;
}

.stat-row {
  display: flex;
  justify-content: space-around;
  background: #fafafa;
  padding: 16px;
  border-radius: 6px;
}

.progress-section {
  margin-top: 16px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
  color: #666;
}

.sub-stats {
  margin-top: 8px;
  text-align: right;
  font-size: 12px;
  color: #8c8c8c;
}

.disk-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.disk-item {
  background: #fafafa;
  padding: 12px;
  border-radius: 6px;
}

.disk-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.disk-name {
  font-weight: 500;
}

.disk-usage {
  color: #8c8c8c;
}
</style>
