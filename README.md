[English Version](README.md) | [中文版](README_ZH.md)

# Daily Tools

A modern, comprehensive web application designed to enhance daily development workflows, built with the latest web technologies.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Core**: React 19, TypeScript
- **UI Components**: [Ant Design 6](https://ant.design/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Database**: [Prisma 7](https://www.prisma.io/)
- **Visualization**: ECharts, React Three Fiber (Three.js)
- **Package Manager**: pnpm

## Features

### 📄 Document Preview

- Support for viewing PDF, Excel, Word (Docx), and PowerPoint (PPTX) files directly in the browser.

### 🔐 Security & Cryptography

- **Encryption**: AES, DES, Rabbit, RC4 and other encryption/decryption tools.
- **Hashing**: MD5, SHA-1, SHA-256, SHA-512, etc.

### 📊 Visualization

- Interactive data visualization using ECharts.
- 3D model rendering capabilities.

## Development Guidelines

To ensure code maintainability and scalability, please adhere to the following principles when contributing:

### 1. Modular Architecture (`src/features`)

**Rule**: All new features and domain-specific logic MUST be implemented within the `src/features` directory.

- **Structure**: `src/features/[feature-name]`
- **Goal**: Isolate feature-specific code (components, hooks, utils) from the global app routing and shared components.

### 2. Next.js App Router Best Practices

- **Server Components**: Use Server Components by default for data fetching and static markup.
- **Client Components**: Use `"use client"` only for interactive components (state, event listeners). Push Client Components down to the leaf nodes of your component tree.

## Installation

1. Clone the repository

   ```bash
   git clone https://github.com/GarlandQian/daily-tools.git
   cd daily-tools
   ```

2. Install dependencies

   ```bash
   pnpm install
   ```

3. Run development server
   ```bash
   pnpm dev
   ```

## License

MIT © [GarlandQian]
