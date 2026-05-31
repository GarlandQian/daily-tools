[English Version](README.md) | [中文版](README_ZH.md)

# Daily Tools (日常工具集)

一个基于最新 Web 技术构建的现代化开发者效率工具平台。

## 技术栈 (Tech Stack)

- **框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **核心**: React 19, TypeScript
- **UI 组件**: Headless React components
- **样式**: [Tailwind CSS 4](https://tailwindcss.com/)
- **可视化**: ECharts, React Three Fiber (Three.js)
- **包管理**: pnpm

## 功能特性 (Features)

### 📄 文档预览

- 支持在浏览器中直接预览 PDF, Excel, Word (Docx), PowerPoint (PPTX) 等格式文件。

### 🔐 安全与加密

- **加密解密**: 支持 AES, DES, Rabbit, RC4 等多种算法。
- **哈希计算**: 支持 MD5, SHA-1, SHA-256, SHA-512 等。

### 📊 数据可视化

- 基于 ECharts 的交互式图表。
- 基于 Three.js 的 3D 渲染能力。

## 开发指南 (Development Guidelines)

为确保代码的可维护性和扩展性，请在开发新功能时严格遵循以下原则：

### 1. 模块化架构 (`src/features`)

**规则**：所有新的业务功能模块**必须**在 `src/features` 目录下进行扩展。

- **结构**：`src/features/[feature-name]`
- **目的**：将功能特定的代码（组件、Hooks、工具函数）与全局应用路由和共享组件解耦。建议参考现有结构（如 `src/features/preview`）。

### 2. Next.js App Router 最佳实践

- **服务端组件 (Server Components)**：默认使用服务端组件进行数据获取和静态内容渲染。
- **客户端组件 (Client Components)**：仅在需要交互（如 State 状态管理、事件监听）时使用 `"use client"`。尽量将客户端组件下沉至组件树的叶子节点。

## 安装与运行

1. 克隆仓库

   ```bash
   git clone https://github.com/GarlandQian/daily-tools.git
   cd daily-tools
   ```

2. 安装依赖

   ```bash
   pnpm install
   ```

3. 启动开发服务器
   ```bash
   pnpm dev
   ```

## 许可证

MIT © [GarlandQian]
