import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verifyJWT } from "@/lib/auth-utils"

// Define type for leave balance
type LeaveBalanceRecord = Record<string, number>

export async function POST(request: NextRequest) {
  console.log("[API] Starting update-leave-balance process")

  try {
    // Verify supabaseAdmin exists
    if (!supabaseAdmin) {
      console.error("[API] Supabase admin client not initialized")
      return NextResponse.json({ error: "Database connection not available" }, { status: 500 })
    }

    // Verify admin authentication
    const token = request.cookies.get("auth-token")?.value
    if (!token) {
      console.error("[API] Authentication token not found")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload || !payload.userId) {
      console.error("[API] Invalid authentication token")
      return NextResponse.json({ error: "Invalid authentication token" }, { status: 401 })
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabaseAdmin
      .from("pegawai")
      .select("role")
      .eq("id", payload.userId)
      .single()

    if (userError || !user) {
      console.error("[API] User not found:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.role !== "admin") {
      console.error("[API] Non-admin user attempted to update leave balances")
      return NextResponse.json({ error: "Only admin can perform this action" }, { status: 403 })
    }

    // Get current year and previous year
    const currentYear = new Date().getFullYear().toString()
    const previousYear = (new Date().getFullYear() - 1).toString()

    // Fetch all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from("pegawai")
      .select("id, leave_balance")
      .order("id")

    if (usersError) {
      console.error("[API] Error fetching users:", usersError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    console.log(`[API] Found ${users.length} users to process`)

    // Statistics counters
    const stats = {
      total: users.length,
      updated: 0,
      capped: 0,
      errors: 0
    }

    // Process each user
    for (const user of users) {
      try {
        let updated = false
        // Initialize leave_balance if it doesn't exist
        let leaveBalance: LeaveBalanceRecord = user.leave_balance || {}

        // Create a new balance object with only current and previous year
        const newBalance: LeaveBalanceRecord = {}

        // Set current year to 12 if not set
        if (!leaveBalance[currentYear] || typeof leaveBalance[currentYear] !== 'number') {
          newBalance[currentYear] = 12
          updated = true
        } else {
          newBalance[currentYear] = leaveBalance[currentYear]
        }

        // Set previous year to 12 if not set, cap at 6 if greater
        if (!leaveBalance[previousYear] || typeof leaveBalance[previousYear] !== 'number') {
          newBalance[previousYear] = 12
          updated = true
        } else if (leaveBalance[previousYear] > 6) {
          newBalance[previousYear] = 6
          stats.capped++
          updated = true
        } else {
          newBalance[previousYear] = leaveBalance[previousYear]
        }

        // Only update if there were changes
        if (updated || JSON.stringify(leaveBalance) !== JSON.stringify(newBalance)) {
          const { error: updateError } = await supabaseAdmin
            .from("pegawai")
            .update({ leave_balance: newBalance })
            .eq("id", user.id)

          if (updateError) {
            console.error(`[API] Error updating user ${user.id}:`, updateError)
            stats.errors++
          } else {
            stats.updated++
            console.log(`[API] Updated leave balance for user ${user.id}:`, newBalance)
          }
        }
      } catch (error) {
        console.error(`[API] Error processing user ${user.id}:`, error)
        stats.errors++
      }
    }

    console.log(`[API] Update complete. Stats: ${JSON.stringify(stats)}`)
    return NextResponse.json({
      message: "Leave balance update complete",
      stats
    })

  } catch (error) {
    console.error("[API] Unexpected error during leave balance update:", error)
    return NextResponse.json(
      { error: "Failed to update leave balance" },
      { status: 500 }
    )
  }
}
