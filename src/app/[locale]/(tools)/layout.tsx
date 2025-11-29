import React from 'react'

import ToolsLayoutClient from './components/ToolsLayoutClient'

const ToolsLayout: React.FC = ({ children }: React.PropsWithChildren) => {
  return <ToolsLayoutClient>{children}</ToolsLayoutClient>
}

export default ToolsLayout
