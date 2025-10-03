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
  Factory
} from "lucide-react"

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
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <Card className="w-64 h-full p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight mb-6">
          Inventory System
        </h2>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon
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
    </Card>
  )
}