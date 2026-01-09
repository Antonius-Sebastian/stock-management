'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Package,
  ShoppingCart,
  BarChart3,
  Factory,
  LogOut,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useSession } from 'next-auth/react'
import { canManageUsers } from '@/lib/rbac'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useState } from 'react'
import { getSidebarCollapsed, saveSidebarCollapsed } from '@/lib/cookies'

const navigation = [
  {
    name: 'Bahan Baku',
    href: '/raw-materials',
    icon: Package,
  },
  {
    name: 'Produk Jadi',
    href: '/finished-goods',
    icon: ShoppingCart,
  },
  {
    name: 'Pemakaian Batch',
    href: '/batches',
    icon: Factory,
  },
  {
    name: 'Laporan Stok',
    href: '/reports',
    icon: BarChart3,
  },
  {
    name: 'Manajemen User',
    href: '/users',
    icon: Users,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  // Initialize state from cookies using lazy initialization
  const [isCollapsed, setIsCollapsed] = useState(() => getSidebarCollapsed())
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    saveSidebarCollapsed(newState)
  }

  const handleLogout = async () => {
    // Use relative URL to ensure it works with any domain
    await signOut({
      callbackUrl: '/login',
      redirect: true,
    })
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 h-11 w-11 backdrop-blur-sm lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Card
        className={cn(
          'flex h-full flex-col transition-all duration-300 ease-in-out',
          'fixed inset-y-0 left-0 z-40 lg:relative',
          isCollapsed ? 'w-16' : 'w-64',
          // Mobile: slide in/out
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between border-b p-3">
          {!isCollapsed && (
            <h2 className="text-xl font-bold tracking-tight">
              Sistem Inventory
            </h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Mobile Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileOpen(false)}
              className="h-8 w-8 lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
            {/* Desktop Collapse Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="hidden h-8 w-8 lg:flex"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              // Hide User Management from non-ADMIN users
              if (
                item.href === '/users' &&
                !canManageUsers(session?.user?.role)
              ) {
                return null
              }
              const isActive = pathname === item.href
              return (
                <Button
                  key={item.name}
                  variant={isActive ? 'default' : 'ghost'}
                  className={cn(
                    'h-11 w-full transition-all duration-200',
                    isCollapsed ? 'justify-center px-2' : 'justify-start px-3',
                    isActive &&
                      'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
                    !isActive &&
                      'hover:bg-accent hover:text-accent-foreground active:scale-[0.98]'
                  )}
                  asChild
                  title={isCollapsed ? item.name : undefined}
                >
                  <Link
                    href={item.href}
                    onClick={() => {
                      setIsMobileOpen(false)
                    }}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-transform duration-200',
                        !isCollapsed && 'mr-2.5',
                        isActive && 'scale-110'
                      )}
                    />
                    {!isCollapsed && (
                      <span className="font-medium">{item.name}</span>
                    )}
                  </Link>
                </Button>
              )
            })}
          </nav>
        </div>

        {session?.user && (
          <div className="mt-auto space-y-2 border-t p-3">
            {!isCollapsed && (
              <div className="bg-muted/50 flex items-center gap-3 rounded-md p-2">
                <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                  <User className="text-primary h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {session.user.name}
                  </p>
                  <p className="text-muted-foreground text-xs capitalize">
                    {session.user.role.toLowerCase()}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className={cn('flex-1', isCollapsed ? 'px-2' : 'justify-start')}
                onClick={handleLogout}
                title={isCollapsed ? 'Keluar' : undefined}
              >
                <LogOut
                  className={cn('h-5 w-5 shrink-0', !isCollapsed && 'mr-2.5')}
                />
                {!isCollapsed && <span>Keluar</span>}
              </Button>

              <ThemeToggle />
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
