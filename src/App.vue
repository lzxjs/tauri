<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

// 顶部功能菜单：launcher(批量启动器) / scraper(网页爬虫) / system(系统信息)
const activeMenu = computed(() => route.name || "launcher");

// 处理菜单点击，使用 vue-router 切换路径
const handleMenuClick = ({ key }) => {
  if (!key) return;
  if (key === route.name) return;
  router.push({ name: key }).catch(() => {});
};
</script>

<template>
  <div class="container">
    <a-layout>
      <a-layout-header class="header">
        <h1>🍅 小茄的工具箱</h1>
      </a-layout-header>

      <a-layout>
        <a-layout-sider width="220" class="sider">
          <a-menu
            :selectedKeys="[activeMenu]"
            mode="inline"
            @click="handleMenuClick"
          >
            <a-menu-item key="launcher">应用批量启动器</a-menu-item>
            <a-menu-item key="system">系统与硬件信息</a-menu-item>
            <a-menu-item key="scraper">网页爬虫</a-menu-item>
          </a-menu>
        </a-layout-sider>

        <a-layout-content class="content">
          <router-view />
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>

<style scoped>
.container {
  height: 100vh;
  overflow: hidden;
}

:deep .ant-layout-sider-children {
  background: #fff;
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
  margin: 18px;
  height: calc(100vh - 108px);
  /* max-height:  calc(100vh - 64px); */
  overflow-y: auto;
  overflow-x: hidden;
  background: #fff;
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
