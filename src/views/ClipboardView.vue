<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { message } from 'ant-design-vue';
import {
  SearchOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  CopyOutlined,
  LinkOutlined,
  MailOutlined,
  FileTextOutlined,
  ClearOutlined,
  PictureOutlined
} from '@ant-design/icons-vue';
import {
  clipboardItems,
  loadClipboardItems,
  addClipboardItem,
  removeClipboardItem,
  removeClipboardItems,
  clearHistory,
  clearAll,
  toggleFavorite,
  updateNote,
  searchItems,
  getFavorites,
  getNonFavorites,
  imageDataToDataUrl
} from '../composables/useClipboardStore';

const loading = ref(true);
const searchKeyword = ref('');
const activeTab = ref('all'); // 'all' | 'favorites'
const selectedItems = ref([]);
const previewImage = ref(null); // 图片预览
const previewVisible = ref(false); // 预览对话框显示状态
let unlistenClipboard = null;

// 过滤后的列表
const filteredItems = computed(() => {
  let items = activeTab.value === 'favorites'
    ? getFavorites()
    : clipboardItems.value;

  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase();
    items = items.filter(item =>
      item.content.toLowerCase().includes(keyword) ||
      (item.note && item.note.toLowerCase().includes(keyword))
    );
  }

  return items;
});

// 统计信息
const stats = computed(() => ({
  total: clipboardItems.value.length,
  favorites: getFavorites().length,
  nonFavorites: getNonFavorites().length
}));

// 获取类型图标
const getTypeIcon = (type) => {
  switch (type) {
    case 'url':
      return LinkOutlined;
    case 'email':
      return MailOutlined;
    case 'image':
      return PictureOutlined;
    default:
      return FileTextOutlined;
  }
};

// 获取类型标签颜色
const getTypeColor = (type) => {
  switch (type) {
    case 'url':
      return '#3b82f6';
    case 'email':
      return '#8b5cf6';
    case 'image':
      return '#10b981';
    default:
      return '#64748b';
  }
};

// 获取类型标签文本
const getTypeLabel = (type) => {
  switch (type) {
    case 'url':
      return 'URL';
    case 'email':
      return 'Email';
    case 'image':
      return '图片';
    default:
      return '文本';
  }
};

// 获取图片 Data URL
const getImageDataUrl = (item) => {
  if (item.type !== 'image' || !item.imageData) return null;
  return imageDataToDataUrl(item.imageData);
};

// 显示图片预览
const showImagePreview = (item) => {
  if (item.type !== 'image') return;
  previewImage.value = getImageDataUrl(item);
  previewVisible.value = true;
};

// 关闭图片预览
const closeImagePreview = () => {
  previewVisible.value = false;
  previewImage.value = null;
};

// 格式化时间
const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }

  // 小于24小时
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  }

  // 小于7天
  if (diff < 604800000) {
    return `${Math.floor(diff / 86400000)}天前`;
  }

  // 显示具体日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 复制到剪贴板（支持文本和图片）
const copyToClipboard = async (item) => {
  try {
    if (item.type === 'image' && item.imageData) {
      await invoke('set_clipboard_image', { imageData: item.imageData });
      message.success('已复制图片到剪贴板');
    } else {
      await invoke('set_clipboard_text', { text: item.content });
      message.success('已复制到剪贴板');
    }
  } catch (error) {
    message.error('复制失败: ' + error);
  }
};

// 双击复制或预览
const handleDoubleClick = (item) => {
  if (item.type === 'image') {
    showImagePreview(item);
  } else {
    copyToClipboard(item);
  }
};

// 切换收藏
const handleToggleFavorite = async (itemId) => {
  try {
    await toggleFavorite(itemId);
  } catch (error) {
    message.error('操作失败: ' + error);
  }
};

// 删除单个项目
const handleDelete = async (itemId) => {
  try {
    await removeClipboardItem(itemId);
    message.success('已删除');
  } catch (error) {
    message.error('删除失败: ' + error);
  }
};

// 批量删除
const handleBatchDelete = async () => {
  if (selectedItems.value.length === 0) {
    message.warning('请先选择要删除的项目');
    return;
  }

  try {
    await removeClipboardItems(selectedItems.value);
    selectedItems.value = [];
    message.success(`已删除 ${selectedItems.value.length} 项`);
  } catch (error) {
    message.error('删除失败: ' + error);
  }
};

// 清空历史
const handleClearHistory = () => {
  if (clipboardItems.value.length === 0) {
    message.info('历史记录已为空');
    return;
  }

  clearHistory();
  message.success('已清空历史记录（保留收藏）');
};

// 清空所有
const handleClearAll = () => {
  if (clipboardItems.value.length === 0) {
    message.info('列表已为空');
    return;
  }

  clearAll();
  message.success('已清空所有记录');
};

// 启动剪贴板监听
const startMonitoring = async () => {
  try {
    // 启动后端监听服务
    await invoke('start_clipboard_monitor');

    // 监听剪贴板变化事件
    unlistenClipboard = await listen('clipboard-changed', async (event) => {
      const content = event.payload;
      await addClipboardItem(content);
    });

    console.log('剪贴板监听已启动');
  } catch (error) {
    console.error('启动剪贴板监听失败:', error);
    message.error('启动监听失败: ' + error);
  }
};

// 停止剪贴板监听
const stopMonitoring = async () => {
  try {
    await invoke('stop_clipboard_monitor');
    if (unlistenClipboard) {
      unlistenClipboard();
      unlistenClipboard = null;
    }
    console.log('剪贴板监听已停止');
  } catch (error) {
    console.error('停止剪贴板监听失败:', error);
  }
};

// 组件挂载
onMounted(async () => {
  loading.value = true;
  try {
    await loadClipboardItems();
    await startMonitoring();
  } catch (error) {
    console.error('初始化失败:', error);
  } finally {
    loading.value = false;
  }
});

// 组件卸载
onUnmounted(() => {
  stopMonitoring();
});
</script>

<template>
  <div class="clipboard-view">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input
          v-model:value="searchKeyword"
          placeholder="搜索剪贴板内容..."
          class="search-input"
          allow-clear
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </a-input>
      </div>

      <div class="toolbar-right">
        <a-button @click="handleClearHistory" class="action-btn">
          <template #icon><ClearOutlined /></template>
          清空历史
        </a-button>
        <a-button danger @click="handleClearAll" class="action-btn">
          <template #icon><DeleteOutlined /></template>
          清空所有
        </a-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">总计</span>
        <span class="stat-value">{{ stats.total }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">收藏</span>
        <span class="stat-value favorite-color">{{ stats.favorites }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">普通</span>
        <span class="stat-value">{{ stats.nonFavorites }}</span>
      </div>
    </div>

    <!-- 标签页切换 -->
    <a-tabs v-model:activeKey="activeTab" class="custom-tabs">
      <a-tab-pane key="all" tab="全部记录">
        <div class="items-container">
          <a-spin :spinning="loading">
            <div v-if="filteredItems.length === 0" class="empty-state">
              <a-empty description="暂无剪贴板记录">
                <template #image>
                  <div class="empty-icon">📋</div>
                </template>
              </a-empty>
            </div>

            <div v-else class="items-list">
              <div
                v-for="item in filteredItems"
                :key="item.id"
                class="clipboard-item"
                @dblclick="handleDoubleClick(item)"
              >
                <div class="item-header">
                  <div class="item-type">
                    <component :is="getTypeIcon(item.type)" :style="{ color: getTypeColor(item.type) }" />
                    <span class="type-label" :style="{ color: getTypeColor(item.type) }">
                      {{ getTypeLabel(item.type) }}
                    </span>
                  </div>

                  <div class="item-actions">
                    <a-button
                      type="text"
                      size="small"
                      @click="handleToggleFavorite(item.id)"
                      class="action-icon"
                    >
                      <component :is="item.isFavorite ? StarFilled : StarOutlined"
                        :style="{ color: item.isFavorite ? '#fbbf24' : '#94a3b8' }"
                      />
                    </a-button>
                    <a-button
                      type="text"
                      size="small"
                      @click="copyToClipboard(item)"
                      class="action-icon"
                    >
                      <CopyOutlined />
                    </a-button>
                    <a-button
                      type="text"
                      size="small"
                      danger
                      @click="handleDelete(item.id)"
                      class="action-icon"
                    >
                      <DeleteOutlined />
                    </a-button>
                  </div>
                </div>

                <!-- 图片预览 -->
                <div v-if="item.type === 'image'" class="item-image" @click="showImagePreview(item)">
                  <img :src="getImageDataUrl(item)" :alt="item.content" />
                </div>

                <!-- 文本内容 -->
                <div v-else class="item-content">
                  {{ item.content }}
                </div>

                <div class="item-footer">
                  <span class="item-time">{{ formatTime(item.createdAt) }}</span>
                  <span v-if="item.note" class="item-note">{{ item.note }}</span>
                </div>
              </div>
            </div>
          </a-spin>
        </div>
      </a-tab-pane>

      <a-tab-pane key="favorites" tab="收藏夹">
        <div class="items-container">
          <div v-if="filteredItems.length === 0" class="empty-state">
            <a-empty description="暂无收藏">
              <template #image>
                <div class="empty-icon">⭐</div>
              </template>
            </a-empty>
          </div>

          <div v-else class="items-list">
            <div
              v-for="item in filteredItems"
              :key="item.id"
              class="clipboard-item"
              @dblclick="handleDoubleClick(item)"
            >
              <div class="item-header">
                <div class="item-type">
                  <component :is="getTypeIcon(item.type)" :style="{ color: getTypeColor(item.type) }" />
                  <span class="type-label" :style="{ color: getTypeColor(item.type) }">
                    {{ getTypeLabel(item.type) }}
                  </span>
                </div>

                <div class="item-actions">
                  <a-button
                    type="text"
                    size="small"
                    @click="handleToggleFavorite(item.id)"
                    class="action-icon"
                  >
                    <StarFilled style="color: #fbbf24" />
                  </a-button>
                  <a-button
                    type="text"
                    size="small"
                    @click="copyToClipboard(item)"
                    class="action-icon"
                  >
                    <CopyOutlined />
                  </a-button>
                  <a-button
                    type="text"
                    size="small"
                    danger
                    @click="handleDelete(item.id)"
                    class="action-icon"
                  >
                    <DeleteOutlined />
                  </a-button>
                </div>
              </div>

              <!-- 图片预览 -->
              <div v-if="item.type === 'image'" class="item-image" @click="showImagePreview(item)">
                <img :src="getImageDataUrl(item)" :alt="item.content" />
              </div>

              <!-- 文本内容 -->
              <div v-else class="item-content">
                {{ item.content }}
              </div>

              <div class="item-footer">
                <span class="item-time">{{ formatTime(item.createdAt) }}</span>
                <span v-if="item.note" class="item-note">{{ item.note }}</span>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>

    <!-- 图片预览对话框 -->
    <a-modal
      v-model:open="previewVisible"
      title="图片预览"
      :footer="null"
      width="80%"
      @cancel="closeImagePreview"
    >
      <div class="image-preview-container">
        <img :src="previewImage" alt="预览图片" class="preview-image" />
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.clipboard-view {
  padding-bottom: 20px;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: var(--box-shadow);
}

.toolbar-left {
  flex: 1;
  max-width: 400px;
}

.search-input {
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.search-input:focus,
.search-input:hover {
  border-color: var(--primary-color);
}

.toolbar-right {
  display: flex;
  gap: 12px;
}

.action-btn {
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 统计信息栏 */
.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: var(--box-shadow);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.favorite-color {
  color: #fbbf24;
}

/* 标签页 */
.custom-tabs {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  box-shadow: var(--box-shadow);
  padding: 20px;
}

:deep(.ant-tabs-nav) {
  margin-bottom: 20px;
}

:deep(.ant-tabs-tab) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

:deep(.ant-tabs-tab-active) {
  background: var(--primary-gradient);
}

:deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: white !important;
}

/* 项目容器 */
.items-container {
  min-height: 400px;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 600px;
  overflow-y: auto;
  padding-right: 8px;
}

/* 剪贴板项目卡片 */
.clipboard-item {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.clipboard-item:hover {
  background: white;
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.15);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.item-type {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.type-label {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.action-icon {
  transition: all 0.3s ease;
}

.action-icon:hover {
  transform: scale(1.1);
}

.item-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  word-break: break-all;
  max-height: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  margin-bottom: 12px;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

.item-time {
  color: var(--text-tertiary);
}

.item-note {
  color: var(--primary-color);
  font-style: italic;
}

/* 空状态 */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

/* 图片项目样式 */
.item-image {
  margin-bottom: 12px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: #f8fafc;
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 200px;
  transition: all 0.3s ease;
}

.item-image:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.item-image img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

/* 图片预览对话框 */
.image-preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}
</style>
