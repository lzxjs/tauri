import { ref } from 'vue';
import { Store } from '@tauri-apps/plugin-store';

const STORE_FILE = 'app-launcher.json';
const APPS_KEY = 'applications';
const SCENES_KEY = 'scenes';
const LAST_SCENE_KEY = 'lastScene';

let store = null;

// 初始化 store
async function initStore() {
  if (!store) {
    store = await Store.load(STORE_FILE);
  }
  return store;
}

// 保存场景列表
export async function saveScenes() {
  try {
    const storeInstance = await initStore();
    await storeInstance.set(SCENES_KEY, scenes.value);
    await storeInstance.save();
  } catch (error) {
    console.error('保存场景列表失败:', error);
    throw error;
  }
}

// 保存上次使用的场景
export async function saveLastScene(name) {
  try {
    const storeInstance = await initStore();
    await storeInstance.set(LAST_SCENE_KEY, name || '默认场景');
    await storeInstance.save();
  } catch (error) {
    console.error('保存上次场景失败:', error);
    throw error;
  }
}

// 读取上次使用的场景
export async function loadLastScene() {
  try {
    const storeInstance = await initStore();
    const saved = await storeInstance.get(LAST_SCENE_KEY);
    return saved || '默认场景';
  } catch (error) {
    console.error('读取上次场景失败:', error);
    return '默认场景';
  }
}

// 应用列表
// 结构：{ id, name, path, scene, addedAt }
export const apps = ref([]);
// 场景列表（显式存储，避免没有应用时场景丢失）
export const scenes = ref([]);

// 加载应用列表
export async function loadApps() {
  try {
    const storeInstance = await initStore();
    const savedApps = await storeInstance.get(APPS_KEY);
    const savedScenes = await storeInstance.get(SCENES_KEY);
    apps.value = savedApps || [];
    scenes.value = savedScenes || [];
    return apps.value;
  } catch (error) {
    console.error('加载应用列表失败:', error);
    apps.value = [];
    return [];
  }
}

// 保存应用列表
export async function saveApps() {
  try {
    const storeInstance = await initStore();
    await storeInstance.set(APPS_KEY, apps.value);
    await storeInstance.save();
  } catch (error) {
    console.error('保存应用列表失败:', error);
    throw error;
  }
}

// 添加应用，可指定场景，默认归入“默认场景”
export async function addApp(appPath, appName, scene = '默认场景') {
  console.log('[useAppStore] 原始路径:', appPath);
  
  // 规范化路径（统一使用反斜杠）
  const normalizedPath = appPath.replace(/\//g, '\\');
  console.log('[useAppStore] 规范化后路径:', normalizedPath);
  console.log('[useAppStore] 当前应用列表:', apps.value.map(app => app.path));
  
  // 检查是否已存在（同一场景内同一路径视为重复，不同场景允许各保留一份）
  const targetScene = scene || '默认场景';
  const exists = apps.value.some(app => {
    const samePath = app.path === normalizedPath;
    const appScene = app.scene || '默认场景';
    const sameScene = appScene === targetScene;
    console.log(
      `[useAppStore] 比较: path "${app.path}" === "${normalizedPath}"? ${samePath}, scene "${appScene}" === "${targetScene}"? ${sameScene}`,
    );
    return samePath && sameScene;
  });
  
  if (exists) {
    console.error('[useAppStore] 应用已存在:', normalizedPath);
    throw new Error('该应用已存在');
  }

  const newApp = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: appName,
    path: normalizedPath,
    scene,
    addedAt: new Date().toISOString()
  };
  
  console.log('[useAppStore] 添加新应用:', newApp);
  apps.value.push(newApp);

  await saveApps();
  console.log('[useAppStore] 保存成功');
}

// 删除单个应用
export async function removeApp(appId) {
  apps.value = apps.value.filter(app => app.id !== appId);
  await saveApps();
}

// 批量删除应用
export async function removeApps(appIds) {
  apps.value = apps.value.filter(app => !appIds.includes(app.id));
  await saveApps();
}

// 清空所有应用
export async function clearApps() {
  apps.value = [];
  await saveApps();
}

// 更新应用名称
export async function updateAppName(appId, name) {
  const index = apps.value.findIndex(app => app.id === appId);
  if (index === -1) return;

  apps.value[index] = {
    ...apps.value[index],
    name,
  };

  await saveApps();
}

// 修改单个应用的场景
export async function setAppScene(appId, scene) {
  const index = apps.value.findIndex(app => app.id === appId);
  if (index === -1) return;

  apps.value[index] = {
    ...apps.value[index],
    scene,
  };

  await saveApps();
}

// 获取所有场景列表（去重）
export function getScenes() {
  const set = new Set();
  // 基于应用推导出的场景
  for (const app of apps.value) {
    set.add(app.scene || '默认场景');
  }
  // 显式保存的场景
  for (const scene of scenes.value) {
    set.add(scene || '默认场景');
  }
  // 如果一个应用和场景都没有，仍然提供一个默认场景
  if (set.size === 0) {
    set.add('默认场景');
  }
  return Array.from(set);
}

// 创建场景（只影响场景列表，不会自动创建应用）
export async function createScene(name) {
  const sceneName = name || '默认场景';
  if (!scenes.value.includes(sceneName)) {
    scenes.value.push(sceneName);
    await saveScenes();
  }
}

// 删除场景（只删除场景记录，不删除应用，删除应用由调用方控制）
export async function deleteScene(name) {
  const sceneName = name || '默认场景';
  scenes.value = scenes.value.filter(s => s !== sceneName);
  await saveScenes();
}

// 获取某个场景下的所有应用
export function getAppsByScene(scene) {
  const target = scene || '默认场景';
  return apps.value.filter(app => (app.scene || '默认场景') === target);
}

// 重命名场景：更新 scenes 列表以及所有应用的 scene 字段
export async function renameScene(oldName, newName) {
  const from = oldName || '默认场景';
  const to = newName || '默认场景';

  if (from === to) return;

  // 更新场景列表
  const set = new Set(scenes.value);
  set.delete(from);
  set.add(to);
  scenes.value = Array.from(set);
  await saveScenes();

  // 更新所有应用中属于该场景的记录
  apps.value = apps.value.map(app => {
    const sceneName = app.scene || '默认场景';
    if (sceneName === from) {
      return { ...app, scene: to };
    }
    return app;
  });
  await saveApps();
}
