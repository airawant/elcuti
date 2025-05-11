import { NextResponse } from "next/server"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"
import { z } from "zod"
import { supabase } from "@/lib/supabase"

// Define validation schema for holidays
const holidaySchema = z.object({
  name: z.string().min(1, "Nama hari libur harus diisi"),
  date: z.string().min(1, "Tanggal harus diisi"),
  description: z.string().optional(),
})

// GET - Mengambil semua hari libur
export async function GET(request: Request) {
  try {
    // Get all holidays data
    const { data: holidays, error } = await supabase
      .from("holidays")
      .select("*")
      .order("date", { ascending: true })

    if (error) {
      console.error("Error fetching holidays:", error)
      return NextResponse.json({ error: "Gagal mengambil data hari libur" }, { status: 500 })
    }

    return NextResponse.json({
      data: holidays || [],
      pagination: {
        total: holidays?.length || 0,
        totalPages: 1
      }
    })
  } catch (error) {
    console.error("Error in GET /api/holidays:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// POST - Menambah hari libur baru
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = holidaySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Data tidak valid", details: validation.error.errors },
        { status: 400 }
      )
    }

    const { name, date, description } = body

    // Check if date already exists
    const { data: existingHoliday, error: checkError } = await supabase
      .from("holidays")
      .select("id")
      .eq("date", date)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing holiday:", checkError)
      return NextResponse.json({ error: "Gagal memeriksa tanggal" }, { status: 500 })
    }

    if (existingHoliday) {
      return NextResponse.json(
        { error: "Tanggal tersebut sudah terdaftar sebagai hari libur" },
        { status: 400 }
      )
    }

    // Insert new holiday
    const { data: holiday, error } = await supabase
      .from("holidays")
      .insert([{ name, date, description }])
      .select()
      .single()

    if (error) {
      console.error("Error creating holiday:", error)
      return NextResponse.json({ error: "Gagal menambah hari libur" }, { status: 500 })
    }

    return NextResponse.json(holiday)
  } catch (error) {
    console.error("Error in POST /api/holidays:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// PATCH - Mengupdate hari libur
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, name, date, description } = body

    if (!id || !name || !date) {
      return NextResponse.json(
        { error: "ID, nama, dan tanggal harus diisi" },
        { status: 400 }
      )
    }

    // Check if new date conflicts with existing holiday (excluding current holiday)
    const { data: existingHoliday, error: checkError } = await supabase
      .from("holidays")
      .select("id")
      .eq("date", date)
      .neq("id", id)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing holiday:", checkError)
      return NextResponse.json({ error: "Gagal memeriksa tanggal" }, { status: 500 })
    }

    if (existingHoliday) {
      return NextResponse.json(
        { error: "Tanggal tersebut sudah terdaftar sebagai hari libur" },
        { status: 400 }
      )
    }

    // Update holiday
    const { data: holiday, error } = await supabase
      .from("holidays")
      .update({ name, date, description })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating holiday:", error)
      return NextResponse.json({ error: "Gagal mengupdate hari libur" }, { status: 500 })
    }

    if (!holiday) {
      return NextResponse.json({ error: "Hari libur tidak ditemukan" }, { status: 404 })
    }

    return NextResponse.json(holiday)
  } catch (error) {
    console.error("Error in PATCH /api/holidays:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

// DELETE - Menghapus hari libur
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID harus diisi" }, { status: 400 })
    }

    const { error } = await supabase
      .from("holidays")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Error deleting holiday:", error)
      return NextResponse.json({ error: "Gagal menghapus hari libur" }, { status: 500 })
    }

    return NextResponse.json({ message: "Hari libur berhasil dihapus" })
  } catch (error) {
    console.error("Error in DELETE /api/holidays:", error)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
