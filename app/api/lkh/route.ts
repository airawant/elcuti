import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { verifyJWT } from "@/lib/auth-utils"
import { z } from "zod"

// ─── Validation Schemas ──────────────────────────────────────────────────────

const kegiatanSchema = z.object({
  tanggal: z.string(),
  uraian_tugas: z.array(z.string()),
  realisasi: z.array(z.string()),
  urutan: z.number().optional().default(1),
})

const createLaporanSchema = z.object({
  bulan: z.number().int().min(1).max(12),
  tahun: z.number().int().min(2020),
  dasar: z.string().optional(),
  approver_id: z.number().optional().nullable(),
  status: z.enum(["draft", "submitted", "approved", "rejected"]).optional().default("draft"),
  kegiatan: z.array(kegiatanSchema).optional().default([]),
})

// ─── Helper: Autentikasi ─────────────────────────────────────────────────────
async function authenticate(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value
  if (!token) return null
  const payload = await verifyJWT(token)
  if (!payload || !payload.id) return null
  return payload
}

// ─── GET: Ambil semua laporan milik user ─────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    const userId = Number(payload.id)

    // Ambil laporan + kegiatan + data approver dalam satu query via join
    const { data, error } = await supabaseAdmin
      .from("lkh_laporan")
      .select(`
        *,
        approver:approver_id (
          id, name, nip, position, workunit
        ),
        kegiatan:lkh_kegiatan (
          id,
          tanggal,
          uraian_tugas,
          realisasi,
          urutan,
          created_at
        )
      `)
      .eq("user_id", userId)
      .order("tahun", { ascending: false })
      .order("bulan", { ascending: false })

    if (error) {
      console.error("Error fetching lkh_laporan:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error("GET /api/lkh error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── POST: Buat laporan baru (header + kegiatan) ─────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    const body = await request.json()
    const parsed = createLaporanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const userId = Number(payload.id)
    const { bulan, tahun, dasar, approver_id, status, kegiatan } = parsed.data

    // Cek apakah laporan untuk bulan/tahun ini sudah ada
    const { data: existing } = await supabaseAdmin
      .from("lkh_laporan")
      .select("id")
      .eq("user_id", userId)
      .eq("bulan", bulan)
      .eq("tahun", tahun)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "Laporan untuk periode ini sudah ada. Gunakan fitur edit untuk memperbarui." },
        { status: 409 }
      )
    }

    // Insert header laporan
    const laporanInsert: any = { user_id: userId, bulan, tahun, status }
    if (dasar) laporanInsert.dasar = dasar
    if (approver_id) laporanInsert.approver_id = approver_id

    const { data: laporan, error: laporanError } = await supabaseAdmin
      .from("lkh_laporan")
      .insert(laporanInsert)
      .select()
      .single()

    if (laporanError) {
      console.error("Error inserting lkh_laporan:", laporanError)
      return NextResponse.json({ error: laporanError.message }, { status: 500 })
    }

    // Insert baris kegiatan jika ada
    if (kegiatan && kegiatan.length > 0) {
      const kegiatanRows = kegiatan.map((k, idx) => ({
        laporan_id: laporan.id,
        tanggal: k.tanggal,
        uraian_tugas: k.uraian_tugas,
        realisasi: k.realisasi,
        urutan: k.urutan ?? idx + 1,
      }))

      const { error: kegiatanError } = await supabaseAdmin
        .from("lkh_kegiatan")
        .insert(kegiatanRows)

      if (kegiatanError) {
        console.error("Error inserting lkh_kegiatan:", kegiatanError)
        // Rollback laporan jika kegiatan gagal
        await supabaseAdmin.from("lkh_laporan").delete().eq("id", laporan.id)
        return NextResponse.json({ error: kegiatanError.message }, { status: 500 })
      }
    }

    // Kembalikan laporan beserta kegiatan
    const { data: result, error: fetchError } = await supabaseAdmin
      .from("lkh_laporan")
      .select(`*, kegiatan:lkh_kegiatan(*)`)
      .eq("id", laporan.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: laporan })
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    console.error("POST /api/lkh error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
