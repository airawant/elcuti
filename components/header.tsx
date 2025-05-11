"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import Image from "next/image"

interface HeaderProps {
  title: string
  onMenuClick: () => void
  children?: React.ReactNode
}

export function Header({ title, onMenuClick, children }: HeaderProps) {
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
              alt="Logo EL-CUTI"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-primary">{title}</h1>
      </div>
      {children}
    </header>
  )
}
