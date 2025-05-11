"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, User } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

type LeaveBalance = Record<string, number>

export default function ProfilePage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const { user, updateUser, updatePassword } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Form states
  const [profileData, setProfileData] = useState({
    name: "",
    position: "",
    workunit: "",
    email: "",
    phone: "",
    address: "",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else {
      // Initialize form with user data
      setProfileData({
        name: user.name || "",
        position: user.position || "",
        workunit: user.workunit || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
      })
    }
  }, [user, router])

  if (!user) {
    return null
  }

  const handleProfileChange = (field: string, value: string) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear error when user types
    if (passwordErrors[field as keyof typeof passwordErrors]) {
      setPasswordErrors((prev) => ({
        ...prev,
        [field]: "",
      }))
    }
  }

  const validatePasswordForm = () => {
    let isValid = true
    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }

    if (!passwordData.currentPassword) {
      errors.currentPassword = "Password saat ini harus diisi"
      isValid = false
    }

    if (!passwordData.newPassword) {
      errors.newPassword = "Password baru harus diisi"
      isValid = false
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = "Password baru minimal 6 karakter"
      isValid = false
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = "Konfirmasi password harus diisi"
      isValid = false
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Konfirmasi password tidak cocok"
      isValid = false
    }

    setPasswordErrors(errors)
    return isValid
  }

  const handleSaveProfile = () => {
    setIsConfirmDialogOpen(true)
  }

  const confirmSaveProfile = () => {
    // Update user profile
    updateUser(user.id, {
      name: profileData.name,
      position: profileData.position,
      workunit: profileData.workunit,
      email: profileData.email,
      phone: profileData.phone,
      address: profileData.address,
    })

    toast({
      title: "Profil berhasil diperbarui",
      description: "Informasi profil Anda telah berhasil diperbarui",
    })

    setIsConfirmDialogOpen(false)
  }

  const handleChangePassword = async () => {
    if (validatePasswordForm()) {
      try {
        if (!user) return;

        // Tampilkan loading state
        toast({
          title: "Mengubah password...",
          description: "Mohon tunggu sebentar",
        });

        await updatePassword(
          user.id,
          passwordData.currentPassword,
          passwordData.newPassword
        );

        toast({
          title: "Password berhasil diubah",
          description: "Password Anda telah berhasil diubah",
        });

        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });

        setIsPasswordDialogOpen(false);
      } catch (error) {
        console.error("Error saat mengubah password:", error);

        let errorMessage = "Terjadi kesalahan saat mengubah password";

        if (error instanceof Error) {
          // Untuk error HTML, kita sudah menanganinya di auth-context.tsx
          // Jadi kita bisa menggunakan pesan error dari sana
          errorMessage = error.message;
        }

        toast({
          title: "Gagal mengubah password",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  // Format leave balance for display
  const formatLeaveBalance = (balance: LeaveBalance | null | undefined) => {
    if (!balance) return "Tidak ada data saldo cuti"

    return Object.entries(balance)
      .sort((a, b) => Number(b[0]) - Number(a[0])) // Sort by year descending
      .map(([year, days]) => {
        const isCurrentYear = year === new Date().getFullYear().toString();
        const isPreviousYear = year === (new Date().getFullYear() - 1).toString();
        let yearLabel = `Tahun ${year}`;

        if (isCurrentYear) {
          yearLabel = `Tahun ${year} (Berjalan)`;
        } else if (isPreviousYear) {
          yearLabel = `Tahun ${year} (Sebelumnya)`;
        }

        return (
          <div key={year} className="flex justify-between items-center py-2 border-b">
            <span className="font-medium">{yearLabel}</span>
            <Badge variant={days > 0 ? "default" : "outline"} className="ml-2">
              {days} hari
            </Badge>
          </div>
        );
      })
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isAdmin={user.role === "admin"} />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar isAdmin={user.role === "admin"} />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Header title="Profil Pengguna" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <div className="bg-primary text-primary-foreground rounded-full w-16 h-16 flex items-center justify-center">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`} />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <p className="text-muted-foreground">{user.position || "Belum diatur"}</p>
            </div>
          </div>

          <Tabs defaultValue="profile">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Informasi Profil</TabsTrigger>
              <TabsTrigger value="security">Keamanan</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informasi Pegawai</CardTitle>
                  <CardDescription>Detail pribadi dan informasi kontak</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">NIP</p>
                      <p className="font-medium">{user.nip || "Tidak diatur"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Jabatan</p>
                      <p className="font-medium">{user.position || "Tidak diatur"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Unit Kerja</p>
                      <p className="font-medium">{user.workunit || "Tidak diatur"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telepon</p>
                      <p className="font-medium">{user.phone || "Tidak diatur"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Alamat</p>
                      <p className="font-medium">{user.address || "Tidak diatur"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Saldo Cuti</CardTitle>
                  <CardDescription>Informasi saldo cuti tahunan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {user.leave_balance ? (
                      formatLeaveBalance(user.leave_balance)
                    ) : (
                      <p className="text-muted-foreground">Tidak ada data saldo cuti</p>
                    )}
                  </div>
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2">Informasi Cuti</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Saldo tahun sebelumnya maksimal 6 hari</li>
                      <li>• Saldo tahun ini ({new Date().getFullYear()}) 12 hari</li>
                      <li>• Ajukan cuti melalui menu "Ajukan Cuti"</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Peran dan Izin</CardTitle>
                  <CardDescription>Peran pengguna dalam sistem</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Peran</p>
                      <Badge variant={user.role === "admin" ? "destructive" : "outline"} className="mt-1">
                        {user.role === "admin" ? "Admin" : "Pengguna"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Penyetuju</p>
                      <Badge variant={user.isapprover ? "default" : "outline"} className="mt-1">
                        {user.isapprover ? "Ya" : "Tidak"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pejabat yang Berwenang</p>
                      <Badge variant={user.isauthorizedofficer ? "default" : "outline"} className="mt-1">
                        {user.isauthorizedofficer ? "Ya" : "Tidak"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Keamanan Akun</CardTitle>
                  <CardDescription>
                    Kelola keamanan akun Anda. Pastikan untuk menggunakan password yang kuat.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-medium">Password</h3>
                        <p className="text-sm text-muted-foreground">
                          Ubah password Anda secara berkala untuk keamanan akun.
                        </p>
                      </div>
                      <Button onClick={() => setIsPasswordDialogOpen(true)}>Ubah Password</Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Keamanan Akun</AlertTitle>
                      <AlertDescription>
                        Jangan pernah membagikan password Anda kepada siapapun. Pastikan untuk keluar dari akun Anda
                        jika menggunakan perangkat umum.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Perubahan</DialogTitle>
            <DialogDescription>Apakah Anda yakin ingin menyimpan perubahan pada profil Anda?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={confirmSaveProfile}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Password</DialogTitle>
            <DialogDescription>Masukkan password saat ini dan password baru Anda.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Password Saat Ini</Label>
              <Input
                id="current-password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
              />
              {passwordErrors.currentPassword && (
                <p className="text-sm text-red-500">{passwordErrors.currentPassword}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
              />
              {passwordErrors.newPassword && <p className="text-sm text-red-500">{passwordErrors.newPassword}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
              />
              {passwordErrors.confirmPassword && (
                <p className="text-sm text-red-500">{passwordErrors.confirmPassword}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleChangePassword}>Ubah Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
