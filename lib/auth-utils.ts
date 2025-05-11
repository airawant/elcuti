import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const secretKey = new TextEncoder().encode(JWT_SECRET)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword)
  } catch (error) {
    console.error("Error comparing passwords:", error)
    return false
  }
}

export async function createJWT(payload: any): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d") // Token expires in 1 day
    .sign(secretKey)
}

export async function verifyJWT(token: string | undefined) {
  try {
    if (!token) {
      console.log("verifyJWT: No token provided")
      return null
    }

    // Ensure token is a string and has proper length
    if (typeof token !== 'string' || token.length < 20) {
      console.log("verifyJWT: Invalid token format")
      return null
    }

    console.log("Verifying JWT token:", token.substring(0, 20) + "...")
    const { payload } = await jwtVerify(token, secretKey)
    console.log("JWT verification successful, payload:", JSON.stringify(payload, null, 2))
    return payload
  } catch (error) {
    console.error("JWT verification failed:", error)
    return null
  }
}

export function setAuthCookie(response: NextResponse, token: string) {
  console.log("Setting auth cookie with token:", token.substring(0, 20) + "...")

  // Set cookie with more permissive options for debugging
  response.cookies.set({
    name: "auth_token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 day
    path: "/",
  })

  // Log all response headers for debugging
  console.log("Response headers after setting cookie:",
    Object.fromEntries(response.headers.entries())
  )

  return response
}

export async function getAuthCookie() {
  try {
    console.log("Getting auth cookie...")
    const cookieStore = await cookies()
    const cookie = cookieStore.get("auth_token")

    if (!cookie?.value) {
      console.log("No auth cookie found")
      return undefined
    }

    console.log("Cookie store result:", {
      name: cookie.name,
      value: cookie.value.substring(0, 20) + "..."
    })

    return cookie.value
  } catch (error) {
    console.error("Error reading cookie:", error)
    return undefined
  }
}

export function removeAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: "auth_token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  })
  return response
}

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value
  if (!token) return null

  const payload = await verifyJWT(token)
  return payload
}
