import { type NextRequest, NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"
import { generateLeaveRequestId } from "@/lib/leave-utils"
import { z } from "zod"

// Define validation schema for leave requests
const leaveRequestSchema = z.object({
  user_id: z.number(),
  type: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  reason: z.string().optional(),
  supervisor_id: z.number().optional(),
  authorized_officer_id: z.number().optional(),
  workingdays: z.number().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(["Pending", "Approved", "Rejected"]),
  supervisor_status: z.enum(["Pending", "Approved", "Rejected"]),
  authorized_officer_status: z.enum(["Pending", "Approved", "Rejected"]),
  supervisor_viewed: z.boolean(),
  authorized_officer_viewed: z.boolean(),
  supervisor_signed: z.boolean(),
  authorized_officer_signed: z.boolean(),
  saldo_carry: z.number(),
  saldo_current_year: z.number(),
  used_carry_over_days: z.number().optional(),
  used_current_year_days: z.number().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    console.log("User payload:", payload)

    // Fetch leave requests based on user role
    let query = supabaseAdmin
      .from("leave_requests")
      .select(`
        *,
        requester:user_id (
          id,
          name,
          position,
          workunit
        ),
        supervisor:supervisor_id (
          id,
          name,
          position
        ),
        authorized_officer:authorized_officer_id (
          id,
          name,
          position
        )
      `)

    // If user is not admin, show:
    // 1. Their own requests
    // 2. Requests where they are the supervisor (all statuses)
    // 3. Requests where they are the authorized officer (all statuses)
    if (payload.role !== "admin") {
      query = query.or(
        `user_id.eq.${payload.id},` +
        `supervisor_id.eq.${payload.id},` +
        `authorized_officer_id.eq.${payload.id}`
      )
    }

    // Add order by to show newest first and pending requests first
    query = query.order("status", { ascending: false })
               .order("created_at", { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error("Error fetching leave requests:", error)
      return NextResponse.json({
        error: "Failed to fetch leave requests",
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    if (!data) {
      console.log("No leave requests found")
      return NextResponse.json([], { status: 200 })
    }

    console.log("Successfully fetched leave requests:", data.length, "records")
    console.log("Sample leave request:", data[0])

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error("Fetch leave requests error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get and verify JWT token
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    console.log("Request body:", body)

    const leaveRequestData = leaveRequestSchema.parse(body)
    console.log("Validated leave request data:", leaveRequestData)

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    // Generate unique ID for leave request
    const leaveRequestId = generateLeaveRequestId(leaveRequestData.user_id)

    // Hitung hari kerja jika tidak disediakan
    if (!leaveRequestData.workingdays) {
      const startDate = new Date(leaveRequestData.start_date)
      const endDate = new Date(leaveRequestData.end_date)
      let workingDays = 0
      const currentDate = new Date(startDate)

      // Ambil data hari libur
      const { data: holidays } = await supabaseAdmin
        .from('holidays')
        .select('date')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])

      const holidayDates = new Set(holidays?.map(h => h.date) || [])

      while (currentDate <= endDate) {
        // Skip hari Sabtu (6) dan Minggu (0)
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
          // Skip hari libur nasional
          const dateString = currentDate.toISOString().split('T')[0]
          if (!holidayDates.has(dateString)) {
            workingDays++
          }
        }
        currentDate.setDate(currentDate.getDate() + 1)
      }

      leaveRequestData.workingdays = workingDays
      console.log("Calculated working days:", workingDays)
    }

    // Ambil data user untuk mendapatkan saldo cuti
    const { data: userData, error: userError } = await supabaseAdmin
      .from('pegawai')
      .select('leave_balance')
      .eq('id', leaveRequestData.user_id)
      .single()

    if (userError || !userData) {
      console.error("Error fetching user data:", userError)
      return NextResponse.json({
        error: "Failed to fetch user data",
        details: userError?.message || "User not found"
      }, { status: 500 })
    }

    // Ambil saldo cuti
    const leaveBalance = userData.leave_balance || {}
    console.log("User leave balance:", leaveBalance)

    const currentYear = new Date(leaveRequestData.start_date).getFullYear()
    const previousYear = currentYear - 1

    // Ambil saldo dari leave_balance pegawai
    const currentYearBalance = leaveBalance[currentYear.toString()] || 12
    const carryOverBalance = Math.min(6, leaveBalance[previousYear.toString()] || 0)
    console.log("Current year balance:", currentYearBalance)
    console.log("Carry over balance:", carryOverBalance)

    // Ambil penggunaan cuti yang sudah ada
    const { data: existingLeaves, error: leavesError } = await supabaseAdmin
      .from('leave_requests')
      .select('workingdays, start_date, used_carry_over_days, used_current_year_days')
      .eq('user_id', leaveRequestData.user_id)
      .eq('status', 'Approved')
      .eq('type', 'Cuti Tahunan')

    if (leavesError) {
      console.error("Error fetching existing leaves:", leavesError)
      return NextResponse.json({
        error: "Failed to fetch existing leaves",
        details: leavesError.message
      }, { status: 500 })
    }

    // Hitung penggunaan cuti yang sudah ada
    const existingUsage = existingLeaves?.reduce((acc, leave) => {
      const leaveYear = new Date(leave.start_date).getFullYear()
      if (leaveYear === currentYear) {
        acc.carryOver += leave.used_carry_over_days || 0
        acc.currentYear += leave.used_current_year_days || 0
      }
      return acc
    }, { carryOver: 0, currentYear: 0 }) || { carryOver: 0, currentYear: 0 }

    console.log("Existing usage:", existingUsage)

    // Hitung penggunaan untuk permintaan baru
    const workingDays = leaveRequestData.workingdays || 0
    let usedCarryOver = 0
    let usedCurrentYear = 0

    // Jika masih ada saldo carry-over, gunakan itu dulu
    const remainingCarryOver = Math.max(0, carryOverBalance - existingUsage.carryOver)
    if (remainingCarryOver > 0) {
      usedCarryOver = Math.min(remainingCarryOver, workingDays)
      usedCurrentYear = workingDays - usedCarryOver
    } else {
      // Jika tidak ada sisa carry-over, gunakan saldo tahun berjalan
      usedCurrentYear = workingDays
    }

    console.log("Leave balance calculation:", {
      currentYear,
      previousYear,
      currentYearBalance,
      carryOverBalance,
      existingUsage,
      workingDays,
      remainingCarryOver,
      usedCarryOver,
      usedCurrentYear,
      remainingCurrentYear: currentYearBalance - existingUsage.currentYear - usedCurrentYear
    })

    // Validasi saldo cuti
    const remainingCurrentYear = currentYearBalance - existingUsage.currentYear - usedCurrentYear
    if (remainingCurrentYear < 0) {
      return NextResponse.json({
        error: "Insufficient leave balance",
        details: `Saldo cuti tidak mencukupi. Sisa saldo: ${remainingCurrentYear + usedCurrentYear} hari, permintaan: ${workingDays} hari`
      }, { status: 400 })
    }

    // Potong saldo cuti di tabel pegawai
    const updatedLeaveBalance = { ...leaveBalance }

    // Potong saldo carry over jika digunakan
    if (usedCarryOver > 0) {
      const prevYearStr = previousYear.toString()
      updatedLeaveBalance[prevYearStr] = Math.max(0, (updatedLeaveBalance[prevYearStr] || 0) - usedCarryOver)
    }

    // Potong saldo tahun berjalan
    if (usedCurrentYear > 0) {
      const currentYearStr = currentYear.toString()
      updatedLeaveBalance[currentYearStr] = Math.max(0, (updatedLeaveBalance[currentYearStr] || 12) - usedCurrentYear)
    }

    // Update saldo di tabel pegawai
    const { error: updateBalanceError } = await supabaseAdmin
      .from('pegawai')
      .update({ leave_balance: updatedLeaveBalance })
      .eq('id', leaveRequestData.user_id)

    if (updateBalanceError) {
      console.error("Error updating leave balance:", updateBalanceError)
      return NextResponse.json({
        error: "Failed to update leave balance",
        details: updateBalanceError.message
      }, { status: 500 })
    }

    // Insert leave request into database using admin client
    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .insert({
        id: leaveRequestId,
        ...leaveRequestData,
        saldo_carry: carryOverBalance,
        saldo_current_year: currentYearBalance,
        created_at: new Date().toISOString(),
        used_carry_over_days: usedCarryOver,
        used_current_year_days: usedCurrentYear,
        leave_year: currentYear
      })
      .select()
      .single()

    if (error) {
      console.error("Error menyimpan permintaan cuti:", error)
      return NextResponse.json({
        error: "Failed to create leave request",
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    console.log("Permintaan cuti berhasil dibuat:", data)
    return NextResponse.json({ message: "Leave request created successfully", leaveRequest: data }, { status: 201 })
  } catch (error) {
    console.error("Create leave request error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()
    const { leaveRequestId, action, type, rejectionReason, signatureDate, signed } = body

    console.log("PATCH request received with data:", {
      leaveRequestId,
      action,
      type,
      rejectionReason: rejectionReason ? "provided" : "not provided",
      signatureDate: signatureDate ? "provided" : "not provided",
      signed
    })

    if (!leaveRequestId || !action || !type) {
      const missingFields = [];
      if (!leaveRequestId) missingFields.push("leaveRequestId");
      if (!action) missingFields.push("action");
      if (!type) missingFields.push("type");

      console.error("Missing required fields:", missingFields.join(", "));
      return NextResponse.json({
        error: "Missing required fields",
        details: `Missing: ${missingFields.join(", ")}`
      }, { status: 400 })
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized")
    }

    // Fetch current leave request
    console.log("Fetching leave request with ID:", leaveRequestId);
    const { data: currentRequest, error: fetchError } = await supabaseAdmin
      .from("leave_requests")
      .select(`
        *,
        requester:user_id (
          id,
          name,
          email,
          position,
          workunit,
          nip,
          address,
          phone
        ),
        supervisor:supervisor_id (
          id,
          name,
          nip
        ),
        authorized_officer:authorized_officer_id (
          id,
          name,
          nip
        )
      `)
      .eq("id", leaveRequestId)
      .single()

    if (fetchError) {
      console.error("Error fetching leave request:", {
        error: fetchError,
        leaveRequestId,
        message: fetchError.message,
        code: fetchError.code
      });
      return NextResponse.json({
        error: "Leave request not found",
        details: fetchError.message,
        code: fetchError.code
      }, { status: 404 })
    }

    if (!currentRequest) {
      console.error("Leave request not found with ID:", leaveRequestId);
      return NextResponse.json({ error: "Leave request not found", details: "No data returned from database" }, { status: 404 })
    }

    // Check if user has permission to approve/reject
    const isSupervisor = currentRequest.supervisor_id === payload.id
    const isAuthorizedOfficer = currentRequest.authorized_officer_id === payload.id

    if (!isSupervisor && !isAuthorizedOfficer && payload.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized to perform this action" }, { status: 403 })
    }

    // Prepare update data
    const updateData: any = {};

    // Update berdasarkan tipe approver
    if (type === "supervisor") {
      updateData.supervisor_status = action;
      updateData.supervisor_viewed = true;
      if (action === "Approved") {
        updateData.supervisor_signed = signed;
        updateData.supervisor_signature_date = signatureDate;
      } else if (action === "Rejected") {
        updateData.status = "Rejected";
        updateData.rejection_reason = rejectionReason;
      }
    } else if (type === "authorized_officer") {
      updateData.authorized_officer_status = action;
      updateData.authorized_officer_viewed = true;
      if (action === "Approved") {
        updateData.status = "Approved";
        updateData.authorized_officer_signed = signed;
        updateData.authorized_officer_signature_date = signatureDate;

        // Kirim data ke Google Script ketika disetujui oleh authorized officer
        try {
          const googleScriptEndpoint = process.env.GOOGLE_SCRIPT_ENDPOINT as string;

          if (!googleScriptEndpoint) {
            console.error("Google Script Endpoint tidak dikonfigurasi");
          } else {
            // Siapkan data untuk dikirim ke Google Script
        const requestData = {
              id: currentRequest.id,
          namapegawai: currentRequest.requester?.name || "",
          jabatan: currentRequest.requester?.position || "",
          unit: currentRequest.requester?.workunit || "",
          nip_pegawai: currentRequest.requester?.nip || "",
          jenisCuti: currentRequest.type,
          tanggalMulai: currentRequest.start_date,
          tanggalSelesai: currentRequest.end_date,
          jumlahHari: currentRequest.workingdays,
          alasan: currentRequest.reason || "",
              saldoawal_n1: currentRequest.saldo_carry,
              saldo_ntahun: currentRequest.saldo_current_year,
          nama_supervisor: currentRequest.supervisor?.name || "",
          nip_supervisor: currentRequest.supervisor?.nip || "",
          nama_officier: currentRequest.authorized_officer?.name || "",
          nip_officier: currentRequest.authorized_officer?.nip || "",
          created_at: currentRequest.created_at,
          alamat: currentRequest.requester?.address || currentRequest.address || "",
          telp: currentRequest.requester?.phone || currentRequest.phone || ""
        };

            console.log("Mengirim data ke Google Script:", requestData);

            // Set timeout 30 detik
        const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              controller.abort();
              console.log("Request ke Google Script timeout setelah 30 detik");
            }, 30000);

          const response = await fetch(googleScriptEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
              signal: controller.signal,
              keepalive: true
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Script returned error:", {
              status: response.status,
              statusText: response.statusText,
              body: errorText
            });
          } else {
            const responseText = await response.text();
            try {
              if (responseText.trim()) {
                  const responseData = JSON.parse(responseText);
                  console.log("Response dari Google Script:", responseData);

                  // Jika ada link file, tambahkan ke updateData
                  if (responseData?.success && responseData?.data) {
                    updateData.link_file = responseData.data;
                    console.log("Link file akan disimpan:", responseData.data);
                  }
                }
              } catch (jsonError) {
                console.log("Response non-JSON dari Google Script:", responseText);
              }
            }
          }
        } catch (error) {
          console.error("Error saat mengirim ke Google Script:", error);
          // Lanjutkan proses meskipun ada error
        }
      } else if (action === "Rejected") {
        updateData.status = "Rejected";
        updateData.rejection_reason = rejectionReason;
      }
    }

    // Update status permintaan cuti
    const { error: updateError } = await supabaseAdmin
      .from("leave_requests")
      .update(updateData)
      .eq("id", leaveRequestId);

    if (updateError) {
      console.error("Error updating leave request:", updateError);
      return NextResponse.json(
        { error: "Failed to update leave request" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Leave request updated successfully" });

  } catch (error) {
    console.error("Error in PATCH /api/leave-requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
