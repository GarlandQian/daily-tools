[English Version](README.md) | [中文版](README_ZH.md)

# Daily Tools

A modern, comprehensive web application designed to enhance daily development workflows, built with the latest web technologies.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Core**: React 19, TypeScript
- **UI Components**: Headless React components
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
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

### 3. Shared Tool Infrastructure

- `src/config/menus.tsx` is the navigation catalog. Keep its tool paths aligned with the static pages under `src/app/[locale]/(tools)` and provide titles in both locale dictionaries.
- `src/features/navigation` owns the shared shell's navigation, preferences, keyboard shortcuts, and visual-effect lifecycle. Browser storage is optional: a blocked or full store must not prevent tools from working.
- `src/features/preview` owns local file selection and renderer sessions. Each uploaded file gets a fresh renderer container; replacing or clearing a file invalidates pending work. Keep file-size and rendered-content limits when adding a format.
- `src/utils/download.ts` provides `downloadText` and `downloadBlob`. Reuse these for exports so filenames, MIME types, anchor cleanup, and object-URL release are handled consistently.

## Validation

Use Node.js 24 and the pnpm version declared in `package.json`.

```bash
pnpm test       # Shared behavior and catalog regression checks
pnpm typecheck  # TypeScript
pnpm lint      # ESLint
pnpm check     # All checks plus the production build
```

The regression suite runs with Node's built-in test runner and TypeScript support; it needs no separate test framework. For preview changes, also exercise a real file upload, replacement, clear/reupload, and invalid-file recovery in the browser. Stop the development server before a production build so both processes do not share `.next` output.

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
