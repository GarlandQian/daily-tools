'use client'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

const variants = {
  hidden: { opacity: 0, x: -200 },
  enter: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 200 },
}

export default function TransitionLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname() // 获取当前路径
  return (
    <motion.div
      key={pathname}
      initial="hidden"
      animate="enter"
      exit="exit"
      variants={variants}
      transition={{ type: 'linear', duration: 0.3 }} // 设置过渡时间
    >
      {children}
    </motion.div>
  )
}
