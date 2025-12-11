<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { message } from "ant-design-vue";
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { startNetworkTrafficService, stopNetworkTrafficService } from "./services/networkTrafficService";
import { loadClipboardItems, addClipboardItem } from './composables/useClipboardStore';

const route = useRoute();
const router = useRouter();
const LAST_ROUTE_KEY = "app_last_route_name";
const COLLAPSED_KEY = "app_sider_collapsed";

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

// 侧边栏收起状态
const collapsed = ref(false);

// 监听侧边栏收起状态变化，保存到 localStorage
watch(collapsed, (newValue) => {
  localStorage.setItem(COLLAPSED_KEY, String(newValue));
});

// 开机启动状态
const autostartEnabled = ref(false);
const autostartLoading = ref(false);

// 剪贴板监听取消函数
let unlistenClipboard = null;

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

// 启动剪贴板监听服务
const startClipboardMonitoring = async () => {
  try {
    // 加载历史剪贴板数据
    await loadClipboardItems();
    console.log('[ClipboardService] 历史数据已加载');

    // 启动后端监听
    await invoke('start_clipboard_monitor');
    console.log('[ClipboardService] 后端监听已启动');

    // 监听剪贴板变化事件
    unlistenClipboard = await listen('clipboard-changed', async (event) => {
      console.log('[ClipboardService] 收到剪贴板变化事件:', event.payload);
      const content = event.payload;
      await addClipboardItem(content);
      console.log('[ClipboardService] 剪贴板项已添加');
    });

    console.log('[ClipboardService] 剪贴板监听已启动');
  } catch (error) {
    console.error('[ClipboardService] 启动剪贴板监听失败:', error);
  }
};

// 停止剪贴板监听服务
const stopClipboardMonitoring = async () => {
  try {
    await invoke('stop_clipboard_monitor');
    if (unlistenClipboard) {
      unlistenClipboard();
      unlistenClipboard = null;
    }
    console.log('[ClipboardService] 剪贴板监听已停止');
  } catch (error) {
    console.error('[ClipboardService] 停止剪贴板监听失败:', error);
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

  // 恢复侧边栏收起状态
  const savedCollapsed = localStorage.getItem(COLLAPSED_KEY);
  if (savedCollapsed !== null) {
    collapsed.value = savedCollapsed === 'true';
  }

  // 启动全局网络流量统计服务
  startNetworkTrafficService();

  // 启动全局剪贴板监听服务
  startClipboardMonitoring();
});

// 组件卸载时停止服务
onUnmounted(() => {
  stopNetworkTrafficService();
  stopClipboardMonitoring();
});
</script>

<template>
  <div class="container">
    <a-layout style="min-height: 100vh">
      <a-layout-sider
        v-model:collapsed="collapsed"
        :collapsedWidth="80"
        :trigger="null"
        width="260"
        class="sider"
        theme="light"
      >
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
          >            
            <a-menu-item key="system">
              <span class="menu-icon-wrapper">🖥️</span>
              <span class="menu-text">系统监控</span>
            </a-menu-item>
            <a-menu-item key="clipboard">
              <span class="menu-icon-wrapper">📋</span>
              <span class="menu-text">剪贴板</span>
            </a-menu-item>
            <a-menu-item key="launcher">
              <span class="menu-icon-wrapper">🚀</span>
              <span class="menu-text">应用启动</span>
            </a-menu-item>
           <a-menu-item key="recorder">
              <span class="menu-icon-wrapper">⏺️</span>
              <span class="menu-text">动作录制</span>
            </a-menu-item>
            <a-menu-item key="iframe">
              <span class="menu-icon-wrapper">🌐</span>
              <span class="menu-text">网页浏览</span>
            </a-menu-item>
            <!-- <a-menu-item key="scraper">
              <span class="menu-icon-wrapper">🕷️</span>
              <span class="menu-text">网页爬虫</span>
            </a-menu-item> -->
          </a-menu>
        </div>

        <div class="sider-footer">
          <div class="collapse-trigger" @click="collapsed = !collapsed">
            <span class="collapse-icon">{{ collapsed ? '→' : '←' }}</span>
            <span v-if="!collapsed" class="collapse-text">收起</span>
          </div>

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
  justify-content: flex-start;
  padding: 0 28px;
  gap: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.collapse-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(79, 172, 254, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.collapse-trigger:hover {
  background: rgba(79, 172, 254, 0.2);
  transform: translateX(-2px);
}

.collapse-icon {
  font-size: 16px;
  font-weight: bold;
  color: var(--primary-color);
  transition: transform 0.3s ease;
}

.collapse-trigger:hover .collapse-icon {
  transform: scale(1.2);
}

.collapse-text {
  font-size: 13px;
  color: var(--primary-color);
  font-weight: 600;
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

/* 侧边栏收起状态样式 */
.sider.ant-layout-sider-collapsed .brand {
  padding: 20px 0 !important;
  height: auto;
  justify-content: center !important;
  width: 100%;
}

.sider.ant-layout-sider-collapsed .brand-text {
  display: none;
}

.sider.ant-layout-sider-collapsed .logo-box {
  margin: 0 !important;
  width: 36px !important;
  height: 36px !important;
  border-radius: 10px;
}

.sider.ant-layout-sider-collapsed .menu-container {
  padding: 10px 12px;
}

.sider.ant-layout-sider-collapsed .ant-menu-item {
  padding-left: 0 !important;
  justify-content: center;
  height: 48px !important;
  line-height: 48px !important;
  margin-bottom: 6px !important;
}

.sider.ant-layout-sider-collapsed .menu-icon-wrapper {
  margin-right: 0;
  font-size: 22px;
  width: 17px;
}

.sider.ant-layout-sider-collapsed .menu-text {
  display: none;
}

.sider.ant-layout-sider-collapsed .sider-footer {
  padding: 16px 12px;
}

.sider.ant-layout-sider-collapsed .collapse-trigger {
  padding: 10px;
}

.sider.ant-layout-sider-collapsed .collapse-text {
  display: none;
}

.sider.ant-layout-sider-collapsed .autostart-card {
  flex-direction: column;
  padding: 10px;
  gap: 0;
  justify-content: center;
}

.sider.ant-layout-sider-collapsed .autostart-info {
  display: none;
}

/* 侧边栏过渡动画 */
.sider {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.ant-layout-sider-children) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.brand-text,
.menu-text,
.collapse-text,
.autostart-info {
  transition: opacity 0.2s ease;
}
</style>
