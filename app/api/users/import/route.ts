import { type NextRequest, NextResponse } from "next/server"
import { hashPassword, getAuthCookie, verifyJWT } from "@/lib/auth-utils"
import { supabaseAdmin } from "@/lib/supabase"

// Tipe untuk row data import
interface ImportRow {
  nip: string
  name: string
  password: string
  role: string
  position?: string
  workunit?: string
  email?: string
  phone?: string
  address?: string
  isapprover?: string | boolean
  isauthorizedofficer?: string | boolean
  masa_kerja?: string
  tipe_pengguna?: string
  [key: string]: string | boolean | number | undefined
}

interface ImportError {
  row: number
  message: string
}

// Validasi email sederhana
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Validasi format tanggal YYYY-MM-DD
function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}

// Parse boolean dari string
function parseBool(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim()
    return lower === "true" || lower === "1" || lower === "ya" || lower === "yes"
  }
  return false
}

export async function POST(request: NextRequest) {
  try {
    // Autentikasi
    const token = await getAuthCookie()
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Hanya admin yang boleh import
    if (payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Server configuration error", details: "Admin operations not available" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const rows: ImportRow[] = body.data

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "Data kosong atau format tidak valid" },
        { status: 400 }
      )
    }

    // Ambil semua NIP yang sudah ada di database
    const { data: existingUsers, error: fetchError } = await supabaseAdmin
      .from("pegawai")
      .select("nip")

    if (fetchError) {
      console.error("[IMPORT] Error fetching existing users:", fetchError)
      return NextResponse.json(
        { error: "Gagal mengecek data existing", details: fetchError.message },
        { status: 500 }
      )
    }

    const existingNips = new Set((existingUsers || []).map((u: { nip: string }) => u.nip))

    const errors: ImportError[] = []
    const validRows: any[] = []

    // Validasi dan proses setiap baris
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // +2 karena baris 1 adalah header, index mulai dari 0

      // Validasi kolom wajib
      if (!row.nip || String(row.nip).trim() === "") {
        errors.push({ row: rowNum, message: "NIP wajib diisi" })
        continue
      }
      if (!row.name || String(row.name).trim() === "") {
        errors.push({ row: rowNum, message: "Nama wajib diisi" })
        continue
      }
      if (!row.password || String(row.password).trim() === "") {
        errors.push({ row: rowNum, message: "Password wajib diisi" })
        continue
      }
      if (!row.role || String(row.role).trim() === "") {
        errors.push({ row: rowNum, message: "Role wajib diisi" })
        continue
      }

      // Validasi role
      const role = String(row.role).toLowerCase().trim()
      if (role !== "admin" && role !== "user") {
        errors.push({ row: rowNum, message: `Role tidak valid: "${row.role}" (harus admin atau user)` })
        continue
      }

      // Validasi tipe_pengguna
      if (row.tipe_pengguna && String(row.tipe_pengguna).trim() !== "") {
        const tipe = String(row.tipe_pengguna).toUpperCase().trim()
        if (tipe !== "PNS" && tipe !== "PPPK") {
          errors.push({ row: rowNum, message: `Tipe pengguna tidak valid: "${row.tipe_pengguna}" (harus PNS atau PPPK)` })
          continue
        }
      }

      // Validasi email (opsional, tapi jika diisi harus valid)
      if (row.email && String(row.email).trim() !== "") {
        if (!isValidEmail(String(row.email).trim())) {
          errors.push({ row: rowNum, message: `Email tidak valid: "${row.email}"` })
          continue
        }
      }

      // Validasi masa_kerja (opsional, tapi jika diisi harus format YYYY-MM-DD)
      if (row.masa_kerja && String(row.masa_kerja).trim() !== "") {
        if (!isValidDate(String(row.masa_kerja).trim())) {
          errors.push({ row: rowNum, message: `Format masa kerja tidak valid: "${row.masa_kerja}" (harus YYYY-MM-DD)` })
          continue
        }
      }

      // Cek NIP duplikat di database
      const nipStr = String(row.nip).trim()
      if (existingNips.has(nipStr)) {
        errors.push({ row: rowNum, message: `NIP sudah digunakan: "${nipStr}"` })
        continue
      }

      // Cek NIP duplikat dalam file import itu sendiri
      const isDuplicateInFile = validRows.some((r) => r.nip === nipStr)
      if (isDuplicateInFile) {
        errors.push({ row: rowNum, message: `NIP duplikat dalam file: "${nipStr}"` })
        continue
      }

      // Validasi password minimal 6 karakter
      if (String(row.password).trim().length < 6) {
        errors.push({ row: rowNum, message: "Password minimal 6 karakter" })
        continue
      }

      // Konversi cuti_* ke leave_balance
      const leave_balance: Record<string, number> = {}
      Object.keys(row)
        .filter((key) => key.startsWith("cuti_"))
        .forEach((key) => {
          const year = key.replace("cuti_", "")
          const value = parseInt(String(row[key])) || 0
          leave_balance[year] = value
        })

      // Jika tidak ada kolom cuti_*, buat default leave_balance
      if (Object.keys(leave_balance).length === 0) {
        const currentYear = new Date().getFullYear()
        leave_balance[currentYear.toString()] = 12
        leave_balance[(currentYear - 1).toString()] = 12
        leave_balance[(currentYear - 2).toString()] = 0
      }

      // Hash password
      const hashedPassword = await hashPassword(String(row.password).trim())

      // Siapkan data untuk insert
      const tipe = row.tipe_pengguna
        ? String(row.tipe_pengguna).toUpperCase().trim()
        : "PNS"

      validRows.push({
        nip: nipStr,
        name: String(row.name).trim(),
        password: hashedPassword,
        role: role,
        position: row.position ? String(row.position).trim() : null,
        workunit: row.workunit ? String(row.workunit).trim() : null,
        email: row.email && String(row.email).trim() !== "" ? String(row.email).trim() : null,
        phone: row.phone ? String(row.phone).trim() : null,
        address: row.address ? String(row.address).trim() : null,
        isapprover: parseBool(row.isapprover),
        isauthorizedofficer: parseBool(row.isauthorizedofficer),
        masa_kerja: row.masa_kerja && String(row.masa_kerja).trim() !== ""
          ? String(row.masa_kerja).trim()
          : null,
        tipe_pengguna: tipe === "PNS" || tipe === "PPPK" ? tipe : "PNS",
        leave_balance: leave_balance,
      })

      // Tambahkan ke set NIP yang sudah ada agar tidak duplikat dalam batch
      existingNips.add(nipStr)
    }

    // Bulk insert jika ada data valid
    let successCount = 0
    if (validRows.length > 0) {
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from("pegawai")
        .insert(validRows)
        .select("id, nip, name, role, position, workunit, email, phone, address, masa_kerja, tipe_pengguna, isapprover, isauthorizedofficer, leave_balance")

      if (insertError) {
        console.error("[IMPORT] Bulk insert error:", insertError)
        // Jika bulk insert gagal, coba insert satu per satu
        for (let j = 0; j < validRows.length; j++) {
          const { error: singleError } = await supabaseAdmin
            .from("pegawai")
            .insert(validRows[j])

          if (singleError) {
            // Cari baris asli dari data untuk menentukan nomor baris
            const originalRowIndex = rows.findIndex(
              (r) => String(r.nip).trim() === validRows[j].nip
            )
            errors.push({
              row: originalRowIndex + 2,
              message: `Gagal menyimpan: ${singleError.message}`,
            })
          } else {
            successCount++
          }
        }
      } else {
        successCount = insertedData?.length || validRows.length
      }
    }

    return NextResponse.json({
      total: rows.length,
      success: successCount,
      failed: rows.length - successCount,
      errors: errors.sort((a, b) => a.row - b.row),
    })
  } catch (error) {
    console.error("[IMPORT] Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
