<template>
  <div class="scraper-view">
    <div class="page-header">
      <div class="header-content">
        <h1>
          <GlobalOutlined class="header-icon" />
          爬虫代码生成器
        </h1>
        <p class="header-desc">可视化配置爬虫规则，一键生成 Node.js / Python 爬虫代码</p>
      </div>
      <div class="header-actions">
        <a-button type="primary" size="large" @click="generateCode">
          <template #icon><CodeOutlined /></template>
          生成代码
        </a-button>
      </div>
    </div>

    <div class="main-content">
      <!-- 左侧配置区 -->
      <div class="config-panel">
        <a-card :bordered="false" class="config-card">
          <a-tabs v-model:activeKey="activeTab">
            <a-tab-pane key="basic" tab="基础设置">
              <a-form layout="vertical" :model="config">
                <a-row :gutter="16">
                  <a-col :span="12">
                    <a-form-item label="生成语言">
                      <a-select v-model:value="config.language">
                        <a-select-option value="node">Node.js (Cheerio)</a-select-option>
                        <a-select-option value="python">Python (BeautifulSoup)</a-select-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="爬取模式">
                      <a-select v-model:value="config.type">
                        <a-select-option value="single">单页提取</a-select-option>
                        <a-select-option value="list">列表+详情</a-select-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                </a-row>

                <a-form-item :label="config.type === 'list' ? '列表页 URL' : '目标 URL'">
                  <a-input v-model:value="config.url" placeholder="https://example.com/target" allow-clear />
                </a-form-item>

                <template v-if="config.type === 'list'">
                  <a-form-item label="列表项选择器" help="用于定位列表中的每一个项目，如: .product-item">
                    <a-input v-model:value="config.listSelector" placeholder=".list-item" />
                  </a-form-item>
                  <a-form-item label="详情链接选择器" help="相对于列表项的链接选择器，如: a.title">
                    <a-input v-model:value="config.linkSelector" placeholder="a" />
                  </a-form-item>
                </template>
              </a-form>
            </a-tab-pane>

            <a-tab-pane key="fields" tab="字段提取">
              <div class="fields-container">
                <div v-for="(field, index) in config.fields" :key="index" class="field-item">
                  <div class="field-header">
                    <span class="field-index">#{{ index + 1 }}</span>
                    <DeleteOutlined class="delete-btn" @click="removeField(index)" v-if="config.fields.length > 1" />
                  </div>
                  <a-row :gutter="12">
                    <a-col :span="8">
                      <a-input v-model:value="field.name" placeholder="字段名 (如: title)" />
                    </a-col>
                    <a-col :span="16">
                      <a-input v-model:value="field.selector" placeholder="CSS选择器 (如: .title h1)" />
                    </a-col>
                  </a-row>
                  <a-row :gutter="12" style="margin-top: 8px">
                    <a-col :span="12">
                      <a-select v-model:value="field.attr" style="width: 100%">
                        <a-select-option value="text">获取文本 (Text)</a-select-option>
                        <a-select-option value="html">获取HTML</a-select-option>
                        <a-select-option value="href">链接 (href)</a-select-option>
                        <a-select-option value="src">图片/资源 (src)</a-select-option>
                        <a-select-option value="custom">自定义属性</a-select-option>
                      </a-select>
                    </a-col>
                    <a-col :span="12" v-if="field.attr === 'custom'">
                      <a-input v-model:value="field.customAttr" placeholder="属性名 (如: data-id)" />
                    </a-col>
                  </a-row>
                </div>
                
                <a-button type="dashed" block @click="addField">
                  <PlusOutlined /> 添加提取字段
                </a-button>
              </div>
            </a-tab-pane>

            <a-tab-pane key="advanced" tab="高级选项">
              <a-form layout="vertical">
                 <a-form-item label="User-Agent">
                   <a-input v-model:value="config.userAgent" placeholder="Mozilla/5.0..." />
                 </a-form-item>
                 <a-row :gutter="16">
                   <a-col :span="12">
                     <a-form-item label="超时时间 (ms)">
                       <a-input-number v-model:value="config.timeout" style="width: 100%" />
                     </a-form-item>
                   </a-col>
                   <a-col :span="12">
                     <a-form-item label="并发数 (列表模式)">
                       <a-input-number v-model:value="config.concurrency" :min="1" :max="10" style="width: 100%" />
                     </a-form-item>
                   </a-col>
                 </a-row>
                 <a-form-item label="导出格式">
                    <a-radio-group v-model:value="config.format" button-style="solid">
                      <a-radio-button value="json">JSON</a-radio-button>
                      <a-radio-button value="csv">CSV</a-radio-button>
                    </a-radio-group>
                 </a-form-item>
              </a-form>
            </a-tab-pane>
          </a-tabs>
        </a-card>
      </div>

      <!-- 右侧代码预览区 -->
      <div class="code-panel">
        <a-card :bordered="false" class="code-card" :bodyStyle="{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }">
          <div class="code-toolbar">
            <span class="code-label">生成结果</span>
            <div class="code-actions">
              <a-tag v-if="generatedCode" color="blue">{{ config.language === 'node' ? 'Node.js' : 'Python' }}</a-tag>
              <a-tooltip title="复制">
                <a-button type="text" size="small" @click="copyCode" :disabled="!generatedCode">
                  <CopyOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip title="下载">
                <a-button type="text" size="small" @click="downloadCode" :disabled="!generatedCode">
                  <DownloadOutlined />
                </a-button>
              </a-tooltip>
            </div>
          </div>
          <div class="code-editor">
            <pre v-if="generatedCode"><code>{{ generatedCode }}</code></pre>
            <div v-else class="empty-state">
              <CodeOutlined style="font-size: 48px; color: #e0e0e0; margin-bottom: 16px" />
              <p>配置参数并点击“生成代码”</p>
            </div>
          </div>
        </a-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { message } from 'ant-design-vue';
import { 
  GlobalOutlined, 
  CodeOutlined, 
  CopyOutlined, 
  DownloadOutlined, 
  PlusOutlined, 
  DeleteOutlined 
} from '@ant-design/icons-vue';

const activeTab = ref('basic');

const config = reactive({
  language: 'node',
  type: 'single',
  url: '',
  listSelector: '',
  linkSelector: '',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  timeout: 5000,
  concurrency: 3,
  format: 'json',
  fields: [
    { name: 'title', selector: 'h1', attr: 'text', customAttr: '' },
    { name: 'content', selector: '.content', attr: 'text', customAttr: '' }
  ]
});

const generatedCode = ref('');

const addField = () => {
  config.fields.push({ name: '', selector: '', attr: 'text', customAttr: '' });
};

const removeField = (index) => {
  config.fields.splice(index, 1);
};

const generateCode = () => {
  if (!config.url) {
    message.warning('请输入目标 URL');
    return;
  }
  if (config.type === 'list' && (!config.listSelector || !config.linkSelector)) {
    message.warning('列表模式下需要填写列表选择器和链接选择器');
    activeTab.value = 'basic';
    return;
  }
  
  const validFields = config.fields.filter(f => f.name && f.selector);
  if (validFields.length === 0) {
    message.warning('请至少配置一个有效的提取字段');
    activeTab.value = 'fields';
    return;
  }

  if (config.language === 'node') {
    generatedCode.value = generateNodeCode();
  } else {
    generatedCode.value = generatePythonCode();
  }
  message.success('代码已生成');
};

const getFieldExtractionCodeNode = (field, $var = '$') => {
  let method = '';
  switch (field.attr) {
    case 'text': method = '.text().trim()'; break;
    case 'html': method = '.html()'; break;
    case 'href': method = '.attr("href")'; break;
    case 'src': method = '.attr("src")'; break;
    case 'custom': method = `.attr("${field.customAttr}")`; break;
    default: method = '.text().trim()';
  }
  return `${$var}('${field.selector}')${method}`;
};

const getFieldExtractionCodePython = (field, soupVar = 'soup') => {
  const sel = field.selector.replace(/'/g, "\\'");
  let code = '';
  switch (field.attr) {
    case 'text': code = `.select_one('${sel}').get_text(strip=True)`; break;
    case 'html': code = `.select_one('${sel}').decode_contents()`; break;
    case 'href': code = `.select_one('${sel}')['href']`; break;
    case 'src': code = `.select_one('${sel}')['src']`; break;
    case 'custom': code = `.select_one('${sel}')['${field.customAttr}']`; break;
    default: code = `.select_one('${sel}').get_text(strip=True)`;
  }
  // Add safety check
  return `${soupVar}.select_one('${sel}') and ${soupVar}${code} or ''`;
};

const generateNodeCode = () => {
  const fieldsCode = config.fields
    .filter(f => f.name && f.selector)
    .map(f => `      ${f.name}: ${getFieldExtractionCodeNode(f, config.type === 'single' ? '$' : 'detail$')}`)
    .join(',\n');

  const baseCode = `const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const config = {
  headers: {
    'User-Agent': '${config.userAgent}'
  },
  timeout: ${config.timeout}
};

const axiosInstance = axios.create(config);
`;

  if (config.type === 'single') {
    return `${baseCode}
async function scrape() {
  try {
    console.log('Fetching: ${config.url}');
    const { data } = await axiosInstance.get('${config.url}');
    const $ = cheerio.load(data);

    const result = {
${fieldsCode}
    };

    console.log('Result:', result);
    saveResult(result);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

function saveResult(data) {
  const output = ${config.format === 'json' ? 'JSON.stringify(data, null, 2)' : 'convertToCSV([data])'};
  fs.writeFileSync('output.${config.format}', output);
  console.log('Saved to output.${config.format}');
}

${config.format === 'csv' ? `
function convertToCSV(arr) {
  if (!arr.length) return '';
  const headers = Object.keys(arr[0]).join(',');
  const rows = arr.map(obj => Object.values(obj).map(v => \`"\${String(v).replace(/"/g, '""')}"\`).join(','));
  return headers + '\\n' + rows.join('\\n');
}
` : ''}
scrape();
`;
  } else {
    // List mode
    return `${baseCode}
async function scrapeList() {
  try {
    console.log('Fetching list: ${config.url}');
    const { data } = await axiosInstance.get('${config.url}');
    const $ = cheerio.load(data);
    
    const links = [];
    $('${config.listSelector}').each((i, el) => {
      const link = $(el).find('${config.linkSelector}').attr('href');
      if (link) {
        // Handle relative URLs
        const absoluteUrl = link.startsWith('http') ? link : new URL(link, '${config.url}').href;
        links.push(absoluteUrl);
      }
    });

    console.log(\`Found \${links.length} items. Starting details scrape with concurrency ${config.concurrency}...\`);
    
    const results = [];
    const chunks = [];
    for (let i = 0; i < links.length; i += ${config.concurrency}) {
      chunks.push(links.slice(i, i + ${config.concurrency}));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map(url => scrapeDetail(url)));
      results.push(...chunkResults.filter(r => r));
      console.log(\`Progress: \${results.length}/\${links.length}\`);
      await new Promise(r => setTimeout(r, 1000)); // Rate limiting
    }

    saveResult(results);

  } catch (error) {
    console.error('List Error:', error.message);
  }
}

async function scrapeDetail(url) {
  try {
    const { data } = await axiosInstance.get(url);
    const detail$ = cheerio.load(data);
    
    return {
      url,
${fieldsCode}
    };
  } catch (e) {
    console.error(\`Failed \${url}: \${e.message}\`);
    return null;
  }
}

function saveResult(data) {
  const output = ${config.format === 'json' ? 'JSON.stringify(data, null, 2)' : 'convertToCSV(data)'};
  fs.writeFileSync('output.${config.format}', output);
  console.log('Saved to output.${config.format}');
}

${config.format === 'csv' ? `
function convertToCSV(arr) {
  if (!arr.length) return '';
  const headers = Object.keys(arr[0]).join(',');
  const rows = arr.map(obj => Object.values(obj).map(v => \`"\${String(v).replace(/"/g, '""')}"\`).join(','));
  return headers + '\\n' + rows.join('\\n');
}
` : ''}
scrapeList();
`;
  }
};

const generatePythonCode = () => {
  const fieldsCode = config.fields
    .filter(f => f.name && f.selector)
    .map(f => `        '${f.name}': ${getFieldExtractionCodePython(f)}`)
    .join(',\n');

  const baseCode = `import requests
from bs4 import BeautifulSoup
import json
import time
import csv
from urllib.parse import urljoin

headers = {
    'User-Agent': '${config.userAgent}'
}
timeout = ${config.timeout / 1000}
`;

  if (config.type === 'single') {
    return `${baseCode}
def scrape():
    url = '${config.url}'
    try:
        print(f"Fetching {url}...")
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        result = {
${fieldsCode}
        }
        
        print("Result:", result)
        save_result([result])
        
    except Exception as e:
        print(f"Error: {e}")

def save_result(data):
    ${config.format === 'json' ? `
    with open('output.json', 'w', encoding='utf-8') as f:
        json.dump(data[0], f, indent=2, ensure_ascii=False)
    ` : `
    keys = data[0].keys()
    with open('output.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(data)
    `}
    print("Saved to output.${config.format}")

if __name__ == "__main__":
    scrape()
`;
  } else {
    return `${baseCode}
def scrape_list():
    list_url = '${config.url}'
    try:
        print(f"Fetching list {list_url}...")
        resp = requests.get(list_url, headers=headers, timeout=timeout)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        links = []
        for item in soup.select('${config.listSelector}'):
            link_el = item.select_one('${config.linkSelector}')
            if link_el and link_el.get('href'):
                full_url = urljoin(list_url, link_el['href'])
                links.append(full_url)
                
        print(f"Found {len(links)} items.")
        
        results = []
        for i, link in enumerate(links):
            detail = scrape_detail(link)
            if detail:
                results.append(detail)
            print(f"Progress: {i+1}/{len(links)}")
            time.sleep(1) # Rate limiting
            
        save_result(results)
        
    except Exception as e:
        print(f"List Error: {e}")

def scrape_detail(url):
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        return {
            'url': url,
${fieldsCode}
        }
    except Exception as e:
        print(f"Detail Error {url}: {e}")
        return None

def save_result(data):
    if not data: return
    ${config.format === 'json' ? `
    with open('output.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    ` : `
    keys = data[0].keys()
    with open('output.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(data)
    `}
    print("Saved to output.${config.format}")

if __name__ == "__main__":
    scrape_list()
`;
  }
};

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value);
    message.success('已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
};

const downloadCode = () => {
  const ext = config.language === 'node' ? 'js' : 'py';
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
.scraper-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f0f2f5;
}

.page-header {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: #1890ff;
  font-size: 24px;
}

.header-desc {
  margin: 4px 0 0 36px;
  color: #8c8c8c;
  font-size: 13px;
}

.main-content {
  flex: 1;
  display: flex;
  padding: 16px;
  gap: 16px;
  overflow: hidden;
}

.config-panel {
  width: 450px;
  display: flex;
  flex-direction: column;
}

.config-card {
  flex: 1;
  overflow-y: auto;
  border-radius: 8px;
}

.code-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.code-card {
  flex: 1;
  border-radius: 8px;
  overflow: hidden;
}

.code-toolbar {
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
}

.code-label {
  font-weight: 600;
  color: #595959;
}

.code-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.code-editor {
  flex: 1;
  background: #1e1e1e;
  overflow: auto;
  position: relative;
}

.code-editor pre {
  margin: 0;
  padding: 20px;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #bfbfbf;
}

.fields-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-item {
  background: #fafafa;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  position: relative;
}

.field-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field-index {
  font-weight: 600;
  color: #1890ff;
  font-size: 12px;
  background: #e6f7ff;
  padding: 1px 8px;
  border-radius: 10px;
}

.delete-btn {
  color: #ff4d4f;
  cursor: pointer;
  font-size: 14px;
}

.delete-btn:hover {
  color: #ff7875;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: transparent;
}
</style>
