import dynamic from 'next/dynamic'

export const metadata = {
  title: 'MD5', // 页面标题
  description: 'Generate MD5 hashes easily with this simple tool.', // 页面描述
  keywords: ['MD5', 'Hash', 'Generator', 'Online Tool'], // 关键词（部分搜索引擎支持）
}

// 动态加载客户端组件
const MD5Form = dynamic(() => import('./components/MD5Form'), { ssr: false })

export default function MD5Page() {
  return <MD5Form />
}
