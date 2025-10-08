"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  Menu
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { canManageUsers } from "@/lib/rbac"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useState, useEffect } from "react"
import { getSidebarCollapsed, saveSidebarCollapsed } from "@/lib/cookies"

const navigation = [
  {
    name: "Bahan Baku",
    href: "/raw-materials",
    icon: Package,
  },
  {
    name: "Produk Jadi",
    href: "/finished-goods",
    icon: ShoppingCart,
  },
  {
    name: "Pemakaian Batch",
    href: "/batches",
    icon: Factory,
  },
  {
    name: "Laporan Stok",
    href: "/reports",
    icon: BarChart3,
  },
  {
    name: "Manajemen User",
    href: "/users",
    icon: Users,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Load collapsed state from cookies on mount
  useEffect(() => {
    setIsCollapsed(getSidebarCollapsed())
  }, [])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    saveSidebarCollapsed(newState)
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Card
        className={cn(
          "h-full flex flex-col transition-all duration-300 ease-in-out",
          "fixed lg:relative inset-y-0 left-0 z-40",
          isCollapsed ? "w-16" : "w-64",
          // Mobile: slide in/out
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-3 flex items-center justify-between border-b">
          {!isCollapsed && (
            <h2 className="text-xl font-bold tracking-tight">
              Sistem Inventory
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="hidden lg:flex h-8 w-8 ml-auto"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              // Hide User Management from non-ADMIN users
              if (item.href === "/users" && !canManageUsers(session?.user?.role)) {
                return null
              }
              return (
                <Button
                  key={item.name}
                  variant={pathname === item.href ? "default" : "ghost"}
                  className={cn(
                    "w-full",
                    isCollapsed ? "justify-center px-2" : "justify-start",
                    pathname === item.href && "bg-primary text-primary-foreground"
                  )}
                  asChild
                  title={isCollapsed ? item.name : undefined}
                >
                  <Link href={item.href} onClick={() => setIsMobileOpen(false)}>
                    <Icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                </Button>
              )
            })}
          </nav>
        </div>

        {session?.user && (
          <div className="mt-auto p-3 border-t space-y-2">
            {!isCollapsed && (
              <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{session.user.role.toLowerCase()}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className={cn(
                  "flex-1",
                  isCollapsed ? "px-2" : "justify-start"
                )}
                onClick={handleLogout}
                title={isCollapsed ? "Keluar" : undefined}
              >
                <LogOut className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
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