import { type NextRequest, NextResponse } from "next/server"
import { supabase, supabaseAdmin } from "@/lib/supabase"
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils"
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

    const currentYearBalance = 12 // Saldo awal tahun berjalan
    const carryOverBalance = Math.min(6, leaveBalance?.[previousYear.toString()] || 0)
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

    // Insert leave request into database using admin client
    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .insert({
        ...leaveRequestData,
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
    const updateData: any = {}

    if (type === "supervisor") {
      updateData.supervisor_status = action
      updateData.supervisor_viewed = true
      updateData.supervisor_signed = signed
      updateData.supervisor_signature_date = signatureDate
      if (action === "Rejected") {
        updateData.status = "Rejected"
        updateData.rejection_reason = rejectionReason
      }
    } else if (type === "authorized_officer") {
      updateData.authorized_officer_status = action
      updateData.authorized_officer_viewed = true
      updateData.authorized_officer_signed = signed
      updateData.authorized_officer_signature_date = signatureDate
      if (action === "Rejected") {
        updateData.status = "Rejected"
        updateData.rejection_reason = rejectionReason
      }
    }

    // If both supervisor and authorized officer approved, update main status
    if (
      (type === "supervisor" && action === "Approved" && currentRequest.authorized_officer_status === "Approved") ||
      (type === "authorized_officer" && action === "Approved" && currentRequest.supervisor_status === "Approved")
    ) {
      updateData.status = "Approved"

      // Update leave balance when request is fully approved
      if (currentRequest.type === "Cuti Tahunan") {
        // Fetch current user's leave balance
        const { data: userData, error: userError } = await supabaseAdmin
          .from('pegawai')
          .select('leave_balance')
          .eq('id', currentRequest.user_id)
          .single()

        if (userError) {
          console.error("Error fetching user leave balance:", userError)
          return NextResponse.json({ error: "Failed to update leave balance" }, { status: 500 })
        }

        const leaveYear = new Date(currentRequest.start_date).getFullYear().toString()
        const leaveBalance = userData?.leave_balance || {}

        // Update leave balance for the year
        if (currentRequest.used_current_year_days > 0) {
          leaveBalance[leaveYear] = (leaveBalance[leaveYear] || 12) - currentRequest.used_current_year_days
        }

        // Update previous year's balance if carry-over days were used
        if (currentRequest.used_carry_over_days > 0) {
          const previousYear = (parseInt(leaveYear) - 1).toString()
          if (leaveBalance[previousYear]) {
            leaveBalance[previousYear] = Math.max(0, leaveBalance[previousYear] - currentRequest.used_carry_over_days)
          }
        }

        // Save updated leave balance
        const { error: updateError } = await supabaseAdmin
          .from('pegawai')
          .update({ leave_balance: leaveBalance })
          .eq('id', currentRequest.user_id)

        if (updateError) {
          console.error("Error updating leave balance:", updateError)
          return NextResponse.json({ error: "Failed to update leave balance" }, { status: 500 })
        }

        console.log("Leave balance updated:", {
          userId: currentRequest.user_id,
          oldBalance: userData?.leave_balance,
          newBalance: leaveBalance,
          usedCurrentYear: currentRequest.used_current_year_days,
          usedCarryOver: currentRequest.used_carry_over_days
        })
      }

      // Notifikasi ke Google Script ketika cuti disetujui
      try {
        const googleScriptEndpoint = "https://script.google.com/macros/s/AKfycbxqZdhvNnZS1NS-uQP6cDQRw0raielTh8LQGijI5vPZKSMLxENnFl8FVuTIpDHNw5IRJg/exec";

        // Pastikan data requester, supervisor, dan authorized officer ada
        if (!currentRequest.requester) {
          console.error("Data requester tidak ditemukan:", currentRequest);
          throw new Error("Data requester tidak ditemukan");
        }

        if (!currentRequest.supervisor) {
          console.error("Data supervisor tidak ditemukan:", currentRequest);
          // Tidak throw error, tetap lanjutkan proses
        }

        if (!currentRequest.authorized_officer) {
          console.error("Data authorized officer tidak ditemukan:", currentRequest);
          // Tidak throw error, tetap lanjutkan proses
        }

        // Fetch leave balance info for the current and previous year
        const { data: userBalanceData, error: balanceError } = await supabaseAdmin
          .from('pegawai')
          .select('leave_balance')
          .eq('id', currentRequest.user_id)
          .single();

        if (balanceError) {
          console.error("Error fetching leave balance for notification:", balanceError);
        }

        const leaveBalance = userBalanceData?.leave_balance || {};
        const currentYear = new Date(currentRequest.start_date).getFullYear();
        const previousYear = currentYear - 1;

        const previousYearBalance = leaveBalance[previousYear.toString()] || 0;
        const currentYearBalance = leaveBalance[currentYear.toString()] || 12;

        // Log data yang akan dikirim untuk debugging
        console.log("Data untuk Google Script:", {
          user_id: currentRequest.user_id,
          requester: currentRequest.requester,
          supervisor: currentRequest.supervisor,
          authorizedOfficer: currentRequest.authorized_officer,
          leaveBalance,
          previousYearBalance,
          currentYearBalance
        });

        // Menyiapkan data untuk dikirim ke Google Script sesuai permintaan
        const requestData = {
          namapegawai: currentRequest.requester?.name || "",
          jabatan: currentRequest.requester?.position || "",
          unit: currentRequest.requester?.workunit || "",
          nip_pegawai: currentRequest.requester?.nip || "",
          jenisCuti: currentRequest.type,
          tanggalMulai: currentRequest.start_date,
          tanggalSelesai: currentRequest.end_date,
          jumlahHari: currentRequest.workingdays,
          alasan: currentRequest.reason || "",
          saldoawal_n1: previousYearBalance,
          saldo_ntahun: currentYearBalance,
          nama_supervisor: currentRequest.supervisor?.name || "",
          nip_supervisor: currentRequest.supervisor?.nip || "",
          nama_officier: currentRequest.authorized_officer?.name || "",
          nip_officier: currentRequest.authorized_officer?.nip || "",
          created_at: currentRequest.created_at,
          alamat: currentRequest.requester?.address || currentRequest.address || "",
          telp: currentRequest.requester?.phone || currentRequest.phone || ""
        };

        console.log("Sending notification to Google Script with data:", requestData);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 detik timeout

        try {
          const response = await fetch(googleScriptEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          console.log("Google Script response status:", response.status, response.statusText);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Google Script returned error:", {
              status: response.status,
              statusText: response.statusText,
              body: errorText
            });
          } else {
            let responseData;
            const responseText = await response.text();

            try {
              if (responseText.trim()) {
                responseData = JSON.parse(responseText);
                console.log("Notifikasi Google Script berhasil dengan respons JSON:", responseData);
              } else {
                console.log("Notifikasi Google Script berhasil dengan respons kosong");
              }
            } catch (jsonError) {
              console.log("Notifikasi Google Script berhasil dengan respons non-JSON:", responseText);
            }
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error("Error saat fetch ke Google Script:", fetchError);

          // Log data tambahan untuk debugging
          console.log("Request data yang gagal dikirim:", JSON.stringify(requestData, null, 2));
        }
      } catch (error) {
        console.error("Error pada proses notifikasi ke Google Script:", error);
        // Error dalam notifikasi tidak menggagalkan proses utama
      }
    }

    // Update leave request
    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .update(updateData)
      .eq("id", leaveRequestId)
      .select()
      .single()

    if (error) {
      console.error("Error updating leave request:", error)
      return NextResponse.json({ error: "Failed to update leave request", details: error.message }, { status: 500 })
    }

    console.log("Leave request updated successfully:", data)
    return NextResponse.json({ message: "Leave request updated successfully", leaveRequest: data }, { status: 200 })
  } catch (error) {
    console.error("Update leave request error:", error)
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
