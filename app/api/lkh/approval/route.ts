import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verifyJWT } from "@/lib/auth-utils"

// Helper Autentikasi
async function authenticate(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value
  if (!token) return null
  const payload = await verifyJWT(token)
  if (!payload || !payload.id) return null
  return payload
}

// ─── GET: Fetch daftar LKH bawahan yang diajukan ke Approver ini ────────────
export async function GET(request: NextRequest) {
  try {
    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!payload.isapprover && payload.role !== "admin") {
      return NextResponse.json(
        { error: "Akses ditolak. Anda bukan approver." },
        { status: 403 }
      )
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    const approverId = Number(payload.id)

    // Query daftar LKH dimana approver_id = user ini
    const { data, error } = await supabaseAdmin
      .from("lkh_laporan")
      .select(`
        *,
        pegawai:user_id (
          id, name, nip, position, workunit, email, phone
        ),
        kegiatan:lkh_kegiatan (
          id, tanggal, uraian_tugas, realisasi, urutan, created_at
        )
      `)
      .eq("approver_id", approverId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching approval LKH:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("GET /api/lkh/approval error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
