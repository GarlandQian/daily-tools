import type { Metadata } from 'next'

import ImageDeliveryClient from '@/features/converter/components/ImageDeliveryClient'

export const metadata: Metadata = {
  title: 'Image Delivery Planner - Daily Tools',
  description:
    'Build, parse, audit, and export responsive image, Next Image, preload, CDN, JSON, and CSV delivery plans'
}

export default function ImageDeliveryPage() {
  return <ImageDeliveryClient />
}
