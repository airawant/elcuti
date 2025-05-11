import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"
import { z } from "zod"

// Define validation schema for leave balance updates
const leaveBalanceSchema = z.object({
  userId: z.number(),
  year: z.string(),
  balance: z.number().min(0),
})

// Define validation schema for initial leave balance
const initialLeaveBalanceSchema = z.object({
  year: z.string(),
  balance: z.number().min(0),
})

export async function PATCH(request: NextRequest) {
  try {
    const token = await getAuthCookie()

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Only admins can update leave balances
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = leaveBalanceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.flatten() },
        { status: 400 },
      )
    }

    const { userId, year, balance } = validationResult.data

    // Fetch the user
    const { data: user, error: fetchError } = await supabase
      .from("pegawai")
      .select("id, leave_balance")
      .eq("id", userId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch user", details: fetchError.message }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update leave balance
    const leaveBalance = user.leave_balance || {}
    leaveBalance[year] = balance

    const { data, error } = await supabase
      .from("pegawai")
      .update({ leave_balance: leaveBalance })
      .eq("id", userId)
      .select("id, leave_balance")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update leave balance", details: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("Update leave balance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthCookie()

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Only admins can set initial leave balances
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = initialLeaveBalanceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.flatten() },
        { status: 400 },
      )
    }

    const { year, balance } = validationResult.data

    // Fetch all users with role 'user'
    const { data: users, error: fetchError } = await supabase
      .from("pegawai")
      .select("id, leave_balance")
      .eq("role", "user")

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch users", details: fetchError.message }, { status: 500 })
    }

    // Update leave balance for all users
    const updates = users.map(async (user) => {
      const leaveBalance = user.leave_balance || {}
      leaveBalance[year] = balance

      return supabase.from("pegawai").update({ leave_balance: leaveBalance }).eq("id", user.id)
    })

    await Promise.all(updates)

    return NextResponse.json({ message: "Leave balances updated successfully" }, { status: 200 })
  } catch (error) {
    console.error("Set initial leave balance error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
