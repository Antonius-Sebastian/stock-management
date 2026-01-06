'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { TourProvider } from '@/components/help/tour-provider'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <TourProvider>
      <div className="bg-background flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-4 pt-16 lg:p-6 lg:pt-6">
          {children}
        </main>
      </div>
    </TourProvider>
  )
}
