import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { comparePasswords, createJWT, setAuthCookie } from "@/lib/auth-utils"
import { z } from "zod"

// Define validation schema
const loginSchema = z.object({
  nip: z.string().min(1, "NIP is required"),
  password: z.string().min(1, "Password is required"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validationResult = loginSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.flatten() },
        { status: 400 },
      )
    }

    const { nip, password } = validationResult.data
    console.log("Login attempt for NIP:", nip)

    // Fetch user from database
    const { data: user, error } = await supabase.from("pegawai").select("*").eq("nip", nip).single()

    if (error || !user) {
      console.log("User not found:", nip)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    const isPasswordValid = await comparePasswords(password, user.password)
    if (!isPasswordValid) {
      console.log("Invalid password for user:", nip)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user

    // Create JWT token
    const token = await createJWT(userWithoutPassword)
    console.log("JWT token created successfully")

    // Create response with necessary headers
    const response = NextResponse.json(
      { message: "Login successful", user: userWithoutPassword },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    )

    // Set auth cookie
    console.log("Setting auth cookie...")
    setAuthCookie(response, token)
    console.log("Auth cookie headers:", response.headers.get("set-cookie"))

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
