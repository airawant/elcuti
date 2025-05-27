"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { LeaveRequestTable } from "@/components/leave-request-table"
import { LeaveRequestModal } from "@/components/leave-request-modal"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

export default function LeaveRequestPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { toast } = useToast()
  const { user, addLeaveRequest } = useAuth()
  const router = useRouter()

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.push("/login")
    } else if (user.role === "admin") {
      router.push("/admin/dashboard")
    }
  }, [user, router])

  if (!user || user.role !== "user") {
    return null
  }

  const handleLeaveSubmission = (formData: any) => {
    // Extract the necessary fields for the leave request
    const leaveRequest = {
      user_id: user.id,
      type: formData.type || formData.leaveType,
      status: "Pending",
      start_date: formData.start_date || formData.startDate,
      end_date: formData.end_date || formData.endDate,
      reason: formData.reason || formData.leaveReason,
      supervisor_id: formData.supervisor_id || formData.supervisorId,
      authorized_officer_id: formData.authorized_officer_id || formData.authorizedOfficerId,
      workingdays: formData.workingDays,
      address: formData.address,
      phone: formData.phone,
      supervisor_viewed: false,
      authorized_officer_viewed: false,
      supervisor_signed: false,
      authorized_officer_signed: false,
      link_file: null,
      supervisor_note: null,
      authorized_officer_note: null,
      used_carry_over_days: 0,
      used_current_year_days: 0,
      leave_year: new Date().getFullYear()
    }
    // Add the leave request
    addLeaveRequest({
      ...leaveRequest,
      status: "Pending" // Use the correct ApprovalStatus enum value
    })

    setIsModalOpen(false)
    toast({
      title: "Permintaan cuti berhasil diajukan",
      description: "Permintaan cuti Anda telah berhasil diajukan dan menunggu persetujuan.",
    })
  }

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
        <Header title="FORMULIR CUTI - PNS" onMenuClick={() => setIsMobileOpen(true)}>
          <Button onClick={() => setIsModalOpen(true)} className="bg-green-500 hover:bg-green-600">
            Ajukan Cuti
          </Button>
        </Header>

        <main className="p-4 md:p-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Riwayat Cuti Pribadi</h2>
            <LeaveRequestTable userId={user.id} />
          </div>
        </main>
      </div>

      <LeaveRequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleLeaveSubmission} />
    </div>
  )
}
