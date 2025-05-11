import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await getAuthCookie()

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Only admins can delete holidays
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Delete holiday from database
    const { error } = await supabase.from("holidays").delete().eq("id", Number.parseInt(params.id))

    if (error) {
      return NextResponse.json({ error: "Failed to delete holiday", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Holiday deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("Delete holiday error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
