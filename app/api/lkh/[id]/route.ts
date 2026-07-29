import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verifyJWT } from "@/lib/auth-utils"
import { z } from "zod"

// ─── Validation Schema ───────────────────────────────────────────────────────

const kegiatanUpdateSchema = z.object({
  id: z.number().optional(), // ada id = update, tidak ada = insert baru
  tanggal: z.string(),
  uraian_tugas: z.array(z.string()),
  realisasi: z.array(z.string()),
  urutan: z.number().optional().default(1),
})

const updateLaporanSchema = z.object({
  bulan: z.number().int().min(1).max(12).optional(),
  tahun: z.number().int().min(2020).optional(),
  dasar: z.string().optional(),
  approver_id: z.number().optional().nullable(),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).optional(),
  approval_note: z.string().optional(),
  approved_at: z.string().optional(),
  pdf_url: z.string().optional(),
  kegiatan: z.array(kegiatanUpdateSchema).optional(),
})

// ─── Helper: Autentikasi ─────────────────────────────────────────────────────
async function authenticate(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value
  if (!token) return null
  const payload = await verifyJWT(token)
  if (!payload || !payload.id) return null
  return payload
}

// ─── Helper: Cek kepemilikan / akses laporan ─────────────────────────────────
async function getLaporanForUser(laporanId: number, userId: number, isApprover: boolean = false) {
  if (!supabaseAdmin) throw new Error("Supabase admin client not initialized")

  let query = supabaseAdmin.from("lkh_laporan").select("*").eq("id", laporanId)

  if (isApprover) {
    query = query.or(`user_id.eq.${userId},approver_id.eq.${userId}`)
  } else {
    query = query.eq("user_id", userId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data
}

// ─── GET: Detail satu laporan ─────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    const laporanId = Number(params.id)
    if (isNaN(laporanId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const userId = Number(payload.id)
    const isAdmin = payload.role === "admin"

    let query = supabaseAdmin
      .from("lkh_laporan")
      .select(`
        *,
        approver:approver_id (
          id, name, nip, position, workunit
        ),
        kegiatan:lkh_kegiatan (
          id, tanggal, uraian_tugas, realisasi, urutan, created_at
        ),
        pegawai:user_id (
          id, name, nip, position, workunit, masa_kerja, tipe_pengguna
        )
      `)
      .eq("id", laporanId)

    if (!isAdmin) {
      query = query.or(`user_id.eq.${userId},approver_id.eq.${userId}`)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 })
    }

    // Sort kegiatan by urutan
    if (data.kegiatan) {
      data.kegiatan.sort((a: any, b: any) => a.urutan - b.urutan)
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("GET /api/lkh/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── PUT: Update laporan + sync kegiatan ─────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    const laporanId = Number(params.id)
    if (isNaN(laporanId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const userId = Number(payload.id)
    const isApprover = Boolean(payload.isapprover) || payload.role === "admin"

    // Cek kepemilikan / hak approver
    const laporan = await getLaporanForUser(laporanId, userId, isApprover)
    if (!laporan) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = updateLaporanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { kegiatan, ...laporanFields } = parsed.data

    // Update header laporan jika ada field yang berubah
    if (Object.keys(laporanFields).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("lkh_laporan")
        .update(laporanFields)
        .eq("id", laporanId)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Sync kegiatan: hapus semua lalu insert ulang (simplest approach)
    if (kegiatan !== undefined) {
      // Hapus kegiatan lama
      const { error: deleteError } = await supabaseAdmin
        .from("lkh_kegiatan")
        .delete()
        .eq("laporan_id", laporanId)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      // Insert kegiatan baru
      if (kegiatan.length > 0) {
        const kegiatanRows = kegiatan.map((k, idx) => ({
          laporan_id: laporanId,
          tanggal: k.tanggal,
          uraian_tugas: k.uraian_tugas,
          realisasi: k.realisasi,
          urutan: k.urutan ?? idx + 1,
        }))

        const { error: insertError } = await supabaseAdmin
          .from("lkh_kegiatan")
          .insert(kegiatanRows)

        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }
      }
    }

    // Kembalikan laporan terbaru
    const { data: result, error: fetchError } = await supabaseAdmin
      .from("lkh_laporan")
      .select(`*, kegiatan:lkh_kegiatan(*)`)
      .eq("id", laporanId)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: { id: laporanId } })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error("PUT /api/lkh/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── DELETE: Hapus laporan ────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    const laporanId = Number(params.id)
    if (isNaN(laporanId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const userId = Number(payload.id)

    // Cek kepemilikan
    const laporan = await getLaporanForUser(laporanId, userId)
    if (!laporan) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 })
    }

    // Kegiatan akan terhapus otomatis karena ON DELETE CASCADE
    const { error } = await supabaseAdmin
      .from("lkh_laporan")
      .delete()
      .eq("id", laporanId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Laporan berhasil dihapus" })
  } catch (err) {
    console.error("DELETE /api/lkh/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
