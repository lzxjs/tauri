<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { message } from "ant-design-vue";
import { startNetworkTrafficService, stopNetworkTrafficService } from "./services/networkTrafficService";

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

  // 启动全局网络流量统计服务
  startNetworkTrafficService();
});

// 组件卸载时停止服务
onUnmounted(() => {
  stopNetworkTrafficService();
});
</script>

<template>
  <div class="container">
    <a-layout style="min-height: 100vh">
      <a-layout-sider width="260" class="sider" theme="light">
        <div class="brand">
          <div class="logo-box">
            <span class="logo-icon">🍅</span>
          </div>
          <div class="brand-text">
            <h1>小茄工具箱</h1>
            <span class="version">v1.0.0</span>
          </div>
        </div>
        
        <div class="menu-container">
          <a-menu
            :selectedKeys="[activeMenu]"
            mode="inline"
            @click="handleMenuClick"
            class="custom-menu"
          >            <a-menu-item key="system">
              <span class="menu-icon-wrapper">🖥️</span>
              <span class="menu-text">系统监控</span>
            </a-menu-item>
            <a-menu-item key="launcher">
              <span class="menu-icon-wrapper">🚀</span>
              <span class="menu-text">应用启动</span>
            </a-menu-item>
           <a-menu-item key="recorder">
              <span class="menu-icon-wrapper">⏺️</span>
              <span class="menu-text">动作录制</span>
            </a-menu-item>
            <a-menu-item key="clipboard">
              <span class="menu-icon-wrapper">📋</span>
              <span class="menu-text">剪贴板</span>
            </a-menu-item>
            <!-- <a-menu-item key="scraper">
              <span class="menu-icon-wrapper">🕷️</span>
              <span class="menu-text">网页爬虫</span>
            </a-menu-item> -->
          </a-menu>
        </div>

        <div class="sider-footer">
           <div class="autostart-card">
             <div class="autostart-info">
               <span class="autostart-title">开机启动</span>
               <span class="autostart-desc">随系统自动运行</span>
             </div>
             <a-switch
               v-model:checked="autostartEnabled"
               :loading="autostartLoading"
               @change="toggleAutostart"
               class="custom-switch"
             />
           </div>
        </div>
      </a-layout-sider>

      <a-layout class="main-layout">
        <a-layout-content class="content-wrapper">
          <div class="content-container">
            <router-view v-slot="{ Component }">
              <transition name="fade-slide" mode="out-in">
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
  z-index: 20;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 20px 0 40px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
}

:deep(.ant-layout-sider-children) {
  display: flex;
  flex-direction: column;
}

.brand {
  height: 100px;
  display: flex;
  align-items: center;
  padding: 0 28px;
  gap: 16px;
}

.logo-box {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 16px rgba(255, 154, 158, 0.25);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.brand:hover .logo-box {
  transform: scale(1.05) rotate(5deg);
}

.logo-icon {
  font-size: 22px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.version {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
  background: rgba(0,0,0,0.03);
  padding: 2px 6px;
  border-radius: 6px;
  align-self: flex-start;
}

.menu-container {
  flex: 1;
  padding: 10px 16px;
  overflow-y: auto;
}

.custom-menu {
  border-right: none !important;
  background: transparent !important;
}

/* 覆盖 Ant Design Menu 样式 */
:deep(.ant-menu-item) {
  border-radius: 12px;
  margin-bottom: 8px !important;
  color: var(--text-secondary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  height: 52px !important;
  line-height: 52px !important;
  padding-left: 16px !important;
  position: relative;
  overflow: hidden;
}

:deep(.ant-menu-item:hover) {
  color: var(--primary-color) !important;
  background: var(--surface-hover) !important;
}

:deep(.ant-menu-item-selected) {
  background: var(--primary-gradient) !important;
  color: #fff !important;
  box-shadow: 0 8px 20px rgba(79, 172, 254, 0.3);
  font-weight: 600;
}

.menu-icon-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  margin-right: 12px;
  font-size: 18px;
  transition: transform 0.3s ease;
}

:deep(.ant-menu-item-selected) .menu-icon-wrapper {
  transform: scale(1.1);
}

.menu-text {
  font-size: 14px;
}

.sider-footer {
  padding: 24px;
}

.autostart-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
  transition: all 0.3s ease;
}

.autostart-card:hover {
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}

.autostart-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.autostart-title {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.autostart-desc {
  font-size: 11px;
  color: var(--text-tertiary);
}

.custom-switch {
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

:deep(.ant-switch-checked) {
  background: var(--primary-gradient) !important;
}

.main-layout {
  background: transparent;
}

.content-wrapper {
  padding: 24px 32px;
  height: 100vh;
  overflow: hidden;
}

.content-container {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
  padding-bottom: 24px;
}

/* 路由切换动画 - 滑动渐变 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.98);
}

/* Ant Design Card 全局覆盖 */
:deep(.ant-card) {
  border-radius: var(--border-radius);
  border: none;
  box-shadow: var(--box-shadow);
  transition: var(--transition);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

:deep(.ant-card:hover) {
  box-shadow: var(--box-shadow-hover);
  transform: translateY(-4px);
  background: #fff;
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
