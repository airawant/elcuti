"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { LeaveCard } from "@/components/leave-card";
import { LeaveCalendar } from "@/components/leave-calendar";
import { useAuth } from "@/lib/auth-context";
import { leaveTypes } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LeaveBalanceCard } from "@/components/leave-balance-card";
import Link from "next/link";
import type { LeaveRequest } from "@/lib/types";

export default function DashboardPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, leaveRequests, getUnviewedRequestsCount } = useAuth();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
    console.log(user);
    if (!user) {
      router.push("/login");
    } else if (user.role === "admin") {
      router.push("/admin/dashboard");
    }
  }, [user, router]);

  if (!user || user.role !== "user") {
    return null;
  }

  // Calculate leave counts by type
  const getLeaveCounts = () => {
    const counts: Record<string, number> = {
      sick: 0,
      maternity: 0,
      unpaid: 0,
      annual: 0,
      important: 0,
      extended: 0,
    };

    leaveRequests
      .filter((req) => req.user_id === user.id && req.status === "Approved")
      .forEach((req) => {
        if (req.type === "Cuti Sakit") counts.sick++;
        else if (req.type === "Cuti Melahirkan") counts.maternity++;
        else if (req.type === "Cuti Di Luar Tanggungan Negara") counts.unpaid++;
        else if (req.type === "Cuti Tahunan") counts.annual++;
        else if (req.type === "Cuti Alasan Penting") counts.important++;
        else if (req.type === "Cuti Besar") counts.extended++;
      });

    return counts;
  };

  const leaveCounts = getLeaveCounts();

  // Get count of unviewed requests
  const unviewedCount = getUnviewedRequestsCount();

  // Get current and previous year
  // Get current and previous years
  const currentYear = new Date().getFullYear().toString();
  const previousYear = (new Date().getFullYear() - 1).toString();
  const twoYearsAgo = (new Date().getFullYear() - 2).toString();

  // Hitung penggunaan cuti dari tabel leave_requests
  const getUsedLeaveDays = () => {
    const usedLeave = {
      twoYearsAgo: 0,
      carryOver: 0,
      currentYear: 0,
      total: 0,
    };

    const pendingLeave = {
      twoYearsAgo: 0,
      carryOver: 0,
      currentYear: 0,
      total: 0,
    };

    leaveRequests
      .filter(
        (req) =>
          req.user_id === user.id && req.type === "Cuti Tahunan" && req.status !== "Rejected"
      )
      .forEach((req) => {
        const twoYearsAgoUsed = req.used_n2_year || 0;
        const carryOverUsed = req.used_carry_over_days || 0;
        const currentYearUsed = req.used_current_year_days || 0;

        if (req.status === "Approved") {
          // Sudah terpakai (Approved)
          usedLeave.twoYearsAgo += twoYearsAgoUsed;
          usedLeave.carryOver += carryOverUsed;
          usedLeave.currentYear += currentYearUsed;
        } else if (req.status === "Pending") {
          // Sedang diproses (Pending)
          pendingLeave.twoYearsAgo += twoYearsAgoUsed;
          pendingLeave.carryOver += carryOverUsed;
          pendingLeave.currentYear += currentYearUsed;
        }
      });

    usedLeave.total = usedLeave.twoYearsAgo + usedLeave.carryOver + usedLeave.currentYear;
    pendingLeave.total =
      pendingLeave.twoYearsAgo + pendingLeave.carryOver + pendingLeave.currentYear;

    return { usedLeave, pendingLeave };
  };

  const { usedLeave, pendingLeave } = getUsedLeaveDays();

  // Hitung sisa saldo aktual langsung dari tabel pegawai (leave_balance)
  const getRemainingBalance = () => {
    const saldoTahunLalu = user.leave_balance?.[previousYear] || 0;
    const saldoTahunIni = user.leave_balance?.[currentYear] || 0;
    const saldoDuaTahunLalu = user.leave_balance?.[twoYearsAgo] || 0;

    return {
      twoYearsAgo: Math.max(0, saldoDuaTahunLalu),
      carryOver: Math.max(0, saldoTahunLalu),
      currentYear: Math.max(0, saldoTahunIni),
      total:
        Math.max(0, saldoDuaTahunLalu) +
        Math.max(0, saldoTahunLalu) +
        Math.max(0, saldoTahunIni),
    };
  };

  const remainingBalance = getRemainingBalance();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <Header
          title="SIM C - Sistem Informasi Manajemen Cuti"
          onMenuClick={() => setIsMobileOpen(true)}
        />

        <main className="p-4 md:p-6 space-y-6">
          {/* Show notification for users with pending requests to approve */}
          {unviewedCount > 0 && (user.isapprover || user.isauthorizedofficer) && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-blue-500" />
                  <div className="flex items-center gap-2 text-blue-700">
                    <span>Anda memiliki</span>
                    <Badge className="bg-blue-500">{unviewedCount}</Badge>
                    <span>permintaan cuti baru yang perlu ditinjau.</span>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Link href="/request-approval">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Tinjau Sekarang
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            {/* Card Saldo N-2 Tahun */}
            <LeaveBalanceCard
              title={`Saldo Cuti ${twoYearsAgo}`}
              balance={remainingBalance.twoYearsAgo}
              type="twoYearsAgo"
              used={usedLeave.twoYearsAgo}
              pending={pendingLeave.twoYearsAgo}
            />

            {/* Card Saldo Carry-Over */}
            <LeaveBalanceCard
              title={`Saldo Cuti ${previousYear}`}
              balance={remainingBalance.carryOver}
              type="carryOver"
              used={usedLeave.carryOver}
              pending={pendingLeave.carryOver}
            />

            {/* Card Saldo Tahun Berjalan */}
            <LeaveBalanceCard
              title={`Saldo Cuti ${currentYear}`}
              balance={remainingBalance.currentYear}
              type="current"
              used={usedLeave.currentYear}
              pending={pendingLeave.currentYear}
            />

            {/* Card Total Saldo */}
            <Card className="overflow-hidden">
              <CardHeader className="p-4 bg-primary">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">Total Saldo Cuti</CardTitle>
                  <Calendar className="h-6 w-6 text-white" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-3xl font-bold">{remainingBalance.total}</div>
                <div className="text-sm text-gray-500">Hari Tersisa</div>

                {/* Informasi detail penggunaan (tanpa menghitung saldo sisa) */}
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-red-600">Sudah Terpakai:</span>
                    <span className="font-medium text-red-600">{usedLeave.total} hari</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-600">Sedang Diproses:</span>
                    <span className="font-medium text-yellow-600">
                      {pendingLeave.total} hari
                    </span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Digunakan:</span>
                      <span className="font-medium text-gray-800">
                        {usedLeave.total + pendingLeave.total} hari
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {leaveTypes
              .filter((type) => {
                // Hide specific leave types for PPPK users
                if (user.tipe_pengguna === "PPPK") {
                  const hiddenTypes = [
                    "Cuti Di Luar Tanggungan Negara",
                    "Cuti Karena Alasan Penting",
                    "Cuti Besar",
                  ];
                  return !hiddenTypes.includes(type.name);
                }
                return true;
              })
              .map((type) => (
                <LeaveCard
                  key={type.id}
                  title={type.name}
                  count={leaveCounts[type.id]}
                  type={type.id}
                />
              ))}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <LeaveCalendar />
          </div>
        </main>
      </div>
    </div>
  );
}
