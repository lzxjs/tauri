<script setup>
import { computed, ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { message } from "ant-design-vue";

const route = useRoute();
const router = useRouter();

// 顶部功能菜单：launcher(批量启动器) / scraper(网页爬虫) / system(系统信息)
const activeMenu = computed(() => route.name || "launcher");

// 开机启动状态
const autostartEnabled = ref(false);
const autostartLoading = ref(false);

// 处理菜单点击，使用 vue-router 切换路径
const handleMenuClick = ({ key }) => {
  if (!key) return;
  if (key === route.name) return;
  router.push({ name: key }).catch(() => {});
};

// 获取开机启动状态
const checkAutostartStatus = async () => {
  try {
    autostartEnabled.value = await isEnabled();
  } catch (error) {
    console.error("获取开机启动状态失败:", error);
  }
};

// 切换开机启动
const toggleAutostart = async (checked) => {
  autostartLoading.value = true;
  try {
    if (checked) {
      await enable();
      message.success("已启用开机启动");
    } else {
      await disable();
      message.success("已禁用开机启动");
    }
    autostartEnabled.value = checked;
  } catch (error) {
    console.error("切换开机启动失败:", error);
    message.error("操作失败，请重试");
    // 恢复原状态
    autostartEnabled.value = !checked;
  } finally {
    autostartLoading.value = false;
  }
};

// 组件挂载时检查状态
onMounted(() => {
  checkAutostartStatus();
});
</script>

<template>
  <div class="container">
    <a-layout>
      <a-layout-header class="header">
        <h1>🍅 小茄的工具箱</h1>
        <div class="header-actions">
          <span class="autostart-label">开机启动</span>
          <a-switch
            v-model:checked="autostartEnabled"
            :loading="autostartLoading"
            @change="toggleAutostart"
          />
        </div>
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
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" :key="route.name" />
            </transition>
          </router-view>
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

:deep(.ant-layout-sider-children) {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.autostart-label {
  font-size: 14px;
  color: #666;
  user-select: none;
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

/* 路由切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
