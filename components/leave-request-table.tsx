"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

type ApprovalStatus = "Pending" | "Approved" | "Rejected"

type LeaveRequest = {
  id: number
  user_id: number
  type: string
  status: ApprovalStatus
  start_date: string
  end_date: string
  reason?: string
  created_at: string
  rejection_reason?: string
  supervisor_id?: number
  authorized_officer_id?: number
  supervisor_status: ApprovalStatus
  authorized_officer_status: ApprovalStatus
  supervisor_viewed: boolean
  authorized_officer_viewed: boolean
  supervisor_signed: boolean
  authorized_officer_signed: boolean
  workingdays?: number
  address?: string
  phone?: string
  link_file?: string
}

interface LeaveRequestTableProps {
  userId?: number
}

export function LeaveRequestTable({ userId }: LeaveRequestTableProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localLeaveRequests, setLocalLeaveRequests] = useState<LeaveRequest[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [viewingRequest, setViewingRequest] = useState<number | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Function to trigger refresh
  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Fetch leave requests
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        setLoading(true)
        setError(null)

        console.log("Memulai fetch data permintaan cuti...")
        const response = await fetch("/api/leave-requests")
        console.log("Response status:", response.status)

        const data = await response.json()
        console.log("Response data:", data)

        if (!response.ok) {
          throw new Error(data.error || "Gagal mengambil data permintaan cuti")
        }

        if (Array.isArray(data)) {
          console.log("Jumlah data yang diterima:", data.length)
          console.log("Sample data pertama:", data[0])
        } else {
          console.log("Data bukan array:", data)
        }

        setLocalLeaveRequests(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error("Error detail:", err)
        setError(err instanceof Error ? err.message : "Terjadi kesalahan saat mengambil data")
      } finally {
        setLoading(false)
      }
    }

    fetchLeaveRequests()
  }, [refreshTrigger])

  // Expose refreshData function
  useEffect(() => {
    // Add event listener for custom refresh event
    const handleRefresh = () => refreshData()
    window.addEventListener('leave-request-updated', handleRefresh)

    return () => {
      window.removeEventListener('leave-request-updated', handleRefresh)
    }
  }, [])

  const itemsPerPage = 10

  // Filter requests based on userId if provided
  const userRequests = userId
    ? localLeaveRequests.filter((req) => req.user_id === userId)
    : localLeaveRequests.filter((req) => {
        if (!user) {
          console.log("User tidak ditemukan, mengembalikan false");
          return false;
        }

        console.log("Data user:", {
          id: user.id,
          role: user.role,
          isapprover: user.isapprover,
          isauthorizedofficer: user.isauthorizedofficer
        });

        // Log semua permintaan yang ada
        console.log("Semua permintaan cuti:", localLeaveRequests.map(req => ({
          id: req.id,
          user_id: req.user_id,
          supervisor_id: req.supervisor_id,
          authorized_officer_id: req.authorized_officer_id,
          status: req.status,
          supervisor_status: req.supervisor_status,
          authorized_officer_status: req.authorized_officer_status
        })));

        // Untuk supervisor, tampilkan permintaan yang memerlukan persetujuan supervisor
        if (user.isapprover) {
          console.log("User adalah supervisor, memeriksa permintaan yang perlu disetujui");
          const supervisorRequests = localLeaveRequests.filter(req => {
            const isMatch =
              req.supervisor_id === user.id &&
              req.supervisor_status === "Pending" &&
              req.status === "Pending";

            console.log(`Permintaan ID ${req.id}:`, {
              matches: isMatch,
              supervisor_check: req.supervisor_id === user.id,
              status_check: req.status === "Pending",
              supervisor_status_check: req.supervisor_status === "Pending"
            });

            return isMatch;
          });

          console.log("Permintaan yang cocok untuk supervisor:", supervisorRequests);
          return (
            req.supervisor_id === user.id &&
            req.supervisor_status === "Pending" &&
            req.status === "Pending"
          );
        }

        // Untuk authorized officer, tampilkan permintaan yang:
        // 1. Memerlukan persetujuan officer
        // 2. Sudah disetujui oleh supervisor
        if (user.isauthorizedofficer) {
          console.log("User adalah authorized officer, memeriksa permintaan yang perlu disetujui");
          const officerRequests = localLeaveRequests.filter(req => {
            const isMatch =
              req.authorized_officer_id === user.id &&
              req.authorized_officer_status === "Pending" &&
              req.supervisor_status === "Approved";

            console.log(`Permintaan ID ${req.id}:`, {
              matches: isMatch,
              officer_check: req.authorized_officer_id === user.id,
              officer_status_check: req.authorized_officer_status === "Pending",
              supervisor_status_check: req.supervisor_status === "Approved"
            });

            return isMatch;
          });

          console.log("Permintaan yang cocok untuk authorized officer:", officerRequests);
          return (
            req.authorized_officer_id === user.id &&
            req.authorized_officer_status === "Pending" &&
            req.supervisor_status === "Approved"
          );
        }

        // Untuk admin, tampilkan semua
        if (user.role === "admin") {
          console.log("User adalah admin, menampilkan semua permintaan");
          return true;
        }

        console.log("User tidak memiliki role khusus, tidak ada permintaan yang ditampilkan");
        return false;
    });

  console.log("Jumlah permintaan yang akan ditampilkan:", userRequests.length);
  if (userRequests.length > 0) {
    console.log("Detail permintaan yang akan ditampilkan:", userRequests.map(req => ({
      id: req.id,
      user_id: req.user_id,
      supervisor_id: req.supervisor_id,
      authorized_officer_id: req.authorized_officer_id,
      status: req.status,
      supervisor_status: req.supervisor_status,
      authorized_officer_status: req.authorized_officer_status
    })));
  }

  // Filter berdasarkan pencarian
  const filteredData = userRequests.filter((item) =>
    Object.values(item).some(
      (value) =>
        value &&
        value.toString().toLowerCase().includes(searchTerm.toLowerCase())
  )
  );

  const sortedData = [...filteredData].sort((a: LeaveRequest, b: LeaveRequest) => {
    if (!sortColumn) return 0

    // Handle sorting by date fields
    if (sortColumn === "start_date" || sortColumn === "end_date" || sortColumn === "created_at") {
      const dateA = new Date(a[sortColumn as keyof LeaveRequest] as string).getTime()
      const dateB = new Date(b[sortColumn as keyof LeaveRequest] as string).getTime()
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA
    }

    // Handle sorting by other fields
    const valueA = a[sortColumn as keyof LeaveRequest] ?? ""
    const valueB = b[sortColumn as keyof LeaveRequest] ?? ""

    if (valueA < valueB) return sortDirection === "asc" ? -1 : 1
    if (valueA > valueB) return sortDirection === "asc" ? 1 : -1
    return 0
  })

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const getStatusBadge = (status: string, supervisorStatus?: string, authorizedOfficerStatus?: string) => {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge
            className={status === "Approved" ? "bg-green-500" : status === "Rejected" ? "bg-red-500" : "bg-yellow-500"}
          >
            {status === "Approved" ? "Disetujui" : status === "Rejected" ? "Ditolak" : "Menunggu"}
          </Badge>
        </div>
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Atasan:</span>
            <Badge
              variant="outline"
              className={
                supervisorStatus === "Approved"
                  ? "bg-green-100 text-green-800 border-green-500"
                  : supervisorStatus === "Rejected"
                    ? "bg-red-100 text-red-800 border-red-500"
                    : "bg-yellow-100 text-yellow-800 border-yellow-500"
              }
            >
              {supervisorStatus === "Approved" ? "Disetujui" : supervisorStatus === "Rejected" ? "Ditolak" : "Menunggu"}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Pejabat:</span>
            <Badge
              variant="outline"
              className={
                authorizedOfficerStatus === "Approved"
                  ? "bg-green-100 text-green-800 border-green-500"
                  : authorizedOfficerStatus === "Rejected"
                    ? "bg-red-100 text-red-800 border-red-500"
                    : "bg-yellow-100 text-yellow-800 border-yellow-500"
              }
            >
              {authorizedOfficerStatus === "Approved"
                ? "Disetujui"
                : authorizedOfficerStatus === "Rejected"
                  ? "Ditolak"
                  : "Menunggu"}
            </Badge>
          </div>
        </div>
      </div>
    )
  }

  const handleViewRequest = (requestId: number) => {
    setViewingRequest(requestId)
    setIsViewDialogOpen(true)
  }

  const getRequestDetails = () => {
    if (!viewingRequest) return null
    return localLeaveRequests.find((req) => req.id === viewingRequest)
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <div className="mt-2">Memuat data...</div>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">{error}</div>
          <Button variant="outline" onClick={refreshData}>
            Coba Lagi
          </Button>
        </div>
      ) : (
        <>
          {/* Role-based header */}
          {!userId && (user?.isapprover || user?.isauthorizedofficer) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                {user.isapprover
                  ? "Daftar Permintaan Cuti - Persetujuan Atasan Langsung"
                  : "Daftar Permintaan Cuti - Persetujuan Pejabat Berwenang"}
              </h2>
              <p className="text-sm text-blue-600">
                {user.isapprover
                  ? "Permintaan cuti yang memerlukan persetujuan Anda sebagai atasan langsung"
                  : "Permintaan cuti yang telah disetujui atasan langsung dan memerlukan persetujuan Anda"}
              </p>
            </div>
          )}

          {userRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {!userId && (user?.isapprover || user?.isauthorizedofficer)
                ? "Tidak ada permintaan cuti yang memerlukan persetujuan Anda saat ini."
                : "Tidak ada data permintaan cuti."}
            </div>
          ) : (
            <>
        <div className="flex justify-between">
          <Input
            placeholder="Cari..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select defaultValue="10">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rows per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 rows</SelectItem>
              <SelectItem value="20">20 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">#</TableHead>
                <TableHead onClick={() => handleSort("type")}>Jenis Cuti</TableHead>
                <TableHead onClick={() => handleSort("start_date")}>Tanggal Mulai</TableHead>
                <TableHead onClick={() => handleSort("status")}>Status</TableHead>
                <TableHead onClick={() => handleSort("created_at")}>Tanggal Pengajuan</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                    {paginatedData.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                  </TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>
                      {format(new Date(item.start_date), "dd MMM yyyy")} -{" "}
                      {format(new Date(item.end_date), "dd MMM yyyy")}
                          <div className="text-xs text-muted-foreground">
                            {item.workingdays} hari kerja
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(
                            item.status,
                            item.supervisor_status,
                            item.authorized_officer_status
                          )}
                    </TableCell>
                    <TableCell>
                          {format(new Date(item.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRequest(item.id)}
                          >
                        <Eye className="h-4 w-4 mr-1" /> Lihat
                      </Button>
                    </TableCell>
                    <TableCell>
                      {item.link_file ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(item.link_file, '_blank')}
                        >
                          Download
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-500">Tidak tersedia</span>
                      )}
                    </TableCell>
                  </TableRow>
                    ))}
            </TableBody>
          </Table>
        </div>
            </>
          )}

        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Selanjutnya
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        </>
      )}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detail Permintaan Cuti</DialogTitle>
            <DialogDescription>Informasi lengkap tentang permintaan cuti</DialogDescription>
          </DialogHeader>

          {(() => {
            const request = getRequestDetails()
            if (!request) return <div>Data tidak ditemukan</div>

            return (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Jenis Cuti</div>
                    <div className="font-medium">{request?.type}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Status</div>
                    <div>
                      {getStatusBadge(
                        request?.status || "Pending",
                        request?.supervisor_status,
                        request?.authorized_officer_status,
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500">Tanggal Mulai</div>
                    <div>{request?.start_date ? format(new Date(request.start_date), "dd MMMM yyyy") : "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Tanggal Selesai</div>
                    <div>{request?.end_date ? format(new Date(request.end_date), "dd MMMM yyyy") : "-"}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-500">Alasan</div>
                  <div>{request?.reason || "-"}</div>
                </div>

                {/* Tambahkan section untuk alasan penolakan */}
                {(request?.status === "Rejected" || 
                  request?.supervisor_status === "Rejected" || 
                  request?.authorized_officer_status === "Rejected") && 
                  request?.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-red-800 mb-2">Alasan Penolakan</div>
                    <div className="text-red-700">{request.rejection_reason}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-gray-500">Tanggal Pengajuan</div>
                  <div>{request?.created_at ? format(new Date(request.created_at), "dd MMMM yyyy, HH:mm") : "-"}</div>
                </div>
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
