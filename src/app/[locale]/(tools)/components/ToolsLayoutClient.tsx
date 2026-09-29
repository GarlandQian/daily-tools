'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useRouter } from 'nextjs-toploader/app'
import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MeshGradient } from '@/components/effects/MeshGradient'
import TransitionLayout from '@/components/TransitionLayout'
import { buildSearchableToolPathSet, buildToolSearchItems } from '@/config/menu-utils'
import { ToolHeader } from '@/features/navigation/components/ToolHeader'
import { ToolSidebar } from '@/features/navigation/components/ToolSidebar'
import { useCommandPalette } from '@/features/navigation/hooks/useCommandPalette'
import { useRecentTools } from '@/features/navigation/hooks/useRecentTools'
import {
  usePageVisibilityClass,
  useRandomizedGlassEffects
} from '@/features/navigation/hooks/useShellEffects'
import { useToolNavigation } from '@/features/navigation/hooks/useToolNavigation'
import { useToolPreferences } from '@/features/navigation/hooks/useToolPreferences'
import { getToolPathname } from '@/features/navigation/paths'
import i18nConfig from '@/locales/i18nConfig'

const ToolCommandPalette = dynamic(
  () => import('./ToolCommandPalette').then(mod => mod.ToolCommandPalette),
  { ssr: false }
)

export default function ToolsLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = getToolPathname(usePathname(), i18nConfig.locales)
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const preferences = useToolPreferences()
  const navigation = useToolNavigation(pathname)
  const command = useCommandPalette(closeSidebar)
  const searchableToolPaths = useMemo(() => buildSearchableToolPathSet(), [])
  const { recentToolPaths, rememberToolPath } = useRecentTools(searchableToolPaths)
  const toolSearchItems = useMemo(
    () => (command.commandPaletteLoaded ? buildToolSearchItems(t) : []),
    [command.commandPaletteLoaded, t]
  )

  useRandomizedGlassEffects()
  usePageVisibilityClass()

  const handleNavigate = (path: string) => {
    rememberToolPath(path)
    router.push(path)
    closeSidebar()
    command.setCommandOpen(false)
  }

  return (
    <div className="relative isolate flex h-screen w-full overflow-hidden">
      <MeshGradient />
      {command.commandPaletteLoaded && (
        <ToolCommandPalette
          currentPath={pathname}
          items={toolSearchItems}
          open={command.commandOpen}
          recentPaths={recentToolPaths}
          onOpenChange={command.setCommandOpen}
          onSelect={handleNavigate}
        />
      )}
      <ToolSidebar
        sidebarCollapsed={preferences.sidebarCollapsed}
        sidebarOpen={sidebarOpen}
        onToggleCollapsed={preferences.toggleSidebarCollapsed}
        onClose={closeSidebar}
        navigation={{
          ...navigation,
          pathname,
          handleNavigate,
          onToggleCategory: navigation.toggleCategory
        }}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <ToolHeader
          breadcrumbs={navigation.breadcrumbs}
          direction={preferences.direction}
          language={preferences.language}
          handleNavigate={handleNavigate}
          handleLanguageChange={preferences.handleLanguageChange}
          handleDirectionChange={preferences.handleDirectionChange}
          openCommandPalette={command.openCommandPalette}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <TransitionLayout
            style={{ maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%' }}
          >
            {children}
          </TransitionLayout>
        </main>
      </div>
    </div>
  )
}
