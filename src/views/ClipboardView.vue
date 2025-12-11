<script setup>
import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { message } from 'ant-design-vue';
import QRCode from 'qrcode';
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
  PictureOutlined,
  EditOutlined,
  GlobalOutlined,
  FilterOutlined,
  AppstoreOutlined,
  BarsOutlined,
  QrcodeOutlined,
  DownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue';
import {
  clipboardItems,
  removeClipboardItem,
  removeClipboardItems,
  clearHistory,
  clearAll,
  toggleFavorite,
  updateNote,
  getFavorites,
  getNonFavorites,
  imageDataToDataUrl
} from '../composables/useClipboardStore';

const loading = ref(false);
const searchKeyword = ref('');
const activeTab = ref('all'); // 'all' | 'favorites'
const filterType = ref('all'); // 'all' | 'text' | 'image' | 'url' | 'email'
const selectedItems = ref([]);
const previewImage = ref(null); // 图片预览
const previewVisible = ref(false); // 预览对话框显示状态

// 备注编辑相关
const noteModalVisible = ref(false);
const editingItem = ref(null);
const editingNote = ref('');

// 二维码相关
const qrCodeVisible = ref(false);
const qrCodeDataUrl = ref('');
const qrCodeContent = ref('');

// 过滤后的列表
const filteredItems = computed(() => {
  let items = activeTab.value === 'favorites'
    ? getFavorites()
    : clipboardItems.value;

  // 类型过滤
  if (filterType.value !== 'all') {
    items = items.filter(item => item.type === filterType.value);
  }

  // 关键词搜索
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

// 获取类型背景色（浅色）
const getTypeBgColor = (type) => {
  switch (type) {
    case 'url':
      return '#eff6ff'; // blue-50
    case 'email':
      return '#f5f3ff'; // violet-50
    case 'image':
      return '#ecfdf5'; // emerald-50
    default:
      return '#f1f5f9'; // slate-100
  }
};

// 获取类型标签文本
const getTypeLabel = (type) => {
  switch (type) {
    case 'url':
      return '链接';
    case 'email':
      return '邮件';
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

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 复制到剪贴板
const copyToClipboard = async (item) => {
  try {
    if (item.type === 'image' && item.imageData) {
      await invoke('set_clipboard_image', { imageData: item.imageData });
      message.success('已复制图片到剪贴板');
    } else {
      await invoke('set_clipboard_text', { text: item.content });
      message.success('已复制文本到剪贴板');
    }
  } catch (error) {
    message.error('复制失败: ' + error);
  }
};

// 打开链接
const openUrl = async (url) => {
  try {
    // 确保有协议头
    let targetUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      targetUrl = 'https://' + url;
    }
    await open(targetUrl);
    message.success('正在打开浏览器...');
  } catch (error) {
    message.error('无法打开链接: ' + error);
  }
};

// 使用搜索引擎搜索
const searchInBrowser = async (text) => {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
    await open(searchUrl);
    message.success('正在打开搜索...');
  } catch (error) {
    message.error('搜索失败: ' + error);
  }
};

// 生成二维码
const showQRCode = async (item) => {
  try {
    const text = item.content;
    qrCodeDataUrl.value = await QRCode.toDataURL(text, { width: 300, margin: 2 });
    qrCodeContent.value = text;
    qrCodeVisible.value = true;
  } catch (error) {
    message.error('生成二维码失败: ' + error);
  }
};

// 下载文件
const downloadItem = async (item) => {
  try {
    if (item.type === 'image') {
      // 图片下载
      const filePath = await save({
        filters: [{
          name: 'Image',
          extensions: ['png']
        }],
        defaultPath: `clipboard_image_${Date.now()}.png`
      });

      if (!filePath) return;

      // 使用 imageDataToDataUrl 获取完整的 PNG Data URL (data:image/png;base64,...)
      const dataUrl = imageDataToDataUrl(item.imageData);
      if (!dataUrl) throw new Error('无法转换图片数据');
      
      // 提取 base64 部分
      const base64Data = dataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      await writeFile(filePath, bytes);
      message.success('图片已保存');
    } else {
      // 文本下载
      const filePath = await save({
        filters: [{
          name: 'Text',
          extensions: ['txt']
        }],
        defaultPath: `clipboard_text_${Date.now()}.txt`
      });

      if (!filePath) return;

      await writeTextFile(filePath, item.content);
      message.success('文本已保存');
    }
  } catch (error) {
    message.error('保存失败: ' + error);
  }
};

// 获取字数/字符数
const getWordCount = (text) => {
  if (!text) return 0;
  // 简单统计：中文字符算一个，英文单词算一个
  const cnMatch = text.match(/[\u4e00-\u9fa5]/g);
  const cnCount = cnMatch ? cnMatch.length : 0;
  
  const enText = text.replace(/[\u4e00-\u9fa5]/g, ' ');
  const enMatch = enText.match(/[a-zA-Z0-9]+/g);
  const enCount = enMatch ? enMatch.length : 0;
  
  return cnCount + enCount;
};

// 打开备注编辑
const openNoteModal = (item) => {
  editingItem.value = item;
  editingNote.value = item.note || '';
  noteModalVisible.value = true;
};

// 保存备注
const saveNote = async () => {
  if (editingItem.value) {
    try {
      await updateNote(editingItem.value.id, editingNote.value);
      message.success('备注已更新');
      noteModalVisible.value = false;
      editingItem.value = null;
      editingNote.value = '';
    } catch (error) {
      message.error('保存失败: ' + error);
    }
  }
};

// 双击处理
const handleDoubleClick = (item) => {
  if (item.type === 'image') {
    showImagePreview(item);
  } else if (item.type === 'url') {
    openUrl(item.content);
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

// 不需要 onMounted，因为数据已在 App.vue 中加载
</script>

<template>
  <div class="clipboard-view">
    <!-- 顶部控制区 -->
    <div class="control-panel glass-effect">
      <div class="search-bar">
        <a-input
          v-model:value="searchKeyword"
          placeholder="搜索剪贴板内容、备注..."
          class="custom-search"
          allow-clear
        >
          <template #prefix>
            <SearchOutlined style="color: var(--text-tertiary)" />
          </template>
        </a-input>
      </div>
      
      <div class="filter-bar">
        <a-radio-group v-model:value="filterType" button-style="solid" size="small">
          <a-radio-button value="all">全部</a-radio-button>
          <a-radio-button value="text">文本</a-radio-button>
          <a-radio-button value="image">图片</a-radio-button>
          <a-radio-button value="url">链接</a-radio-button>
          <a-radio-button value="email">邮件</a-radio-button>
        </a-radio-group>

        <div class="actions-right">
          <a-tooltip title="清空非收藏历史">
            <a-button type="text" @click="handleClearHistory" class="icon-btn">
              <ClearOutlined />
            </a-button>
          </a-tooltip>
          <a-popconfirm
            title="确定要清空所有记录吗？包括收藏项！"
            ok-text="确定"
            cancel-text="取消"
            @confirm="handleClearAll"
          >
            <a-tooltip title="清空所有">
              <a-button type="text" danger class="icon-btn">
                <DeleteOutlined />
              </a-button>
            </a-tooltip>
          </a-popconfirm>
        </div>
      </div>
    </div>

    <!-- 主要内容区 -->
    <div class="main-content">
      <a-tabs v-model:activeKey="activeTab" class="custom-tabs" :animated="true">
        <a-tab-pane key="all" tab="最近记录">
          <template #tab>
            <span><BarsOutlined /> 最近记录</span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="favorites" tab="我的收藏">
          <template #tab>
             <span><StarFilled /> 我的收藏</span>
          </template>
        </a-tab-pane>
      </a-tabs>

      <div class="list-container">
        <a-spin :spinning="loading">
          <div v-if="filteredItems.length === 0" class="empty-state">
            <a-empty :description="searchKeyword ? '未找到相关记录' : '暂无剪贴板记录'">
              <template #image>
                <div class="empty-icon-wrapper">
                  <component :is="activeTab === 'favorites' ? StarOutlined : FileTextOutlined" />
                </div>
              </template>
            </a-empty>
          </div>

          <transition-group name="list" tag="div" class="items-grid" v-else>
            <div
              v-for="item in filteredItems"
              :key="item.id"
              class="clipboard-card glass-effect"
              :class="{ 'is-favorite': item.isFavorite }"
              @dblclick="handleDoubleClick(item)"
            >
              <!-- 卡片头部 -->
              <div class="card-header">
                <div class="type-tag" :style="{ color: getTypeColor(item.type), backgroundColor: getTypeBgColor(item.type) }">
                  <component :is="getTypeIcon(item.type)" />
                  <span>{{ getTypeLabel(item.type) }}</span>
                </div>
                <div class="time-tag">
                  {{ formatTime(item.createdAt) }}
                </div>
              </div>

              <!-- 卡片内容 -->
              <div class="card-body">
                <!-- 图片预览 -->
                <div v-if="item.type === 'image'" class="image-preview" @click.stop="showImagePreview(item)">
                  <img :src="getImageDataUrl(item)" :alt="item.content" loading="lazy" />
                  <div class="image-overlay">
                    <SearchOutlined /> 预览
                  </div>
                </div>
                
                <!-- 文本内容 -->
                <div v-else class="text-content">
                  {{ item.content }}
                </div>
                
                <!-- 文本统计信息 (仅文本类型显示) -->
                <div v-if="item.type === 'text' || item.type === 'url' || item.type === 'email'" class="text-stats">
                  <span class="stat-item">{{ item.content.length }} 字符</span>
                  <span class="stat-item">{{ getWordCount(item.content) }} 字</span>
                </div>

                <!-- 备注显示 -->
                <div v-if="item.note" class="note-display" @click.stop="openNoteModal(item)">
                  <EditOutlined class="note-icon" />
                  <span>{{ item.note }}</span>
                </div>
              </div>

              <!-- 卡片底部操作栏 -->
              <div class="card-footer">
                <div class="action-group">
                  <a-tooltip :title="item.isFavorite ? '取消收藏' : '收藏'">
                    <a-button 
                      type="text" 
                      size="small" 
                      class="action-btn"
                      :class="{ 'favorite-active': item.isFavorite }"
                      @click.stop="handleToggleFavorite(item.id)"
                    >
                      <component :is="item.isFavorite ? StarFilled : StarOutlined" />
                    </a-button>
                  </a-tooltip>

                  <a-tooltip title="复制">
                    <a-button type="text" size="small" class="action-btn" @click.stop="copyToClipboard(item)">
                      <CopyOutlined />
                    </a-button>
                  </a-tooltip>
                  
                  <a-tooltip title="编辑备注">
                    <a-button type="text" size="small" class="action-btn" @click.stop="openNoteModal(item)">
                      <EditOutlined />
                    </a-button>
                  </a-tooltip>

                  <!-- 新增功能按钮 -->
                  <a-tooltip title="保存文件">
                    <a-button type="text" size="small" class="action-btn" @click.stop="downloadItem(item)">
                      <DownloadOutlined />
                    </a-button>
                  </a-tooltip>

                  <a-tooltip v-if="item.type !== 'image'" title="生成二维码">
                    <a-button type="text" size="small" class="action-btn" @click.stop="showQRCode(item)">
                      <QrcodeOutlined />
                    </a-button>
                  </a-tooltip>

                  <a-tooltip v-if="item.type === 'url'" title="打开链接">
                    <a-button type="text" size="small" class="action-btn" @click.stop="openUrl(item.content)">
                      <GlobalOutlined />
                    </a-button>
                  </a-tooltip>
                  
                  <a-tooltip v-if="item.type === 'text'" title="在浏览器搜索">
                    <a-button type="text" size="small" class="action-btn" @click.stop="searchInBrowser(item.content)">
                      <SearchOutlined />
                    </a-button>
                  </a-tooltip>
                </div>

                <a-popconfirm
                  title="确定删除此记录?"
                  @confirm="handleDelete(item.id)"
                  ok-text="是"
                  cancel-text="否"
                >
                  <a-button type="text" size="small" danger class="delete-btn">
                    <DeleteOutlined />
                  </a-button>
                </a-popconfirm>
              </div>
            </div>
          </transition-group>
        </a-spin>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <a-modal
      v-model:open="previewVisible"
      :footer="null"
      width="80%"
      centered
      class="preview-modal"
      @cancel="closeImagePreview"
    >
      <div class="full-image-container">
        <img :src="previewImage" alt="预览图片" />
      </div>
    </a-modal>

    <!-- 备注编辑弹窗 -->
    <a-modal
      v-model:open="noteModalVisible"
      title="编辑备注"
      @ok="saveNote"
      centered
      :maskClosable="false"
    >
      <a-textarea
        v-model:value="editingNote"
        placeholder="为此记录添加备注..."
        :rows="4"
        show-count
        :maxlength="100"
      />
    </a-modal>

    <!-- 二维码弹窗 -->
    <a-modal
      v-model:open="qrCodeVisible"
      title="二维码"
      :footer="null"
      centered
      width="360px"
    >
      <div class="qrcode-container">
        <img :src="qrCodeDataUrl" alt="QR Code" />
        <div class="qrcode-text">{{ qrCodeContent }}</div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.clipboard-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
}

/* 控制面板 */
.control-panel {
  padding: 16px;
  border-radius: var(--border-radius);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: var(--box-shadow-sm);
  z-index: 10;
}

.search-bar {
  width: 100%;
}

.custom-search :deep(.ant-input) {
  background: transparent;
}

.custom-search :deep(.ant-input-affix-wrapper) {
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.06);
  background: rgba(255,255,255,0.6);
  padding: 8px 11px;
}

.custom-search :deep(.ant-input-affix-wrapper:focus),
.custom-search :deep(.ant-input-affix-wrapper-focused) {
  box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.2);
  border-color: var(--primary-color);
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions-right {
  display: flex;
  gap: 4px;
}

.icon-btn {
  color: var(--text-secondary);
  transition: all 0.3s;
}

.icon-btn:hover {
  background: rgba(0,0,0,0.05);
  color: var(--primary-color);
}

.icon-btn.ant-btn-dangerous:hover {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
}

/* 主要内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 防止双滚动条 */
}

/* 标签页自定义 */
.custom-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}

.custom-tabs :deep(.ant-tabs-tab) {
  padding: 8px 0;
  margin-right: 24px;
  color: var(--text-tertiary);
  transition: all 0.3s;
}

.custom-tabs :deep(.ant-tabs-tab:hover) {
  color: var(--primary-color);
}

.custom-tabs :deep(.ant-tabs-tab-active) .ant-tabs-tab-btn {
  color: var(--primary-color);
  font-weight: 600;
}

.custom-tabs :deep(.ant-tabs-ink-bar) {
  background: var(--primary-gradient);
  height: 3px;
  border-radius: 3px;
}

/* 列表容器 */
.list-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 6px; /* 给滚动条留点空间 */
  padding-bottom: 20px;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* 卡片样式 */
.clipboard-card {
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.6);
  position: relative;
  overflow: hidden;
  height: 200px; /* 固定高度，统一视觉 */
}

.clipboard-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--box-shadow-hover);
  border-color: rgba(79, 172, 254, 0.3);
  background: #fff;
}

.clipboard-card.is-favorite {
  border-color: rgba(251, 191, 36, 0.4);
  background: linear-gradient(to bottom right, rgba(255, 255, 255, 0.9), rgba(255, 251, 235, 0.6));
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.type-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.time-tag {
  font-size: 11px;
  color: var(--text-tertiary);
}

.card-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 文本内容 */
.text-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
  flex: 1; /* 让文本内容占据剩余空间，但不超过max-height限制 */
}

.text-stats {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 4px;
  display: flex;
  gap: 8px;
}

/* 图片预览小图 */
.image-preview {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
  position: relative;
  cursor: zoom-in;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.2s;
  backdrop-filter: blur(2px);
}

.image-preview:hover .image-overlay {
  opacity: 1;
}

/* 备注 */
.note-display {
  margin-top: auto;
  padding-top: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: color 0.2s;
}

.note-display:hover {
  color: var(--primary-color);
}

.note-icon {
  font-size: 12px;
}

/* 底部操作栏 */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid rgba(0,0,0,0.03);
  margin-top: auto; /* 确保在底部 */
}

.action-group {
  display: flex;
  gap: 4px;
}

.action-btn {
  color: var(--text-secondary);
}

.action-btn:hover {
  color: var(--primary-color);
  background: rgba(79, 172, 254, 0.1);
}

.favorite-active {
  color: #fbbf24 !important;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.clipboard-card:hover .delete-btn {
  opacity: 1;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--text-tertiary);
}

.empty-icon-wrapper {
  font-size: 48px;
  color: #e2e8f0;
  margin-bottom: 16px;
}

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 全图预览 */
.full-image-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
}

.full-image-container img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
}

/* 二维码容器 */
.qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 10px;
}

.qrcode-container img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.qrcode-text {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  word-break: break-all;
  max-width: 100%;
  max-height: 60px;
  overflow-y: auto;
}
</style>
