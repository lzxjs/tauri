<script setup>
import { computed, ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { message } from "ant-design-vue";

const route = useRoute();
const router = useRouter();
const LAST_ROUTE_KEY = "app_last_route_name";

// 顶部功能菜单：launcher(批量启动器) / scraper(网页爬虫) / system(系统信息)
const activeMenu = computed(() => route.name || "launcher");

// 监听路由变化，保存当前激活的菜单
watch(
  () => route.name,
  (newName) => {
    if (newName) {
      localStorage.setItem(LAST_ROUTE_KEY, newName);
    }
  }
);

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

  // 恢复上次访问的路由
  const lastRouteName = localStorage.getItem(LAST_ROUTE_KEY);
  if (lastRouteName && lastRouteName !== route.name) {
    router.push({ name: lastRouteName }).catch((err) => {
      console.warn("恢复上次路由失败:", err);
    });
  }
});
</script>

<template>
  <div class="container">
    <a-layout style="min-height: 100vh">
      <a-layout-header class="header">
        <div class="brand">
          <span class="logo-icon">🍅</span>
          <h1>小茄的工具箱</h1>
        </div>
        <div class="header-actions">
          <a-space>
            <span class="autostart-label">开机启动</span>
            <a-switch
              v-model:checked="autostartEnabled"
              :loading="autostartLoading"
              @change="toggleAutostart"
              size="small"
            />
          </a-space>
        </div>
      </a-layout-header>

      <a-layout>
        <a-layout-sider width="220" class="sider" theme="light">
          <a-menu
            :selectedKeys="[activeMenu]"
            mode="inline"
            @click="handleMenuClick"
            style="height: 100%; border-right: 0"
          >
            <a-menu-item key="launcher">应用批量启动器</a-menu-item>
            <a-menu-item key="system">系统与硬件信息</a-menu-item>
            <a-menu-item key="scraper">网页爬虫</a-menu-item>
            <a-menu-item key="recorder">键鼠录制回放</a-menu-item>
          </a-menu>
        </a-layout-sider>

        <a-layout-content class="content-wrapper">
          <div class="content">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" :key="route.name" />
              </transition>
            </router-view>
          </div>
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

.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 10;
  height: 64px;
  line-height: 64px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 24px;
}

.header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f1f1f;
}

.header-actions {
  display: flex;
  align-items: center;
}

.autostart-label {
  font-size: 14px;
  color: #666;
  user-select: none;
}

.sider {
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  z-index: 5;
}

.content-wrapper {
  padding: 16px;
  background: #f0f2f5;
  height: calc(100vh - 64px);
  overflow: hidden;
}

.content {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  /* background: #fff; */
  /* border-radius: 8px; */
  /* padding: 24px; */
  /* box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03); */
}

/* Custom Scrollbar for content */
.content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.content::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}
.content::-webkit-scrollbar-track {
  background: transparent;
}

:deep(.ant-card) {
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all 0.3s;
}

:deep(.ant-card:hover) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* 路由切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
