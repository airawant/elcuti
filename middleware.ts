import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"

// Define protected routes
const adminRoutes = ["/admin", "/admin/dashboard", "/admin/users", "/admin/leave-requests", "/admin/settings"]
const userRoutes = ["/dashboard", "/leave-requests", "/profile", "/request-approval", "/guide"]
const authRoutes = ["/login"]
const protectedApiRoutes = ["/api/users", "/api/leave-requests", "/api/leave-balance"]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log("Middleware processing path:", pathname)

  // Get current user from JWT token
  const user = await getCurrentUser(request)
  console.log("Middleware user:", user ? `authenticated as ${user.role}` : "not authenticated")

  // Handle API routes first
  if (protectedApiRoutes.some(route => pathname.startsWith(route))) {
    if (!user) {
      console.log("API request rejected: not authenticated")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // Special handling for /api/users - allow admins and special users (approvers/authorized officers)
    if (pathname.startsWith("/api/users")) {
      if (user.role !== "admin" && user.role !== "user" && !user.isapprover && !user.isauthorizedofficer) {
        console.log("API request rejected: not admin/approver/authorized officer")
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }
  }

  // Redirect to login if accessing protected routes without authentication
  if (!user) {
    if ([...adminRoutes, ...userRoutes].some((route) => pathname.startsWith(route))) {
      console.log("Redirecting to login")
      const url = new URL("/login", request.url)
      url.searchParams.set("from", pathname)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Redirect to dashboard if accessing auth routes while authenticated
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    console.log("Redirecting authenticated user from auth route")
    const redirectUrl = user.role === "admin" ? "/admin/dashboard" : "/dashboard"
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  // Restrict admin routes to admin users
  if (adminRoutes.some((route) => pathname.startsWith(route)) && user.role !== "admin") {
    console.log("Non-admin accessing admin route, redirecting")
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
