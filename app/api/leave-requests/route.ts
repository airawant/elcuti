import { type NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { getAuthCookie, verifyJWT } from "@/lib/auth-utils";
import { generateLeaveRequestId } from "@/lib/leave-utils";
import { z } from "zod";

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
  saldo_n2_year: z.number().optional(),
  used_carry_over_days: z.number().optional(),
  used_current_year_days: z.number().optional(),
  used_n2_year: z.number().optional(),
  file_lampiran: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const payload = await verifyJWT(token);

    if (!payload || !payload.id) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized");
    }

    console.log("User payload:", payload);

    // Fetch leave requests based on user role
    let query = supabaseAdmin.from("leave_requests").select(`
        *,
        requester:user_id (
          id,
          name,
          position,
          workunit,
          tipe_pengguna
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
      `);

    // If user is not admin, show:
    // 1. Their own requests
    // 2. Requests where they are the supervisor (all statuses)
    // 3. Requests where they are the authorized officer (all statuses)
    if (payload.role !== "admin") {
      query = query.or(
        `user_id.eq.${payload.id},` +
          `supervisor_id.eq.${payload.id},` +
          `authorized_officer_id.eq.${payload.id}`
      );
    }

    // Add order by to show newest first and pending requests first
    query = query
      .order("status", { ascending: false })
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching leave requests:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch leave requests",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    if (!data) {
      console.log("No leave requests found");
      return NextResponse.json([], { status: 200 });
    }

    console.log("Successfully fetched leave requests:", data.length, "records");
    console.log("Sample leave request:", data[0]);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Fetch leave requests error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get and verify JWT token
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    console.log("Request body:", body);

    const leaveRequestData = leaveRequestSchema.parse(body);
    console.log("Validated leave request data:", leaveRequestData);

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized");
    }

    // Generate unique ID for leave request
    const leaveRequestId = generateLeaveRequestId(leaveRequestData.user_id);

    // Hitung hari kerja jika tidak disediakan
    if (!leaveRequestData.workingdays) {
      const startDate = new Date(leaveRequestData.start_date);
      const endDate = new Date(leaveRequestData.end_date);
      let workingDays = 0;
      const currentDate = new Date(startDate);

      // Ambil data hari libur
      const { data: holidays } = await supabaseAdmin
        .from("holidays")
        .select("date")
        .gte("date", startDate.toISOString().split("T")[0])
        .lte("date", endDate.toISOString().split("T")[0]);

      const holidayDates = new Set(holidays?.map((h) => h.date) || []);

      while (currentDate <= endDate) {
        // Skip hari Sabtu (6) dan Minggu (0)
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
          // Skip hari libur nasional
          const dateString = currentDate.toISOString().split("T")[0];
          if (!holidayDates.has(dateString)) {
            workingDays++;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      leaveRequestData.workingdays = workingDays;
      console.log("Calculated working days:", workingDays);
    }

    // Ambil data user untuk mendapatkan saldo cuti
    const { data: userData, error: userError } = await supabaseAdmin
      .from("pegawai")
      .select("leave_balance")
      .eq("id", leaveRequestData.user_id)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user data:", userError);
      return NextResponse.json(
        {
          error: "Failed to fetch user data",
          details: userError?.message || "User not found",
        },
        { status: 500 }
      );
    }

    // Ambil saldo cuti
    const leaveBalance = userData.leave_balance || {};
    console.log("User leave balance:", leaveBalance);

    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const twoYearsAgo = currentYear - 2;

    // Ambil saldo dari leave_balance pegawai
    const currentYearBalance = leaveBalance[currentYear.toString()] || 12;
    const carryOverBalance = Math.min(6, leaveBalance[previousYear.toString()] || 0);
    const twoYearsAgoBalance = Math.min(6, leaveBalance[twoYearsAgo.toString()] || 0);
    console.log("Current year balance:", currentYearBalance);
    console.log("Carry over balance:", carryOverBalance);
    console.log("Two years ago balance:", twoYearsAgoBalance);

    // Ambil penggunaan cuti yang sudah ada
    const { data: existingLeaves, error: leavesError } = await supabaseAdmin
      .from("leave_requests")
      .select(
        "workingdays, start_date, used_carry_over_days, used_current_year_days, used_n2_year"
      )
      .eq("user_id", leaveRequestData.user_id)
      .eq("status", "Approved")
      .eq("type", "Cuti Tahunan");

    if (leavesError) {
      console.error("Error fetching existing leaves:", leavesError);
      return NextResponse.json(
        {
          error: "Failed to fetch existing leaves",
          details: leavesError.message,
        },
        { status: 500 }
      );
    }

    // Hitung penggunaan untuk permintaan baru
    const workingDays = leaveRequestData.workingdays || 0;

    // Gunakan data yang dikirim dari frontend
    let usedTwoYearsAgo = leaveRequestData.used_n2_year || 0;
    let usedCarryOver = leaveRequestData.used_carry_over_days || 0;
    let usedCurrentYear = leaveRequestData.used_current_year_days || 0;

    // Validasi bahwa data dari frontend sudah benar
    const totalUsedFromFrontend = usedTwoYearsAgo + usedCarryOver + usedCurrentYear;

    // Jika data dari frontend tidak lengkap atau tidak sesuai, hitung ulang
    if (
      totalUsedFromFrontend !== workingDays ||
      (usedTwoYearsAgo === 0 && usedCarryOver === 0 && usedCurrentYear === 0)
    ) {
      console.log("Data dari frontend tidak lengkap, menghitung ulang...");

      // Ambil penggunaan cuti yang sudah ada untuk tahun ini
      const existingUsage = existingLeaves?.reduce(
        (acc, leave) => {
          const leaveYear = new Date(leave.start_date).getFullYear();
          if (leaveYear === currentYear) {
            acc.carryOver += leave.used_carry_over_days || 0;
            acc.currentYear += leave.used_current_year_days || 0;
            acc.twoYearsAgo += leave.used_n2_year || 0;
          }
          return acc;
        },
        { carryOver: 0, currentYear: 0, twoYearsAgo: 0 }
      ) || { carryOver: 0, currentYear: 0, twoYearsAgo: 0 };

      console.log("Existing usage:", existingUsage);

      // Hitung saldo yang tersisa
      const remainingTwoYearsAgo = Math.max(0, twoYearsAgoBalance - existingUsage.twoYearsAgo);
      const remainingCarryOver = Math.max(0, carryOverBalance - existingUsage.carryOver);
      const remainingCurrentYear = Math.max(0, currentYearBalance - existingUsage.currentYear);

      // Reset nilai penggunaan
      usedTwoYearsAgo = 0;
      usedCarryOver = 0;
      usedCurrentYear = 0;

      // Gunakan saldo 2 tahun lalu terlebih dahulu (jika ada)
      if (remainingTwoYearsAgo > 0) {
        usedTwoYearsAgo = Math.min(remainingTwoYearsAgo, workingDays);
      }

      // Kemudian gunakan saldo tahun lalu (jika ada)
      if (remainingCarryOver > 0 && usedTwoYearsAgo < workingDays) {
        const remainingDays = workingDays - usedTwoYearsAgo;
        usedCarryOver = Math.min(remainingCarryOver, remainingDays);
      }

      // Terakhir gunakan saldo tahun ini
      const totalUsed = usedTwoYearsAgo + usedCarryOver;
      if (totalUsed < workingDays) {
        usedCurrentYear = workingDays - totalUsed;
      }
    }

    console.log("Leave balance calculation:", {
      currentYear,
      previousYear,
      twoYearsAgo,
      currentYearBalance,
      carryOverBalance,
      twoYearsAgoBalance,
      workingDays,
      usedTwoYearsAgo,
      usedCarryOver,
      usedCurrentYear,
      totalUsed: usedTwoYearsAgo + usedCarryOver + usedCurrentYear,
      dataFromFrontend: {
        used_n2_year: leaveRequestData.used_n2_year,
        used_carry_over_days: leaveRequestData.used_carry_over_days,
        used_current_year_days: leaveRequestData.used_current_year_days,
      },
    });

    // Validasi saldo cuti hanya untuk Cuti Tahunan
    if (leaveRequestData.type === "Cuti Tahunan") {
      const totalSaldo = twoYearsAgoBalance + carryOverBalance + currentYearBalance;
      const totalUsed = usedTwoYearsAgo + usedCarryOver + usedCurrentYear;

      if (totalUsed > totalSaldo) {
        return NextResponse.json(
          {
            error: "Insufficient leave balance",
            details: `Saldo cuti tidak mencukupi. Total saldo: ${totalSaldo} hari, permintaan: ${workingDays} hari`,
          },
          { status: 400 }
        );
      }

      // Validasi bahwa total penggunaan sama dengan workingDays
      if (totalUsed !== workingDays) {
        return NextResponse.json(
          {
            error: "Invalid leave usage",
            details: `Total penggunaan saldo (${totalUsed} hari) tidak sama dengan hari kerja (${workingDays} hari)`,
          },
          { status: 400 }
        );
      }

      // Potong saldo cuti di tabel pegawai hanya untuk Cuti Tahunan
      const updatedLeaveBalance = { ...leaveBalance };

      // Potong saldo 2 tahun lalu jika digunakan
      if (usedTwoYearsAgo > 0) {
        const twoYearsAgoStr = twoYearsAgo.toString();
        updatedLeaveBalance[twoYearsAgoStr] = Math.max(
          0,
          (updatedLeaveBalance[twoYearsAgoStr] || 0) - usedTwoYearsAgo
        );
      }

      // Potong saldo carry over jika digunakan
      if (usedCarryOver > 0) {
        const prevYearStr = previousYear.toString();
        updatedLeaveBalance[prevYearStr] = Math.max(
          0,
          (updatedLeaveBalance[prevYearStr] || 0) - usedCarryOver
        );
      }

      // Potong saldo tahun berjalan
      if (usedCurrentYear > 0) {
        const currentYearStr = currentYear.toString();
        updatedLeaveBalance[currentYearStr] = Math.max(
          0,
          (updatedLeaveBalance[currentYearStr] || 12) - usedCurrentYear
        );
      }

      // Update saldo di tabel pegawai
      const { error: updateBalanceError } = await supabaseAdmin
        .from("pegawai")
        .update({ leave_balance: updatedLeaveBalance })
        .eq("id", leaveRequestData.user_id);

      if (updateBalanceError) {
        console.error("Error updating leave balance:", updateBalanceError);
        return NextResponse.json(
          {
            error: "Failed to update leave balance",
            details: updateBalanceError.message,
          },
          { status: 500 }
        );
      }
    } else {
      // Untuk cuti selain Cuti Tahunan, set semua penggunaan saldo ke 0
      usedTwoYearsAgo = 0;
      usedCarryOver = 0;
      usedCurrentYear = 0;
    }

    // Insert leave request into database using admin client
    const insertData = {
      id: leaveRequestId,
      ...leaveRequestData,
      saldo_carry: leaveRequestData.type === "Cuti Tahunan" ? carryOverBalance : 0,
      saldo_current_year: leaveRequestData.type === "Cuti Tahunan" ? currentYearBalance : 0,
      saldo_n2_year: leaveRequestData.type === "Cuti Tahunan" ? twoYearsAgoBalance : 0,
      created_at: new Date().toISOString(),
      used_carry_over_days: usedCarryOver,
      used_current_year_days: usedCurrentYear,
      used_n2_year: usedTwoYearsAgo,
      leave_year: currentYear,
      file_lampiran: leaveRequestData.file_lampiran,
    };

    console.log("Data yang akan disimpan ke database:", {
      id: insertData.id,
      user_id: insertData.user_id,
      workingdays: insertData.workingdays,
      used_n2_year: insertData.used_n2_year,
      used_carry_over_days: insertData.used_carry_over_days,
      used_current_year_days: insertData.used_current_year_days,
      saldo_n2_year: insertData.saldo_n2_year,
      saldo_carry: insertData.saldo_carry,
      saldo_current_year: insertData.saldo_current_year,
      total_used:
        insertData.used_n2_year +
        insertData.used_carry_over_days +
        insertData.used_current_year_days,
    });

    const { data, error } = await supabaseAdmin
      .from("leave_requests")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error menyimpan permintaan cuti:", error);
      return NextResponse.json(
        {
          error: "Failed to create leave request",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    console.log("Permintaan cuti berhasil dibuat:", data);
    return NextResponse.json(
      { message: "Leave request created successfully", leaveRequest: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create leave request error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { leaveRequestId, action, type, rejectionReason, signatureDate, signed } = body;

    console.log("PATCH request received with data:", {
      leaveRequestId,
      action,
      type,
      rejectionReason: rejectionReason ? "provided" : "not provided",
      signatureDate: signatureDate ? "provided" : "not provided",
      signed,
    });

    if (!leaveRequestId || !action || !type) {
      const missingFields = [];
      if (!leaveRequestId) missingFields.push("leaveRequestId");
      if (!action) missingFields.push("action");
      if (!type) missingFields.push("type");

      console.error("Missing required fields:", missingFields.join(", "));
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: `Missing: ${missingFields.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized");
    }

    // Fetch current leave request
    console.log("Fetching leave request with ID:", leaveRequestId);
    const { data: currentRequest, error: fetchError } = await supabaseAdmin
      .from("leave_requests")
      .select(
        `
        *,
        requester:user_id (
          id,
          name,
          email,
          position,
          workunit,
          nip,
          address,
          phone,
          masa_kerja
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
      `
      )
      .eq("id", leaveRequestId)
      .single();

    if (fetchError) {
      console.error("Error fetching leave request:", {
        error: fetchError,
        leaveRequestId,
        message: fetchError.message,
        code: fetchError.code,
      });
      return NextResponse.json(
        {
          error: "Leave request not found",
          details: fetchError.message,
          code: fetchError.code,
        },
        { status: 404 }
      );
    }

    if (!currentRequest) {
      console.error("Leave request not found with ID:", leaveRequestId);
      return NextResponse.json(
        { error: "Leave request not found", details: "No data returned from database" },
        { status: 404 }
      );
    }

    // Check if user has permission to approve/reject
    const isSupervisor = currentRequest.supervisor_id === payload.id;
    const isAuthorizedOfficer = currentRequest.authorized_officer_id === payload.id;

    if (!isSupervisor && !isAuthorizedOfficer && payload.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized to perform this action" },
        { status: 403 }
      );
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

        // Kembalikan saldo cuti ketika ditolak oleh supervisor
        await restoreLeaveBalance(currentRequest);
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
              saldo_n2_tahun: currentRequest.saldo_n2_year || 0,
              n2_tahun: currentRequest.used_n2_year || 0,
              n1_tahun: currentRequest.used_carry_over_days || 0,
              ntahun: currentRequest.used_current_year_days || 0,
              masa_kerja: currentRequest.requester?.masa_kerja || "",
              nama_supervisor: currentRequest.supervisor?.name || "",
              nip_supervisor: currentRequest.supervisor?.nip || "",
              nama_officier: currentRequest.authorized_officer?.name || "",
              nip_officier: currentRequest.authorized_officer?.nip || "",
              created_at: currentRequest.created_at,
              alamat: currentRequest.requester?.address || currentRequest.address || "",
              telp: currentRequest.requester?.phone || currentRequest.phone || "",
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
              keepalive: true,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Google Script returned error:", {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
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

        // Kembalikan saldo cuti ketika ditolak oleh authorized officer
        await restoreLeaveBalance(currentRequest);
      }
    }

    // Update status permintaan cuti
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized");
    }

    const { error: updateError } = await supabaseAdmin
      .from("leave_requests")
      .update(updateData)
      .eq("id", leaveRequestId);

    if (updateError) {
      console.error("Error updating leave request:", updateError);
      return NextResponse.json({ error: "Failed to update leave request" }, { status: 500 });
    }

    return NextResponse.json({ message: "Leave request updated successfully" });
  } catch (error) {
    console.error("Error in PATCH /api/leave-requests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Tambahkan fungsi helper untuk mengembalikan saldo cuti
async function restoreLeaveBalance(leaveRequest: any) {
  try {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin client not initialized");
    }

    // Ambil data pegawai
    const { data: userData, error: userError } = await supabaseAdmin
      .from("pegawai")
      .select("leave_balance")
      .eq("id", leaveRequest.user_id)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user data for balance restoration:", userError);
      return;
    }

    const leaveBalance = userData.leave_balance || {};
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const twoYearsAgo = currentYear - 2;

    // Kembalikan saldo yang telah digunakan
    const updatedLeaveBalance = { ...leaveBalance };

    // Kembalikan saldo 2 tahun lalu
    if (leaveRequest.used_n2_year > 0) {
      const twoYearsAgoStr = twoYearsAgo.toString();
      updatedLeaveBalance[twoYearsAgoStr] =
        (updatedLeaveBalance[twoYearsAgoStr] || 0) + leaveRequest.used_n2_year;
    }

    // Kembalikan saldo carry over (tahun lalu)
    if (leaveRequest.used_carry_over_days > 0) {
      const prevYearStr = previousYear.toString();
      updatedLeaveBalance[prevYearStr] =
        (updatedLeaveBalance[prevYearStr] || 0) + leaveRequest.used_carry_over_days;
    }

    // Kembalikan saldo tahun berjalan
    if (leaveRequest.used_current_year_days > 0) {
      const currentYearStr = currentYear.toString();
      updatedLeaveBalance[currentYearStr] =
        (updatedLeaveBalance[currentYearStr] || 0) + leaveRequest.used_current_year_days;
    }

    // Update saldo di database
    const { error: updateError } = await supabaseAdmin
      .from("pegawai")
      .update({ leave_balance: updatedLeaveBalance })
      .eq("id", leaveRequest.user_id);

    if (updateError) {
      console.error("Error restoring leave balance:", updateError);
    } else {
      console.log("Leave balance restored successfully for user:", leaveRequest.user_id);
    }
  } catch (error) {
    console.error("Error in restoreLeaveBalance:", error);
  }
}
