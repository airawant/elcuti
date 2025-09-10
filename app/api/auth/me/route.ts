import { type NextRequest, NextResponse } from "next/server"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"
import { supabase } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    console.log("Processing /api/auth/me request...")
    const token = await getAuthCookie()
    console.log("Auth token from cookie:", token ? token.substring(0, 20) + "..." : "not found")

    if (!token) {
      console.log("/api/auth/me: No token found")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    console.log("JWT verification result:", payload ? "valid" : "invalid")

    if (!payload || !payload.id) {
      console.log("/api/auth/me: Invalid token payload")
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Log payload for debugging
    console.log("JWT payload:", JSON.stringify(payload, null, 2))

    // Fetch fresh user data from database
    console.log("Fetching user data from Supabase for ID:", payload.id)
    const { data: user, error } = await supabase
      .from("pegawai")
      .select(
        "id, nip, name, role, position, workunit, email, phone, address, isapprover, isauthorizedofficer, leave_balance, tipe_pengguna, masa_kerja",
      )
      .eq("id", payload.id)
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({
        error: "Database error",
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    if (!user) {
      console.log("/api/auth/me: User not found in database")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    console.log("Successfully fetched user data")
    return NextResponse.json(user, { status: 200 })
  } catch (error) {
    console.error("Unexpected error in /api/auth/me:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
