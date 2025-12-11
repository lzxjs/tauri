import { ref } from 'vue';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

const STORE_FILE = 'clipboard-manager.json';
const ITEMS_KEY = 'clipboardItems';
const MAX_HISTORY_KEY = 'maxHistory';
export const maxHistoryLimit = ref(100); // 默认100条

let store = null;

// 初始化 store
async function initStore() {
  if (!store) {
    store = await Store.load(STORE_FILE);
  }
  return store;
}

// 剪贴板项目列表
// 结构：{ id, content, imageData, width, height, type, isFavorite, note, createdAt }
export const clipboardItems = ref([]);

// 检测内容类型
function detectContentType(content, isImage = false) {
  // 如果是图片类型
  if (isImage) {
    return 'image';
  }

  // URL 检测
  const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  if (urlPattern.test(content.trim())) {
    return 'url';
  }

  // Email 检测
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(content.trim())) {
    return 'email';
  }

  // 默认为文本
  return 'text';
}

// 将图片数据转换为 Data URL (带压缩)
function imageDataToDataUrl(imageData) {
  if (!imageData) return null;

  // 解析格式：width,height,base64data
  const parts = imageData.split(',');
  if (parts.length !== 3) return null;

  const width = parseInt(parts[0]);
  const height = parseInt(parts[1]);
  const base64Data = parts[2];

  // 创建 canvas 来渲染 RGBA 数据
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 解码 Base64 数据
  const binaryString = atob(base64Data);
  const bytes = new Uint8ClampedArray(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 创建 ImageData 并绘制到 canvas
  const imageDataObj = new ImageData(bytes, width, height);
  ctx.putImageData(imageDataObj, 0, 0);

  // 检查是否需要压缩
  // 原始数据大小约为 base64Data.length * 0.75 字节
  const approximateSize = base64Data.length * 0.75;
  const MAX_SIZE = 800 * 1024; // 800KB

  if (approximateSize > MAX_SIZE) {
    // 压缩图片：使用 jpeg 格式并降低质量
    // 计算缩放比例：简单估算，尝试将质量降低到 0.7
    return canvas.toDataURL('image/jpeg', 0.7);
  } else {
    // 小图保持 png 格式以获得更好质量
    return canvas.toDataURL('image/png');
  }
}

// 加载剪贴板历史
export async function loadClipboardItems() {
  try {
    const storeInstance = await initStore();
    
    // 加载历史记录限制
    const savedLimit = await storeInstance.get(MAX_HISTORY_KEY);
    if (savedLimit) {
      maxHistoryLimit.value = savedLimit;
    }

    const savedItems = await storeInstance.get(ITEMS_KEY);
    clipboardItems.value = savedItems || [];
    return clipboardItems.value;
  } catch (error) {
    console.error('加载剪贴板历史失败:', error);
    clipboardItems.value = [];
    return [];
  }
}

// 保存剪贴板历史
export async function saveClipboardItems() {
  try {
    const storeInstance = await initStore();
    await storeInstance.set(ITEMS_KEY, clipboardItems.value);
    await storeInstance.save();
  } catch (error) {
    console.error('保存剪贴板历史失败:', error);
    throw error;
  }
}

// 添加剪贴板项目（支持文本和图片）
export async function addClipboardItem(clipboardData) {
  // 处理后端发送的数据结构
  let content = '';
  let imageData = null;
  let width = 0;
  let height = 0;
  let isImage = false;

  // 判断数据类型
  if (typeof clipboardData === 'string') {
    // 旧版本兼容：纯文本
    content = clipboardData;
  } else if (clipboardData && typeof clipboardData === 'object') {
    // 新版本：{ type: 'Text'/'Image', data: '...' }
    if (clipboardData.type === 'Image') {
      isImage = true;
      // 检查图片大小并在存储前尝试压缩
      // 注意：这里我们只做简单的预处理，真正的压缩发生在 imageDataToDataUrl (展示层)
      // 或者我们可以修改后端传过来的数据结构，让后端直接存压缩后的？
      // 目前为了不改动后端，我们在存储前不做有损压缩，只在展示和保存时处理
      // 但为了减少内存占用，我们可以在这里就做一次转换
      
      const rawData = clipboardData.data;
      
      // 解析图片尺寸
      const parts = rawData.split(',');
      if (parts.length === 3) {
        width = parseInt(parts[0]);
        height = parseInt(parts[1]);
        content = `图片 (${width}x${height})`;
        
        // 优化：如果是超大图片，我们在这里可以考虑直接存储压缩后的 base64
        // 但由于 imageDataToDataUrl 需要特定的格式 (width,height,base64)，
        // 我们保持原样存储，但在显示时进行压缩
        imageData = rawData;
      }
    } else if (clipboardData.type === 'Text') {
      content = clipboardData.data;
    }
  }

  // 检查是否为空
  if (!content || (content.trim() === '' && !isImage)) {
    return;
  }

  // 检查是否与最新的一条重复
  if (clipboardItems.value.length > 0) {
    const latestItem = clipboardItems.value[0];
    if (isImage && latestItem.imageData === imageData) {
      return; // 重复图片，不添加
    }
    if (!isImage && latestItem.content === content) {
      return; // 重复文本，不添加
    }
  }

  const newItem = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content: content,
    imageData: imageData,
    width: width,
    height: height,
    type: detectContentType(content, isImage),
    isFavorite: false,
    note: '',
    createdAt: Date.now()
  };

  // 添加到列表开头
  clipboardItems.value.unshift(newItem);

  // 限制历史记录数量（保留收藏的项目）
  const favorites = clipboardItems.value.filter(item => item.isFavorite);
  const nonFavorites = clipboardItems.value.filter(item => !item.isFavorite);

  // 根据用户设置的限制进行截断
  if (nonFavorites.length > maxHistoryLimit.value) {
    // 只保留最新的 maxHistoryLimit 条非收藏记录
    clipboardItems.value = [
      ...nonFavorites.slice(0, maxHistoryLimit.value),
      ...favorites
    ];
  }

  await saveClipboardItems();
}

// 设置最大历史记录数
export async function setMaxHistoryLimit(limit) {
  maxHistoryLimit.value = limit;
  
  // 保存设置
  const storeInstance = await initStore();
  await storeInstance.set(MAX_HISTORY_KEY, limit);
  await storeInstance.save();
  
  // 立即应用新的限制
  const favorites = clipboardItems.value.filter(item => item.isFavorite);
  const nonFavorites = clipboardItems.value.filter(item => !item.isFavorite);
  
  if (nonFavorites.length > limit) {
    clipboardItems.value = [
      ...nonFavorites.slice(0, limit),
      ...favorites
    ];
    await saveClipboardItems();
  }
}

// 删除单个项目
export async function removeClipboardItem(itemId) {
  clipboardItems.value = clipboardItems.value.filter(item => item.id !== itemId);
  await saveClipboardItems();
}

// 批量删除项目
export async function removeClipboardItems(itemIds) {
  clipboardItems.value = clipboardItems.value.filter(item => !itemIds.includes(item.id));
  await saveClipboardItems();
}

// 清空历史记录（不包括收藏）
export async function clearHistory() {
  clipboardItems.value = clipboardItems.value.filter(item => item.isFavorite);
  await saveClipboardItems();
}

// 清空所有（包括收藏）
export async function clearAll() {
  clipboardItems.value = [];
  await saveClipboardItems();
}

// 切换收藏状态
export async function toggleFavorite(itemId) {
  const item = clipboardItems.value.find(item => item.id === itemId);
  if (item) {
    item.isFavorite = !item.isFavorite;
    await saveClipboardItems();
  }
}

// 更新备注
export async function updateNote(itemId, note) {
  const item = clipboardItems.value.find(item => item.id === itemId);
  if (item) {
    item.note = note;
    await saveClipboardItems();
  }
}

// 搜索过滤
export function searchItems(keyword) {
  if (!keyword || keyword.trim() === '') {
    return clipboardItems.value;
  }

  const lowerKeyword = keyword.toLowerCase();
  return clipboardItems.value.filter(item =>
    item.content.toLowerCase().includes(lowerKeyword) ||
    (item.note && item.note.toLowerCase().includes(lowerKeyword))
  );
}

// 获取收藏列表
export function getFavorites() {
  return clipboardItems.value.filter(item => item.isFavorite);
}

// 获取非收藏列表
export function getNonFavorites() {
  return clipboardItems.value.filter(item => !item.isFavorite);
}

// 导出图片数据转换函数供 Vue 组件使用
export { imageDataToDataUrl };
