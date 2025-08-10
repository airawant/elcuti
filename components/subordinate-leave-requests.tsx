"use client"

import { useState } from "react"
import { format, differenceInDays } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from "lucide-react"

export function SubordinateLeaveRequests() {
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const { user, users, leaveRequests, updateLeaveRequest, getSubordinateRequests } = useAuth()
  const { toast } = useToast()

  const itemsPerPage = 10

  // If user is not an approver, don't show this component
  if (!user || !user.isApprover) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Anda tidak memiliki akses untuk menyetujui permintaan cuti.</p>
      </div>
    )
  }

  const pendingRequests = getSubordinateRequests().filter((req) => req.status === "Pending")

  // Filter by search term
  const filteredRequests = pendingRequests.filter((req) => {
    const employee = users.find((u) => u.id === req.user_id)
    return (
      employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  // Paginate
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage)
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleApprove = async () => {
    if (selectedRequest) {
      try {
        await updateLeaveRequest(selectedRequest, "Approved")
        toast({
          title: "Berhasil",
          description: "Permintaan cuti telah disetujui",
          variant: "default",
        })
        setIsDialogOpen(false)
      } catch (error) {
        toast({
          title: "Gagal",
          description: error instanceof Error ? error.message : "Gagal menyetujui permintaan cuti",
          variant: "destructive",
        })
      }
    }
  }

  const handleReject = async () => {
    if (selectedRequest) {
      try {
        await updateLeaveRequest(selectedRequest, "Rejected")
        toast({
          title: "Berhasil",
          description: "Permintaan cuti telah ditolak",
          variant: "default",
        })
        setIsDialogOpen(false)
      } catch (error) {
        toast({
          title: "Gagal",
          description: error instanceof Error ? error.message : "Gagal menolak permintaan cuti",
          variant: "destructive",
        })
      }
    }
  }

  const openRequestDialog = (requestId: number) => {
    setSelectedRequest(requestId)
    setIsDialogOpen(true)
  }

  if (pendingRequests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Tidak ada permintaan cuti yang perlu disetujui.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari permintaan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="text-sm text-muted-foreground">Total: {pendingRequests.length} permintaan</div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pegawai</TableHead>
              <TableHead>Jenis Cuti</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Tanggal Pengajuan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  Tidak ada data yang sesuai dengan pencarian
                </TableCell>
              </TableRow>
            ) : (
              paginatedRequests.map((request) => {
                const employee = users.find((u) => u.id === request.user_id)
                const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1

                return (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{employee?.name || "Unknown"}</TableCell>
                    <TableCell>{request.type}</TableCell>
                    <TableCell>{duration} hari</TableCell>
                    <TableCell>
                      {format(new Date(request.start_date), "dd MMM")} -{" "}
                      {format(new Date(request.end_date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={request.reason}>
                      {request.reason || "-"}
                    </TableCell>
                    <TableCell>{format(new Date(request.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => openRequestDialog(request.id)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
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
          <div className="text-sm text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Selanjutnya
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Permintaan Cuti</DialogTitle>
            <DialogDescription>Setujui atau tolak permintaan cuti ini.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedRequest && (
              <div className="space-y-4">
                {(() => {
                  const request = leaveRequests.find((r) => r.id === selectedRequest)
                  const employee = users.find((u) => u?.id === request?.user_id)

                  if (!request) return null

                  return (
                    <>
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
                        <p>{request.reason || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tanggal Pengajuan</p>
                        <p>{format(new Date(request.created_at), "dd MMMM yyyy")}</p>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
          <DialogFooter className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              <XCircle className="mr-2 h-4 w-4" />
              Tolak
            </Button>
            <Button onClick={handleApprove}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Setujui
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

