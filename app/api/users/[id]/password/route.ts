import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import { hashPassword, comparePasswords, verifyJWT } from "@/lib/auth-utils"
import { supabaseAdmin } from "@/lib/supabase"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Tunggu params.id sebelum menggunakannya
    const id = await params.id
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ message: "ID pengguna tidak valid" }, { status: 400 })
    }

    // Verifikasi session menggunakan cookie
    const cookieStore = cookies()
    const authToken = cookieStore.get("auth_token")?.value

    if (!authToken) {
      return NextResponse.json({ message: "Tidak terautentikasi" }, { status: 401 })
    }

    // Verifikasi JWT token
    const payload = await verifyJWT(authToken)
    if (!payload) {
      return NextResponse.json({ message: "Token tidak valid" }, { status: 401 })
    }

    // Ambil data dari request
    const requestBody = await request.json()
    const { current_password, new_password } = requestBody

    if (!current_password || !new_password) {
      return NextResponse.json({ message: "Password saat ini dan password baru diperlukan" }, { status: 400 })
    }

    if (new_password.length < 6) {
      return NextResponse.json({ message: "Password baru harus minimal 6 karakter" }, { status: 400 })
    }

    // Dapatkan user dari database menggunakan supabaseAdmin
    const { data: user, error: userError } = await supabaseAdmin
      .from("pegawai")
      .select("*")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("Error saat mengambil data pengguna:", userError)
      return NextResponse.json({ message: "Pengguna tidak ditemukan" }, { status: 404 })
    }

    // Pastikan hanya admin atau pengguna itu sendiri yang bisa mengganti password
    if (user.id !== payload.id && payload.role !== "admin") {
      return NextResponse.json({ message: "Tidak diizinkan mengubah password pengguna lain" }, { status: 403 })
    }

    // Verifikasi password saat ini
    const isPasswordValid = await comparePasswords(current_password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json({ message: "Password saat ini tidak valid" }, { status: 400 })
    }

    // Hash password baru
    const hashedPassword = await hashPassword(new_password)

    // Update password di database menggunakan supabaseAdmin
    const { error: updateError } = await supabaseAdmin
      .from("pegawai")
      .update({ password: hashedPassword })
      .eq("id", userId)

    if (updateError) {
      console.error("Error saat update password:", updateError)
      return NextResponse.json({ message: "Gagal mengupdate password" }, { status: 500 })
    }

    return NextResponse.json({ message: "Password berhasil diupdate" }, { status: 200 })
  } catch (error) {
    console.error("Error in password update:", error)
    return NextResponse.json({ message: "Terjadi kesalahan server" }, { status: 500 })
  }
}
