<script setup>
import { ref, h } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { message } from 'ant-design-vue';
import { GlobalOutlined, SearchOutlined } from '@ant-design/icons-vue';

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

<template>
  <a-col :xs="24" :lg="24" style="margin-bottom: 10px">
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
          {{ scrapeLoading ? '爬取中...' : '开始爬取' }}
        </a-button>

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
                        <a-tag color="blue">元素 #{{ index + 1 }}</a-tag>
                      </template>
                      <template #description>
                        <div class="result-item">
                          <div class="result-text">
                            <strong>文本内容:</strong>
                            <p>{{ item.text || '(无文本)' }}</p>
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
</template>

<style scoped>
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
