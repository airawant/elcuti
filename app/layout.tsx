import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClientLayout } from "./components/client-layout"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "SIM C - Sistem Informasi Manajemen Cuti Kantor Kemenag Kota Tanjungpinang",
  description: "Sistem Informasi Manajemen Cuti Kantor Kementerian Agama Kota Tanjungpinang",
  generator: "Prakom",
  icons: {
    icon: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}

import "./globals.css"

import "./globals.css"



import './globals.css'
