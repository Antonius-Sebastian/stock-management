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
  Users
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { canManageUsers } from "@/lib/rbac"

const navigation = [
  {
    name: "Raw Materials",
    href: "/raw-materials",
    icon: Package,
  },
  {
    name: "Finished Goods",
    href: "/finished-goods",
    icon: ShoppingCart,
  },
  {
    name: "Batch Usage",
    href: "/batches",
    icon: Factory,
  },
  {
    name: "Stock Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    name: "User Management",
    href: "/users",
    icon: Users,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <Card className="w-64 h-full p-6 flex flex-col">
      <div className="flex-1">
        <h2 className="text-2xl font-bold tracking-tight mb-6">
          Inventory System
        </h2>
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
                  "w-full justify-start",
                  pathname === item.href && "bg-primary text-primary-foreground"
                )}
                asChild
              >
                <Link href={item.href}>
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>

      {session?.user && (
        <div className="mt-auto pt-6 border-t">
          <div className="flex items-center gap-3 mb-3 p-2 rounded-md bg-slate-50">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{session.user.role.toLowerCase()}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      )}
    </Card>
  )
}