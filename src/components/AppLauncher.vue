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
    <a-card title="" :bordered="false">
      <template #extra>
        <a-space>
          <!-- 场景选择 -->
          <a-select
            v-model:value="currentScene"
            style="min-width: 160px"
            :options="sceneOptions"
            placeholder="选择场景"
            @change="handleSceneChange"
          />
          <a-button
            type="dashed"
            size="small"
            :icon="h(PlusOutlined)"
            @click="openCreateSceneModal"
          >
            新建场景
          </a-button>
          <a-button
            type="dashed"
            size="small"
            :icon="h(EditOutlined)"
            @click="openRenameSceneModal"
          >
            重命名场景
          </a-button>
          <a-popconfirm
            title="确认删除当前场景及其下所有应用？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="handleDeleteScene"
          >
            <a-button
              type="dashed"
              danger
              size="small"
              :icon="h(DeleteOutlined)"
            >
              删除场景
            </a-button>
          </a-popconfirm>
          <a-button
            type="primary"
            danger
            :icon="h(DeleteOutlined)"
            @click="() => {}"
            :disabled="selectedRowKeys.length === 0"
          >
            <a-popconfirm
              title="确认删除选中的应用？"
              ok-text="删除"
              cancel-text="取消"
              @confirm="handleBatchDelete"
            >
              <span>批量删除 ({{ selectedRowKeys.length }})</span>
            </a-popconfirm>
          </a-button>
          <a-button
            type="primary"
            :icon="h(RocketOutlined)"
            @click="handleLaunchSelected"
            :loading="launching"
            :disabled="selectedRowKeys.length === 0"
          >
            {{ launching ? "启动中..." : "启动选中" }}
          </a-button>
          <a-button
            type="default"
            :icon="h(RocketOutlined)"
            @click="handleLaunchSceneAll"
            :loading="launching"
            :disabled="appsInScene.length === 0"
          >
            {{ launching ? "启动中..." : "本场景全部" }}
          </a-button>
        </a-space>
      </template>

      <!-- 拖放区域 -->
      <div
        class="drop-zone"
        :class="{ 'drop-zone-active': isDragging }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <CloudUploadOutlined class="drop-icon" />
        <p class="drop-text">拖放程序快捷方式到此处</p>
        <p class="drop-hint">支持 .lnk、.exe 等文件</p>
      </div>

      <!-- 应用列表 -->
      <div class="app-list">
        <a-divider orientation="left">
          <AppstoreAddOutlined />
          已添加的应用 ({{ appsInScene.length }}) - 场景：{{ currentScene }}
        </a-divider>

        <a-table
          :columns="columns"
          :data-source="appsInScene"
          :row-key="(record) => record.id"
          :row-selection="rowSelection"
          :pagination="apps.length > 10 ? { pageSize: 10 } : false"
          :scroll="{ x: 800 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div>
                <a-input
                  v-if="editingNameId === record.id"
                  v-model:value="editingNameValue"
                  size="small"
                  @blur="() => finishEditName(record)"
                  @pressEnter="() => finishEditName(record)"
                />
                <span
                  v-else
                  class="app-name-text"
                  @click="startEditName(record)"
                >
                  {{ record.name }}
                </span>
              </div>
            </template>
            <template v-else-if="column.key === 'addedAt'">
              <span>{{
                new Date(record.addedAt).toLocaleString("zh-CN")
              }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                type="link"
                size="small"
                :icon="h(RocketOutlined)"
                title="启动"
                @click="launchApps([record])"
              />
              <a-button
                type="link"
                size="small"
                :icon="h(ArrowUpOutlined)"
                title="上移"
                @click="() => moveRow(record, 'up')"
              />
              <a-button
                type="link"
                size="small"
                :icon="h(ArrowDownOutlined)"
                title="下移"
                @click="() => moveRow(record, 'down')"
              />

              <a-button
                type="link"
                size="small"
                :icon="h(FolderOpenOutlined)"
                title="打开所在文件夹"
                @click="() => openAppFolder(record)"
              />
              <a-button
                type="link"
                size="small"
                :icon="h(EditOutlined)"
                title="改场景"
                @click="openSceneModal(record)"
              />
              <a-popconfirm
                title="确认删除该应用？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="() => handleDelete(record.id)"
              >
                <a-button
                  type="link"
                  danger
                  size="small"
                  :icon="h(DeleteOutlined)"
                  title="删除"
                />
              </a-popconfirm>
            </template>
          </template>

          <template #emptyText>
            <a-empty description="暂无应用，请拖放程序快捷方式到上方区域" />
          </template>
        </a-table>
      </div>
    </a-card>
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
:deep .ant-card .ant-card-extra {
  margin-left: 0;
}
.app-launcher {
  width: 100%;
}

.drop-zone {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 60px 20px;
  text-align: center;
  background: #fafafa;
  transition: all 0.3s;
  cursor: pointer;
  margin-bottom: 24px;
}

.drop-zone:hover {
  border-color: #1890ff;
  background: #e6f7ff;
}

.drop-zone-active {
  border-color: #1890ff;
  background: #e6f7ff;
  transform: scale(1.02);
}

.drop-icon {
  font-size: 48px;
  color: #1890ff;
  margin-bottom: 16px;
}

.drop-text {
  font-size: 16px;
  color: #262626;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.drop-hint {
  font-size: 14px;
  color: #8c8c8c;
  margin: 0;
}

.app-list {
  margin-top: 24px;
}

:deep(.ant-table) {
  font-size: 14px;
}

:deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
}
</style>
