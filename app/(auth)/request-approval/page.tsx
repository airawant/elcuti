"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { format, differenceInDays } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LeaveRequestModal } from "@/components/leave-request-modal"
import { useToast } from "@/hooks/use-toast"
import { Search, FileText, ListFilter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LeaveRequestTable } from "@/components/leave-request-table"

export default function RequestApprovalPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const { user, users, leaveRequests, updateLeaveRequestStatus: updateLeaveRequest, refreshLeaveRequests } = useAuth()
  const { toast } = useToast()

  const router = useRouter()

  // Redirect if not logged in or not an approver
  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else if (!user.isapprover && !user.isauthorizedofficer && user.role !== "admin") {
      router.push("/dashboard")
    }
  }, [user, router])

  if (!user || (!user.isapprover && !user.isauthorizedofficer && user.role !== "admin")) {
    return null
  }

  // Filter requests based on user's role and approval status
  const filteredRequests = leaveRequests.filter((request) => {
    if (!user) return false

    // Text search
    const employee = users.find((u) => u.id === request.user_id)
    const matchesSearch =
      !searchTerm ||
      employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.type.toLowerCase().includes(searchTerm.toLowerCase())

    // Status filter
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" &&
        ((user.isapprover && request.supervisor_status === "Pending") ||
          (user.isauthorizedofficer && request.authorized_officer_status === "Pending"))) ||
      (statusFilter === "approved" &&
        ((user.isapprover && request.supervisor_status === "Approved") ||
          (user.isauthorizedofficer && request.authorized_officer_status === "Approved"))) ||
      (statusFilter === "rejected" &&
        ((user.isapprover && request.supervisor_status === "Rejected") ||
          (user.isauthorizedofficer && request.authorized_officer_status === "Rejected")))

    // Filter based on user's role and request status
    let isRelevantToUser = false
    if (user.isapprover && request.supervisor_id === user.id) {
      isRelevantToUser = true
    } else if (user.isauthorizedofficer && request.authorized_officer_id === user.id) {
      // Hanya tampilkan untuk pejabat berwenang jika sudah disetujui atasan langsung
      isRelevantToUser = request.supervisor_status === "Approved"
    }
    return matchesSearch && matchesStatus && isRelevantToUser
  })

  const getStatusBadge = (request: any) => {
    const supervisorStatus = request.supervisor_status
    const authorizedOfficerStatus = request.authorized_officer_status

    if (supervisorStatus === "Rejected" || authorizedOfficerStatus === "Rejected") {
      return <Badge variant="destructive">Ditolak</Badge>
    }
    if (supervisorStatus === "Approved" && authorizedOfficerStatus === "Approved") {
      return <Badge className="bg-green-500">Disetujui</Badge>
    }
    if (supervisorStatus === "Approved" && authorizedOfficerStatus === "Pending") {
      return <Badge variant="outline">Menunggu Pejabat</Badge>
    }
    return <Badge variant="outline">Menunggu Persetujuan</Badge>
  }

  const openReviewModal = (request: any) => {
    setSelectedRequest(request)
    setIsModalOpen(true)
  }

  const handleApprovalSubmission = async (data: any) => {
    try {
      console.log("Handling approval submission with data:", data);

      if (!data.requestId) {
        console.error("Missing requestId in approval data");
        toast({
          title: "Gagal",
          description: "ID permintaan tidak valid",
          variant: "destructive",
        });
        return;
      }

      // Pastikan requestId dalam bentuk number
      const requestId = Number(data.requestId);
      if (isNaN(requestId)) {
        console.error("Invalid requestId format:", data.requestId);
        toast({
          title: "Gagal",
          description: "Format ID permintaan tidak valid",
          variant: "destructive",
        });
        return;
      }

      console.log("Sending approval with requestId:", requestId);

      // Perbarui status permintaan cuti
      await updateLeaveRequest(
        requestId,
        data.approverType,
        data.status,
        data.rejectionReason,
        data.signatureDate,
        data.signed
      );

      setIsModalOpen(false);
      toast({
        title: data.status === "Approved" ? "Permintaan disetujui" : "Permintaan ditolak",
        description:
          data.status === "Approved" ? "Permintaan cuti telah berhasil disetujui" : "Permintaan cuti telah ditolak",
      });

      // Refresh data
      await refreshLeaveRequests();

      // Gunakan router.refresh() sebagai pengganti window.location.reload()
      router.refresh();
    } catch (error) {
      console.error("Error updating leave request:", error);
      toast({
        title: "Gagal",
        description: error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat memperbarui status. Silakan coba lagi.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Header title="Persetujuan Cuti" onMenuClick={() => setIsMobileOpen(true)} />

        <main className="p-4 md:p-6 space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari permintaan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>

              <div className="flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="pending">Menunggu Persetujuan</SelectItem>
                    <SelectItem value="approved">Disetujui</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daftar Permintaan Cuti</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredRequests.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <FileText className="mx-auto h-12 w-12 text-gray-300" />
                  <div>
                    <h3 className="text-lg font-medium">Tidak ada permintaan cuti</h3>
                    <p className="text-sm text-gray-500">Tidak ada permintaan cuti yang menunggu persetujuan Anda.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pegawai</TableHead>
                        <TableHead>Jenis Cuti</TableHead>
                        <TableHead>Durasi</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => {
                        const employee = users.find((u) => u.id === request.user_id)
                        const duration = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1
                        const isPending =
                          (user.id === request.supervisor_id && request.supervisor_status === "Pending") ||
                          (user.id === request.authorized_officer_id && request.authorized_officer_status === "Pending")

                        return (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{employee?.name || "Unknown"}</TableCell>
                            <TableCell>{request.type}</TableCell>
                            <TableCell>{duration} hari</TableCell>
                            <TableCell>
                              {format(new Date(request.start_date), "dd MMM")} -{" "}
                              {format(new Date(request.end_date), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>{getStatusBadge(request)}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => openReviewModal(request)}>
                                {isPending ? "Review" : "Lihat"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <LeaveRequestModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleApprovalSubmission}
          mode="approve"
          requestData={selectedRequest}
          approverType={user.id === selectedRequest.supervisor_id ? "supervisor" : "authorized_officer"}
        />
      )}
    </div>
  )
}
