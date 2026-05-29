'use client'

type IconFontProps = {
  className?: string
  type?: string
  onClick?: () => void
}

export default function IconFont({ className, type, onClick }: IconFontProps) {
  return (
    <span className={className} onClick={onClick} aria-hidden="true">
      {type?.includes('chinese') ? '中' : 'EN'}
    </span>
  )
}
