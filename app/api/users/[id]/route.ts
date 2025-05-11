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

    // Check if fields exist in the request
    const hasIsApprover = 'isApprover' in body || 'isapprover' in body;
    const hasIsAuthorizedOfficer = 'isAuthorizedOfficer' in body || 'isauthorizedofficer' in body;
    const hasWorkUnit = 'workUnit' in body || 'workunit' in body;

    console.log("[UPDATE] Direct field extract:", {
      workUnit_direct: workUnitValue,
      has_workUnit: hasWorkUnit,
      isApprover_direct: isApproverValue,
      has_isApprover: hasIsApprover,
      isAuthorizedOfficer_direct: isAuthorizedOfficerValue,
      has_isAuthorizedOfficer: hasIsAuthorizedOfficer
    });

    // Validate input
    const validationResult = userUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      console.log("Validation error:", validationResult.error.flatten())
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.flatten() },
        { status: 400 },
      )
    }

    const userData = validationResult.data

    // Map frontend camelCase to backend fields
    const workUnit = workUnitValue;
    const isApprover = isApproverValue;
    const isAuthorizedOfficer = isAuthorizedOfficerValue;

    console.log("[UPDATE] Field mapping:", {
      frontend_workUnit: body.workUnit,
      backend_workunit: userData.workunit,
      mapped_workUnit: workUnit,

      frontend_isApprover: body.isApprover,
      backend_isapprover: userData.isapprover,
      mapped_isApprover: isApprover,

      frontend_isAuthorizedOfficer: body.isAuthorizedOfficer,
      backend_isauthorizedofficer: userData.isauthorizedofficer,
      mapped_isAuthorizedOfficer: isAuthorizedOfficer
    });

    // If updating email, check if it's already in use
    if (userData.email) {
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from("pegawai")
        .select("id, email")
        .eq("email", userData.email)
        .neq("id", userId)
        .single()

      if (emailCheckError && emailCheckError.code !== "PGRST116") {
        console.error("Email check error:", emailCheckError)
        return NextResponse.json({ error: "Database error", details: emailCheckError.message }, { status: 500 })
      }

      if (existingEmail) {
        return NextResponse.json({ error: "Email already in use by another user" }, { status: 409 })
      }
    }

    // Update user in database
    if (!supabaseAdmin) {
      console.error("[UPDATE] Service role key not configured")
      return NextResponse.json({
        error: "Server configuration error",
        details: "Admin operations not available"
      }, { status: 500 })
    }

    // Prepare update data explicitly
    const updateData: Record<string, any> = {};

    // Add fields that exist in userData from validation
    if (userData.name) updateData.name = userData.name;
    if (userData.role) updateData.role = userData.role;
    if (userData.position) updateData.position = userData.position;
    if (userData.email) updateData.email = userData.email;
    if (userData.phone) updateData.phone = userData.phone;
    if (userData.address) updateData.address = userData.address;

    // Handle special fields directly from the raw body
    if (hasWorkUnit) {
      updateData.workunit = workUnitValue;
    }

    if (hasIsApprover) {
      updateData.isapprover = isApproverValue;
    }

    if (hasIsAuthorizedOfficer) {
      updateData.isauthorizedofficer = isAuthorizedOfficerValue;
    }

    // Handle leave_balance field
    const hasLeaveBalance = 'leave_balance' in body;
    let leaveBalanceValue = userData.leave_balance;

    // If no leave_balance provided in update or empty, create dynamic one
    if (hasLeaveBalance && (!leaveBalanceValue || Object.keys(leaveBalanceValue).length === 0)) {
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      // Create dynamic leave_balance
      leaveBalanceValue = {
        [currentYear.toString()]: 12,     // Tahun saat ini (dinamis)
        [previousYear.toString()]: 12     // Tahun sebelumnya (dinamis)
      };

      console.log("[UPDATE] Created dynamic leave_balance:", {
        currentYear,
        previousYear,
        leave_balance: leaveBalanceValue
      });
    }

    // Jika sisa cuti tahun lalu > 6, batasi menjadi 6 (aturan cuti)
    if (leaveBalanceValue) {
      const currentYear = new Date().getFullYear();
      const previousYear = (currentYear - 1).toString();

      if (leaveBalanceValue[previousYear] && leaveBalanceValue[previousYear] > 6) {
        leaveBalanceValue[previousYear] = 6;
        console.log(`[UPDATE] Capped previous year (${previousYear}) leave balance to 6 days`);
      }
    }

    // Add leave_balance to updateData if it exists
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
