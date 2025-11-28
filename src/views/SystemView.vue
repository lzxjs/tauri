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
  <a-spin :spinning="loading" size="large">
    <a-row :gutter="[16, 16]">
      <!-- 系统信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="系统信息" :bordered="false">
          <template #extra>
            <CloudServerOutlined style="font-size: 24px; color: #1890ff" />
          </template>
          <a-descriptions :column="1" v-if="systemInfo">
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
        </a-card>
      </a-col>

      <!-- CPU 信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="CPU 信息" :bordered="false">
          <template #extra>
            <DatabaseOutlined style="font-size: 24px; color: #52c41a" />
          </template>
          <a-descriptions :column="1" v-if="cpuInfo">
            <a-descriptions-item label="CPU 品牌">
              {{ cpuInfo.cpu_brand }}
            </a-descriptions-item>
            <a-descriptions-item label="核心数">
              {{ cpuInfo.cpu_count }} 核
            </a-descriptions-item>
            <a-descriptions-item label="频率">
              {{ cpuInfo.cpu_frequency }} MHz
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>

      <!-- 内存信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="内存信息" :bordered="false">
          <template #extra>
            <HddOutlined style="font-size: 24px; color: #fa8c16" />
          </template>
          <div v-if="memoryInfo">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-statistic
                  title="总内存"
                  :value="formatBytes(memoryInfo.total_memory)"
                  :value-style="{ color: '#3f8600' }"
                />
              </a-col>
              <a-col :span="12">
                <a-statistic
                  title="已用内存"
                  :value="formatBytes(memoryInfo.used_memory)"
                  :value-style="{ color: '#cf1322' }"
                />
              </a-col>
            </a-row>
            <a-divider />
            <a-row :gutter="16">
              <a-col :span="12">
                <a-statistic
                  title="可用内存"
                  :value="formatBytes(memoryInfo.available_memory)"
                />
              </a-col>
              <a-col :span="12">
                <a-statistic
                  title="内存使用率"
                  :value="
                    (
                      (memoryInfo.used_memory / memoryInfo.total_memory) *
                      100
                    ).toFixed(2)
                  "
                  suffix="%"
                />
              </a-col>
            </a-row>
            <a-divider />
            <a-progress
              :percent="
                Number(
                  (
                    (memoryInfo.used_memory / memoryInfo.total_memory) *
                    100
                  ).toFixed(2)
                )
              "
              :status="
                memoryInfo.used_memory / memoryInfo.total_memory > 0.8
                  ? 'exception'
                  : 'active'
              "
            />
          </div>
        </a-card>
      </a-col>

      <!-- 磁盘信息卡片 -->
      <a-col :xs="24" :lg="12">
        <a-card title="磁盘信息" :bordered="false">
          <template #extra>
            <HddOutlined style="font-size: 24px; color: #722ed1" />
          </template>
          <div v-if="diskInfo.length > 0">
            <div
              v-for="(disk, index) in diskInfo"
              :key="index"
              class="disk-item"
            >
              <a-descriptions :column="1" size="small">
                <a-descriptions-item label="磁盘名称">
                  {{ disk.name || disk.mount_point }}
                </a-descriptions-item>
                <a-descriptions-item label="挂载点">
                  {{ disk.mount_point }}
                </a-descriptions-item>
                <a-descriptions-item label="文件系统">
                  {{ disk.file_system }}
                </a-descriptions-item>
                <a-descriptions-item label="总容量">
                  {{ formatBytes(disk.total_space) }}
                </a-descriptions-item>
                <a-descriptions-item label="可用空间">
                  {{ formatBytes(disk.available_space) }}
                </a-descriptions-item>
                <a-descriptions-item label="使用率">
                  {{
                    (
                      (1 - disk.available_space / disk.total_space) *
                      100
                    ).toFixed(2)
                  }}%
                </a-descriptions-item>
              </a-descriptions>
              <a-progress
                :percent="
                  Number(
                    (
                      (1 - disk.available_space / disk.total_space) *
                      100
                    ).toFixed(2)
                  )
                "
                :status="
                  1 - disk.available_space / disk.total_space > 0.8
                    ? 'exception'
                    : 'active'
                "
              />
              <a-divider v-if="index < diskInfo.length - 1" />
            </div>
          </div>
          <a-empty v-else description="未检测到磁盘" />
        </a-card>
      </a-col>
    </a-row>
  </a-spin>
</template>

<style scoped>
.disk-item {
  margin-bottom: 16px;
}

.disk-item:last-child {
  margin-bottom: 0;
}
</style>
