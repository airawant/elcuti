import { type NextRequest, NextResponse } from "next/server"
import { hashPassword } from "@/lib/auth-utils"
import { supabaseAdmin } from "@/lib/supabase"
import { z } from "zod"

const registerSchema = z.object({
  nip: z.string().min(1, "NIP is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["admin", "user"]),
  position: z.string().optional(),
  workunit: z.string().optional(),
  workUnit: z.string().optional(),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
  masa_kerja: z.string().optional(),
  isapprover: z.boolean().optional(),
  isApprover: z.boolean().optional(),
  isauthorizedofficer: z.boolean().optional(),
  isAuthorizedOfficer: z.boolean().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      console.error("[REGISTER] Service role key not configured")
      return NextResponse.json({
        error: "Server configuration error",
        details: "Admin operations not available"
      }, { status: 500 })
    }

    const body = await request.json()
    console.log("[REGISTER] Raw request body:", body)

    // Handle frontend data format regardless of validation
    const isApproverValue = body.isApprover === true || body.isapprover === true;
    const isAuthorizedOfficerValue = body.isAuthorizedOfficer === true || body.isauthorizedofficer === true;
    const workUnitValue = body.workUnit || body.workunit || '';
    const masaKerjaValue = body.masa_kerja || null;

    console.log("[REGISTER] Direct field extract:", {
      workUnit_direct: workUnitValue,
      masa_kerja_direct: masaKerjaValue,
      isApprover_direct: isApproverValue,
      isAuthorizedOfficer_direct: isAuthorizedOfficerValue
    });

    const validationResult = registerSchema.safeParse(body)
    if (!validationResult.success) {
      console.log("[REGISTER] Validation error:", validationResult.error.flatten())
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.flatten() },
        { status: 400 },
      )
    }

    const userData = validationResult.data
    console.log("[REGISTER] Parsed data:", {
      ...userData,
      password: "[REDACTED]",
      isapprover: userData.isapprover,
      isapprover_type: typeof userData.isapprover,
      isauthorizedofficer: userData.isauthorizedofficer,
      isauthorizedofficer_type: typeof userData.isauthorizedofficer
    })

    // Check if user with same NIP or email already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("pegawai")
      .select("id, nip, email")
      .or(`nip.eq.${userData.nip},email.eq.${userData.email}`)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[REGISTER] Error checking existing user:", checkError)
      return NextResponse.json({ error: "Database error", details: checkError.message }, { status: 500 })
    }

    if (existingUser) {
      const field = existingUser.nip === userData.nip ? "NIP" : "email"
      return NextResponse.json({ error: `${field} already in use` }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password)

    // Create dynamic leave balance for current year and previous year
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Inisialisasi leave_balance dengan tahun berjalan dan tahun sebelumnya
    const defaultLeaveBalance = {
      [currentYear.toString()]: 12,     // Tahun saat ini (dinamis)
      [previousYear.toString()]: 12     // Tahun sebelumnya (dinamis)
    };

    console.log("[REGISTER] Dynamic leave balance:", {
      currentYear,
      previousYear,
      leave_balance: defaultLeaveBalance
    });

    // Create database ready object from raw data
    const dbData = {
      nip: userData.nip,
      name: userData.name,
      role: userData.role,
      position: userData.position,
      workunit: workUnitValue,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      masa_kerja: masaKerjaValue,
      isapprover: isApproverValue,
      isauthorizedofficer: isAuthorizedOfficerValue,
      password: hashedPassword,
      leave_balance: defaultLeaveBalance
    }

    console.log("[REGISTER] Data to insert:", {
      ...dbData,
      password: '[REDACTED]',
      workunit: dbData.workunit || 'not set',
      masa_kerja: dbData.masa_kerja,
      isapprover: dbData.isapprover || false,
      isauthorizedofficer: dbData.isauthorizedofficer || false,
      leave_balance: dbData.leave_balance
    })

    // Create user with explicit column names
    const { data: newUser, error: createError } = await supabaseAdmin
      .from("pegawai")
      .insert({
        nip: dbData.nip,
        name: dbData.name,
        role: dbData.role,
        position: dbData.position,
        workunit: dbData.workunit,
        email: dbData.email,
        phone: dbData.phone,
        address: dbData.address,
        masa_kerja: dbData.masa_kerja,
        isapprover: dbData.isapprover,
        isauthorizedofficer: dbData.isauthorizedofficer,
        password: dbData.password,
        leave_balance: dbData.leave_balance
      })
      .select("id, nip, name, role, position, workunit, email, phone, address, masa_kerja, isapprover, isauthorizedofficer, leave_balance")
      .single()

    if (createError) {
      console.error("[REGISTER] Create user error:", createError)
      return NextResponse.json({ error: "Failed to create user", details: createError.message }, { status: 500 })
    }

    console.log("[REGISTER] Successfully created user:", newUser)
    return NextResponse.json({
      message: "User created successfully",
      user: newUser
    }, { status: 201 })
  } catch (error) {
    console.error("[REGISTER] Unexpected error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
