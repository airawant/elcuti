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

const duplicateLaporanSchema = z.object({
  bulan: z.number().int().min(1).max(12).optional(),
  tahun: z.number().int().min(2020).optional(),
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

async function isPeriodTaken(userId: number, bulan: number, tahun: number) {
  if (!supabaseAdmin) throw new Error("Supabase admin client not initialized")

  const { data, error } = await supabaseAdmin
    .from("lkh_laporan")
    .select("id")
    .eq("user_id", userId)
    .eq("bulan", bulan)
    .eq("tahun", tahun)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

async function findNextAvailablePeriod(userId: number, startBulan: number, startTahun: number) {
  let bulan = startBulan
  let tahun = startTahun

  for (let i = 0; i < 24; i++) {
    if (!(await isPeriodTaken(userId, bulan, tahun))) {
      return { bulan, tahun }
    }
    bulan += 1
    if (bulan > 12) {
      bulan = 1
      tahun += 1
    }
  }

  return null
}

// ─── GET: Detail satu laporan ─────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const laporanId = Number(resolvedParams.id)
    if (isNaN(laporanId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
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
    const resolvedParams = await Promise.resolve(params);
    const laporanId = Number(resolvedParams.id)
    if (isNaN(laporanId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
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

// ─── POST: Duplikasi laporan menjadi laporan baru ───────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const laporanId = Number(resolvedParams.id)
    if (isNaN(laporanId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    const userId = Number(payload.id)

    const sourceLaporan = await getLaporanForUser(laporanId, userId)
    if (!sourceLaporan) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = duplicateLaporanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const explicitPeriod = parsed.data.bulan !== undefined && parsed.data.tahun !== undefined
    let targetBulan = parsed.data.bulan ?? sourceLaporan.bulan
    let targetTahun = parsed.data.tahun ?? sourceLaporan.tahun

    if (explicitPeriod) {
      if (await isPeriodTaken(userId, targetBulan, targetTahun)) {
        return NextResponse.json(
          { error: "Laporan untuk periode ini sudah ada. Pilih bulan/tahun lain." },
          { status: 409 }
        )
      }
    } else {
      let nextBulan = sourceLaporan.bulan + 1
      let nextTahun = sourceLaporan.tahun
      if (nextBulan > 12) {
        nextBulan = 1
        nextTahun += 1
      }

      const availablePeriod = await findNextAvailablePeriod(userId, nextBulan, nextTahun)
      if (!availablePeriod) {
        return NextResponse.json(
          { error: "Tidak ada periode kosong dalam 24 bulan ke depan." },
          { status: 409 }
        )
      }

      targetBulan = availablePeriod.bulan
      targetTahun = availablePeriod.tahun
    }

    const { data: sourceKegiatan, error: kegiatanError } = await supabaseAdmin
      .from("lkh_kegiatan")
      .select("tanggal, uraian_tugas, realisasi, urutan")
      .eq("laporan_id", laporanId)
      .order("urutan", { ascending: true })

    if (kegiatanError) {
      return NextResponse.json({ error: kegiatanError.message }, { status: 500 })
    }

    const { data: newLaporan, error: insertError } = await supabaseAdmin
      .from("lkh_laporan")
      .insert({
        user_id: userId,
        approver_id: sourceLaporan.approver_id,
        bulan: targetBulan,
        tahun: targetTahun,
        dasar: sourceLaporan.dasar,
        status: "draft",
        pdf_url: null,
        approval_note: null,
        approved_at: null,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    if (sourceKegiatan && sourceKegiatan.length > 0) {
      const kegiatanRows = sourceKegiatan.map((k, idx) => ({
        laporan_id: newLaporan.id,
        tanggal: k.tanggal,
        uraian_tugas: k.uraian_tugas,
        realisasi: k.realisasi,
        urutan: k.urutan ?? idx + 1,
      }))

      const { error: copyKegiatanError } = await supabaseAdmin
        .from("lkh_kegiatan")
        .insert(kegiatanRows)

      if (copyKegiatanError) {
        await supabaseAdmin.from("lkh_laporan").delete().eq("id", newLaporan.id)
        return NextResponse.json({ error: copyKegiatanError.message }, { status: 500 })
      }
    }

    const { data: result, error: fetchError } = await supabaseAdmin
      .from("lkh_laporan")
      .select(`
        *,
        approver:approver_id (
          id, name, nip, position, workunit
        ),
        kegiatan:lkh_kegiatan (
          id, tanggal, uraian_tugas, realisasi, urutan, created_at
        )
      `)
      .eq("id", newLaporan.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ data: newLaporan }, { status: 201 })
    }

    if (result.kegiatan) {
      result.kegiatan.sort((a: { urutan: number }, b: { urutan: number }) => a.urutan - b.urutan)
    }

    return NextResponse.json(
      {
        data: result,
        message: "Laporan berhasil diduplikasi sebagai draft baru",
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("POST /api/lkh/[id] duplicate error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── DELETE: Hapus laporan ────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const laporanId = Number(resolvedParams.id)
    if (isNaN(laporanId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
    }

    const payload = await authenticate(request)
    if (!payload) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
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
