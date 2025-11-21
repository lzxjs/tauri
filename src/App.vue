<script setup>
import { ref, onMounted, h } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { message } from 'ant-design-vue'
import { 
  DesktopOutlined, 
  DatabaseOutlined, 
  HddOutlined, 
  CloudServerOutlined,
  ReloadOutlined 
} from '@ant-design/icons-vue'

const loading = ref(true)
const systemInfo = ref(null)
const cpuInfo = ref(null)
const memoryInfo = ref(null)
const diskInfo = ref([])

// 格式化字节为可读格式
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
}

// 获取所有系统信息
const fetchAllInfo = async () => {
  loading.value = true
  try {
    const [sysInfo, cpu, memory, disks] = await Promise.all([
      invoke('get_system_info'),
      invoke('get_cpu_info'),
      invoke('get_memory_info'),
      invoke('get_disk_info')
    ])
    
    systemInfo.value = sysInfo
    cpuInfo.value = cpu
    memoryInfo.value = memory
    diskInfo.value = disks
    
    message.success('系统信息加载成功')
  } catch (error) {
    message.error('获取系统信息失败: ' + error)
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAllInfo()
})
</script>

<template>
  <div class="container">
    <a-layout>
      <a-layout-header class="header">
        <h1>
          <DesktopOutlined />
          小茄的系统信息查看器
        </h1>
        <a-button type="primary" :icon="h(ReloadOutlined)" @click="fetchAllInfo" :loading="loading">
          刷新
        </a-button>
      </a-layout-header>
      
      <a-layout-content class="content">
        <a-spin :spinning="loading" size="large">
          <a-row :gutter="[16, 16]">
            <!-- 系统信息卡片 -->
            <a-col :xs="24" :lg="12">
              <a-card title="系统信息" :bordered="false">
                <template #extra>
                  <CloudServerOutlined style="font-size: 24px; color: #1890ff;" />
                </template>
                <a-descriptions :column="1" v-if="systemInfo">
                  <a-descriptions-item label="操作系统">{{ systemInfo.os_name }}</a-descriptions-item>
                  <a-descriptions-item label="系统版本">{{ systemInfo.os_version }}</a-descriptions-item>
                  <a-descriptions-item label="内核版本">{{ systemInfo.kernel_version }}</a-descriptions-item>
                  <a-descriptions-item label="主机名">{{ systemInfo.hostname }}</a-descriptions-item>
                  <a-descriptions-item label="架构">{{ systemInfo.architecture }}</a-descriptions-item>
                </a-descriptions>
              </a-card>
            </a-col>

            <!-- CPU 信息卡片 -->
            <a-col :xs="24" :lg="12">
              <a-card title="CPU 信息" :bordered="false">
                <template #extra>
                  <DatabaseOutlined style="font-size: 24px; color: #52c41a;" />
                </template>
                <a-descriptions :column="1" v-if="cpuInfo">
                  <a-descriptions-item label="CPU 品牌">{{ cpuInfo.cpu_brand }}</a-descriptions-item>
                  <a-descriptions-item label="核心数">{{ cpuInfo.cpu_count }} 核</a-descriptions-item>
                  <a-descriptions-item label="频率">{{ cpuInfo.cpu_frequency }} MHz</a-descriptions-item>
                </a-descriptions>
              </a-card>
            </a-col>

            <!-- 内存信息卡片 -->
            <a-col :xs="24" :lg="12">
              <a-card title="内存信息" :bordered="false">
                <template #extra>
                  <HddOutlined style="font-size: 24px; color: #fa8c16;" />
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
                        :value="((memoryInfo.used_memory / memoryInfo.total_memory) * 100).toFixed(2)"
                        suffix="%"
                      />
                    </a-col>
                  </a-row>
                  <a-divider />
                  <a-progress 
                    :percent="Number(((memoryInfo.used_memory / memoryInfo.total_memory) * 100).toFixed(2))"
                    :status="memoryInfo.used_memory / memoryInfo.total_memory > 0.8 ? 'exception' : 'active'"
                  />
                </div>
              </a-card>
            </a-col>

            <!-- 磁盘信息卡片 -->
            <a-col :xs="24" :lg="12">
              <a-card title="磁盘信息" :bordered="false">
                <template #extra>
                  <HddOutlined style="font-size: 24px; color: #722ed1;" />
                </template>
                <div v-if="diskInfo.length > 0">
                  <div v-for="(disk, index) in diskInfo" :key="index" class="disk-item">
                    <a-descriptions :column="1" size="small">
                      <a-descriptions-item label="磁盘名称">{{ disk.name || disk.mount_point }}</a-descriptions-item>
                      <a-descriptions-item label="挂载点">{{ disk.mount_point }}</a-descriptions-item>
                      <a-descriptions-item label="文件系统">{{ disk.file_system }}</a-descriptions-item>
                      <a-descriptions-item label="总容量">{{ formatBytes(disk.total_space) }}</a-descriptions-item>
                      <a-descriptions-item label="可用空间">{{ formatBytes(disk.available_space) }}</a-descriptions-item>
                      <a-descriptions-item label="使用率">
                        {{ ((1 - disk.available_space / disk.total_space) * 100).toFixed(2) }}%
                      </a-descriptions-item>
                    </a-descriptions>
                    <a-progress 
                      :percent="Number(((1 - disk.available_space / disk.total_space) * 100).toFixed(2))"
                      :status="(1 - disk.available_space / disk.total_space) > 0.8 ? 'exception' : 'active'"
                    />
                    <a-divider v-if="index < diskInfo.length - 1" />
                  </div>
                </div>
                <a-empty v-else description="未检测到磁盘" />
              </a-card>
            </a-col>
          </a-row>
        </a-spin>
      </a-layout-content>
    </a-layout>
  </div>
</template>

<style scoped>
.container {
  min-height: 100vh;
}

.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: #1890ff;
  display: flex;
  align-items: center;
  gap: 12px;
}

.content {
  padding: 24px;
  min-height: calc(100vh - 64px);
}

.disk-item {
  margin-bottom: 16px;
}

.disk-item:last-child {
  margin-bottom: 0;
}

:deep(.ant-card) {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 2px 8px rgba(0, 0, 0, 0.06);
  border-radius: 8px;
}

:deep(.ant-card-head) {
  border-bottom: 1px solid #f0f0f0;
  font-weight: 600;
}
</style>
