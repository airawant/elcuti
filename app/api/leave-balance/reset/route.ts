import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    const token = getAuthCookie()

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Only admins can reset annual leave
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()
    const previousYear = currentYear - 1
    const twoYearsAgo = currentYear - 2

    // Fetch all users with role 'user'
    const { data: users, error: fetchError } = await supabase
      .from("pegawai")
      .select("id, leave_balance")
      .eq("role", "user")

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch users", details: fetchError.message }, { status: 500 })
    }

    // Fetch leave requests for previous year
    const { data: leaveRequests, error: leaveRequestsError } = await supabase
      .from("leave_requests")
      .select("user_id, type, status, start_date, end_date, workingDays")
      .eq("type", "Cuti Tahunan")
      .eq("status", "Approved")
      .gte("start_date", `${previousYear}-01-01`)
      .lte("end_date", `${previousYear}-12-31`)

    if (leaveRequestsError) {
      return NextResponse.json(
        { error: "Failed to fetch leave requests", details: leaveRequestsError.message },
        { status: 500 },
      )
    }

    // Calculate used leave days for each user
    const usedLeaveDays: Record<number, number> = {}

    leaveRequests.forEach((request) => {
      if (!usedLeaveDays[request.user_id]) {
        usedLeaveDays[request.user_id] = 0
      }
      usedLeaveDays[request.user_id] += request.workingDays || 0
    })

    // Update leave balance for all users
    const updates = users.map(async (user) => {
      const leaveBalance = user.leave_balance || {}

      // Get previous year's balance
      const previousYearBalance = leaveBalance[previousYear.toString()] || 12

      // Calculate unused leave from previous year
      const usedLeave = usedLeaveDays[user.id] || 0
      const unusedLeave = Math.max(0, previousYearBalance - usedLeave)

      // Calculate carry-over (max 6 days)
      const carryOver = Math.min(6, unusedLeave)

      // Set new balances
      leaveBalance[currentYear.toString()] = 12 // Reset to 12 days
      leaveBalance[previousYear.toString()] = carryOver // Update previous year's balance to carry-over amount

      // Remove N-2 balance
      delete leaveBalance[twoYearsAgo.toString()]

      return supabase.from("pegawai").update({ leave_balance: leaveBalance }).eq("id", user.id)
    })

    await Promise.all(updates)

    return NextResponse.json({ message: "Annual leave reset successfully" }, { status: 200 })
  } catch (error) {
    console.error("Reset annual leave error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

