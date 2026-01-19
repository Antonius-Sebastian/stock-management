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
      <div className="bg-background flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 pt-16 transition-all duration-300 sm:p-4 sm:pt-16 md:p-5 lg:p-6 lg:pt-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </TourProvider>
  )
}
