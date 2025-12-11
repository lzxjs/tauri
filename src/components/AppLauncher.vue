<script setup>
// 应用批量启动器：负责拖拽添加快捷方式、管理列表、排序、批量调用后端命令启动程序
import { ref, onMounted, onUnmounted, h } from "vue";
import { message } from "ant-design-vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  RocketOutlined,
  DeleteOutlined,
  AppstoreAddOutlined,
  CloudUploadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  PlusOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  CaretRightOutlined,
  SwapOutlined,
  EllipsisOutlined
} from "@ant-design/icons-vue";
import {
  apps,
  loadApps,
  addApp,
  removeApp,
  removeApps,
  setAppScene,
  getScenes,
  getAppsByScene,
  saveApps,
  updateAppName,
  createScene,
  deleteScene,
  saveLastScene,
  loadLastScene,
  renameScene,
} from "../composables/useAppStore";

const isDragging = ref(false);
const selectedRowKeys = ref([]);
const launching = ref(false);
// 当前场景（默认“默认场景”，启动时从 store 恢复）
const currentScene = ref("默认场景");
// 当前场景下的应用列表（由 apps + currentScene 计算）
const appsInScene = ref([]);
// 场景选择下拉框的选项
const sceneOptions = ref([]);
// 修改场景弹窗的状态
const sceneModalOpen = ref(false);
const sceneModalRecord = ref(null);
const sceneModalValue = ref("默认场景");
// 新建场景弹窗
const sceneCreateModalOpen = ref(false);
const sceneCreateName = ref("");
// 重命名场景弹窗
const sceneRenameModalOpen = ref(false);
const sceneRenameName = ref("");
// 行排序（通过上移 / 下移按钮控制）
let unlistenFileDrop = null;

// 名称编辑状态
const editingNameId = ref(null);
const editingNameValue = ref("");

// 表格列定义
const columns = [
  {
    title: "程序名称",
    dataIndex: "name",
    key: "name",
    ellipsis: true,
  },
  {
    title: "程序路径",
    dataIndex: "path",
    key: "path",
    ellipsis: true,
  },
  {
    title: "添加时间",
    dataIndex: "addedAt",
    key: "addedAt",
    width: 180,
  },
  {
    title: "操作",
    key: "action",
    width: 180,
    fixed: "right",
  },
];

// 拖放处理 - 使用 Tauri 的文件拖放 API 只做 UI 态的高亮
const handleDragOver = (e) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = (e) => {
  e.preventDefault();
  isDragging.value = false;
};

const handleDrop = (e) => {
  e.preventDefault();
  isDragging.value = false;
};

// 处理文件拖放：从 Tauri 事件拿到本地路径，转换成 name + path + 当前场景 后交给 useAppStore
const handleFileDrop = async (paths) => {
  if (!paths || paths.length === 0) return;

  console.log("拖放的文件路径:", paths);
  console.log("当前应用列表:", apps.value);

  let successCount = 0;
  let failCount = 0;
  let existCount = 0;
  const errors = [];

  for (const filePath of paths) {
    // 提取文件名
    const fileName = filePath.split("\\").pop().split("/").pop();
    // 提取文件名（不含扩展名）
    const appName = fileName.replace(/\.(lnk|exe|app|url)$/i, "");

    console.log(`准备添加: ${appName} - ${filePath}`);

    try {
      await addApp(filePath, appName, currentScene.value || "默认场景");
      successCount++;
      console.log(`添加成功: ${appName}`);
    } catch (error) {
      console.error(`添加应用失败 [${appName}]:`, error.message);
      // 按启动路径判断是否为已存在应用
      if (error && error.message === "该应用已存在") {
        existCount++;
        errors.push({ name: appName, path: filePath, error: "应用已存在" });
      } else {
        failCount++;
        errors.push({ name: appName, path: filePath, error: error.message });
      }
    }
  }

  console.log("添加完成后的应用列表:", apps.value);

  if (successCount > 0) {
    message.success(`成功添加 ${successCount} 个应用`);
  }
  if (existCount > 0) {
    message.warning(`${existCount} 个应用已存在，已跳过`);
  }
  if (failCount > 0) {
    console.error(
      "添加失败的应用详情:",
      errors.filter((e) => e.error !== "应用已存在")
    );
    message.error(`${failCount} 个应用添加失败，请查看控制台`);
  }
  // 新增完成后刷新当前场景视图
  refreshScenesAndApps();
};

// 批量打开（选中项）
const handleLaunchSelected = async () => {
  if (selectedRowKeys.value.length === 0) {
    message.warning("请先选择要启动的应用");
    return;
  }

  const selectedSet = new Set(selectedRowKeys.value);
  const target = appsInScene.value.filter((app) => selectedSet.has(app.id));
  await launchApps(target);
};

// 批量打开（当前场景全部）
const handleLaunchSceneAll = async () => {
  await launchApps(appsInScene.value);
};

// 删除单个应用
const handleDelete = async (appId) => {
  try {
    await removeApp(appId);
    message.success("删除成功");
    // 如果删除的应用在选中列表中，也要移除
    selectedRowKeys.value = selectedRowKeys.value.filter(
      (key) => key !== appId
    );
    // 同步当前场景数据
    refreshScenesAndApps();
  } catch (error) {
    message.error("删除失败: " + error.message);
  }
};

// 打开应用所在文件夹
const openAppFolder = async (record) => {
  if (!record || !record.path) return;
  try {
    await invoke("open_app_folder", { path: record.path });
  } catch (error) {
    console.error("打开文件夹失败:", error);
    message.error("打开文件夹失败: " + (error?.message || error));
  }
};

// 删除当前场景（删除该场景下所有应用），然后切回默认场景/其他场景
const handleDeleteScene = async () => {
  const scene = currentScene.value || "默认场景";

  // 找出当前场景下的所有应用
  const appsToDelete = apps.value.filter(
    (app) => (app.scene || "默认场景") === scene
  );

  try {
    if (appsToDelete.length > 0) {
      const ids = appsToDelete.map((app) => app.id);
      await removeApps(ids);
    }

    // 删除场景记录
    await deleteScene(scene);

    // 切回默认场景或第一个可用场景
    const scenes = getScenes();
    if (scene !== "默认场景" && scenes.includes("默认场景")) {
      currentScene.value = "默认场景";
    } else if (scenes.length > 0) {
      currentScene.value = scenes[0];
    } else {
      currentScene.value = "默认场景";
    }

    // 场景变更后更新 lastScene
    await saveLastScene(currentScene.value);

    selectedRowKeys.value = [];
    refreshScenesAndApps();

    message.success(`场景“${scene}”及其下的应用已删除`);
  } catch (error) {
    console.error("删除场景失败:", error);
    message.error("删除场景失败");
  }
};

// 表格行选择配置（用于批量删除 / 启动）
const rowSelection = {
  selectedRowKeys: selectedRowKeys,
  onChange: (keys) => {
    selectedRowKeys.value = keys;
  },
};

// 批量删除（仅作用于当前场景列表中选中的 id）
const handleBatchDelete = async () => {
  if (selectedRowKeys.value.length === 0) {
    message.warning("请先选择要删除的应用");
    return;
  }

  try {
    await removeApps(selectedRowKeys.value);
    message.success(`成功删除 ${selectedRowKeys.value.length} 个应用`);
    selectedRowKeys.value = [];
    // 同步当前场景数据
    refreshScenesAndApps();
  } catch (error) {
    message.error("批量删除失败: " + error.message);
  }
};

// 通用批量打开逻辑：接受一个应用数组，逐个调用 launch_app
const launchApps = async (targetApps) => {
  if (!targetApps || targetApps.length === 0) {
    message.warning("没有可打开的应用");
    return;
  }

  launching.value = true;
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (const app of targetApps) {
    try {
      console.log(`正在启动: ${app.name} - ${app.path}`);
      // 调用后端 Tauri 命令启动程序
      await invoke("launch_app", { path: app.path });

      successCount++;
      console.log(`启动成功: ${app.name}`);

      // 添加小延迟，避免同时启动太多程序
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`打开应用失败 [${app.name}]:`, error);
      errors.push({ name: app.name, error: error.message });
      failCount++;
    }
  }

  launching.value = false;

  if (successCount > 0) {
    message.success(`成功启动 ${successCount} 个应用`);
  }
  if (failCount > 0) {
    console.error("启动失败的应用:", errors);
    message.error(`${failCount} 个应用启动失败，请查看控制台`);
  }
};

// 行排序：通过“上移 / 下移”按钮调整当前场景内的顺序
const moveRow = async (record, direction) => {
  const index = appsInScene.value.findIndex((app) => app.id === record.id);
  if (index === -1) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= appsInScene.value.length) return;

  const reordered = [...appsInScene.value];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(targetIndex, 0, moved);

  const sceneName = currentScene.value || "默认场景";
  const otherApps = apps.value.filter(
    (app) => (app.scene || "默认场景") !== sceneName
  );
  apps.value = [...otherApps, ...reordered];
  appsInScene.value = reordered;

  try {
    await saveApps();
    console.log(
      "排序已保存:",
      reordered.map((a) => a.name)
    );
  } catch (error) {
    console.error("保存排序失败:", error);
    message.error("保存排序失败");
  }
};

// 根据当前 apps 列表和 currentScene 计算 appsInScene 和 sceneOptions
const refreshScenesAndApps = () => {
  // 同步场景列表
  const baseScenes = getScenes();
  const scenesSet = new Set(baseScenes);
  const current = currentScene.value || "默认场景";
  // 确保当前场景始终在列表中，即使还没有应用
  scenesSet.add(current);

  sceneOptions.value = Array.from(scenesSet).map((name) => ({
    label: name,
    value: name,
  }));

  appsInScene.value = getAppsByScene(current);
};

// 切换场景
const handleSceneChange = (value) => {
  currentScene.value = value || "默认场景";
  // 记住最新场景
  saveLastScene(currentScene.value).catch((error) => {
    console.error("保存上次场景失败:", error);
  });
  appsInScene.value = getAppsByScene(currentScene.value);
  // 切换场景时清空勾选
  selectedRowKeys.value = [];
};

// 打开修改场景弹窗
const openSceneModal = (record) => {
  sceneModalRecord.value = record;
  sceneModalValue.value = record.scene || currentScene.value || "默认场景";
  sceneModalOpen.value = true;
};

// 确认修改场景
const handleSceneModalOk = async () => {
  if (!sceneModalRecord.value) {
    sceneModalOpen.value = false;
    return;
  }

  const newScene = (sceneModalValue.value || "").trim() || "默认场景";

  try {
    // 检查目标场景中是否已有同路径应用
    const targetPath = sceneModalRecord.value.path;
    const existsInTargetScene = apps.value.some((app) => {
      const appScene = app.scene || "默认场景";
      return (
        app.id !== sceneModalRecord.value.id &&
        app.path === targetPath &&
        appScene === newScene
      );
    });

    if (existsInTargetScene) {
      message.warning(`场景“${newScene}”中已存在相同程序，已取消变更`);
      return;
    }

    await setAppScene(sceneModalRecord.value.id, newScene);
    sceneModalOpen.value = false;
    sceneModalRecord.value = null;
    refreshScenesAndApps();
    message.success("场景已更新");
  } catch (error) {
    console.error("更新场景失败:", error);
    message.error("更新场景失败");
  }
};

// 取消修改场景
const handleSceneModalCancel = () => {
  sceneModalOpen.value = false;
  sceneModalRecord.value = null;
};

// 打开新建场景弹窗
const openCreateSceneModal = () => {
  sceneCreateName.value = "";
  sceneCreateModalOpen.value = true;
};

// 确认新建场景
const handleSceneCreateOk = () => {
  const name = sceneCreateName.value.trim();
  if (!name) {
    message.warning("场景名称不能为空");
    return;
  }

  currentScene.value = name;
  sceneCreateModalOpen.value = false;

  // 持久化场景
  createScene(name)
    .then(() => {
      // 保存上次场景
      return saveLastScene(name);
    })
    .then(() => {
      // 重新计算场景选项和当前场景应用列表
      refreshScenesAndApps();
      selectedRowKeys.value = [];
      message.success(`已切换到新场景：${name}`);
    })
    .catch((error) => {
      console.error("创建场景失败:", error);
      message.error("创建场景失败");
    });
};

// 取消新建场景
const handleSceneCreateCancel = () => {
  sceneCreateModalOpen.value = false;
};

// 打开重命名场景弹窗
const openRenameSceneModal = () => {
  sceneRenameName.value = currentScene.value || "默认场景";
  sceneRenameModalOpen.value = true;
};

// 确认重命名场景
const handleSceneRenameOk = async () => {
  const oldName = currentScene.value || "默认场景";
  const newName = sceneRenameName.value.trim() || "默认场景";

  if (newName === oldName) {
    sceneRenameModalOpen.value = false;
    return;
  }

  try {
    await renameScene(oldName, newName);
    currentScene.value = newName;
    await saveLastScene(newName);
    refreshScenesAndApps();
    selectedRowKeys.value = [];
    message.success(`场景已重命名为：“${newName}”`);
  } catch (error) {
    console.error("重命名场景失败:", error);
    message.error("重命名场景失败");
  } finally {
    sceneRenameModalOpen.value = false;
  }
};

// 取消重命名场景
const handleSceneRenameCancel = () => {
  sceneRenameModalOpen.value = false;
};

// 开始编辑名称
const startEditName = (record) => {
  editingNameId.value = record.id;
  editingNameValue.value = record.name || "";
};

// 名称编辑完成（失焦或回车）
const finishEditName = async (record) => {
  const newName = editingNameValue.value.trim();
  editingNameId.value = null;

  if (!newName || newName === record.name) return;

  try {
    await updateAppName(record.id, newName);
    // 同步内存中的数据
    record.name = newName;
    const index = apps.value.findIndex((app) => app.id === record.id);
    if (index !== -1) {
      apps.value[index].name = newName;
    }
    message.success("名称已更新");
  } catch (error) {
    console.error("更新名称失败:", error);
    message.error("更新名称失败");
  }
};

// 初始化加载
onMounted(async () => {
  try {
    await loadApps();
    // 恢复上次使用的场景
    currentScene.value = await loadLastScene();
    refreshScenesAndApps();

    // 监听文件拖放事件
    const webview = getCurrentWebviewWindow();
    unlistenFileDrop = await webview.onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        isDragging.value = false;
        handleFileDrop(event.payload.paths);
      } else if (event.payload.type === "over") {
        isDragging.value = true;
      } else if (event.payload.type === "leave") {
        isDragging.value = false;
      }
    });
  } catch (error) {
    message.error("初始化失败: " + error.message);
    console.error(error);
  }
});

// 清理监听器
onUnmounted(() => {
  if (unlistenFileDrop) {
    unlistenFileDrop();
  }
});
</script>

<template>
  <div class="app-launcher">
    <div class="card-wrapper">
      <!-- 头部区域 -->
      <div class="card-header launcher-header">
        <div class="header-left">
          <div class="icon-box">
            <RocketOutlined />
          </div>
          <span class="card-title">应用启动</span>
        </div>

        <div class="header-controls">
          <!-- 场景管理 -->
          <div class="scene-selector-group">
            <a-select
              v-model:value="currentScene"
              class="scene-select"
              :options="sceneOptions"
              placeholder="选择场景"
              @change="handleSceneChange"
              :dropdownMatchSelectWidth="false"
            />
            
            <a-tooltip title="新建场景">
              <a-button class="icon-btn" @click="openCreateSceneModal">
                <PlusOutlined />
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="重命名场景">
              <a-button class="icon-btn" @click="openRenameSceneModal">
                <EditOutlined />
              </a-button>
            </a-tooltip>
            
            <a-popconfirm
              title="确认删除当前场景及其下所有应用？"
              ok-text="删除"
              cancel-text="取消"
              @confirm="handleDeleteScene"
            >
              <a-tooltip title="删除场景">
                <a-button class="icon-btn" danger>
                  <DeleteOutlined />
                </a-button>
              </a-tooltip>
            </a-popconfirm>
          </div>
        </div>
      </div>

      <div class="card-body">
        <!-- 顶部操作栏 -->
        <div class="action-bar">
          <div class="action-left">
            <a-tag color="blue">
              <template #icon><AppstoreAddOutlined /></template>
              {{ currentScene }} ({{ appsInScene.length }})
            </a-tag>
          </div>
          
          <div class="action-right">
             <a-button
              type="default"
              class="action-btn"
              @click="handleLaunchSceneAll"
              :loading="launching"
              :disabled="appsInScene.length === 0"
            >
              <template #icon><RocketOutlined /></template>
              {{ launching ? "启动中..." : "启动本场景全部" }}
            </a-button>

            <a-button
              type="primary"
              class="action-btn"
              @click="handleLaunchSelected"
              :loading="launching"
              :disabled="selectedRowKeys.length === 0"
            >
              <template #icon><RocketOutlined /></template>
              {{ launching ? "启动中..." : "启动选中" }}
            </a-button>

            <a-popconfirm
              title="确认删除选中的应用？"
              ok-text="删除"
              cancel-text="取消"
              @confirm="handleBatchDelete"
            >
              <a-button
                danger
                class="action-btn"
                :disabled="selectedRowKeys.length === 0"
              >
                <template #icon><DeleteOutlined /></template>
                批量删除
              </a-button>
            </a-popconfirm>
          </div>
        </div>

        <!-- 拖放区域 -->
        <div
          class="drop-zone"
          :class="{ 'drop-zone-active': isDragging }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <div class="drop-content">
            <div class="drop-icon-wrapper">
              <CloudUploadOutlined class="drop-icon" />
            </div>
            <div class="drop-text-group">
              <p class="drop-title">拖放程序快捷方式到此处</p>
              <p class="drop-desc">支持 .lnk、.exe 等文件自动识别</p>
            </div>
          </div>
        </div>

        <!-- 应用列表 -->
        <div class="app-table-wrapper">
          <a-table
            :columns="columns"
            :data-source="appsInScene"
            :row-key="(record) => record.id"
            :row-selection="rowSelection"
            :pagination="apps.length > 10 ? { pageSize: 10 } : false"
            :scroll="{ x: 800 }"
            class="custom-table"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="name-cell">
                  <a-input
                    v-if="editingNameId === record.id"
                    v-model:value="editingNameValue"
                    size="small"
                    class="name-input"
                    @blur="() => finishEditName(record)"
                    @pressEnter="() => finishEditName(record)"
                    auto-focus
                  />
                  <span
                    v-else
                    class="app-name-text"
                    title="点击编辑名称"
                    @click="startEditName(record)"
                  >
                    {{ record.name }}
                    <EditOutlined class="edit-hint-icon" />
                  </span>
                </div>
              </template>
              <template v-else-if="column.key === 'addedAt'">
                <span class="date-text">{{
                  new Date(record.addedAt).toLocaleString("zh-CN")
                }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <div class="action-buttons">
                  <a-tooltip title="启动">
                    <a-button
                      type="text"
                      size="small"
                      class="row-btn launch-btn"
                      @click="launchApps([record])"
                    >
                      <RocketOutlined />
                    </a-button>
                  </a-tooltip>
                  
                  <div class="divider-vertical"></div>
                  
                  <a-tooltip title="上移">
                    <a-button
                      type="text"
                      size="small"
                      class="row-btn"
                      @click="() => moveRow(record, 'up')"
                    >
                      <ArrowUpOutlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="下移">
                    <a-button
                      type="text"
                      size="small"
                      class="row-btn"
                      @click="() => moveRow(record, 'down')"
                    >
                      <ArrowDownOutlined />
                    </a-button>
                  </a-tooltip>
                  
                  <div class="divider-vertical"></div>

                  <a-dropdown>
                    <a-button type="text" size="small" class="row-btn">
                      <EllipsisOutlined />
                    </a-button>
                    <template #overlay>
                      <a-menu>
                        <a-menu-item @click="() => openAppFolder(record)">
                          <FolderOpenOutlined /> 打开位置
                        </a-menu-item>
                        <a-menu-item @click="openSceneModal(record)">
                          <SwapOutlined /> 移动场景
                        </a-menu-item>
                        <a-menu-divider />
                        <a-menu-item danger @click="() => handleDelete(record.id)">
                          <DeleteOutlined /> 删除应用
                        </a-menu-item>
                      </a-menu>
                    </template>
                  </a-dropdown>
                </div>
              </template>
            </template>

            <template #emptyText>
              <div class="empty-state">
                <div class="empty-icon-bg">
                   <AppstoreAddOutlined />
                </div>
                <span class="empty-text">暂无应用，请从上方拖入</span>
              </div>
            </template>
          </a-table>
        </div>
      </div>
    </div>

    <!-- 修改场景弹窗 -->
    <a-modal
      v-model:open="sceneModalOpen"
      title="修改应用场景"
      @ok="handleSceneModalOk"
      @cancel="handleSceneModalCancel"
      ok-text="保存"
      cancel-text="取消"
    >
      <p style="margin-bottom: 8px">请选择要修改的场景：</p>
      <a-select
        v-model:value="sceneModalValue"
        style="width: 100%"
        :options="sceneOptions"
        allow-clear
        show-search
        option-filter-prop="label"
        placeholder="选择或输入场景名称"
      />
    </a-modal>
    <!-- 新建场景弹窗 -->
    <a-modal
      v-model:open="sceneCreateModalOpen"
      title="新建场景"
      @ok="handleSceneCreateOk"
      @cancel="handleSceneCreateCancel"
      ok-text="保存"
      cancel-text="取消"
    >
      <p style="margin-bottom: 8px">请输入新的场景名称：</p>
      <a-input
        v-model:value="sceneCreateName"
        placeholder="例如：工作、娱乐、开发环境"
      />
    </a-modal>
    <!-- 重命名场景弹窗 -->
    <a-modal
      v-model:open="sceneRenameModalOpen"
      title="重命名场景"
      @ok="handleSceneRenameOk"
      @cancel="handleSceneRenameCancel"
      ok-text="保存"
      cancel-text="取消"
    >
      <p style="margin-bottom: 8px">请输入新的场景名称：</p>
      <a-input
        v-model:value="sceneRenameName"
        placeholder="例如：工作、娱乐、开发环境"
      />
    </a-modal>
  </div>
</template>

<style scoped>
.app-launcher {
  padding-bottom: 24px;
}

.card-wrapper {
  background: #fff;
  border-radius: 16px;
  box-shadow: var(--box-shadow-card);
  overflow: hidden;
  transition: all 0.3s ease;
  min-height: 85vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
}

/* Header Styles */
.card-header {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.launcher-header .icon-box {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.scene-selector-group {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface-hover);
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.scene-select {
  width: 200px;
}

:deep(.ant-select-selector) {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  box-shadow: none;
  color: var(--text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: rgba(0,0,0,0.05);
  color: var(--primary-color);
}

/* Body Content */
.card-body {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.action-right {
  display: flex;
  gap: 12px;
}

.action-btn {
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

/* Drop Zone */
.drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  background: var(--surface-hover);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
}

.drop-zone:hover {
  border-color: var(--primary-color);
  background: rgba(59, 130, 246, 0.02);
  transform: translateY(-2px);
  box-shadow: var(--box-shadow-sm);
}

.drop-zone-active {
  border-color: var(--primary-color);
  background: rgba(59, 130, 246, 0.05);
  transform: scale(1.01);
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.15);
}

.drop-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.drop-icon-wrapper {
  width: 72px;
  height: 72px;
  border-radius: 24px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  transition: transform 0.3s ease;
}

.drop-zone:hover .drop-icon-wrapper {
  transform: scale(1.05) rotate(5deg);
}

.drop-icon {
  font-size: 36px;
  color: var(--primary-color);
}

.drop-text-group {
  text-align: left;
}

.drop-title {
  font-size: 16px;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  font-weight: 600;
}

.drop-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

/* Table Styles */
.app-table-wrapper {
  background: white;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 让表格内容区域自适应高度 */
:deep(.ant-table-wrapper),
:deep(.ant-spin-nested-loading),
:deep(.ant-spin-container),
:deep(.ant-table),
:deep(.ant-table-container),
:deep(.ant-table-body) {
  height: 100%;
}

:deep(.ant-table-body) {
  overflow-y: auto !important;
}

:deep(.ant-table-thead > tr > th) {
  background: var(--surface-hover);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 13px;
  border-bottom: 1px solid var(--border-color);
}

.name-cell {
  display: flex;
  align-items: center;
}

.app-name-text {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.app-name-text:hover {
  background: #f1f5f9;
  color: var(--primary-color);
}

.edit-hint-icon {
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.app-name-text:hover .edit-hint-icon {
  opacity: 0.7;
}

.date-text {
  color: var(--text-tertiary);
  font-size: 13px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.row-btn {
  color: var(--text-secondary);
}

.row-btn:hover {
  color: var(--primary-color);
  background: rgba(79, 172, 254, 0.1);
}

.launch-btn {
  color: #10b981;
}

.launch-btn:hover {
  color: #059669;
  background: rgba(16, 185, 129, 0.1);
}

.divider-vertical {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
  margin: 0 4px;
}

/* Empty State */
.empty-state {
  padding: 40px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.empty-icon-bg {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: #cbd5e1;
}

.empty-text {
  color: var(--text-tertiary);
}
</style>
