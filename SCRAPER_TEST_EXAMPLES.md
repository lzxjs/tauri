# 爬虫测试示例

## 快速测试用例

在界面中可以直接测试以下示例：

### 示例 1：Example.com 标题
- **URL**: `https://example.com`
- **选择器**: `h1`
- **预期结果**: 获取 "Example Domain" 标题

---

### 示例 2：GitHub 仓库标题
- **URL**: `https://github.com/tauri-apps/tauri`
- **选择器**: `h1`
- **预期结果**: 获取仓库名称

---

### 示例 3：多个元素
- **URL**: `https://example.com`
- **选择器**: `p`
- **预期结果**: 获取所有段落文本

---

### 示例 4：链接
- **URL**: `https://example.com`
- **选择器**: `a`
- **预期结果**: 获取所有链接

---

### 示例 5：Class 选择器
- **URL**: `https://example.com`
- **选择器**: `div`
- **预期结果**: 获取所有 div 元素

---

## CSS 选择器速查

| 选择器 | 说明 | 示例 |
|--------|------|------|
| `h1` | 标签选择器 | 选择所有 h1 标签 |
| `.class` | 类选择器 | 选择 class="class" 的元素 |
| `#id` | ID选择器 | 选择 id="id" 的元素 |
| `div p` | 后代选择器 | 选择 div 内的所有 p |
| `div > p` | 子选择器 | 选择 div 的直接子元素 p |
| `a[href]` | 属性选择器 | 选择有 href 属性的 a 标签 |
| `h1, h2, h3` | 多选择器 | 选择所有 h1、h2、h3 |

---

## 常见问题

### 1. 跨域问题
✅ Tauri 后端不受浏览器 CORS 限制，可以访问任何网站

### 2. 找不到元素
- 检查选择器语法是否正确
- 确认目标网站是否为静态 HTML（不支持 JS 渲染）
- 使用浏览器开发者工具验证选择器

### 3. 请求失败
- 检查 URL 格式（必须包含 http:// 或 https://）
- 确认网络连接正常
- 某些网站可能有反爬虫机制

---

## 进阶用法

### 组合选择器
```
div.article > h2.title
```
选择 class 为 article 的 div 下的 class 为 title 的 h2

### 属性选择器
```
a[href^="https"]
```
选择 href 以 https 开头的链接

### 伪类选择器
```
li:first-child
```
选择第一个 li 元素
