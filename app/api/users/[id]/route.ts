import { type NextRequest, NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { getAuthCookie, verifyJWT, hashPassword } from "@/lib/auth-utils"
import { z } from "zod"

// Define validation schema for user updates
const userUpdateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  role: z.enum(["admin", "user"]).optional(),
  position: z.string().optional(),
  workunit: z.string().optional(),
  workUnit: z.string().optional(),
  email: z.string().email("Please enter a valid email").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  masa_kerja: z.string().optional(),
  tipe_pengguna: z.enum(["PNS", "PPPK"]).optional(),
  isapprover: z.boolean().optional(),
  isApprover: z.boolean().optional(),
  isauthorizedofficer: z.boolean().optional(),
  isAuthorizedOfficer: z.boolean().optional(),
  leave_balance: z.record(z.string(), z.number()).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = Number.parseInt(params.id)
    console.log("Attempting to update user with ID:", userId)

    const token = await getAuthCookie()
    console.log("Auth token for update:", token ? "Found" : "Not found")

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    console.log("JWT payload for update:", payload ? "Valid" : "Invalid")

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Check if user is admin or updating their own profile
    if (payload.role !== "admin" && payload.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    console.log("[UPDATE] Raw request body:", body)

    // Direct extraction regardless of validation
    const isApproverValue = body.isApprover === true || body.isapprover === true;
    const isAuthorizedOfficerValue = body.isAuthorizedOfficer === true || body.isauthorizedofficer === true;
    const workUnitValue = body.workUnit || body.workunit || '';
    const masaKerjaValue = body.masa_kerja || null;

    // Check if fields exist in the request
    const hasIsApprover = 'isApprover' in body || 'isapprover' in body;
    const hasIsAuthorizedOfficer = 'isAuthorizedOfficer' in body || 'isauthorizedofficer' in body;
    const hasWorkUnit = 'workUnit' in body || 'workunit' in body;
    const hasMasaKerja = 'masa_kerja' in body;

    // Validate input
    const validation = userUpdateSchema.safeParse(body)
    if (!validation.success) {
      console.log("[UPDATE] Validation error:", validation.error.flatten())
      return NextResponse.json({ error: "Validation error", details: validation.error.flatten() }, { status: 400 })
    }

    const userData = validation.data

    // Prepare update data with only provided fields
    const updateData: any = {}
    if (userData.name) updateData.name = userData.name
    if (userData.role) updateData.role = userData.role
    if (userData.position !== undefined) updateData.position = userData.position
    if (hasWorkUnit) updateData.workunit = workUnitValue
    if (userData.email !== undefined) updateData.email = userData.email
    if (userData.phone !== undefined) updateData.phone = userData.phone
    if (userData.address !== undefined) updateData.address = userData.address
    if (hasMasaKerja) updateData.masa_kerja = masaKerjaValue
    if (userData.tipe_pengguna !== undefined) updateData.tipe_pengguna = userData.tipe_pengguna

    if (hasIsApprover) updateData.isapprover = isApproverValue
    if (hasIsAuthorizedOfficer) updateData.isauthorizedofficer = isAuthorizedOfficerValue

    // Handle leave_balance if provided
    const leaveBalanceValue = userData.leave_balance
    if (leaveBalanceValue) {
      updateData.leave_balance = leaveBalanceValue;
    }

    // Add password if provided
    if (userData.password) {
      updateData.password = await hashPassword(userData.password);
    }

    console.log("[UPDATE] Data to update:", {
      ...updateData,
      password: updateData.password ? "[REDACTED]" : undefined
    })

    // Update user in database with final data
    if (!supabaseAdmin) {
      console.error("[UPDATE] Service role key not configured")
      return NextResponse.json({ error: "Server configuration error", details: "Admin operations not available" }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from("pegawai")
      .update(updateData)
      .eq("id", userId)
      .select("*")
      .single()

    if (error) {
      console.error("[UPDATE] Error:", error)
      return NextResponse.json({ error: "Failed to update user", details: error.message }, { status: 500 })
    }

    // Log the actual data in database after update
    console.log("[UPDATE] Database state after update:", {
      ...data,
      password: '[REDACTED]',
      workunit: data.workunit,
      masa_kerja: data.masa_kerja,
      isapprover: data.isapprover,
      isauthorizedofficer: data.isauthorizedofficer,
      leave_balance: data.leave_balance
    })

    // Return only necessary fields
    const responseData = {
      id: data.id,
      nip: data.nip,
      name: data.name,
      role: data.role,
      position: data.position,
      workunit: data.workunit,
      email: data.email,
      phone: data.phone,
      address: data.address,
      masa_kerja: data.masa_kerja,
      tipe_pengguna: data.tipe_pengguna,
      isapprover: data.isapprover,
      isauthorizedofficer: data.isauthorizedofficer,
      leave_balance: data.leave_balance
    }

    console.log("[UPDATE] Successfully updated user:", responseData)
    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    console.error("Update user error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = Number.parseInt(params.id)
    console.log("[DELETE] Attempting to delete user with ID:", userId)

    const token = await getAuthCookie()
    console.log("[DELETE] Auth token:", token ? "Found" : "Not found")

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    console.log("[DELETE] JWT payload:", payload)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Only admins can delete users
    if (payload.role !== "admin") {
      console.log("[DELETE] Unauthorized - User is not admin. Role:", payload.role)
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Prevent deleting yourself
    if (payload.id === userId) {
      console.log("[DELETE] Attempted to delete own account")
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    if (!supabaseAdmin) {
      console.error("[DELETE] Service role key not configured")
      return NextResponse.json({
        error: "Server configuration error",
        details: "Admin operations not available"
      }, { status: 500 })
    }

    // First check if user exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("pegawai")
      .select("id, name")
      .eq("id", userId)
      .single()

    console.log("[DELETE] Check user existence result:", { existingUser, checkError })

    if (checkError) {
      console.error("[DELETE] Error checking user existence:", checkError)
      return NextResponse.json({ error: "Database error", details: checkError.message }, { status: 500 })
    }

    if (!existingUser) {
      console.log("[DELETE] User not found with ID:", userId)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Delete user from database
    const { error: deleteError } = await supabaseAdmin
      .from("pegawai")
      .delete()
      .eq("id", userId)

    if (deleteError) {
      console.error("[DELETE] Delete error:", deleteError)
      return NextResponse.json({
        error: "Failed to delete user",
        details: deleteError.message
      }, { status: 500 })
    }

    // Verify deletion
    const { data: verifyData } = await supabaseAdmin
      .from("pegawai")
      .select("id")
      .eq("id", userId)
      .single()

    if (verifyData) {
      console.error("[DELETE] User still exists after deletion")
      return NextResponse.json({
        error: "Delete operation failed",
        details: "User still exists in database"
      }, { status: 500 })
    }

    console.log("[DELETE] Successfully deleted user:", existingUser)
    return NextResponse.json({
      message: "User deleted successfully",
      deletedUser: existingUser
    }, { status: 200 })
  } catch (error) {
    console.error("[DELETE] Unexpected error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
