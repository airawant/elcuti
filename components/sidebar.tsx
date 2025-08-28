"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, FileText, Users, Settings, LogOut, BookOpen, CheckSquare, User } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isAdmin?: boolean
}

interface MobileSidebarProps extends SidebarProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

// Define route type with optional badge
interface RouteItem {
  name: string
  href: string
  icon: React.ForwardRefExoticComponent<any>
  badge?: number
}

export function Sidebar({ className, isAdmin = false }: SidebarProps) {
  const pathname = usePathname()
  const { logout, user, getPendingRequestsCount } = useAuth()

  // Get count of unviewed requests
  const supervisorRequestsCount = getPendingRequestsCount("supervisor")
  const authorizedOfficerRequestsCount = getPendingRequestsCount("authorized_officer")
  const totalPendingRequests = supervisorRequestsCount + authorizedOfficerRequestsCount

  // Base routes for all users
  const userRoutes: RouteItem[] = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Permintaan Cuti",
      href: "/leave-requests",
      icon: FileText,
    },
  ]

  // Add approver routes if user is an approver
  if (user?.isapprover) {
    userRoutes.push({
      name: "Persetujuan Cuti",
      href: "/request-approval",
      icon: CheckSquare,
      badge: totalPendingRequests > 0 ? totalPendingRequests : undefined,
    })
  }

  // Add general routes
  userRoutes.push(
    {
      name: "Buku Panduan",
      href: "/guide",
      icon: BookOpen,
    },
    {
      name: "Profil",
      href: "/profile",
      icon: User,
    },
  )

  // Admin routes
  const adminRoutes: RouteItem[] = [
    {
      name: "Dashboard",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Pengguna",
      href: "/admin/users",
      icon: Users,
    },
    {
      name: "Permintaan Cuti",
      href: "/admin/leave-requests",
      icon: FileText,
    },
    {
      name: "Pengaturan",
      href: "/admin/settings",
      icon: Settings,
    },
    {
      name: "Profil",
      href: "/profile",
      icon: User,
    },
  ]

  const routes = isAdmin ? adminRoutes : userRoutes

  return (
    <div className={cn("pb-12 w-64 bg-white", className)}>
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <div className="flex items-center space-x-2 mb-2">
            <div className="relative w-12 h-12">
              <Image
                src="/logo.png"
                alt="Logo SIM C"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-primary">SIM C</h2>
              <p className="text-[10px] text-muted-foreground leading-tight">KEMENAG KOTA TANJUNGPINANG</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground px-2 mt-1">{isAdmin ? "Admin Panel" : "User Panel"}</div>
        </div>
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">{isAdmin ? "ADMIN" : "DASHBOARD"}</h2>
          <div className="space-y-1">
            {routes.map((route) => (
              <Button
                key={route.href}
                variant={pathname === route.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  pathname === route.href
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-secondary/50 hover:text-secondary-foreground",
                )}
                asChild
              >
                <Link href={route.href} className="relative">
                  <route.icon className="mr-2 h-4 w-4" />
                  {route.name}
                  {route.badge && <Badge className="ml-2 bg-red-500 text-white">{route.badge}</Badge>}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        <div className="px-3 py-2 mt-auto">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}

// Komponen mobile sidebar dengan SheetTitle untuk aksesibilitas
export function MobileSidebar({ isOpen, onOpenChange, isAdmin = false }: MobileSidebarProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0">
        <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
        <Sidebar isAdmin={isAdmin} />
      </SheetContent>
    </Sheet>
  )
}
