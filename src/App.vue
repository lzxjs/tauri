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
      <a-layout-sider width="240" class="sider" theme="light">
        <div class="brand">
          <div class="logo-box">
            <span class="logo-icon">🍅</span>
          </div>
          <h1>小茄的工具箱</h1>
        </div>
        
        <a-menu
          :selectedKeys="[activeMenu]"
          mode="inline"
          @click="handleMenuClick"
          class="custom-menu"
        >
          <a-menu-item key="launcher">
            <span class="menu-icon">🚀</span>
            <span>应用批量启动器</span>
          </a-menu-item>
          <a-menu-item key="system">
            <span class="menu-icon">🖥️</span>
            <span>系统与硬件信息</span>
          </a-menu-item>
          <a-menu-item key="scraper">
            <span class="menu-icon">🕷️</span>
            <span>网页爬虫</span>
          </a-menu-item>
          <a-menu-item key="recorder">
            <span class="menu-icon">⏺️</span>
            <span>键鼠录制回放</span>
          </a-menu-item>
        </a-menu>

        <div class="sider-footer">
           <div class="autostart-control">
             <span class="autostart-label">开机启动</span>
             <a-switch
               v-model:checked="autostartEnabled"
               :loading="autostartLoading"
               @change="toggleAutostart"
               size="small"
             />
           </div>
        </div>
      </a-layout-sider>

      <a-layout>
        <!-- 移除顶部 Header，让界面更清爽，功能收入左侧或内容区顶部 -->
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
  background: var(--bg-color);
}

.sider {
  z-index: 10;
  background: var(--surface-color) !important;
  border-right: 1px solid rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
}

.brand {
  height: 80px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 12px;
}

.logo-box {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(255, 154, 158, 0.3);
}

.logo-icon {
  font-size: 20px;
}

.brand h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.custom-menu {
  border-right: none !important;
  background: transparent !important;
  padding: 0 12px;
  flex: 1;
}

/* 覆盖 Ant Design Menu 样式 */
:deep(.ant-menu-item) {
  border-radius: 8px;
  margin-bottom: 8px !important;
  color: var(--text-secondary);
  transition: all 0.3s ease;
  height: 48px !important;
  line-height: 48px !important;
}

:deep(.ant-menu-item:hover) {
  color: var(--primary-color) !important;
  background: rgba(92, 124, 250, 0.05) !important;
}

:deep(.ant-menu-item-selected) {
  background: var(--primary-color) !important;
  color: #fff !important;
  box-shadow: 0 4px 12px rgba(92, 124, 250, 0.3);
  font-weight: 500;
}

.menu-icon {
  margin-right: 10px;
  font-size: 18px;
}

.sider-footer {
  padding: 24px;
  border-top: 1px solid rgba(0,0,0,0.03);
}

.autostart-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.autostart-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.content-wrapper {
  padding: 24px;
  background: var(--bg-color);
  height: 100vh;
  overflow: hidden;
}

.content {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px; /* 防止滚动条遮挡内容 */
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
