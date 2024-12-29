import SHAForm from './components/SHAForm'

export const metadata = {
  title: 'SHA', // 页面标题
  description: 'Generate SHA hashes easily with this simple tool.', // 页面描述
  keywords: ['SHA', 'Hash', 'Generator', 'Online Tool'] // 关键词（部分搜索引擎支持）
}

export default function SHAPage() {
  return <SHAForm />
}
