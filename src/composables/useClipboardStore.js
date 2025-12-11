import { ref } from 'vue';
import { Store } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';

const STORE_FILE = 'clipboard-manager.json';
const ITEMS_KEY = 'clipboardItems';
const MAX_HISTORY = 100; // 最多保存100条历史记录

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

// 将图片数据转换为 Data URL
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

  // 转换为 Data URL
  return canvas.toDataURL('image/png');
}

// 加载剪贴板历史
export async function loadClipboardItems() {
  try {
    const storeInstance = await initStore();
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
      imageData = clipboardData.data;

      // 解析图片尺寸
      const parts = imageData.split(',');
      if (parts.length === 3) {
        width = parseInt(parts[0]);
        height = parseInt(parts[1]);
        content = `图片 (${width}x${height})`;
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

  // 图片类型最多保存20条，文本类型保存100条
  const imageItems = nonFavorites.filter(item => item.type === 'image');
  const textItems = nonFavorites.filter(item => item.type !== 'image');

  let filteredNonFavorites = nonFavorites;
  if (imageItems.length > 20) {
    // 只保留最新的20条图片
    filteredNonFavorites = [
      ...imageItems.slice(0, 20),
      ...textItems
    ];
  }

  if (filteredNonFavorites.length > MAX_HISTORY) {
    // 只保留最新的 MAX_HISTORY 条非收藏记录
    clipboardItems.value = [
      ...filteredNonFavorites.slice(0, MAX_HISTORY),
      ...favorites
    ];
  }

  await saveClipboardItems();
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
