<template>
  <div class="scraper-view">
    <a-card :bordered="false" class="main-card">
      <template #title>
        <div class="card-title">
          <GlobalOutlined style="color: #13c2c2" />
          <span>网页元素抓取</span>
        </div>
      </template>
      
      <div class="search-area">
        <a-input-group compact>
          <a-input
            v-model:value="scrapeUrl"
            style="width: 50%"
            placeholder="输入网页URL (例如: https://example.com)"
            size="large"
            :prefix="h(GlobalOutlined)"
            @pressEnter="scrapePage"
          />
          <a-input
            v-model:value="scrapeSelector"
            style="width: 35%"
            placeholder="CSS选择器 (例如: .content, #main)"
            size="large"
            :prefix="h(SearchOutlined)"
            @pressEnter="scrapePage"
          />
          <a-button
            type="primary"
            size="large"
            style="width: 15%"
            :loading="scrapeLoading"
            @click="scrapePage"
          >
            {{ scrapeLoading ? '爬取中' : '开始爬取' }}
          </a-button>
        </a-input-group>
        <div class="tips">
          <InfoCircleOutlined /> 输入目标网址和标准的 CSS 选择器来提取页面内容
        </div>
      </div>

      <div v-if="scrapeResult" class="result-area">
        <a-divider orientation="left">爬取结果</a-divider>

        <div v-if="scrapeResult.success">
          <a-alert
            :message="`成功找到 ${scrapeResult.data.length} 个匹配元素`"
            type="success"
            show-icon
            class="result-alert"
          />

          <div v-if="scrapeResult.data.length > 0">
            <a-list
              :data-source="scrapeResult.data"
              :pagination="
                scrapeResult.data.length > 10
                  ? { pageSize: 10, showSizeChanger: true }
                  : false
              "
              item-layout="vertical"
              size="large"
            >
              <template #renderItem="{ item, index }">
                <a-list-item key="index" class="result-list-item">
                  <div class="result-content">
                    <div class="result-header">
                      <a-tag color="blue">#{{ index + 1 }}</a-tag>
                      <span class="text-preview">{{ item.text || '(无纯文本内容)' }}</span>
                    </div>
                    
                    <div class="code-block">
                      <div class="code-header">HTML 源码</div>
                      <pre><code>{{ item.html }}</code></pre>
                    </div>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </div>
          <a-empty v-else description="未找到匹配的元素，请检查选择器是否正确" />
        </div>

        <a-alert
          v-else
          message="爬取失败"
          :description="scrapeResult.error"
          type="error"
          show-icon
        />
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { ref, h } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { message } from 'ant-design-vue';
import { GlobalOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons-vue';

const scrapeUrl = ref('https://example.com');
const scrapeSelector = ref('html');
const scrapeLoading = ref(false);
const scrapeResult = ref(null);

const scrapePage = async () => {
  if (!scrapeUrl.value || !scrapeSelector.value) {
    message.warning('请输入URL和CSS选择器');
    return;
  }

  scrapeLoading.value = true;
  scrapeResult.value = null;

  try {
    const result = await invoke('scrape_page', {
      url: scrapeUrl.value,
      selector: scrapeSelector.value,
    });

    scrapeResult.value = result;

    if (result.success) {
      message.success(`成功抓取 ${result.data.length} 个元素`);
    } else {
      message.error('抓取失败: ' + result.error);
    }
  } catch (error) {
    message.error('调用失败: ' + error);
    console.error(error);
  } finally {
    scrapeLoading.value = false;
  }
};
</script>

<style scoped>
.scraper-view {
  min-height: 100%;
}

.main-card {
  min-height: 100%;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.search-area {
  padding: 24px 0;
  max-width: 900px;
  margin: 0 auto;
}

.tips {
  margin-top: 8px;
  color: #8c8c8c;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.result-area {
  margin-top: 24px;
}

.result-alert {
  margin-bottom: 24px;
}

.result-list-item {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  margin-bottom: 16px;
  transition: all 0.3s;
}

.result-list-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border-color: #e6f7ff;
}

.result-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.text-preview {
  font-weight: 500;
  color: #262626;
  margin-left: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 800px;
}

.code-block {
  background: #1e1e1e;
  border-radius: 6px;
  overflow: hidden;
}

.code-header {
  background: #2d2d2d;
  color: #8c8c8c;
  padding: 4px 12px;
  font-size: 12px;
  border-bottom: 1px solid #333;
}

.code-block pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  max-height: 200px;
}

.code-block pre::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.code-block pre::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}

.code-block pre::-webkit-scrollbar-track {
  background: transparent;
}
</style>
