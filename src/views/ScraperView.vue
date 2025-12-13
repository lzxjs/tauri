<template>
  <div class="scraper-container">
    <!-- Top Bar: Request Control -->
    <div class="control-header">
      <div class="url-bar-card glass-panel">
        <div class="url-input-wrapper">
          <a-input-group compact class="custom-input-group">
            <a-select v-model:value="requestMethod" class="method-select" :bordered="false">
              <a-select-option value="GET">GET</a-select-option>
            </a-select>
            <div class="divider-vertical"></div>
            <a-auto-complete
              v-model:value="targetUrl"
              :options="urlHistoryOptions"
              class="url-input"
              :filterOption="false"
              @select="onSelectHistoryUrl"
              :bordered="false"
            >
              <a-input
                placeholder="输入目标网址 (例如 https://example.com)"
                @pressEnter="fetchPage"
                :bordered="false"
              >
                <template #prefix>
                   <LinkOutlined style="color: #bfbfbf" />
                </template>
              </a-input>
            </a-auto-complete>
            
            <div class="url-actions">
               <a-divider type="vertical" style="height: 20px; margin: 0 4px" />
               <a-tooltip title="请求设置">
                  <a-button type="text" shape="circle" @click="settingsVisible = true">
                    <SettingOutlined />
                  </a-button>
               </a-tooltip>
               <a-tooltip title="清空历史">
                  <a-button type="text" shape="circle" @click="clearUrlHistory" :disabled="urlHistory.length === 0">
                     <HistoryOutlined />
                  </a-button>
               </a-tooltip>
            </div>

            <a-button type="primary" class="fetch-btn" :loading="loading" @click="fetchPage">
              <template #icon><GlobalOutlined /></template>
              加载页面
            </a-button>
          </a-input-group>
        </div>
      </div>

      <div class="actions-bar">
         <a-radio-group v-model:value="isInspectorActive" button-style="solid" class="mode-switch">
            <a-radio-button :value="false">浏览模式</a-radio-button>
            <a-radio-button :value="true">
               <AimOutlined /> 选取模式
            </a-radio-button>
         </a-radio-group>
         
         <div class="right-actions">
            <a-button @click="showCodeModal" class="action-btn">
               <template #icon><CodeOutlined /></template>
               生成代码
            </a-button>
            
            <a-dropdown>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="save" @click="exportRules">
                    <SaveOutlined /> 保存规则配置
                  </a-menu-item>
                  <a-menu-item key="load" @click="triggerImport">
                    <FolderOpenOutlined /> 导入规则配置
                  </a-menu-item>
                </a-menu>
              </template>
              <a-button class="action-btn">
                 规则管理 <DownOutlined />
              </a-button>
            </a-dropdown>

             <input 
              type="file" 
              ref="fileInput" 
              style="display: none" 
              accept=".json"
              @change="importRules"
            />
         </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Left: Browser Preview -->
      <div class="pane browser-pane">
        <div class="pane-header">
          <div class="pane-title">
            <DesktopOutlined /> 页面预览
          </div>
          <div class="pane-controls">
             <span v-if="isInspectorActive" class="inspector-badge">
               <span class="pulse-dot"></span> 正在选取元素...
             </span>
             <a-radio-group v-model:value="isMobileView" size="small" button-style="solid">
                <a-radio-button :value="false"><DesktopOutlined /></a-radio-button>
                <a-radio-button :value="true"><MobileOutlined /></a-radio-button>
             </a-radio-group>
          </div>
        </div>
        
        <div class="browser-viewport-wrapper">
            <div class="browser-viewport" ref="browserContainer" :class="{ 'mobile-view': isMobileView }">
              <div class="browser-address-bar" v-if="processedHtml">
                 <div class="traffic-lights">
                    <span></span><span></span><span></span>
                 </div>
                 <div class="fake-url">{{ targetUrl || 'Empty Page' }}</div>
              </div>
              
              <div class="iframe-container">
                  <iframe
                    ref="previewFrame"
                    class="preview-iframe"
                    sandbox="allow-same-origin allow-scripts"
                    :srcdoc="processedHtml"
                  ></iframe>
                  
                  <div v-if="!processedHtml" class="empty-state">
                    <div class="empty-icon-bg">
                        <GlobalOutlined />
                    </div>
                    <h3>准备就绪</h3>
                    <p>在上方输入网址并点击"加载页面"开始配置</p>
                  </div>
                  
                  <div v-if="loading" class="loading-overlay">
                    <a-spin size="large" tip="正在加载页面资源..." />
                  </div>
              </div>
            </div>
        </div>
      </div>

      <!-- Right: Configuration -->
      <div class="pane config-pane">
        <a-tabs v-model:activeKey="activeTab" class="custom-tabs" :tabBarGutter="24">
          <!-- Fields Tab -->
          <a-tab-pane key="fields">
            <template #tab>
              <span class="tab-label">
                <ProfileOutlined />
                提取规则
              </span>
            </template>
            
            <div class="config-content scrollbar-custom">
              <div class="fields-list">
                 <transition-group name="list" tag="div">
                    <div v-for="(field, index) in fields" :key="index" class="field-card" :class="{ active: currentFieldIndex === index }" @click="currentFieldIndex = index">
                       <div class="field-card-header">
                          <div class="field-name">
                             <span class="field-index">#{{ index + 1 }}</span>
                             <a-input v-model:value="field.name" placeholder="字段名" size="small" class="field-name-input" :bordered="false" />
                          </div>
                          <div class="field-actions">
                             <a-tooltip title="复制">
                                <a-button type="text" size="small" @click.stop="duplicateField(index)"><CopyOutlined /></a-button>
                             </a-tooltip>
                             <a-tooltip title="删除">
                                <a-button type="text" danger size="small" @click.stop="removeField(index)"><DeleteOutlined /></a-button>
                             </a-tooltip>
                          </div>
                       </div>
                       
                       <div class="field-card-body" v-show="currentFieldIndex === index">
                          <div class="form-row">
                             <div class="form-item" style="flex: 1">
                                <label>CSS 选择器</label>
                                <div class="selector-input-group">
                                   <a-input v-model:value="field.selector" placeholder="点击左侧元素自动获取" size="small">
                                      <template #suffix>
                                         <AimOutlined class="aim-icon" :class="{ active: isInspectorActive }" />
                                      </template>
                                   </a-input>
                                </div>
                             </div>
                             <div class="form-item" style="width: 100px">
                                <label>属性</label>
                                <a-select v-model:value="field.attr" size="small" style="width: 100%">
                                    <a-select-option value="text">Text</a-select-option>
                                    <a-select-option value="html">HTML</a-select-option>
                                    <a-select-option value="href">Href</a-select-option>
                                    <a-select-option value="src">Src</a-select-option>
                                    <a-select-option value="custom">Custom</a-select-option>
                                </a-select>
                             </div>
                          </div>
                          
                          <div v-if="field.attr === 'custom'" class="form-row">
                             <div class="form-item">
                                <label>自定义属性名</label>
                                <a-input v-model:value="field.customAttr" placeholder="例如 data-id" size="small" />
                             </div>
                          </div>

                          <div class="data-clean-section">
                             <div class="section-title">数据清洗</div>
                             <div class="form-row">
                                <div class="form-item" style="width: 100px">
                                   <a-select v-model:value="field.transformType" size="small" style="width: 100%">
                                      <a-select-option value="none">无处理</a-select-option>
                                      <a-select-option value="trim">Trim</a-select-option>
                                      <a-select-option value="regex">正则提取</a-select-option>
                                      <a-select-option value="replace">替换</a-select-option>
                                   </a-select>
                                </div>
                                <div class="form-item" style="flex: 1" v-if="['regex', 'replace'].includes(field.transformType)">
                                   <a-input v-model:value="field.transformPattern" :placeholder="field.transformType === 'regex' ? '正则 (e.g. Price: (\\d+))' : '匹配正则'" size="small" />
                                </div>
                                <div class="form-item" style="flex: 1" v-if="field.transformType === 'replace'">
                                   <a-input v-model:value="field.transformReplacement" placeholder="替换值 (留空删除)" size="small" />
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </transition-group>

                 <a-button type="dashed" block class="add-field-btn" @click="addField">
                   <PlusOutlined /> 添加新字段
                 </a-button>
              </div>
            </div>
          </a-tab-pane>

          <!-- Data Preview Tab -->
          <a-tab-pane key="data">
            <template #tab>
               <span class="tab-label">
                <EyeOutlined />
                数据预览
              </span>
            </template>
            <div class="config-content data-tab-content">
               <div class="data-toolbar">
                  <div class="toolbar-left">
                     <span class="mode-label">采集模式:</span>
                     <a-radio-group v-model:value="listMode" size="small" button-style="solid">
                        <a-radio-button :value="false">单条</a-radio-button>
                        <a-radio-button :value="true">列表</a-radio-button>
                     </a-radio-group>
                  </div>
                  <div class="toolbar-right">
                     <a-tag color="blue">{{ previewCountText }}</a-tag>
                     <a-button type="text" size="small" @click="refreshPreview" :loading="loading"><ReloadOutlined /></a-button>
                  </div>
               </div>

               <div v-if="listMode" class="list-selector-box">
                  <div class="box-label">列表容器 (循环项)</div>
                  <a-input-search
                     v-model:value="listSelector"
                     placeholder="CSS 选择器 (例如 .product-item)"
                     enter-button="智能检测"
                     size="small"
                     @search="detectListSelector"
                  />
               </div>

               <div class="preview-display">
                  <div class="display-controls">
                      <a-radio-group v-model:value="previewViewMode" size="small">
                        <a-radio-button value="json">JSON</a-radio-button>
                        <a-radio-button value="table">表格</a-radio-button>
                      </a-radio-group>
                      
                      <a-dropdown>
                        <template #overlay>
                          <a-menu>
                            <a-menu-item @click="exportData('json')"><FileTextOutlined /> 导出 JSON</a-menu-item>
                            <a-menu-item @click="exportData('csv')"><TableOutlined /> 导出 CSV</a-menu-item>
                          </a-menu>
                        </template>
                        <a-button size="small">导出 <DownOutlined /></a-button>
                      </a-dropdown>
                  </div>
                  
                  <div class="display-area custom-scroll">
                     <div v-if="previewViewMode === 'json'" class="json-view">
                        <div v-if="!hasPreviewData" class="no-data">暂无数据</div>
                        <pre v-else>{{ previewDataJson }}</pre>
                     </div>
                     <div v-else class="table-view">
                        <a-table
                          v-if="hasPreviewData"
                          :dataSource="listMode ? previewResult : [previewResult]"
                          :columns="tableColumns"
                          size="small"
                          :pagination="{ pageSize: 20, size: 'small' }"
                          :scroll="{ x: 'max-content', y: 400 }"
                        />
                         <div v-else class="no-data">暂无数据</div>
                     </div>
                  </div>
               </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>

    <!-- Settings Drawer -->
    <a-drawer
      v-model:open="settingsVisible"
      title="请求配置"
      placement="right"
      width="360"
      :headerStyle="{ borderBottom: '1px solid #f0f0f0' }"
      :bodyStyle="{ padding: '20px' }"
    >
      <a-form layout="vertical">
        <a-form-item label="请求超时 (毫秒)">
          <a-input-number v-model:value="requestTimeout" style="width: 100%" />
        </a-form-item>
        
        <div class="section-divider">请求头 (Headers)</div>
        <div class="headers-list">
           <div v-for="(header, index) in requestHeaders" :key="index" class="header-row">
              <a-input v-model:value="header.key" placeholder="Key" class="header-input" />
              <span class="colon">:</span>
              <a-input v-model:value="header.value" placeholder="Value" class="header-input" />
              <a-button type="text" danger size="small" @click="removeHeader(index)">
                <DeleteOutlined />
              </a-button>
           </div>
        </div>
        <a-button type="dashed" block @click="addHeader" style="margin-top: 10px">
          <PlusOutlined /> 添加 Header
        </a-button>
      </a-form>
    </a-drawer>

    <!-- Code Generation Modal -->
    <a-modal
      v-model:open="codeModalVisible"
      title="代码生成"
      width="800px"
      :footer="null"
      class="code-modal"
    >
      <div class="code-modal-body">
        <div class="code-toolbar">
          <a-radio-group v-model:value="codeLanguage" button-style="solid">
            <a-radio-button value="node">Node.js (Cheerio)</a-radio-button>
            <a-radio-button value="python">Python (BS4)</a-radio-button>
          </a-radio-group>
          <div class="code-actions">
             <a-button @click="copyCode"><CopyOutlined /> 复制</a-button>
             <a-button type="primary" @click="downloadCode"><DownloadOutlined /> 下载文件</a-button>
          </div>
        </div>
        <div class="code-editor-container">
          <pre><code>{{ generatedCode }}</code></pre>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import { 
  GlobalOutlined, 
  AimOutlined, 
  CodeOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  CopyOutlined,
  DownloadOutlined,
  SettingOutlined,
  TableOutlined,
  FileTextOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  MobileOutlined,
  DesktopOutlined,
  ProfileOutlined,
  EyeOutlined,
  HistoryOutlined,
  ClearOutlined,
  LinkOutlined,
  ReloadOutlined,
  DownOutlined
} from '@ant-design/icons-vue';
import { fetch } from '@tauri-apps/plugin-http';

// --- State ---
const targetUrl = ref('');
const requestMethod = ref('GET');
const loading = ref(false);
const processedHtml = ref('');
const previewFrame = ref(null);
const isInspectorActive = ref(false);
const isMobileView = ref(false);
const activeTab = ref('fields');

// --- URL History ---
const urlHistory = ref([]);
const URL_HISTORY_KEY = 'scraper:urlHistory:v1';
const MAX_URL_HISTORY = 20;

// --- Advanced Settings ---
const settingsVisible = ref(false);
const requestHeaders = ref([
  { key: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
]);
const requestTimeout = ref(10000);

// --- Data Preview Options ---
const previewViewMode = ref('json'); // 'json' | 'table'

const fields = reactive([
  { 
    name: 'title', 
    selector: 'h1', 
    attr: 'text', 
    customAttr: '',
    transformType: 'none',
    transformPattern: '',
    transformReplacement: ''
  }
]);
const currentFieldIndex = ref(0);

const listMode = ref(false);
const listSelector = ref('');

const codeModalVisible = ref(false);
const codeLanguage = ref('node');

const loadUrlHistory = () => {
  try {
    const raw = localStorage.getItem(URL_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    urlHistory.value = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (e) {
    urlHistory.value = [];
  }
};

const saveUrlHistory = () => {
  try {
    localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(urlHistory.value.slice(0, MAX_URL_HISTORY)));
  } catch (e) {
    // ignore
  }
};

const normalizedUrl = (input) => {
  const str = (input || '').trim();
  if (!str) return '';
  if (str.startsWith('http://') || str.startsWith('https://')) return str;
  return 'https://' + str;
};

const addToHistory = (url) => {
  const u = normalizedUrl(url);
  if (!u) return;
  urlHistory.value = [u, ...urlHistory.value.filter(x => x !== u)].slice(0, MAX_URL_HISTORY);
  saveUrlHistory();
};

const clearUrlHistory = () => {
  urlHistory.value = [];
  saveUrlHistory();
  message.success('已清空 URL 历史');
};

const urlHistoryOptions = computed(() => {
  const q = (targetUrl.value || '').trim().toLowerCase();
  const list = q ? urlHistory.value.filter(u => u.toLowerCase().includes(q)) : urlHistory.value;
  return list.slice(0, 8).map(u => ({ value: u }));
});

const onSelectHistoryUrl = (value) => {
  targetUrl.value = value;
};

// --- Settings Logic ---
const addHeader = () => {
  requestHeaders.value.push({ key: '', value: '' });
};

const removeHeader = (index) => {
  requestHeaders.value.splice(index, 1);
};

// --- Import/Export Logic ---
const fileInput = ref(null);

const exportRules = () => {
  const config = {
    targetUrl: targetUrl.value,
    requestMethod: requestMethod.value,
    fields: fields,
    listMode: listMode.value,
    listSelector: listSelector.value,
    headers: requestHeaders.value
  };
  downloadFile('scraper-rules.json', JSON.stringify(config, null, 2));
};

const triggerImport = () => {
  fileInput.value.click();
};

const importRules = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);
      if (config.targetUrl) targetUrl.value = config.targetUrl;
      if (config.requestMethod) requestMethod.value = config.requestMethod;
      if (config.fields) {
        fields.length = 0;
        fields.push(...config.fields);
      }
      if (config.listMode !== undefined) listMode.value = config.listMode;
      if (config.listSelector) listSelector.value = config.listSelector;
      if (config.headers) requestHeaders.value = config.headers;
      
      message.success('规则导入成功');
      refreshPreview();
    } catch (err) {
      message.error('规则文件解析失败');
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset
};

const exportData = (type) => {
  if (!previewResult.value) return;
  
  if (type === 'json') {
    downloadFile('data.json', JSON.stringify(previewResult.value, null, 2));
  } else if (type === 'csv') {
    // Simple CSV conversion
    let data = Array.isArray(previewResult.value) ? previewResult.value : [previewResult.value];
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(fieldName => {
        let val = row[fieldName] || '';
        val = String(val).replace(/"/g, '""'); // Escape quotes
        return `"${val}"`;
      }).join(','))
    ].join('\n');
    
    downloadFile('data.csv', csvContent, 'text/csv');
  }
};

const downloadFile = (filename, content, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// --- Browser & Inspector Logic ---

const fetchPage = async () => {
  if (!targetUrl.value) {
    message.warning('请输入目标网址');
    return;
  }

  targetUrl.value = normalizedUrl(targetUrl.value);

  loading.value = true;
  isInspectorActive.value = false;
  
  try {
    const headers = {};
    requestHeaders.value.forEach(h => {
      if (h.key && h.value) headers[h.key] = h.value;
    });

    const response = await fetch(targetUrl.value, {
      method: 'GET',
      headers: headers,
      connectTimeout: requestTimeout.value
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const html = await response.text();
    processedHtml.value = injectInspectorScript(html, targetUrl.value);
    addToHistory(targetUrl.value);
    
    message.success('页面加载成功');
  } catch (error) {
    console.error(error);
    message.error(`加载失败: ${error?.message || error || '网络请求失败'}`);
  } finally {
    loading.value = false;
  }
};

// Inject script for interaction and base tag for relative links
const injectInspectorScript = (html, baseUrl) => {
  // Add base tag
  const baseTag = `<base href="${baseUrl}" target="_blank">`;
  let processed = html.replace('<head>', `<head>${baseTag}`);
  
  // Inject Inspector Script
  const script = `
    <script>
      (function() {
        let active = false;
        let highlighted = null;
        
        window.addEventListener('message', (event) => {
          if (event.data.type === 'toggle-inspector') {
            active = event.data.active;
            if (!active && highlighted) {
              highlighted.style.outline = '';
              highlighted = null;
            }
          }
        });

        document.addEventListener('mouseover', (e) => {
          if (!active) return;
          e.stopPropagation();
          
          if (highlighted) highlighted.style.outline = '';
          e.target.style.outline = '2px solid #1890ff';
          highlighted = e.target;
        }, true);

        document.addEventListener('mouseout', (e) => {
          if (!active) return;
          e.target.style.outline = '';
        }, true);

        document.addEventListener('click', (e) => {
          if (!active) return;
          e.preventDefault();
          e.stopPropagation();
          
          const selector = generateSelector(e.target);
          window.parent.postMessage({
            type: 'element-selected',
            selector: selector,
            tagName: e.target.tagName,
            text: e.target.innerText.slice(0, 50)
          }, '*');
        }, true);

        // Simple selector generator
        function generateSelector(el) {
          if (el.tagName.toLowerCase() === 'html') return 'html';
          if (el.tagName.toLowerCase() === 'body') return 'body';
          if (el.id) return '#' + el.id;
          
          const path = [];
          while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
              selector += '#' + el.id;
              path.unshift(selector);
              break;
            } else {
              let sib = el, nth = 1;
              while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() == selector)
                  nth++;
              }
              if (nth != 1)
                selector += ":nth-of-type("+nth+")";
            }
            path.unshift(selector);
            el = el.parentNode;
            if (el.tagName.toLowerCase() === 'body') break;
          }
          return path.join(" > ");
        }
      })();
    <\/script>
    <style>
      /* Prevent pointer events on iframes/objects to allow selection over them */
      iframe, object, embed { pointer-events: none; }
    </style>
  `;
  
  return processed + script;
};

const toggleInspector = () => {
  // Logic now handled by watch(isInspectorActive) usually, or we can just send the message
  // But since we use v-model isInspectorActive, we should watch it.
};

watch(isInspectorActive, (active) => {
   if (!processedHtml.value) {
     if(active) message.warning("请先加载页面");
     return;
   }
   if (previewFrame.value && previewFrame.value.contentWindow) {
    previewFrame.value.contentWindow.postMessage({
      type: 'toggle-inspector',
      active: active
    }, '*');
  }
});

// Handle messages from iframe
const handleMessage = (event) => {
  if (event.data.type === 'element-selected') {
    if (currentFieldIndex.value !== -1 && fields[currentFieldIndex.value]) {
      fields[currentFieldIndex.value].selector = event.data.selector;
      message.success(`已选择: ${event.data.tagName}`);
      // Refresh preview automatically
      scheduleRefreshPreview();
    }
  }
};

const handleKeydown = (e) => {
  const key = (e.key || '').toLowerCase();
  const isMac = navigator.platform && navigator.platform.toLowerCase().includes('mac');
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (key === 'escape') {
    isInspectorActive.value = false;
    if (codeModalVisible.value) codeModalVisible.value = false;
    if (settingsVisible.value) settingsVisible.value = false;
  }

  if (!mod) return;

  if (key === 'enter' && !e.isComposing) {
    // Only fetch if focused on URL? Actually let's restrict this
    // e.preventDefault();
    // fetchPage();
  } else if (key === 'i') {
    e.preventDefault();
    isInspectorActive.value = !isInspectorActive.value;
  }
};

onMounted(() => {
  window.addEventListener('message', handleMessage);
  window.addEventListener('keydown', handleKeydown);
  loadUrlHistory();
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  window.removeEventListener('keydown', handleKeydown);
  if (refreshTimer.value) {
    clearTimeout(refreshTimer.value);
    refreshTimer.value = null;
  }
});

// --- Field Management ---
const addField = () => {
  fields.push({ 
    name: `field_${fields.length + 1}`, 
    selector: '', 
    attr: 'text', 
    customAttr: '',
    transformType: 'none',
    transformPattern: '',
    transformReplacement: ''
  });
  currentFieldIndex.value = fields.length - 1;
};

const duplicateField = (index) => {
  const field = fields[index];
  fields.splice(index + 1, 0, JSON.parse(JSON.stringify(field)));
};

const removeField = (index) => {
  fields.splice(index, 1);
  if (currentFieldIndex.value >= fields.length) {
    currentFieldIndex.value = Math.max(0, fields.length - 1);
  }
};

// --- Preview Logic ---
const previewResult = ref([]);

const tableColumns = computed(() => {
  return fields
    .filter(f => f && f.name)
    .map(f => ({ title: f.name, dataIndex: f.name, key: f.name }));
});

const hasPreviewData = computed(() => {
  if (listMode.value) {
    return Array.isArray(previewResult.value) && previewResult.value.length > 0;
  }
  return previewResult.value && typeof previewResult.value === 'object' && Object.keys(previewResult.value).length > 0;
});

const previewCountText = computed(() => {
  if (!processedHtml.value) return 'Ready';
  if (listMode.value) {
    const n = Array.isArray(previewResult.value) ? previewResult.value.length : 0;
    return `${n} 条结果`;
  }
  return hasPreviewData.value ? '1 条结果' : '0 条结果';
});

const refreshTimer = ref(null);
const scheduleRefreshPreview = () => {
  if (refreshTimer.value) clearTimeout(refreshTimer.value);
  refreshTimer.value = setTimeout(() => {
    refreshPreview();
  }, 250);
};

const refreshPreview = () => {
  if (!processedHtml.value) return;
  
  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(processedHtml.value, 'text/html');
  
  if (listMode.value && listSelector.value) {
    // List Mode
    const items = doc.querySelectorAll(listSelector.value);
    const results = [];
    items.forEach(item => {
      const row = {};
      fields.forEach(field => {
        if (field.name && field.selector) {
          const el = item.querySelector(field.selector);
          row[field.name] = extractValue(el, field);
        }
      });
      results.push(row);
    });
    previewResult.value = results;
  } else {
    // Single Mode
    const row = {};
    fields.forEach(field => {
      if (field.name && field.selector) {
        const el = doc.querySelector(field.selector);
        row[field.name] = extractValue(el, field);
      }
    });
    previewResult.value = row;
  }
};

const extractValue = (el, field) => {
  if (!el) return null;
  let val = '';
  switch (field.attr) {
    case 'text': val = el.textContent.trim(); break;
    case 'html': val = el.innerHTML; break;
    case 'href': val = el.getAttribute('href'); break;
    case 'src': val = el.getAttribute('src'); break;
    case 'custom': val = el.getAttribute(field.customAttr); break;
    default: val = el.textContent.trim();
  }

  // Transformations
  if (val && field.transformType === 'regex' && field.transformPattern) {
    try {
      const re = new RegExp(field.transformPattern);
      const match = val.match(re);
      if (match) val = match[1] || match[0];
    } catch (e) { console.warn('Regex Error', e); }
  } else if (val && field.transformType === 'replace' && field.transformPattern) {
    try {
      val = val.replace(new RegExp(field.transformPattern, 'g'), field.transformReplacement || '');
    } catch (e) { console.warn('Replace Error', e); }
  } else if (val && field.transformType === 'trim') {
      val = val.trim();
  }

  return val;
};

const previewDataJson = computed(() => {
  return JSON.stringify(previewResult.value, null, 2);
});

const detectListSelector = () => {
  if (!processedHtml.value) {
    message.warning('请先加载页面');
    return;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml.value, 'text/html');
    const body = doc.body;
    if (!body) {
      message.error('页面解析失败');
      return;
    }

    let best = null;

    const parents = body.querySelectorAll('*');
    parents.forEach(parent => {
      const children = Array.from(parent.children || []);
      if (children.length < 6) return;

      const counter = new Map();
      children.forEach(ch => {
        const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
        if (!tag) return;

        const cls = (ch.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);
        const key = cls.length ? '.' + cls[0] : tag;
        counter.set(key, (counter.get(key) || 0) + 1);
      });

      for (const [key, count] of counter.entries()) {
        if (count < 3) continue;
        const score = count;
        if (!best || score > best.score) {
          best = { selector: key, score };
        }
      }
    });

    if (!best) {
      message.info('未检测到明显的列表结构，请手动输入');
      return;
    }

    listSelector.value = best.selector;
    message.success(`已智能填入: ${best.selector}`);
    scheduleRefreshPreview();
  } catch (e) {
    message.error('智能检测失败，请手动输入');
  }
};

watch([fields, listMode, listSelector], () => {
  scheduleRefreshPreview();
}, { deep: true });


// --- Code Generation ---

const generatedCode = computed(() => {
  if (codeLanguage.value === 'node') {
    return generateNodeCode();
  } else {
    return generatePythonCode();
  }
});

const showCodeModal = () => {
  codeModalVisible.value = true;
};

const generateNodeCode = () => {
  const processField = (f, varName) => {
    let code = '';
    // Extraction
    let extract = '';
    switch(f.attr) {
      case 'text': extract = '.text()'; break;
      case 'html': extract = '.html()'; break;
      case 'href': extract = '.attr("href")'; break;
      case 'src': extract = '.attr("src")'; break;
      case 'custom': extract = `.attr("${f.customAttr}")`; break;
      default: extract = '.text()';
    }
    code += `    let ${varName} = el.find('${f.selector}')${extract};\n`;
    
    // Default trim for text if no transform specified or explicit trim
    if (f.attr === 'text' && f.transformType === 'none') {
        code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
    }

    // Transformations
    if (f.transformType === 'trim') {
       code += `    if (${varName}) ${varName} = ${varName}.trim();\n`;
    } else if (f.transformType === 'regex' && f.transformPattern) {
       code += `    const ${varName}_match = ${varName} ? ${varName}.match(new RegExp('${f.transformPattern.replace(/\\/g, '\\\\')}')) : null;\n`;
       code += `    ${varName} = ${varName}_match ? (${varName}_match[1] || ${varName}_match[0]) : "";\n`;
    } else if (f.transformType === 'replace' && f.transformPattern) {
       code += `    if (${varName}) ${varName} = ${varName}.replace(new RegExp('${f.transformPattern.replace(/\\/g, '\\\\')}', 'g'), '${f.transformReplacement || ''}');\n`;
    }
    
    return code;
  };

  const fieldsProcessing = fields
    .filter(f => f.name && f.selector)
    .map(f => processField(f, `val_${f.name}`))
    .join('\n');

  const fieldsAssignment = fields
    .filter(f => f.name && f.selector)
    .map(f => `      ${f.name}: val_${f.name}`)
    .join(',\n');

  if (listMode.value) {
    return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = '${targetUrl.value}';
  const { data } = await axios.get(url, {
     headers: ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n     ')}
  });
  const $ = cheerio.load(data);
  const results = [];

  $('${listSelector.value}').each((i, element) => {
    const el = $(element);
${fieldsProcessing}
    results.push({
${fieldsAssignment}
    });
  });

  console.log(JSON.stringify(results, null, 2));
}

scrape();`;
  } else {
    // Single mode structure
    const singleProcessing = fields
        .filter(f => f.name && f.selector)
        .map(f => {
            // slightly different for single mode as root is $
            let code = `    // ${f.name}\n`;
            let selector = `$('${f.selector}')`;
             let extract = '';
            switch(f.attr) {
              case 'text': extract = '.text()'; break;
              case 'html': extract = '.html()'; break;
              case 'href': extract = '.attr("href")'; break;
              case 'src': extract = '.attr("src")'; break;
              case 'custom': extract = `.attr("${f.customAttr}")`; break;
              default: extract = '.text()';
            }
            code += `    let val_${f.name} = ${selector}${extract};\n`;
             if (f.attr === 'text' && f.transformType === 'none') {
                code += `    if (val_${f.name}) val_${f.name} = val_${f.name}.trim();\n`;
            }
            if (f.transformType === 'trim') {
               code += `    if (val_${f.name}) val_${f.name} = val_${f.name}.trim();\n`;
            } else if (f.transformType === 'regex' && f.transformPattern) {
               code += `    const match_${f.name} = val_${f.name} ? val_${f.name}.match(new RegExp('${f.transformPattern.replace(/\\/g, '\\\\')}')) : null;\n`;
               code += `    val_${f.name} = match_${f.name} ? (match_${f.name}[1] || match_${f.name}[0]) : "";\n`;
            } else if (f.transformType === 'replace' && f.transformPattern) {
               code += `    if (val_${f.name}) val_${f.name} = val_${f.name}.replace(new RegExp('${f.transformPattern.replace(/\\/g, '\\\\')}', 'g'), '${f.transformReplacement || ''}');\n`;
            }
            return code;
        }).join('\n');

    return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = '${targetUrl.value}';
  const { data } = await axios.get(url, {
     headers: ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n     ')}
  });
  const $ = cheerio.load(data);

${singleProcessing}
  const result = {
${fieldsAssignment}
  };

  console.log(JSON.stringify(result, null, 2));
}

scrape();`;
  }
};

const generatePythonCode = () => {
    const processField = (f, varName, isList) => {
        let code = '';
        let elVar = isList ? 'el' : 'soup';
        let selectMethod = isList ? 'select_one' : 'select_one';
        
        code += `        element = ${elVar}.${selectMethod}('${f.selector}')\n`;
        
        let extract = '';
        switch(f.attr) {
            case 'text': extract = '.get_text()'; break; // trim handled later
            case 'html': extract = '.decode_contents()'; break;
            case 'href': extract = '.get("href")'; break;
            case 'src': extract = '.get("src")'; break;
            case 'custom': extract = `.get("${f.customAttr}")`; break;
            default: extract = '.get_text()';
        }
        
        code += `        ${varName} = element${extract} if element else None\n`;
        
        // Transforms
        if (f.attr === 'text' && f.transformType === 'none') {
             code += `        if ${varName}: ${varName} = ${varName}.strip()\n`;
        }
        if (f.transformType === 'trim') {
             code += `        if ${varName}: ${varName} = ${varName}.strip()\n`;
        } else if (f.transformType === 'regex' && f.transformPattern) {
             code += `        if ${varName}:\n`;
             code += `            match = re.search(r'${f.transformPattern.replace(/\\/g, '\\\\')}', ${varName})\n`;
             code += `            ${varName} = match.group(1) if match and match.lastindex and match.lastindex >= 1 else (match.group(0) if match else "")\n`;
        } else if (f.transformType === 'replace' && f.transformPattern) {
             code += `        if ${varName}: ${varName} = re.sub(r'${f.transformPattern.replace(/\\/g, '\\\\')}', '${f.transformReplacement || ''}', ${varName})\n`;
        }
        
        return code;
    };

  const fieldsAssignment = fields
    .filter(f => f.name && f.selector)
    .map(f => `            '${f.name}': val_${f.name}`)
    .join(',\n');

  if (listMode.value) {
    const fieldProcessors = fields
        .filter(f => f.name && f.selector)
        .map(f => processField(f, `val_${f.name}`, true))
        .join('\n');

    return `import requests
from bs4 import BeautifulSoup
import json
import re

def scrape():
    url = '${targetUrl.value}'
    headers = ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n    ').replace(/true/g, 'True').replace(/false/g, 'False')}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    results = []
    for el in soup.select('${listSelector.value}'):
${fieldProcessors}
        results.append({
${fieldsAssignment}
        })

    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    scrape()`;
  } else {
    const fieldProcessors = fields
        .filter(f => f.name && f.selector)
        .map(f => processField(f, `val_${f.name}`, false)) // Indent fixed in map? No, map returns string with indent
        .join('\n')
        .replace(/^        /gm, '    '); // Adjust indent for non-loop

    return `import requests
from bs4 import BeautifulSoup
import json
import re

def scrape():
    url = '${targetUrl.value}'
    headers = ${JSON.stringify(requestHeaders.value.reduce((acc, h) => { if(h.key) acc[h.key] = h.value; return acc; }, {}), null, 4).replace(/\n/g, '\n    ').replace(/true/g, 'True').replace(/false/g, 'False')}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
${fieldProcessors}
    data = {
${fieldsAssignment}
    }

    print(json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    scrape()`;
  }
};

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value);
    message.success('复制成功');
  } catch (e) {
    message.error('复制失败');
  }
};

const downloadCode = () => {
  const ext = codeLanguage.value === 'node' ? 'js' : 'py';
  const blob = new Blob([generatedCode.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scraper.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};

</script>

<style scoped>
.scraper-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  color: var(--text-primary);
}

/* --- Top Bar --- */
.control-header {
   display: flex;
   flex-direction: column;
   gap: 12px;
}

.url-bar-card {
  padding: 8px;
  background: white;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  display: flex;
  align-items: center;
}

.url-input-wrapper {
   width: 100%;
}

.custom-input-group {
   display: flex;
   align-items: center;
   width: 100%;
   background: var(--surface-hover);
   border-radius: var(--border-radius-sm);
   padding: 4px;
   border: 1px solid transparent;
   transition: all 0.2s;
}

.custom-input-group:focus-within {
   border-color: var(--primary-color);
   background: white;
   box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.method-select {
   width: 85px;
}

:deep(.method-select .ant-select-selector) {
   background: transparent !important;
   font-weight: 600;
   color: var(--primary-color);
}

.divider-vertical {
   width: 1px;
   height: 20px;
   background: #e2e8f0;
   margin: 0 4px;
}

.url-input {
   flex: 1;
}

:deep(.url-input .ant-input) {
   background: transparent;
   font-size: 14px;
}

.url-actions {
   display: flex;
   align-items: center;
   padding-right: 8px;
}

.fetch-btn {
   border-radius: 6px !important;
   height: 32px;
   margin-left: 4px;
   padding: 0 16px;
   font-weight: 500;
   box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
}

.actions-bar {
   display: flex;
   justify-content: space-between;
   align-items: center;
   padding: 0 4px;
}

.right-actions {
   display: flex;
   gap: 8px;
}

.action-btn {
   border-radius: var(--border-radius-sm);
   border: none;
   background: rgba(255, 255, 255, 0.6);
   box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.action-btn:hover {
   background: white;
   color: var(--primary-color);
}

/* --- Main Content --- */
.main-content {
   flex: 1;
   display: flex;
   gap: 16px;
   overflow: hidden;
}

.pane {
   background: white;
   border-radius: var(--border-radius);
   box-shadow: var(--box-shadow);
   display: flex;
   flex-direction: column;
   overflow: hidden;
}

.pane-header {
   padding: 12px 16px;
   border-bottom: 1px solid #f1f5f9;
   display: flex;
   justify-content: space-between;
   align-items: center;
   background: #fff;
}

.pane-title {
   font-weight: 600;
   color: var(--text-primary);
   display: flex;
   align-items: center;
   gap: 8px;
}

/* Browser Pane */
.browser-pane {
   flex: 3;
   background: #f8fafc; /* Darker bg for browser contrast */
   position: relative;
}

.browser-viewport-wrapper {
   flex: 1;
   position: relative;
   overflow: auto;
   display: flex;
   justify-content: center;
   padding: 20px;
}

.browser-viewport {
   width: 100%;
   height: 100%;
   background: white;
   border-radius: 8px;
   box-shadow: 0 10px 30px rgba(0,0,0,0.1);
   display: flex;
   flex-direction: column;
   overflow: hidden;
   border: 1px solid #e2e8f0;
   transition: all 0.4s ease;
}

.browser-viewport.mobile-view {
   width: 375px;
   height: 667px;
   border-radius: 24px;
   border: 8px solid #2d3748;
}

.browser-address-bar {
   height: 36px;
   background: #f1f5f9;
   border-bottom: 1px solid #e2e8f0;
   display: flex;
   align-items: center;
   padding: 0 12px;
   gap: 12px;
}

.traffic-lights {
   display: flex;
   gap: 6px;
}

.traffic-lights span {
   width: 10px;
   height: 10px;
   border-radius: 50%;
   background: #cbd5e1;
}

.traffic-lights span:nth-child(1) { background: #ff5f56; }
.traffic-lights span:nth-child(2) { background: #ffbd2e; }
.traffic-lights span:nth-child(3) { background: #27c93f; }

.fake-url {
   flex: 1;
   background: white;
   height: 24px;
   border-radius: 4px;
   display: flex;
   align-items: center;
   padding: 0 8px;
   font-size: 11px;
   color: #64748b;
   white-space: nowrap;
   overflow: hidden;
   text-overflow: ellipsis;
   box-shadow: 0 1px 1px rgba(0,0,0,0.05) inset;
}

.iframe-container {
   flex: 1;
   position: relative;
   background: white;
}

.preview-iframe {
   width: 100%;
   height: 100%;
   border: none;
}

.empty-state {
   position: absolute;
   top: 0; left: 0; right: 0; bottom: 0;
   display: flex;
   flex-direction: column;
   align-items: center;
   justify-content: center;
   color: #94a3b8;
}

.empty-icon-bg {
   width: 80px;
   height: 80px;
   background: #f1f5f9;
   border-radius: 50%;
   display: flex;
   align-items: center;
   justify-content: center;
   font-size: 32px;
   color: #cbd5e1;
   margin-bottom: 16px;
}

.empty-state h3 {
   font-size: 16px;
   color: #475569;
   margin-bottom: 4px;
   font-weight: 600;
}

.inspector-badge {
   color: var(--primary-color);
   font-size: 12px;
   font-weight: 600;
   display: flex;
   align-items: center;
   gap: 6px;
   background: rgba(59, 130, 246, 0.1);
   padding: 2px 8px;
   border-radius: 12px;
}

.pulse-dot {
   width: 8px;
   height: 8px;
   background: currentColor;
   border-radius: 50%;
   animation: pulse 1.5s infinite;
}

@keyframes pulse {
   0% { opacity: 1; transform: scale(1); }
   50% { opacity: 0.4; transform: scale(1.2); }
   100% { opacity: 1; transform: scale(1); }
}

.loading-overlay {
   position: absolute;
   top: 0; left: 0; right: 0; bottom: 0;
   background: rgba(255,255,255,0.8);
   display: flex;
   align-items: center;
   justify-content: center;
   z-index: 10;
   backdrop-filter: blur(2px);
}

/* Config Pane */
.config-pane {
   flex: 2;
   min-width: 320px;
   max-width: 450px;
}

.custom-tabs {
   height: 100%;
   display: flex;
   flex-direction: column;
}

:deep(.ant-tabs-nav) {
   margin: 0 !important;
   padding: 0 16px;
   border-bottom: 1px solid #f1f5f9;
}

.tab-label {
   font-size: 13px;
   padding: 12px 0;
}

:deep(.ant-tabs-content) {
   flex: 1;
}

.config-content {
   height: 100%;
   overflow-y: auto;
   padding: 16px;
}

/* Fields List */
.fields-list {
   display: flex;
   flex-direction: column;
   gap: 12px;
}

.field-card {
   background: #fff;
   border: 1px solid #e2e8f0;
   border-radius: 8px;
   transition: all 0.2s;
   overflow: hidden;
}

.field-card:hover {
   border-color: #cbd5e1;
   box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.field-card.active {
   border-color: var(--primary-color);
   box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.field-card-header {
   padding: 8px 12px;
   background: #f8fafc;
   display: flex;
   justify-content: space-between;
   align-items: center;
   cursor: pointer;
   border-bottom: 1px solid transparent;
}

.field-card.active .field-card-header {
   border-bottom-color: #f1f5f9;
   background: #eff6ff;
}

.field-name {
   display: flex;
   align-items: center;
   gap: 8px;
   flex: 1;
}

.field-index {
   font-size: 11px;
   color: #94a3b8;
   font-weight: 600;
   width: 24px;
}

.field-name-input {
   font-weight: 500;
   color: var(--text-primary);
}

.field-actions {
   opacity: 0;
   transition: opacity 0.2s;
}

.field-card:hover .field-actions,
.field-card.active .field-actions {
   opacity: 1;
}

.field-card-body {
   padding: 12px;
   display: flex;
   flex-direction: column;
   gap: 12px;
   background: white;
}

.form-row {
   display: flex;
   gap: 8px;
   align-items: center;
}

.form-item label {
   display: block;
   font-size: 11px;
   color: #64748b;
   margin-bottom: 4px;
}

.selector-input-group :deep(.ant-input) {
   font-family: monospace;
   color: #0f172a;
}

.aim-icon {
   cursor: pointer;
   color: #94a3b8;
   transition: color 0.2s;
}

.aim-icon:hover, .aim-icon.active {
   color: var(--primary-color);
}

.data-clean-section {
   background: #f8fafc;
   padding: 8px;
   border-radius: 6px;
   border: 1px dashed #e2e8f0;
}

.section-title {
   font-size: 10px;
   color: #94a3b8;
   margin-bottom: 6px;
   text-transform: uppercase;
   letter-spacing: 0.5px;
}

.add-field-btn {
   border-style: dashed;
   height: 40px;
}

/* Data Preview Tab Styles */
.data-tab-content {
    display: flex;
    flex-direction: column;
    padding: 0; /* Override */
}

.data-toolbar {
    padding: 10px 16px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8fafc;
}

.toolbar-left, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.mode-label {
    font-size: 12px;
    color: #64748b;
}

.list-selector-box {
    padding: 12px 16px;
    background: white;
    border-bottom: 1px solid #f1f5f9;
}

.box-label {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 4px;
}

.preview-display {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #f8fafc;
}

.display-controls {
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
}

.display-area {
    flex: 1;
    margin: 0 16px 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    position: relative;
}

.json-view {
    height: 100%;
    overflow: auto;
    padding: 16px;
}

.json-view pre {
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #334155;
    margin: 0;
}

.table-view {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.no-data {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: #cbd5e1;
    font-size: 13px;
}

/* Scrollbar Customization */
.scrollbar-custom::-webkit-scrollbar {
    width: 6px;
}
.scrollbar-custom::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 3px;
}
.custom-scroll {
    overflow: auto;
}

/* Drawer Styles */
.section-divider {
    font-size: 12px;
    color: #94a3b8;
    margin: 16px 0 8px;
    font-weight: 600;
}

.headers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.header-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.colon {
    color: #94a3b8;
    font-weight: bold;
}

/* Code Modal */
.code-modal-body {
    height: 500px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.code-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.code-actions {
    display: flex;
    gap: 8px;
}

.code-editor-container {
    flex: 1;
    background: #1e293b;
    border-radius: 8px;
    padding: 16px;
    overflow: auto;
    color: #e2e8f0;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
}

.code-editor-container pre {
    margin: 0;
}

/* List Transition */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
