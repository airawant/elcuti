import { type NextRequest, NextResponse } from "next/server"
import { removeAuthCookie } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ message: "Logged out successfully" }, { status: 200 })

    // Remove auth cookie
    removeAuthCookie(response)

    return response
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

