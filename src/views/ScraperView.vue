<template>
  <div class="scraper-container">
    <!-- Top Bar -->
    <div class="top-bar">
      <div class="url-input-group">
        <a-input-group compact style="display: flex">
          <a-select v-model:value="requestMethod" style="width: 100px">
            <a-select-option value="GET">GET</a-select-option>
          </a-select>
          <a-input
            v-model:value="targetUrl"
            placeholder="输入目标网址 (https://...)"
            style="flex: 1"
            @pressEnter="fetchPage"
          />
          <a-button type="primary" :loading="loading" @click="fetchPage">
            <template #icon><GlobalOutlined /></template>
            加载网页
          </a-button>
        </a-input-group>
      </div>
      <div class="actions">
        <a-space>
          <a-tooltip title="开启/关闭 元素选择模式">
            <a-button
              :type="isInspectorActive ? 'primary' : 'default'"
              @click="toggleInspector"
              shape="circle"
            >
              <template #icon><AimOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-button type="primary" ghost @click="showCodeModal">
            <template #icon><CodeOutlined /></template>
            生成代码
          </a-button>
        </a-space>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-body">
      <!-- Left: Browser Preview -->
      <div class="browser-pane">
        <div class="browser-header">
          <span>页面预览</span>
          <span v-if="isInspectorActive" class="inspector-badge">
            <AimOutlined /> 选择模式中... (点击页面元素自动提取)
          </span>
        </div>
        <div class="browser-viewport" ref="browserContainer">
          <iframe
            ref="previewFrame"
            class="preview-iframe"
            sandbox="allow-same-origin allow-scripts"
            :srcdoc="processedHtml"
          ></iframe>
          <div v-if="!processedHtml" class="empty-browser">
            <GlobalOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>输入网址并点击加载以开始可视化配置</p>
          </div>
          <div v-if="loading" class="loading-overlay">
            <a-spin tip="正在加载页面..." />
          </div>
        </div>
      </div>

      <!-- Right: Configuration -->
      <div class="config-pane">
        <a-tabs v-model:activeKey="activeTab" class="config-tabs">
          <!-- Fields Tab -->
          <a-tab-pane key="fields" tab="提取规则">
            <div class="fields-list">
              <div v-for="(field, index) in fields" :key="index" class="field-card" :class="{ active: currentFieldIndex === index }">
                <div class="field-header" @click="currentFieldIndex = index">
                  <span class="field-badge">#{{ index + 1 }}</span>
                  <a-input v-model:value="field.name" placeholder="字段名称" size="small" style="width: 120px" :bordered="false" />
                  <div class="field-actions">
                    <a-tooltip title="删除">
                      <a-button type="text" danger size="small" @click.stop="removeField(index)">
                        <template #icon><DeleteOutlined /></template>
                      </a-button>
                    </a-tooltip>
                  </div>
                </div>
                
                <div class="field-body" v-if="currentFieldIndex === index">
                  <a-form layout="vertical" size="small">
                    <a-form-item label="CSS选择器">
                      <div style="display: flex; gap: 8px">
                        <a-input v-model:value="field.selector" placeholder="点击左侧元素自动生成" />
                        <a-button :type="isInspectorActive ? 'primary' : 'default'" size="small" @click="toggleInspector">
                          <AimOutlined />
                        </a-button>
                      </div>
                    </a-form-item>
                    <a-row :gutter="8">
                      <a-col :span="12">
                        <a-form-item label="提取属性">
                          <a-select v-model:value="field.attr" style="width: 100%">
                            <a-select-option value="text">文本 (Text)</a-select-option>
                            <a-select-option value="html">HTML</a-select-option>
                            <a-select-option value="href">链接 (href)</a-select-option>
                            <a-select-option value="src">资源 (src)</a-select-option>
                            <a-select-option value="custom">自定义</a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                      <a-col :span="12" v-if="field.attr === 'custom'">
                        <a-form-item label="属性名">
                          <a-input v-model:value="field.customAttr" placeholder="e.g. data-id" />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </a-form>
                </div>
              </div>

              <a-button type="dashed" block @click="addField" style="margin-top: 12px">
                <PlusOutlined /> 添加字段
              </a-button>
            </div>
          </a-tab-pane>

          <!-- Data Preview Tab -->
          <a-tab-pane key="data" tab="数据预览">
            <div class="data-preview">
              <div class="preview-toolbar">
                <a-radio-group v-model:value="listMode" size="small" button-style="solid">
                  <a-radio-button :value="false">单条</a-radio-button>
                  <a-radio-button :value="true">列表</a-radio-button>
                </a-radio-group>
                <a-button type="link" size="small" @click="refreshPreview">刷新预览</a-button>
              </div>
              
              <div v-if="listMode" class="list-config">
                 <a-form layout="vertical" size="small">
                    <a-form-item label="列表容器选择器 (循环项)">
                       <div style="display: flex; gap: 8px">
                        <a-input v-model:value="listSelector" placeholder="例如: .product-item" />
                         <a-button size="small" @click="detectListSelector">
                          <MagicIcon /> 智能检测
                        </a-button>
                       </div>
                    </a-form-item>
                 </a-form>
              </div>

              <div class="preview-json">
                <pre>{{ previewDataJson }}</pre>
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>

    <!-- Code Generation Modal -->
    <a-modal
      v-model:open="codeModalVisible"
      title="生成爬虫代码"
      width="800px"
      :footer="null"
    >
      <div class="code-modal-content">
        <div class="code-options">
          <a-radio-group v-model:value="codeLanguage" button-style="solid">
            <a-radio-button value="node">Node.js (Cheerio)</a-radio-button>
            <a-radio-button value="python">Python (BeautifulSoup)</a-radio-button>
          </a-radio-group>
          <a-space>
             <a-button @click="copyCode"><CopyOutlined /> 复制</a-button>
             <a-button type="primary" @click="downloadCode"><DownloadOutlined /> 下载</a-button>
          </a-space>
        </div>
        <div class="code-editor-preview">
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
  DownloadOutlined
} from '@ant-design/icons-vue';
import { fetch } from '@tauri-apps/plugin-http';

// --- State ---
const targetUrl = ref('');
const requestMethod = ref('GET');
const loading = ref(false);
const processedHtml = ref('');
const previewFrame = ref(null);
const isInspectorActive = ref(false);
const activeTab = ref('fields');

const fields = reactive([
  { name: 'title', selector: 'h1', attr: 'text', customAttr: '' }
]);
const currentFieldIndex = ref(0);

const listMode = ref(false);
const listSelector = ref('');

const codeModalVisible = ref(false);
const codeLanguage = ref('node');

// --- Helper Components ---
// MagicIcon for smart detect (just using a placeholder icon for now)
const MagicIcon = AimOutlined; 

// --- Browser & Inspector Logic ---

const fetchPage = async () => {
  if (!targetUrl.value) {
    message.warning('请输入目标网址');
    return;
  }
  
  if (!targetUrl.value.startsWith('http')) {
    targetUrl.value = 'https://' + targetUrl.value;
  }

  loading.value = true;
  isInspectorActive.value = false;
  
  try {
    const response = await fetch(targetUrl.value, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const html = await response.text();
    processedHtml.value = injectInspectorScript(html, targetUrl.value);
    
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
  if (!processedHtml.value) return;
  isInspectorActive.value = !isInspectorActive.value;
  
  // Send message to iframe
  if (previewFrame.value && previewFrame.value.contentWindow) {
    previewFrame.value.contentWindow.postMessage({
      type: 'toggle-inspector',
      active: isInspectorActive.value
    }, '*');
  }
};

// Handle messages from iframe
const handleMessage = (event) => {
  if (event.data.type === 'element-selected') {
    if (currentFieldIndex.value !== -1 && fields[currentFieldIndex.value]) {
      fields[currentFieldIndex.value].selector = event.data.selector;
      message.success(`已选择: ${event.data.tagName}`);
      // Refresh preview automatically
      refreshPreview();
    }
  }
};

onMounted(() => {
  window.addEventListener('message', handleMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
});

// --- Field Management ---
const addField = () => {
  fields.push({ name: '', selector: '', attr: 'text', customAttr: '' });
  currentFieldIndex.value = fields.length - 1;
};

const removeField = (index) => {
  fields.splice(index, 1);
  if (currentFieldIndex.value >= fields.length) {
    currentFieldIndex.value = Math.max(0, fields.length - 1);
  }
};

// --- Preview Logic ---
const previewResult = ref([]);

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
  switch (field.attr) {
    case 'text': return el.textContent.trim();
    case 'html': return el.innerHTML;
    case 'href': return el.getAttribute('href');
    case 'src': return el.getAttribute('src');
    case 'custom': return el.getAttribute(field.customAttr);
    default: return el.textContent.trim();
  }
};

const previewDataJson = computed(() => {
  return JSON.stringify(previewResult.value, null, 2);
});

const detectListSelector = () => {
  // Simple heuristic: find container with most children of same tag
  message.info('智能检测暂未实现，请手动输入');
};

watch([fields, listMode, listSelector], () => {
  // Debounce refresh could go here
  refreshPreview();
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
  const fieldsConfig = fields
    .filter(f => f.name && f.selector)
    .map(f => {
      let extract = '';
      switch(f.attr) {
        case 'text': extract = '.text().trim()'; break;
        case 'html': extract = '.html()'; break;
        case 'href': extract = '.attr("href")'; break;
        case 'src': extract = '.attr("src")'; break;
        case 'custom': extract = `.attr("${f.customAttr}")`; break;
        default: extract = '.text().trim()';
      }
      return { name: f.name, selector: f.selector, extract };
    });

  if (listMode.value) {
    return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = '${targetUrl.value}';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const results = [];

  $('${listSelector.value}').each((i, el) => {
    const item = $(el);
    results.push({
${fieldsConfig.map(f => `      ${f.name}: item.find('${f.selector}')${f.extract}`).join(',\n')}
    });
  });

  console.log(JSON.stringify(results, null, 2));
}

scrape();`;
  } else {
    return `const axios = require('axios');
const cheerio = require('cheerio');

async function scrape() {
  const url = '${targetUrl.value}';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const result = {
${fieldsConfig.map(f => `    ${f.name}: $('${f.selector}')${f.extract}`).join(',\n')}
  };

  console.log(JSON.stringify(result, null, 2));
}

scrape();`;
  }
};

const generatePythonCode = () => {
    const fieldsConfig = fields
    .filter(f => f.name && f.selector)
    .map(f => {
      let extract = '';
      switch(f.attr) {
        case 'text': extract = '.get_text(strip=True)'; break;
        case 'html': extract = '.decode_contents()'; break;
        case 'href': extract = '.get("href")'; break;
        case 'src': extract = '.get("src")'; break;
        case 'custom': extract = `.get("${f.customAttr}")`; break;
        default: extract = '.get_text(strip=True)';
      }
      return { name: f.name, selector: f.selector, extract };
    });

  if (listMode.value) {
    return `import requests
from bs4 import BeautifulSoup
import json

def scrape():
    url = '${targetUrl.value}'
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    results = []
    for item in soup.select('${listSelector.value}'):
        data = {}
${fieldsConfig.map(f => `        el = item.select_one('${f.selector}')
        data['${f.name}'] = el${f.extract} if el else None`).join('\n')}
        results.append(data)

    print(json.dumps(results, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    scrape()`;
  } else {
    return `import requests
from bs4 import BeautifulSoup
import json

def scrape():
    url = '${targetUrl.value}'
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    data = {}
${fieldsConfig.map(f => `    el = soup.select_one('${f.selector}')
    data['${f.name}'] = el${f.extract} if el else None`).join('\n')}

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
  background-color: #f5f5f5;
  overflow: hidden;
}

/* Top Bar */
.top-bar {
  background: white;
  padding: 12px 24px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.url-input-group {
  flex: 1;
  max-width: 800px;
}

/* Main Body */
.main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Browser Pane (Left) */
.browser-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e8e8e8;
  background: #e6e6e6;
  position: relative;
}

.browser-header {
  background: #f0f0f0;
  padding: 8px 16px;
  font-size: 12px;
  color: #666;
  border-bottom: 1px solid #d9d9d9;
  display: flex;
  justify-content: space-between;
}

.inspector-badge {
  color: #1890ff;
  font-weight: bold;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}

.browser-viewport {
  flex: 1;
  position: relative;
  background: white;
  margin: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

.empty-browser {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #999;
  background: #fafafa;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255,255,255,0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

/* Config Pane (Right) */
.config-pane {
  width: 400px;
  background: white;
  display: flex;
  flex-direction: column;
}

.config-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.ant-tabs-content) {
  flex: 1;
  height: 100%;
  overflow-y: auto;
}

.fields-list {
  padding: 16px;
}

.field-card {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  margin-bottom: 12px;
  background: #fafafa;
  transition: all 0.3s;
}

.field-card.active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.field-header {
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.field-badge {
  background: #1890ff;
  color: white;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
}

.field-actions {
  margin-left: auto;
}

.field-body {
  padding: 12px;
  border-top: 1px solid rgba(0,0,0,0.05);
  background: white;
  border-radius: 0 0 6px 6px;
}

/* Data Preview */
.data-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-toolbar {
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-config {
    padding: 12px 16px;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
}

.preview-json {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: #282c34;
  color: #abb2bf;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  margin: 0;
}

.preview-json pre {
    margin: 0;
}

/* Code Modal */
.code-modal-content {
  height: 500px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.code-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.code-editor-preview {
  flex: 1;
  background: #1e1e1e;
  border-radius: 4px;
  overflow: auto;
  padding: 16px;
  color: #d4d4d4;
  font-family: 'Consolas', monospace;
}
</style>
