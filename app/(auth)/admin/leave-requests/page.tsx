"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, differenceInDays } from "date-fns"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckCircle,
  XCircle,
  CalendarIcon,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function AdminLeaveRequestsPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { user, leaveRequests, users } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    if (user.role !== "admin") {
      router.push("/dashboard")
      return
    }
  }, [user, router])

  if (!user || user.role !== "admin") {
    return null
  }

  // Get pending leave requests
  const pendingRequests = leaveRequests.filter((req) => req.status === "Pending")

  // Get all leave requests
  const allRequests = [...leaveRequests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Pagination logic
  const totalPages = Math.ceil(allRequests.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedRequests = allRequests.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const openRequestDialog = (requestId: number) => {
    setSelectedRequest(requestId)
    setIsDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return <Badge className="bg-green-500">Disetujui</Badge>
      case "Rejected":
        return <Badge variant="destructive">Ditolak</Badge>
      default:
        return <Badge variant="outline">Menunggu</Badge>
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
        <Header title="Daftar Permohonan Cuti" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Permohonan Tertunda</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">Tidak ada permohonan cuti tertunda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pegawai</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Durasi</TableHead>
                      <TableHead>Alasan</TableHead>
                      <TableHead>Tanggal Pengajuan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => {
                      const employee = users.find((u) => u.id === request.user_id)
                      const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1

                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            {employee?.name || "Unknown"}
                            {employee?.tipe_pengguna && (
                              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-md ${employee.tipe_pengguna === "PNS" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                                {employee.tipe_pengguna}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{request.type}</TableCell>
                          <TableCell>
                            {request.workingdays} hari kerja
                          </TableCell>
                          <TableCell>{request.reason}</TableCell>
                          <TableCell>{format(new Date(request.created_at), "dd MMM yyyy")}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRequestDialog(request.id)}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Semua Permohonan</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pegawai</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal Pengajuan</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRequests.map((request) => {
                    const employee = users.find((u) => u.id === request.user_id)
                    const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1

                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          {employee?.name || "Unknown"}
                          {employee?.tipe_pengguna && (
                            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-md ${employee.tipe_pengguna === "PNS" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                              {employee.tipe_pengguna}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{request.type}</TableCell>
                        <TableCell>
                          {request.workingdays} hari kerja
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>{format(new Date(request.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRequestDialog(request.id)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination controls */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={pageSize.toString()} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Item per halaman
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <span className="text-sm">
                    Halaman {currentPage} dari {totalPages || 1}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Permohonan Cuti</DialogTitle>
            <DialogDescription>Informasi lengkap tentang permohonan cuti.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedRequest && (() => {
              const request = leaveRequests.find((r) => r.id === selectedRequest)
              const employee = users.find((u) => u?.id === request?.user_id)

              if (!request) return null

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm font-medium">Pegawai</p>
                      <p>{employee?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Jenis Cuti</p>
                      <p>{request.type}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-sm font-medium">Tanggal Mulai</p>
                      <p>{format(new Date(request.start_date), "dd MMM yyyy")}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Tanggal Selesai</p>
                      <p>{format(new Date(request.end_date), "dd MMM yyyy")}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Alasan</p>
                    <p>{request.reason}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p>{getStatusBadge(request.status)}</p>
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter className="flex">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
