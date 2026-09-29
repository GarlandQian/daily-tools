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

### 3. 共享工具基础能力

- `src/config/menus.tsx` 是导航目录。工具路径需要与 `src/app/[locale]/(tools)` 下的静态页面一致，并在两种语言中提供标题。
- `src/features/navigation` 负责应用外壳的导航、偏好、快捷键和视觉效果生命周期。浏览器存储被禁用或已满时，工具仍应正常运行。
- `src/features/preview` 负责本地文件选择和渲染会话。每次上传都使用新的渲染容器；替换或清空文件后，旧异步任务不能影响新预览。新增格式时须保留文件大小和渲染内容上限。
- `src/utils/download.ts` 提供 `downloadText` 和 `downloadBlob`。导出功能应复用它们，统一处理文件名、MIME 类型、下载节点清理和对象 URL 释放。

## 验证

使用 Node.js 24 和 `package.json` 声明的 pnpm 版本。

```bash
pnpm test       # 共享行为与工具目录回归检查
pnpm typecheck  # TypeScript 检查
pnpm lint      # ESLint 检查
pnpm check     # 以上检查及生产构建
```

回归检查使用 Node 内置测试运行器和 TypeScript 支持，无需额外测试框架。修改预览功能后，还应在浏览器中用真实文件验证上传、替换、清空后重传及错误文件恢复。生产构建前先停止开发服务器，避免两个进程共用 `.next` 输出。

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
