"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Menu, User } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"

interface HeaderProps {
  title: string
  onMenuClick: () => void
  children?: React.ReactNode
}

export function Header({ title, onMenuClick, children }: HeaderProps) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={onMenuClick}>
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        <div className="hidden md:flex items-center mr-4">
          <div className="relative w-8 h-8">
            <Image
              src="/logo.png"
              alt="Logo SIM C"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-primary">{title}</h1>
      </div>

      {/* User info di pojok kanan atas */}
      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center">
            <div className="hidden md:block text-right mr-2">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.nip}</p>
            </div>
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
          </div>
        )}
        {children}
      </div>
    </header>
  )
}
