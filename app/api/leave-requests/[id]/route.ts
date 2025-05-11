import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"
import { z } from "zod"

// Define validation schema for leave request updates
const leaveRequestUpdateSchema = z.object({
  approverType: z.enum(["supervisor", "authorized_officer"]),
  status: z.enum(["Approved", "Rejected"]),
  rejectionReason: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await getAuthCookie()

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = leaveRequestUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation error", details: validationResult.error.flatten() },
        { status: 400 },
      )
    }

    const { approverType, status, rejectionReason } = validationResult.data

    // Fetch the leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", Number.parseInt(params.id))
      .single()

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch leave request", details: fetchError.message }, { status: 500 })
    }

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Check if user is authorized to update this leave request
    if (approverType === "supervisor" && leaveRequest.supervisor_id !== payload.id && payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (
      approverType === "authorized_officer" &&
      leaveRequest.authorized_officer_id !== payload.id &&
      payload.role !== "admin"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {}

    if (approverType === "supervisor") {
      updateData.supervisor_status = status
      updateData.supervisor_viewed = true
      updateData.supervisor_signed = true
      updateData.supervisor_signature_date = new Date().toISOString()

      // If supervisor rejects, the whole request is rejected
      if (status === "Rejected") {
        updateData.status = "Rejected"
        if (rejectionReason) {
          updateData.rejection_reason = rejectionReason
        }
      }
      // If supervisor approves, we wait for authorized officer
      else if (status === "Approved") {
        // Keep overall status as pending until authorized officer approves
        updateData.status = "Pending"
      }
    } else if (approverType === "authorized_officer") {
      updateData.authorized_officer_status = status
      updateData.authorized_officer_viewed = true
      updateData.authorized_officer_signed = true
      updateData.authorized_officer_signature_date = new Date().toISOString()

      // Authorized officer can only act if supervisor has approved
      if (leaveRequest.supervisor_status === "Approved") {
        if (status === "Approved") {
          updateData.status = "Approved"
        } else if (status === "Rejected") {
          updateData.status = "Rejected"
          if (rejectionReason) {
            updateData.rejection_reason = rejectionReason
          }
        }
      }
    }

    // Update leave request in database
    const { data, error } = await supabase
      .from("leave_requests")
      .update(updateData)
      .eq("id", Number.parseInt(params.id))
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update leave request", details: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("Update leave request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await getAuthCookie()

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Fetch the leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", Number.parseInt(params.id))
      .single()

    if (fetchError) {
      return NextResponse.json({ error: "Failed to fetch leave request", details: fetchError.message }, { status: 500 })
    }

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 })
    }

    // Check if user is authorized to view this leave request
    if (
      payload.role !== "admin" &&
      leaveRequest.user_id !== payload.id &&
      leaveRequest.supervisor_id !== payload.id &&
      leaveRequest.authorized_officer_id !== payload.id
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json(leaveRequest, { status: 200 })
  } catch (error) {
    console.error("Fetch leave request error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
