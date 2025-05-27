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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { LeaveRequest } from "@/lib/types";

export default function DashboardPage() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, leaveRequests, getUnviewedRequestsCount } = useAuth();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
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
  const currentYear = new Date().getFullYear().toString();
  const previousYear = (new Date().getFullYear() - 1).toString();

  // Hitung penggunaan cuti dari tabel leave_requests
  const getUsedLeaveDays = () => {
    const usedLeave = {
      carryOver: 0,
      currentYear: 0,
      total: 0,
    };

    leaveRequests
      .filter(
        (req) =>
          req.user_id === user.id && req.type === "Cuti Tahunan" && req.status !== "Rejected" // Hanya hitung yang Pending atau Approved
      )
      .forEach((req) => {
        usedLeave.carryOver += req.used_carry_over_days || 0;
        usedLeave.currentYear += req.used_current_year_days || 0;
      });

    usedLeave.total = usedLeave.carryOver + usedLeave.currentYear;
    return usedLeave;
  };

  const usedLeaveDays = getUsedLeaveDays();

  // Hitung sisa saldo aktual
  const getRemainingBalance = () => {
    const saldoTahunLalu = user.leave_balance?.[previousYear] || 0;
    const saldoTahunIni = user.leave_balance?.[currentYear] || 0;

    return {
      carryOver: Math.max(0, saldoTahunLalu),
      currentYear: Math.max(0, saldoTahunIni),
      total: Math.max(0, saldoTahunLalu) + Math.max(0, saldoTahunIni),
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
        <Header title="ELCUTI - Elektronik Cuti" onMenuClick={() => setIsMobileOpen(true)} />

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

          <div className="grid gap-4 md:grid-cols-3">
            {/* Card Saldo Carry-Over */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500">Saldo Cuti N-1 Tahun</h3>
              <div className="text-3xl font-bold">{remainingBalance.carryOver} hari</div>
              <div className="text-sm text-gray-500">Dari Tahun {previousYear}</div>
              <div className="mt-2">
                <div className="text-sm text-red-500">
                  Terpakai/Diproses: {usedLeaveDays.carryOver} hari
                </div>
                {/* <div className="text-sm text-green-500">
                  Sisa Aktual:{" "}
                  {Math.max(0, remainingBalance.carryOver - usedLeaveDays.carryOver)} hari
                </div> */}
              </div>
            </div>

            {/* Card Saldo Cuti Tahun Berjalan */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500">Saldo Cuti Tahun Ini</h3>
              <div className="text-3xl font-bold">{remainingBalance.currentYear} hari</div>
              <div className="text-sm text-gray-500">Tahun {currentYear}</div>
              <div className="mt-2">
                <div className="text-sm text-red-500">
                  Terpakai/Diproses: {usedLeaveDays.currentYear} hari
                </div>
                {/* <div className="text-sm text-green-500">
                  Sisa Aktual:{" "}
                  {Math.max(0, remainingBalance.currentYear - usedLeaveDays.currentYear)} hari
                </div> */}
              </div>
            </div>

            {/* Card Total Sisa Cuti */}
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500">Total Saldo Cuti</h3>
              <div className="text-3xl font-bold">
                {remainingBalance.total} hari
              </div>
              <div className="text-sm text-gray-500">Total Tersedia</div>
              <div className="mt-2">
                <div className="text-sm text-red-500">
                  Total Terpakai/Diproses: {usedLeaveDays.total} hari
                </div>
                {/* <div className="text-sm text-green-500">
                  Sisa Aktual: {Math.max(0, remainingBalance.total - usedLeaveDays.total)} hari
                </div> */}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {leaveTypes.map((type) => (
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
