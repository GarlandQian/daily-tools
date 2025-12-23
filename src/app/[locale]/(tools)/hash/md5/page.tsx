import MD5Form from '@/features/hash/components/MD5Form'

export const metadata = {
  title: 'MD5', // 页面标题
  description: 'Generate MD5 hashes easily with this simple tool.', // 页面描述
  keywords: ['MD5', 'Hash', 'Generator', 'Online Tool'] // 关键词（部分搜索引擎支持）
}

export default function MD5Page() {
  return <MD5Form />
}
