'use client'

import {
  Check,
  CirclePause,
  CirclePlay,
  ClipboardCopy,
  Download,
  Github,
  Inbox,
  Laptop,
  Menu,
  Minimize2,
  Moon,
  Paintbrush,
  Plus,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sun,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  spin?: boolean
}

const withDefaults = (Icon: ComponentType<SVGProps<SVGSVGElement>>) => {
  const Wrapped = ({ className, spin, ...props }: IconProps) => (
    <Icon
      aria-hidden="true"
      className={[spin ? 'animate-spin' : '', className].filter(Boolean).join(' ')}
      width={props.width ?? '1em'}
      height={props.height ?? '1em'}
      {...props}
    />
  )
  Wrapped.displayName = 'AntdCompatIcon'
  return Wrapped
}

export const CheckOutlined = withDefaults(Check)
export const ClearOutlined = withDefaults(X)
export const CompressOutlined = withDefaults(Minimize2)
export const CopyOutlined = withDefaults(ClipboardCopy)
export const DeleteOutlined = withDefaults(Trash2)
export const DownloadOutlined = withDefaults(Download)
export const FormatPainterOutlined = withDefaults(Paintbrush)
export const GithubOutlined = withDefaults(Github)
export const InboxOutlined = withDefaults(Inbox)
export const LaptopOutlined = withDefaults(Laptop)
export const LoadingOutlined = withDefaults(RotateCcw)
export const MenuOutlined = withDefaults(Menu)
export const MoonOutlined = withDefaults(Moon)
export const PauseCircleOutlined = withDefaults(CirclePause)
export const PlayCircleOutlined = withDefaults(CirclePlay)
export const PlusOutlined = withDefaults(Plus)
export const ReloadOutlined = withDefaults(RotateCcw)
export const SafetyOutlined = withDefaults(ShieldCheck)
export const SunOutlined = withDefaults(Sun)
export const SwapOutlined = withDefaults(Shuffle)
export const UploadOutlined = withDefaults(Upload)

export function createFromIconfontCN() {
  const IconFont = ({ className, type, onClick }: { className?: string; type?: string; onClick?: () => void }) => (
    <span className={className} onClick={onClick} aria-hidden="true">
      {type?.includes('chinese') ? '中' : 'EN'}
    </span>
  )
  return IconFont
}
