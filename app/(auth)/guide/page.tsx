"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar, MobileSidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, HelpCircle } from "lucide-react"
import Image from "next/image"

type LeaveType = {
  id: number
  code: string
  name: string
  description: string
}

export default function GuidePage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const { user } = useAuth()
  const router = useRouter()

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.push("/login")
    }
  }, [user, router])

  // Fetch leave types
  useEffect(() => {
    async function fetchLeaveTypes() {
      try {
        const response = await fetch("/api/leave-types")
        if (!response.ok) {
          throw new Error("Gagal mengambil data jenis cuti")
        }
        const data = await response.json()
        setLeaveTypes(data.data)
      } catch (error) {
        console.error("Error fetching leave types:", error)
      }
    }

    fetchLeaveTypes()
  }, [])

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isAdmin={user.role === "admin"} />
      </div>

      {/* Mobile sidebar */}
      <MobileSidebar isOpen={isMobileOpen} onOpenChange={setIsMobileOpen} isAdmin={user.role === "admin"} />

      <div className="flex-1">
        <Header title="Buku Panduan" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="relative w-16 h-16">
                  <Image
                    src="/logo.png"
                    alt="Logo EL-CUTI"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-primary">
                    EL-CUTI KEMENAG KOTA TANJUNGPINANG
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    ELEKTRONIK CUTI KANTOR KEMENAG KOTA TANJUNGPINANG
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Ikhtisar</TabsTrigger>
                  <TabsTrigger value="leave-types">Jenis Cuti</TabsTrigger>
                  <TabsTrigger value="faq">Pertanyaan Umum</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold">Sistem Manajemen Cuti Elektronik</h3>
                  <p>
                    Selamat datang di EL-CUTI KEMENAG KOTA TANJUNGPINANG, sistem manajemen cuti elektronik Anda. Panduan ini akan membantu Anda memahami cara
                    menggunakan sistem dengan efektif.
                  </p>
                  <h4 className="text-md font-semibold mt-4">Memulai</h4>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Masuk menggunakan kredensial Anda</li>
                    <li>Lihat dashboard untuk melihat saldo cuti dan riwayat</li>
                    <li>Ajukan permintaan cuti baru dari halaman "Permintaan Cuti"</li>
                    <li>Lacak status permintaan cuti Anda</li>
                  </ol>
                </TabsContent>
                <TabsContent value="leave-types" className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold">Jenis Cuti</h3>
                  <div className="space-y-4">
                    {leaveTypes.map((type) => (
                      <div key={type.id}>
                        <h4 className="font-medium">{type.name}</h4>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="faq" className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold">Pertanyaan Umum</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">Bagaimana cara mengajukan permintaan cuti?</h4>
                      <p className="text-sm text-gray-600">
                        Buka halaman "Permintaan Cuti" dan klik "Permintaan Baru". Isi detail yang diperlukan dan
                        kirimkan.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Bagaimana cara memeriksa saldo cuti saya?</h4>
                      <p className="text-sm text-gray-600">
                        Saldo cuti Anda ditampilkan di dashboard untuk setiap tahun.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Apa yang terjadi jika permintaan cuti saya ditolak?</h4>
                      <p className="text-sm text-gray-600">
                        Anda akan menerima notifikasi, dan status akan diperbarui dalam daftar permintaan cuti Anda. Anda
                        dapat mengajukan permintaan baru jika diperlukan.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Bisakah saya membatalkan permintaan cuti?</h4>
                      <p className="text-sm text-gray-600">
                        Ya, Anda dapat membatalkan permintaan cuti yang masih dalam status menunggu. Permintaan yang sudah disetujui
                        mungkin memerlukan persetujuan administrator untuk pembatalan.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium">Berapa lama sebelumnya saya harus mengajukan permintaan cuti?</h4>
                      <p className="text-sm text-gray-600">
                        Untuk cuti yang direncanakan, disarankan untuk mengajukan minimal 2 minggu sebelumnya. Cuti darurat dapat
                        diajukan dengan pemberitahuan lebih singkat.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <HelpCircle className="mr-2 h-5 w-5" />
                Butuh Bantuan?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Jika Anda membutuhkan bantuan lebih lanjut, silakan hubungi Kepegawaian Kantor Kementerian Agama Kota Tanjungpinang:</p>
              <div className="mt-2">
                <p className="text-sm">Email: tanjungpinang@kemenag.go.id</p>
                <p className="text-sm">Telepon: 08 2172 801 123</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

// Move this file to app/(auth)/guide/page.tsx
