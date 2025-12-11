<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
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
  InfoCircleOutlined,
  CheckSquareOutlined,
  CloseSquareOutlined,
  ExportOutlined,
  MergeCellsOutlined,
  CalendarOutlined,
  FontSizeOutlined
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
  imageDataToDataUrl,
  maxHistoryLimit,
  setMaxHistoryLimit
} from '../composables/useClipboardStore';

const loading = ref(true); // 默认开启加载状态
const searchKeyword = ref('');
const activeTab = ref('all'); // 'all' | 'favorites'
const filterType = ref('all'); // 'all' | 'text' | 'image' | 'url' | 'email'
const selectedItems = ref([]);
const previewImage = ref(null); // 图片预览
const previewVisible = ref(false); // 预览对话框显示状态
const listContainerRef = ref(null);
const loadTrigger = ref(null);

// 批量操作相关
const batchMode = ref(false);
const batchSelectedIds = ref(new Set());

// 高级筛选相关
const advancedFilterVisible = ref(false);
const dateRange = ref('all'); // 'all' | 'today' | 'week' | 'month'
const wordCountRange = ref('all'); // 'all' | 'short' | 'medium' | 'long'

// 搜索增强相关
const regexMode = ref(false);
const searchHistory = ref([]);
const searchInputFocused = ref(false);

// 分页相关
const pageSize = 20;
const visibleCount = ref(pageSize);

// 图片缓存
const imageCache = new Map();

// 备注编辑相关
const noteModalVisible = ref(false);
const editingItem = ref(null);
const editingNote = ref('');

// 二维码相关
const qrCodeVisible = ref(false);
const qrCodeDataUrl = ref('');
const qrCodeContent = ref('');

// 文本预览相关
const textPreviewVisible = ref(false);
const textPreviewContent = ref('');
const textPreviewItem = ref(null);

// 过滤后的列表
const filteredItems = computed(() => {
  let items = activeTab.value === 'favorites'
    ? getFavorites()
    : clipboardItems.value;

  // 类型过滤
  if (filterType.value !== 'all') {
    items = items.filter(item => item.type === filterType.value);
  }

  // 日期范围筛选
  if (dateRange.value !== 'all') {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    items = items.filter(item => {
      const diff = now - item.createdAt;
      if (dateRange.value === 'today') return diff < oneDayMs;
      if (dateRange.value === 'week') return diff < 7 * oneDayMs;
      if (dateRange.value === 'month') return diff < 30 * oneDayMs;
      return true;
    });
  }

  // 字数范围筛选
  if (wordCountRange.value !== 'all') {
    items = items.filter(item => {
      const wordCount = getWordCount(item.content);
      if (wordCountRange.value === 'short') return wordCount < 100;
      if (wordCountRange.value === 'medium') return wordCount >= 100 && wordCount <= 500;
      if (wordCountRange.value === 'long') return wordCount > 500;
      return true;
    });
  }

  // 关键词搜索（支持正则）
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value;
    if (regexMode.value) {
      try {
        const regex = new RegExp(keyword, 'i');
        items = items.filter(item =>
          regex.test(item.content) ||
          (item.note && regex.test(item.note))
        );
      } catch (e) {
        // 正则表达式错误，回退到普通搜索
        const lowerKeyword = keyword.toLowerCase();
        items = items.filter(item =>
          item.content.toLowerCase().includes(lowerKeyword) ||
          (item.note && item.note.toLowerCase().includes(lowerKeyword))
        );
      }
    } else {
      const lowerKeyword = keyword.toLowerCase();
      items = items.filter(item =>
        item.content.toLowerCase().includes(lowerKeyword) ||
        (item.note && item.note.toLowerCase().includes(lowerKeyword))
      );
    }
  }

  return items;
});

// 分页后的显示列表
const displayedItems = computed(() => {
  return filteredItems.value.slice(0, visibleCount.value);
});

// 监听筛选条件变化，重置分页
watch([() => activeTab.value, () => filterType.value, () => searchKeyword.value, () => dateRange.value, () => wordCountRange.value], () => {
  visibleCount.value = pageSize;
  // 清理部分缓存以释放内存
  if (imageCache.size > 100) {
    imageCache.clear();
  }
  // 滚动回顶部
  if (listContainerRef.value) {
    listContainerRef.value.scrollTop = 0;
  }
  // 退出批量模式
  if (batchMode.value) {
    batchMode.value = false;
    batchSelectedIds.value.clear();
  }
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

// 获取图片 Data URL (带缓存)
const getImageDataUrl = (item) => {
  if (item.type !== 'image' || !item.imageData) return null;
  
  // 优先从缓存获取
  if (imageCache.has(item.id)) {
    return imageCache.get(item.id);
  }
  
  const url = imageDataToDataUrl(item.imageData);
  if (url) {
    imageCache.set(item.id, url);
  }
  return url;
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

// 显示文本预览
const showTextPreview = (item) => {
  if (item.type === 'image') return;
  textPreviewContent.value = item.content;
  textPreviewItem.value = item;
  textPreviewVisible.value = true;
};

// 关闭文本预览
const closeTextPreview = () => {
  textPreviewVisible.value = false;
  textPreviewContent.value = '';
  textPreviewItem.value = null;
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

// 处理存储限制变更
const handleLimitChange = async (value) => {
  try {
    await setMaxHistoryLimit(value);
    message.success(`已设置存储上限为 ${value} 条`);
  } catch (error) {
    message.error('设置失败: ' + error);
  }
};

// ========== 批量操作功能 ==========

// 切换批量模式
const toggleBatchMode = () => {
  batchMode.value = !batchMode.value;
  if (!batchMode.value) {
    batchSelectedIds.value.clear();
  }
};

// 切换单项选中状态
const toggleItemSelection = (itemId) => {
  if (batchSelectedIds.value.has(itemId)) {
    batchSelectedIds.value.delete(itemId);
  } else {
    batchSelectedIds.value.add(itemId);
  }
};

// 全选/取消全选
const toggleSelectAll = () => {
  if (batchSelectedIds.value.size === displayedItems.value.length) {
    batchSelectedIds.value.clear();
  } else {
    batchSelectedIds.value.clear();
    displayedItems.value.forEach(item => {
      batchSelectedIds.value.add(item.id);
    });
  }
};

// 批量删除
const handleBatchDelete = async () => {
  if (batchSelectedIds.value.size === 0) {
    message.warning('请先选择要删除的项目');
    return;
  }
  try {
    const ids = Array.from(batchSelectedIds.value);
    await removeClipboardItems(ids);
    message.success(`已删除 ${ids.length} 项`);
    batchSelectedIds.value.clear();
    batchMode.value = false;
  } catch (error) {
    message.error('批量删除失败: ' + error);
  }
};

// 批量收藏/取消收藏
const handleBatchFavorite = async (isFavorite) => {
  if (batchSelectedIds.value.size === 0) {
    message.warning('请先选择要操作的项目');
    return;
  }
  try {
    const ids = Array.from(batchSelectedIds.value);
    for (const id of ids) {
      await toggleFavorite(id);
    }
    message.success(`已${isFavorite ? '收藏' : '取消收藏'} ${ids.length} 项`);
    batchSelectedIds.value.clear();
  } catch (error) {
    message.error('批量操作失败: ' + error);
  }
};

// 批量导出
const handleBatchExport = async () => {
  if (batchSelectedIds.value.size === 0) {
    message.warning('请先选择要导出的项目');
    return;
  }
  try {
    const selectedItems = clipboardItems.value.filter(item =>
      batchSelectedIds.value.has(item.id)
    );

    let content = '';
    selectedItems.forEach((item, index) => {
      content += `========== 项目 ${index + 1} ==========\n`;
      content += `类型: ${getTypeLabel(item.type)}\n`;
      content += `时间: ${new Date(item.createdAt).toLocaleString('zh-CN')}\n`;
      if (item.note) content += `备注: ${item.note}\n`;
      content += `内容:\n${item.content}\n\n`;
    });

    const filePath = await save({
      filters: [{
        name: 'Text',
        extensions: ['txt']
      }],
      defaultPath: `clipboard_export_${Date.now()}.txt`
    });

    if (!filePath) return;

    await writeTextFile(filePath, content);
    message.success(`已导出 ${selectedItems.length} 项到文件`);
  } catch (error) {
    message.error('导出失败: ' + error);
  }
};

// 批量合并复制
const handleBatchCopy = async () => {
  if (batchSelectedIds.value.size === 0) {
    message.warning('请先选择要合并的项目');
    return;
  }
  try {
    const selectedItems = clipboardItems.value
      .filter(item => batchSelectedIds.value.has(item.id))
      .filter(item => item.type !== 'image'); // 排除图片

    if (selectedItems.length === 0) {
      message.warning('没有可合并的文本内容');
      return;
    }

    const mergedContent = selectedItems.map(item => item.content).join('\n\n');
    await invoke('set_clipboard_text', { text: mergedContent });
    message.success(`已合并复制 ${selectedItems.length} 项`);
  } catch (error) {
    message.error('合并复制失败: ' + error);
  }
};

// ========== 搜索历史功能 ==========

// 加载搜索历史
const loadSearchHistory = () => {
  try {
    const history = localStorage.getItem('clipboard_search_history');
    if (history) {
      searchHistory.value = JSON.parse(history);
    }
  } catch (error) {
    console.error('加载搜索历史失败:', error);
  }
};

// 保存搜索历史
const saveSearchHistory = (keyword) => {
  if (!keyword.trim()) return;

  // 移除重复项
  searchHistory.value = searchHistory.value.filter(item => item !== keyword);
  // 添加到开头
  searchHistory.value.unshift(keyword);
  // 限制最多5条
  if (searchHistory.value.length > 5) {
    searchHistory.value = searchHistory.value.slice(0, 5);
  }

  try {
    localStorage.setItem('clipboard_search_history', JSON.stringify(searchHistory.value));
  } catch (error) {
    console.error('保存搜索历史失败:', error);
  }
};

// 清空搜索历史
const clearSearchHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem('clipboard_search_history');
  message.success('已清空搜索历史');
};

// 使用搜索历史
const useSearchHistory = (keyword) => {
  searchKeyword.value = keyword;
};

// 处理搜索框失焦
const handleSearchBlur = () => {
  setTimeout(() => {
    searchInputFocused.value = false;
  }, 200);
};

// 监听搜索关键词变化，保存历史
watch(searchKeyword, (newVal, oldVal) => {
  if (oldVal && oldVal.trim() && newVal !== oldVal) {
    saveSearchHistory(oldVal);
  }
});

// 滚动加载更多
const loadMore = () => {
  if (visibleCount.value < filteredItems.value.length) {
    visibleCount.value += pageSize;
  }
};

// ========== 快捷键支持 ==========

// 快捷键处理
const handleKeyDown = (e) => {
  // Ctrl/Cmd + A: 全选
  if ((e.ctrlKey || e.metaKey) && e.key === 'a' && batchMode.value) {
    e.preventDefault();
    toggleSelectAll();
    return;
  }

  // Ctrl/Cmd + F: 聚焦搜索框
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const searchInput = document.querySelector('.custom-search input');
    if (searchInput) searchInput.focus();
    return;
  }

  // Delete: 删除选中项
  if (e.key === 'Delete' && batchMode.value && batchSelectedIds.value.size > 0) {
    e.preventDefault();
    handleBatchDelete();
    return;
  }

  // Ctrl/Cmd + C: 批量复制
  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && batchMode.value && batchSelectedIds.value.size > 0) {
    e.preventDefault();
    handleBatchCopy();
    return;
  }

  // Esc: 退出批量模式
  if (e.key === 'Escape' && batchMode.value) {
    e.preventDefault();
    batchMode.value = false;
    batchSelectedIds.value.clear();
    return;
  }
};

// 观察器实例
let observer = null;

onMounted(() => {
  // 加载搜索历史
  loadSearchHistory();

  // 添加快捷键监听
  window.addEventListener('keydown', handleKeyDown);

  // 设置 IntersectionObserver 实现无限滚动
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMore();
    }
  }, {
    root: listContainerRef.value,
    threshold: 0.1,
    rootMargin: '100px' // 提前加载
  });

  // 确保 DOM 更新后观察元素
  nextTick(() => {
    // 模拟一个小延迟以展示 loading 效果，避免白屏
    setTimeout(() => {
      loading.value = false;
    }, 300);

    if (loadTrigger.value) {
      observer.observe(loadTrigger.value);
    }
  });
});

onUnmounted(() => {
  // 移除快捷键监听
  window.removeEventListener('keydown', handleKeyDown);

  if (observer) {
    observer.disconnect();
  }
  imageCache.clear();
});
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
          @focus="searchInputFocused = true"
          @blur="handleSearchBlur"
        >
          <template #prefix>
            <SearchOutlined style="color: var(--text-tertiary)" />
          </template>
          <template #suffix>
            <a-tooltip :title="regexMode ? '正则模式' : '普通模式'">
              <a-button
                type="text"
                size="small"
                :class="['regex-toggle', { 'regex-active': regexMode }]"
                @click="regexMode = !regexMode"
              >
                .*
              </a-button>
            </a-tooltip>
          </template>
        </a-input>

        <!-- 搜索历史下拉 -->
        <div v-if="searchHistory.length > 0 && !searchKeyword && searchInputFocused" class="search-history-dropdown">
          <div class="history-header">
            <span>搜索历史</span>
            <a-button type="text" size="small" @click="clearSearchHistory">清空</a-button>
          </div>
          <div class="history-list">
            <div
              v-for="(item, index) in searchHistory"
              :key="index"
              class="history-item"
              @click="useSearchHistory(item)"
            >
              {{ item }}
            </div>
          </div>
        </div>
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
          <!-- 高级筛选 -->
          <a-dropdown :trigger="['click']" v-model:open="advancedFilterVisible">
            <a-tooltip title="高级筛选">
              <a-button type="text" size="small" class="icon-btn" :class="{ 'filter-active': dateRange !== 'all' || wordCountRange !== 'all' }">
                <FilterOutlined />
              </a-button>
            </a-tooltip>
            <template #overlay>
              <div class="advanced-filter-panel">
                <div class="filter-section">
                  <div class="filter-label">
                    <CalendarOutlined /> 日期范围
                  </div>
                  <a-radio-group v-model:value="dateRange" size="small">
                    <a-radio-button value="all">全部</a-radio-button>
                    <a-radio-button value="today">今天</a-radio-button>
                    <a-radio-button value="week">最近7天</a-radio-button>
                    <a-radio-button value="month">最近30天</a-radio-button>
                  </a-radio-group>
                </div>
                <div class="filter-section">
                  <div class="filter-label">
                    <FontSizeOutlined /> 字数范围
                  </div>
                  <a-radio-group v-model:value="wordCountRange" size="small">
                    <a-radio-button value="all">全部</a-radio-button>
                    <a-radio-button value="short">短文本(&lt;100)</a-radio-button>
                    <a-radio-button value="medium">中等(100-500)</a-radio-button>
                    <a-radio-button value="long">长文本(&gt;500)</a-radio-button>
                  </a-radio-group>
                </div>
              </div>
            </template>
          </a-dropdown>

          <!-- 批量操作按钮 -->
          <a-tooltip :title="batchMode ? '退出批量模式' : '批量操作'">
            <a-button
              type="text"
              size="small"
              class="icon-btn"
              :class="{ 'batch-active': batchMode }"
              @click="toggleBatchMode"
            >
              <CheckSquareOutlined v-if="!batchMode" />
              <CloseSquareOutlined v-else />
            </a-button>
          </a-tooltip>

          <a-dropdown :trigger="['click']">
            <a-tooltip title="设置保留条数">
              <a-button type="text" size="small" class="icon-btn setting-btn">
                <span class="limit-text">{{ maxHistoryLimit }}条</span>
                <AppstoreOutlined />
              </a-button>
            </a-tooltip>
            <template #overlay>
              <a-menu @click="({ key }) => handleLimitChange(key)" :selectedKeys="[maxHistoryLimit]">
                <a-menu-item :key="100">保留 100 条</a-menu-item>
                <a-menu-item :key="200">保留 200 条</a-menu-item>
                <a-menu-item :key="300">保留 300 条</a-menu-item>
                <a-menu-item :key="400">保留 400 条</a-menu-item>
                <a-menu-item :key="500">保留 500 条</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>

          <div class="divider-vertical"></div>

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

      <!-- 批量操作栏 -->
      <transition name="batch-bar">
        <div v-if="batchMode" class="batch-action-bar">
          <div class="batch-info">
            <a-checkbox
              :checked="batchSelectedIds.size === displayedItems.length && displayedItems.length > 0"
              :indeterminate="batchSelectedIds.size > 0 && batchSelectedIds.size < displayedItems.length"
              @change="toggleSelectAll"
            >
              已选择 {{ batchSelectedIds.size }} 项
            </a-checkbox>
          </div>
          <div class="batch-actions">
            <a-button size="small" @click="handleBatchCopy" :disabled="batchSelectedIds.size === 0">
              <MergeCellsOutlined /> 合并复制
            </a-button>
            <a-button size="small" @click="handleBatchFavorite(true)" :disabled="batchSelectedIds.size === 0">
              <StarOutlined /> 批量收藏
            </a-button>
            <a-button size="small" @click="handleBatchExport" :disabled="batchSelectedIds.size === 0">
              <ExportOutlined /> 导出
            </a-button>
            <a-popconfirm
              title="确定删除选中的项目吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="handleBatchDelete"
            >
              <a-button size="small" danger :disabled="batchSelectedIds.size === 0">
                <DeleteOutlined /> 删除
              </a-button>
            </a-popconfirm>
          </div>
        </div>
      </transition>
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

      <div class="list-container" ref="listContainerRef">
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
              v-for="item in displayedItems"
              :key="item.id"
              class="clipboard-card glass-effect"
              :class="{ 'is-favorite': item.isFavorite, 'is-selected': batchSelectedIds.has(item.id) }"
              @dblclick="handleDoubleClick(item)"
              @click="batchMode && toggleItemSelection(item.id)"
            >
              <!-- 批量选择复选框 -->
              <div v-if="batchMode" class="batch-checkbox" @click.stop="toggleItemSelection(item.id)">
                <a-checkbox :checked="batchSelectedIds.has(item.id)" />
              </div>

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
                <div v-else class="text-content" @click.stop="showTextPreview(item)">
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
          <!-- 加载触发器 -->
          <div
            v-if="filteredItems.length > 0"
            ref="loadTrigger"
            class="load-trigger"
          >
            <span v-if="visibleCount < filteredItems.length" class="loading-text">加载中...</span>
            <span v-else class="no-more-text">没有更多了</span>
          </div>
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
      class="custom-modal"
      ok-text="保存"
      cancel-text="取消"
    >
      <div class="note-editor-wrapper">
        <a-textarea
          v-model:value="editingNote"
          placeholder="写点什么备注一下..."
          :rows="4"
          show-count
          :maxlength="100"
          class="custom-textarea"
        />
      </div>
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

    <!-- 文本预览弹窗 -->
    <a-modal
      v-model:open="textPreviewVisible"
      :title="textPreviewItem ? `${getTypeLabel(textPreviewItem.type)} - 预览` : '文本预览'"
      width="80%"
      centered
      class="text-preview-modal"
      @cancel="closeTextPreview"
    >
      <div class="text-preview-container">
        <!-- 头部信息 -->
        <div v-if="textPreviewItem" class="preview-header">
          <div class="preview-meta">
            <span class="meta-item">
              <component :is="getTypeIcon(textPreviewItem.type)" />
              {{ getTypeLabel(textPreviewItem.type) }}
            </span>
            <span class="meta-item">{{ formatTime(textPreviewItem.createdAt) }}</span>
            <span class="meta-item">{{ textPreviewContent.length }} 字符</span>
            <span class="meta-item">{{ getWordCount(textPreviewContent) }} 字</span>
          </div>
          <div v-if="textPreviewItem.note" class="preview-note">
            <EditOutlined /> {{ textPreviewItem.note }}
          </div>
        </div>

        <!-- 文本内容 -->
        <div class="preview-content">
          <pre>{{ textPreviewContent }}</pre>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <template #footer>
        <div class="preview-footer">
          <a-space>
            <a-button @click="copyToClipboard(textPreviewItem)">
              <CopyOutlined /> 复制
            </a-button>
            <a-button v-if="textPreviewItem && textPreviewItem.type === 'url'" @click="openUrl(textPreviewContent)">
              <GlobalOutlined /> 打开链接
            </a-button>
            <a-button v-if="textPreviewItem && textPreviewItem.type === 'text'" @click="searchInBrowser(textPreviewContent)">
              <SearchOutlined /> 搜索
            </a-button>
            <a-button @click="showQRCode(textPreviewItem)">
              <QrcodeOutlined /> 二维码
            </a-button>
            <a-button @click="downloadItem(textPreviewItem)">
              <DownloadOutlined /> 下载
            </a-button>
            <a-button @click="closeTextPreview">关闭</a-button>
          </a-space>
        </div>
      </template>
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
  align-items: center;
}

.divider-vertical {
  width: 1px;
  height: 16px;
  background-color: rgba(0, 0, 0, 0.06);
  margin: 0 4px;
}

.icon-btn {
  color: var(--text-secondary);
  transition: all 0.3s;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: rgba(0,0,0,0.05);
  color: var(--primary-color);
}

.setting-btn {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}

.limit-text {
  font-weight: 500;
}

.icon-btn.ant-btn-dangerous:hover {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
}

/* Modal 自定义 */
.custom-modal :deep(.ant-modal-content) {
  border-radius: 16px;
  box-shadow: var(--box-shadow);
  padding: 24px;
}

.custom-modal :deep(.ant-modal-header) {
  margin-bottom: 16px;
}

.custom-modal :deep(.ant-modal-title) {
  font-weight: 600;
}

.note-editor-wrapper {
  padding: 4px 0;
}

.custom-textarea {
  border-radius: 8px;
  padding: 12px;
  border-color: rgba(0,0,0,0.1);
  resize: none;
  background: #f8fafc;
  transition: all 0.3s;
}

.custom-textarea:focus {
  background: #fff;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.1);
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
  border-radius: 16px; /* 更圆润的边角 */
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.8); /* 稍微增加不透明度 */
  position: relative;
  overflow: hidden;
  height: 200px;
  background: rgba(255, 255, 255, 0.4); /* 默认微透背景 */
}

.clipboard-card:hover {
  transform: translateY(-4px) scale(1.01); /* 轻微放大 */
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.01); /* 更现代的阴影 */
  border-color: rgba(79, 172, 254, 0.4);
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
  padding-top: 10px;
  border-top: 1px solid rgba(0,0,0,0.04);
  margin-top: auto;
}

.action-group {
  display: flex;
  gap: 2px; /* 稍微紧凑 */
}

.action-btn {
  color: var(--text-secondary);
  border-radius: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  color: var(--primary-color);
  background: rgba(79, 172, 254, 0.15);
  transform: scale(1.1);
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
.load-trigger {
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  color: var(--text-tertiary);
  font-size: 12px;
  margin-top: 10px;
}

/* ========== 新增功能样式 ========== */

/* 正则模式切换按钮 */
.regex-toggle {
  font-family: monospace;
  font-weight: bold;
  font-size: 14px;
  color: var(--text-tertiary);
  padding: 0 8px;
  transition: all 0.3s;
}

.regex-toggle:hover {
  color: var(--primary-color);
}

.regex-toggle.regex-active {
  color: var(--primary-color);
  background: rgba(79, 172, 254, 0.1);
}

/* 搜索历史下拉 */
.search-bar {
  position: relative;
}

.search-history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  max-height: 200px;
  overflow: hidden;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.history-list {
  max-height: 160px;
  overflow-y: auto;
}

.history-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.2s;
}

.history-item:hover {
  background: rgba(79, 172, 254, 0.1);
}

/* 高级筛选面板 */
.advanced-filter-panel {
  background: white;
  border-radius: 8px;
  padding: 16px;
  min-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.filter-section {
  margin-bottom: 16px;
}

.filter-section:last-child {
  margin-bottom: 0;
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-active {
  color: var(--primary-color) !important;
  background: rgba(79, 172, 254, 0.1) !important;
}

/* 批量操作栏 */
.batch-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(to right, rgba(79, 172, 254, 0.1), rgba(79, 172, 254, 0.05));
  border-radius: 8px;
  margin-top: 12px;
}

.batch-info {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.batch-actions {
  display: flex;
  gap: 8px;
}

.batch-active {
  color: var(--primary-color) !important;
  background: rgba(79, 172, 254, 0.15) !important;
}

/* 批量操作栏动画 */
.batch-bar-enter-active,
.batch-bar-leave-active {
  transition: all 0.3s ease;
}

.batch-bar-enter-from,
.batch-bar-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 批量选择复选框 */
.batch-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  background: white;
  border-radius: 4px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 选中状态的卡片 */
.clipboard-card.is-selected {
  border-color: var(--primary-color) !important;
  background: rgba(79, 172, 254, 0.05) !important;
  transform: scale(0.98);
}

/* 批量模式下的卡片 */
.clipboard-card {
  cursor: pointer;
  user-select: none;
}

/* 文本内容可点击提示 */
.text-content {
  cursor: zoom-in;
  transition: all 0.2s;
}

.text-content:hover {
  background: rgba(79, 172, 254, 0.05);
  border-radius: 4px;
}

/* 文本预览弹窗 */
.text-preview-modal :deep(.ant-modal-content) {
  border-radius: 16px;
  overflow: hidden;
}

.text-preview-container {
  max-height: 70vh;
  overflow-y: auto;
}

.preview-header {
  padding: 16px;
  background: linear-gradient(to right, rgba(79, 172, 254, 0.05), rgba(79, 172, 254, 0.02));
  border-radius: 8px;
  margin-bottom: 16px;
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.preview-note {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
  margin-top: 8px;
  border-left: 3px solid var(--primary-color);
}

.preview-content {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  min-height: 200px;
  max-height: 50vh;
  overflow-y: auto;
}

.preview-content pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0;
}
</style>
