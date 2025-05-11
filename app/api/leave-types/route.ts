import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    // Dapatkan data jenis cuti dari database
    const { data: leaveTypes, error } = await supabaseAdmin
      .from("leave_types")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Error saat mengambil data jenis cuti:", error)
      return NextResponse.json({ message: "Gagal mengambil data jenis cuti" }, { status: 500 })
    }

    return NextResponse.json({ data: leaveTypes }, { status: 200 })
  } catch (error) {
    console.error("Error in leave types API:", error)
    return NextResponse.json({ message: "Terjadi kesalahan server" }, { status: 500 })
  }
}
