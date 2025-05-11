"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

// Define type for stats
interface LeaveBalanceStats {
  total: number
  updated: number
  capped: number
  errors: number
}

export default function AdminSettingsPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState<LeaveBalanceStats | null>(null)
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else if (user.role !== "admin") {
      router.push("/dashboard")
    }
  }, [user, router])

  if (!user || user.role !== "admin") {
    return null
  }

  const updateLeaveBalance = async () => {
    setIsLoading(true)
    setStats(null)

    try {
      const response = await fetch("/api/admin/update-leave-balance", {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update leave balance")
      }

      const data = await response.json()
      setStats(data.stats)

      toast({
        title: "Leave balance updated",
        description: `Updated ${data.stats.updated} of ${data.stats.total} users. Capped ${data.stats.capped} balances.`,
      })
    } catch (error) {
      console.error("Error updating leave balance:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update leave balance",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isAdmin />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar isAdmin />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Header title="Admin Settings" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">System Settings</h1>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Manajemen Saldo Cuti</CardTitle>
                <CardDescription>
                 Perbaharui saldo cuti untuk semua pengguna berdasarkan aturan:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Set Tahun Berjalan ({new Date().getFullYear()}) menjadi 12 hari jika belum diatur</li>
                    <li>Sisa cuti tahunan maksimal 6 hari jika lebih dari itu</li>
                    <li>Hapus tahun yang lebih lama dari tahun N-1</li>
                  </ul>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats && (
                  <div className="bg-slate-100 p-3 rounded-md mb-3 text-sm">
                    <h4 className="font-semibold mb-1">Pemuktahiran Terakhir :</h4>
                    <div className="space-y-1">
                      <p>Total Pengguna: {stats.total}</p>
                      <p>Updated Pengguna: {stats.updated}</p>
                      <p>Saldo: {stats.capped}</p>
                      {stats.errors > 0 && (
                        <p className="text-red-600">Errors: {stats.errors}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={updateLeaveBalance}
                  disabled={isLoading}
                >
                  {isLoading ? "Updating..." : "Update Saldo Cuti"}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informasi Sistem</CardTitle>
                <CardDescription>
                  Informasi tentang konfigurasi sistem saat ini.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tahun Berjalan :</span>
                    <span>{new Date().getFullYear()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tahun N-1:</span>
                    <span>{new Date().getFullYear() - 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Aturan Saldo Cuti :</span>
                    <span>maksimal 6 hari untuk tahun N-1</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
