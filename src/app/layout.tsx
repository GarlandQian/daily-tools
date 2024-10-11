import 'normalize.css/normalize.css'
import './globals.css'

import React from 'react'
import { AntdRegistry } from '@ant-design/nextjs-registry'

export const metadata = {
  title: "GarlandQian's Tools",
  description: "This is garlandQian's tools",
}

const RootLayout = ({ children }: React.PropsWithChildren) => (
  <html lang="en">
    <body className="flex min-h-screen w-full flex-col">
      <AntdRegistry>{children}</AntdRegistry>
    </body>
  </html>
)

export default RootLayout
