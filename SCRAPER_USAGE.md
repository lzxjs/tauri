# 爬虫功能使用指南

## 已集成的爬虫命令

### 1. `fetch_url` - 获取网页HTML
获取指定URL的完整HTML内容。

**前端调用示例：**
```javascript
import { invoke } from '@tauri-apps/api/core';

// 获取网页HTML
const html = await invoke('fetch_url', { 
  url: 'https://example.com' 
});
console.log(html);
```

---

### 2. `parse_html_by_selector` - 解析HTML
使用CSS选择器从HTML中提取数据。

**前端调用示例：**
```javascript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('parse_html_by_selector', {
  html: '<div><h1>标题</h1><p>段落</p></div>',
  selector: 'h1'
});

console.log(result);
// {
//   success: true,
//   data: [
//     { text: '标题', html: '<h1>标题</h1>' }
//   ],
//   error: null
// }
```

---

### 3. `scrape_page` - 一步完成爬取 ⭐ 推荐
直接从URL抓取并解析数据，最常用的方法。

**前端调用示例：**
```javascript
import { invoke } from '@tauri-apps/api/core';

// 抓取网页标题
const result = await invoke('scrape_page', {
  url: 'https://example.com',
  selector: 'h1'
});

if (result.success) {
  result.data.forEach(item => {
    console.log('文本:', item.text);
    console.log('HTML:', item.html);
  });
} else {
  console.error('错误:', result.error);
}
```

---

## CSS选择器示例

```javascript
// 选择所有标题
selector: 'h1, h2, h3'

// 选择class为article的div
selector: 'div.article'

// 选择id为content的元素
selector: '#content'

// 选择所有链接
selector: 'a'

// 选择带href属性的链接
selector: 'a[href]'

// 嵌套选择
selector: 'div.container > p'

// 多个条件
selector: 'div.post h2.title'
```

---

## Vue3 完整示例

```vue
<script setup>
import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const url = ref('https://example.com');
const selector = ref('h1');
const result = ref(null);
const loading = ref(false);

async function scrapePage() {
  loading.value = true;
  try {
    result.value = await invoke('scrape_page', {
      url: url.value,
      selector: selector.value
    });
  } catch (error) {
    console.error('调用失败:', error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <input v-model="url" placeholder="输入URL" />
    <input v-model="selector" placeholder="CSS选择器" />
    <button @click="scrapePage" :disabled="loading">
      {{ loading ? '爬取中...' : '开始爬取' }}
    </button>
    
    <div v-if="result">
      <div v-if="result.success">
        <h3>找到 {{ result.data.length }} 个元素</h3>
        <div v-for="(item, index) in result.data" :key="index">
          <p>{{ item.text }}</p>
        </div>
      </div>
      <div v-else>
        <p>错误: {{ result.error }}</p>
      </div>
    </div>
  </div>
</template>
```

---

## 注意事项

1. **跨域问题**：Tauri后端不受浏览器CORS限制，可以访问任何网站
2. **静态网页**：当前方案适用于静态HTML，不支持JavaScript渲染的内容
3. **请求频率**：注意控制请求频率，避免被目标网站封禁
4. **错误处理**：始终检查 `result.success` 和 `result.error`
5. **性能**：使用 `blocking` 模式，大量请求时注意不要阻塞UI

---

## 常见用例

### 抓取新闻标题
```javascript
await invoke('scrape_page', {
  url: 'https://news.example.com',
  selector: 'h2.news-title'
});
```

### 抓取商品价格
```javascript
await invoke('scrape_page', {
  url: 'https://shop.example.com/product/123',
  selector: 'span.price'
});
```

### 抓取文章内容
```javascript
await invoke('scrape_page', {
  url: 'https://blog.example.com/post/456',
  selector: 'article .content p'
});
```
