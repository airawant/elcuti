"use client"

import { useAuth } from "@/lib/auth-context"
import { LeaveRequest } from "@/lib/types"
import React, { useMemo } from "react"

interface LeaveBalanceInfoProps {
  initialBalance: number
  carryOverBalance: number
  remainingCarryOverBalance: number
  remainingCurrentYearBalance: number
  remainingBalance: number
  workingdays: number
  leaveType: string
  userId: number | undefined
}

interface YearlyUsage {
  carryOver: number
  current: number
}

export function LeaveBalanceInfo({
  initialBalance,
  carryOverBalance,
  remainingCarryOverBalance,
  remainingCurrentYearBalance,
  remainingBalance,
  workingdays,
  leaveType,
  userId,
}: LeaveBalanceInfoProps) {
  const { leaveRequests, users } = useAuth();
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Dapatkan data pegawai dari users
  const userData = useMemo(() => {
    return users.find(u => u.id === userId);
  }, [users, userId]);

  // Ambil saldo cuti dari leave_balance
  const leaveBalance = useMemo(() => {
    if (!userData || !userData.leave_balance) return {
      current: initialBalance,
      carryOver: carryOverBalance
    };

    return {
      current: userData.leave_balance[currentYear.toString()] || 0,
      carryOver: userData.leave_balance[previousYear.toString()] || 0
    };
  }, [userData, initialBalance, carryOverBalance, currentYear, previousYear]);

  // Hitung penggunaan cuti tahun ini
  const currentYearUsage = useMemo<YearlyUsage>(() => {
    if (!userId || !Array.isArray(leaveRequests)) {
      return { carryOver: 0, current: 0 };
    }

    // Pastikan leaveRequests adalah array dari LeaveRequest
    const typedLeaveRequests = leaveRequests as LeaveRequest[];

    const approvedRequests = typedLeaveRequests.filter((req) =>
      req.user_id === userId &&
      req.status === "Approved" &&
      req.leave_year === currentYear
    );

    return approvedRequests.reduce((acc: YearlyUsage, req) => ({
      carryOver: acc.carryOver + (req.used_carry_over_days || 0),
      current: acc.current + (req.used_current_year_days || 0),
    }), { carryOver: 0, current: 0 });
  }, [userId, leaveRequests, currentYear]);

  // Hitung sisa saldo
  const remainingLeaveBalance = useMemo(() => {
    const remainingCarryOver = Math.max(0, leaveBalance.carryOver - currentYearUsage.carryOver);
    const remainingCurrent = Math.max(0, leaveBalance.current - currentYearUsage.current);
    return {
      carryOver: remainingCarryOver,
      current: remainingCurrent,
      total: remainingCarryOver + remainingCurrent
    };
  }, [leaveBalance, currentYearUsage]);

  // Calculate leave balance after deduction
  const calculateRemainingLeaveAfterDeduction = () => {
    // Only deduct from leave balance if it's Annual Leave
    if (leaveType === "Cuti Tahunan") {
      return Math.max(0, remainingLeaveBalance.total - workingdays);
    }
    // For other leave types, no deduction
    return remainingLeaveBalance.total;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Saldo Tahun N-1 ({previousYear})</h4>
          <div className="flex justify-between text-sm font-medium">
            <span>Total Saldo:</span>
            <span>{leaveBalance.carryOver} hari</span>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Saldo Tahun {currentYear}</h4>
          <div className="flex justify-between text-sm font-medium">
            <span>Total Saldo:</span>
            <span>{leaveBalance.current} hari</span>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-sm font-medium">Total Saldo Cuti</h4>
            <p className="text-xs text-gray-500">Saldo yang dapat digunakan</p>
          </div>
          <div className="text-2xl font-bold">{remainingLeaveBalance.total} hari</div>
        </div>
      </div>

      {leaveType === "Cuti Tahunan" && workingdays > remainingLeaveBalance.total && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-700">
            Saldo cuti tidak mencukupi untuk permintaan ini ({workingdays} hari).
          </p>
        </div>
      )}
    </div>
  )
}
