export type Holiday = {
  id: number
  name: string
  date: string
  description?: string
}

export type LeaveRequest = {
  id: number
  user_id: number
  type: string
  start_date: string
  end_date: string
  reason: string
  status: "Pending" | "Approved" | "Rejected"
  workingdays: number
  supervisor_id?: number
  authorized_officer_id?: number
  supervisor_status: "Pending" | "Approved" | "Rejected"
  authorized_officer_status: "Pending" | "Approved" | "Rejected"
  supervisor_viewed: boolean
  authorized_officer_viewed: boolean
  supervisor_signed: boolean
  authorized_officer_signed: boolean
  supervisor_signature_date?: string
  authorized_officer_signature_date?: string
  used_carry_over_days: number
  used_current_year_days: number
  used_n2_year: number
  saldo_n2_year: number
  saldo_carry: number
  saldo_current_year: number
  leave_year: number
  created_at: string
  updated_at?: string
  rejection_reason?: string
  address?: string
  phone?: string
}
