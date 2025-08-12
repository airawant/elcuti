import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getAuthCookie, verifyJWT, hashPassword } from "@/lib/auth-utils"
import { z } from "zod"

// Define validation schema for user creation
const userCreateSchema = z.object({
  nip: z.string().min(1, "NIP is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(["admin", "user"]),
  position: z.string().optional(),
  workUnit: z.string().optional(),
  email: z.string().email("Please enter a valid email").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  isApprover: z.boolean().optional(),
  isAuthorizedOfficer: z.boolean().optional(),
  leave_balance: z.record(z.string(), z.number()).optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export async function GET(request: NextRequest) {
  try {
    console.log("Starting /api/users request...")
    const token = await getAuthCookie()
    console.log("Auth token:", token ? "Found" : "Not found")

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    console.log("JWT payload:", payload ? JSON.stringify(payload, null, 2) : "Invalid token")

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Check if user is admin
    console.log("User role:", payload.role)
    console.log("User isapprover:", payload.isapprover)
    console.log("User isauthorizedofficer:", payload.isauthorizedofficer)

    // Allow admin, approvers, and authorized officers to access users list
    if (payload.role !== "admin" && !payload.isapprover && !payload.isauthorizedofficer) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch all users from database
    console.log("Fetching users from Supabase...")
    const { data: users, error } = await supabase
      .from("pegawai")
      .select(
        "id, nip, name, role, position, workunit, email, phone, address, masa_kerja, tipe_pengguna, isapprover, isauthorizedofficer, leave_balance",
      )
      .order("id", { ascending: true })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({
        error: "Failed to fetch users",
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log(`Successfully fetched ${users?.length || 0} users`)
    return NextResponse.json(users, { status: 200 })
  } catch (error) {
    console.error("Unexpected error in /api/users:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthCookie()
    console.log("Auth token for create:", token ? "Found" : "Not found")

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    console.log("JWT payload for create:", payload ? "Valid" : "Invalid")

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Only admins can create users
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = userCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.flatten() },
        { status: 400 },
      )
    }

    const userData = validationResult.data

    // Check if NIP is already in use
    const { data: existingNIP, error: nipCheckError } = await supabase
      .from("pegawai")
      .select("id, nip")
      .eq("nip", userData.nip)
      .single()

    if (nipCheckError && nipCheckError.code !== "PGRST116") {
      return NextResponse.json({ error: "Database error", details: nipCheckError.message }, { status: 500 })
    }

    if (existingNIP) {
      return NextResponse.json({ error: "NIP already in use" }, { status: 409 })
    }

    // Check if email is already in use (if provided)
    if (userData.email) {
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from("pegawai")
        .select("id, email")
        .eq("email", userData.email)
        .single()

      if (emailCheckError && emailCheckError.code !== "PGRST116") {
        return NextResponse.json({ error: "Database error", details: emailCheckError.message }, { status: 500 })
      }

      if (existingEmail) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 })
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password)

    // Create user in database
    const { data, error } = await supabase
      .from("pegawai")
      .insert({
        ...userData,
        password: hashedPassword,
        workunit: userData.workUnit,
        isapprover: userData.isApprover,
        isauthorizedofficer: userData.isAuthorizedOfficer,
      })
      .select(
        "id, nip, name, role, position, workunit, email, phone, address, isapprover, isauthorizedofficer, leave_balance",
      )
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to create user", details: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
