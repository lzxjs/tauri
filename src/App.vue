<script setup>
import { ref, onMounted, h } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { message } from "ant-design-vue";
import {
  DesktopOutlined,
  DatabaseOutlined,
  HddOutlined,
  CloudServerOutlined,
  ReloadOutlined,
  GlobalOutlined,
  SearchOutlined,
} from "@ant-design/icons-vue";

const loading = ref(true);
const systemInfo = ref(null);
const cpuInfo = ref(null);
const memoryInfo = ref(null);
const diskInfo = ref([]);

// 爬虫相关
const scrapeUrl = ref("https://example.com");
const scrapeSelector = ref("html");
const scrapeLoading = ref(false);
const scrapeResult = ref(null);

// 格式化字节为可读格式
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
};

// 获取所有系统信息
const fetchAllInfo = async () => {
  loading.value = true;
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

    message.success("系统信息加载成功");
  } catch (error) {
    message.error("获取系统信息失败: " + error);
    console.error(error);
  } finally {
    loading.value = false;
  }
};

// 爬取网页
const scrapePage = async () => {
  if (!scrapeUrl.value || !scrapeSelector.value) {
    message.warning("请输入URL和CSS选择器");
    return;
  }

  scrapeLoading.value = true;
  scrapeResult.value = null;

  try {
    const result = await invoke("scrape_page", {
      url: scrapeUrl.value,
      selector: scrapeSelector.value,
    });

    scrapeResult.value = result;

    if (result.success) {
      message.success(`成功抓取 ${result.data.length} 个元素`);
    } else {
      message.error("抓取失败: " + result.error);
    }
  } catch (error) {
    message.error("调用失败: " + error);
    console.error(error);
  } finally {
    scrapeLoading.value = false;
  }
};

onMounted(() => {
  fetchAllInfo();
});
</script>

<template>
  <div class="container">
    <a-layout>
      <a-layout-header class="header">
        <h1>
          <DesktopOutlined />
          小茄的系统信息查看器
        </h1>
        <a-button
          type="primary"
          :icon="h(ReloadOutlined)"
          @click="fetchAllInfo"
          :loading="loading"
        >
          刷新
        </a-button>
      </a-layout-header>

      <a-layout-content class="content">
        <a-spin :spinning="loading" size="large">
          <!-- 网页爬虫卡片 -->
          <a-col :xs="24" :lg="24" style="margin-bottom: 10px;">
            <a-card title="网页爬虫" :bordered="false">
              <template #extra>
                <GlobalOutlined style="font-size: 24px; color: #13c2c2" />
              </template>

              <a-space direction="vertical" style="width: 100%" :size="16">
                <a-input
                  v-model:value="scrapeUrl"
                  placeholder="输入网页URL，例如: https://example.com"
                  size="large"
                  :prefix="h(GlobalOutlined)"
                />

                <a-input
                  v-model:value="scrapeSelector"
                  placeholder="输入CSS选择器，例如: h1, .title, #content"
                  size="large"
                  :prefix="h(SearchOutlined)"
                />

                <a-button
                  type="primary"
                  size="large"
                  block
                  :loading="scrapeLoading"
                  @click="scrapePage"
                >
                  {{ scrapeLoading ? "爬取中..." : "开始爬取" }}
                </a-button>

                <!-- 爬取结果 -->
                <div v-if="scrapeResult" class="scrape-result">
                  <a-divider orientation="left">爬取结果</a-divider>

                  <div v-if="scrapeResult.success">
                    <a-alert
                      :message="`成功找到 ${scrapeResult.data.length} 个元素`"
                      type="success"
                      show-icon
                      style="margin-bottom: 16px"
                    />

                    <div v-if="scrapeResult.data.length > 0">
                      <a-list
                        :data-source="scrapeResult.data"
                        :pagination="
                          scrapeResult.data.length > 10
                            ? { pageSize: 10 }
                            : false
                        "
                        bordered
                      >
                        <template #renderItem="{ item, index }">
                          <a-list-item>
                            <a-list-item-meta>
                              <template #title>
                                <a-tag color="blue"
                                  >元素 #{{ index + 1 }}</a-tag
                                >
                              </template>
                              <template #description>
                                <div class="result-item">
                                  <div class="result-text">
                                    <strong>文本内容:</strong>
                                    <p>{{ item.text || "(无文本)" }}</p>
                                  </div>
                                  <a-divider style="margin: 8px 0" />
                                  <div class="result-html">
                                    <strong>HTML代码:</strong>
                                    <pre>{{ item.html }}</pre>
                                  </div>
                                </div>
                              </template>
                            </a-list-item-meta>
                          </a-list-item>
                        </template>
                      </a-list>
                    </div>
                    <a-empty v-else description="未找到匹配的元素" />
                  </div>

                  <a-alert
                    v-else
                    :message="'爬取失败'"
                    :description="scrapeResult.error"
                    type="error"
                    show-icon
                  />
                </div>
              </a-space>
            </a-card>
          </a-col>
          <a-row :gutter="[16, 16]">
            <!-- 系统信息卡片 -->
            <a-col :xs="24" :lg="12">
              <a-card title="系统信息" :bordered="false">
                <template #extra>
                  <CloudServerOutlined
                    style="font-size: 24px; color: #1890ff"
                  />
                </template>
                <a-descriptions :column="1" v-if="systemInfo">
                  <a-descriptions-item label="操作系统">{{
                    systemInfo.os_name
                  }}</a-descriptions-item>
                  <a-descriptions-item label="系统版本">{{
                    systemInfo.os_version
                  }}</a-descriptions-item>
                  <a-descriptions-item label="内核版本">{{
                    systemInfo.kernel_version
                  }}</a-descriptions-item>
                  <a-descriptions-item label="主机名">{{
                    systemInfo.hostname
                  }}</a-descriptions-item>
                  <a-descriptions-item label="架构">{{
                    systemInfo.architecture
                  }}</a-descriptions-item>
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
                  <a-descriptions-item label="CPU 品牌">{{
                    cpuInfo.cpu_brand
                  }}</a-descriptions-item>
                  <a-descriptions-item label="核心数"
                    >{{ cpuInfo.cpu_count }} 核</a-descriptions-item
                  >
                  <a-descriptions-item label="频率"
                    >{{ cpuInfo.cpu_frequency }} MHz</a-descriptions-item
                  >
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
                      <a-descriptions-item label="磁盘名称">{{
                        disk.name || disk.mount_point
                      }}</a-descriptions-item>
                      <a-descriptions-item label="挂载点">{{
                        disk.mount_point
                      }}</a-descriptions-item>
                      <a-descriptions-item label="文件系统">{{
                        disk.file_system
                      }}</a-descriptions-item>
                      <a-descriptions-item label="总容量">{{
                        formatBytes(disk.total_space)
                      }}</a-descriptions-item>
                      <a-descriptions-item label="可用空间">{{
                        formatBytes(disk.available_space)
                      }}</a-descriptions-item>
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

.scrape-result {
  margin-top: 16px;
}

.result-item {
  width: 100%;
}

.result-text p {
  margin: 8px 0;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  word-break: break-all;
}

.result-html pre {
  margin: 8px 0;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.5;
  color: #333;
}
</style>
