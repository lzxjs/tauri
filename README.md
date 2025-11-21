# 系统信息查看器

基于 Vue3 + Tauri + Ant Design Vue 开发的桌面端系统信息查看工具。

## 功能特性

- ✅ 查看系统基本信息（操作系统、版本、架构等）
- ✅ 查看 CPU 信息（品牌、核心数、频率）
- ✅ 查看内存使用情况（总内存、已用、可用、使用率）
- ✅ 查看磁盘信息（容量、使用率、文件系统）
- ✅ 实时刷新功能
- ✅ 现代化 UI 界面

## 技术栈

- **前端框架**: Vue 3 (Composition API + `<script setup>`)
- **构建工具**: Vite
- **桌面框架**: Tauri 2.x
- **UI 框架**: Ant Design Vue 4.x
- **图标库**: @ant-design/icons-vue
- **后端语言**: Rust
- **系统信息库**: sysinfo

## 开发环境要求

- Node.js 18+
- Rust 1.77.2+
- npm 或 yarn

## 安装依赖

```bash
npm install
```

## 开发模式运行

```bash
npm run tauri:dev
```

## 构建应用

```bash
npm run tauri:build
```

构建完成后，可执行文件位于 `src-tauri/target/release/` 目录下。

## 项目结构

```
.
├── src/                    # 前端源码
│   ├── App.vue            # 主应用组件
│   ├── main.js            # 入口文件
│   └── style.css          # 全局样式
├── src-tauri/             # Tauri 后端
│   ├── src/
│   │   ├── lib.rs         # Rust 主逻辑
│   │   └── main.rs        # 入口文件
│   ├── Cargo.toml         # Rust 依赖配置
│   └── tauri.conf.json    # Tauri 配置
├── package.json           # 前端依赖配置
└── vite.config.js         # Vite 配置
```

## 使用说明

1. 启动应用后，会自动加载系统信息
2. 点击右上角"刷新"按钮可重新获取最新信息
3. 支持查看多个磁盘的详细信息

## License

MIT
