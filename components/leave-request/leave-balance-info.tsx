"use client"

import { useAuth } from "@/lib/auth-context"
import { LeaveRequest } from "@/lib/types"
import React, { useMemo } from "react"

interface LeaveBalanceInfoProps {
  workingDays: number;
  leaveType: string;
  userId?: number;
  mode?: "create" | "view" | "approve";
  selectedLeaveBalance?: "twoYearsAgo" | "carryOver" | "current";
  usedTwoYearsAgo?: number;
  usedPrevYear?: number;
  usedCurrentYear?: number;
}

export function LeaveBalanceInfo({
  workingDays,
  leaveType,
  userId,
  mode = "create",
  selectedLeaveBalance = "current",
  usedTwoYearsAgo = 0,
  usedPrevYear = 0,
  usedCurrentYear = 0,
}: LeaveBalanceInfoProps) {
  const { users } = useAuth();

  // Hanya tampilkan untuk Cuti Tahunan dan mode create
  if (leaveType !== "Cuti Tahunan" || mode !== "create") {
    return null;
  }

  // Cari data user
  const user = users.find((u) => u.id === userId);
  if (!user || !user.leave_balance) {
    return (
      <div className="text-sm text-gray-500 italic">
        Data saldo cuti tidak tersedia
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const twoYearsAgo = currentYear - 2;

  // Ambil saldo dari leave_balance di tabel pegawai
  // Sesuaikan dengan logika backend: default current year ke 12, cap previous years ke 6
  const currentYearBalance = user.leave_balance[currentYear.toString()];
  const previousYearBalance = Math.min(6, user.leave_balance[previousYear.toString()] || 0);
  const twoYearsAgoBalance = Math.min(6, user.leave_balance[twoYearsAgo.toString()] || 0);
  const totalBalance = currentYearBalance + previousYearBalance + twoYearsAgoBalance;

  // Gunakan input manual jika ada
  let deductionFromTwoYearsAgo = usedTwoYearsAgo;
  let deductionFromPrevYear = usedPrevYear;
  let deductionFromCurrentYear = usedCurrentYear;

  // Jika input manual tidak ada (semua 0), fallback ke selectedLeaveBalance
  if (deductionFromTwoYearsAgo + deductionFromPrevYear + deductionFromCurrentYear === 0 && workingDays > 0) {
     switch (selectedLeaveBalance) {
      case 'twoYearsAgo':
        if (twoYearsAgoBalance > 0) {
          deductionFromTwoYearsAgo = Math.min(twoYearsAgoBalance, workingDays);
        }
        break;
      case 'carryOver':
        if (previousYearBalance > 0) {
          deductionFromPrevYear = Math.min(previousYearBalance, workingDays);
        }
        break;
      case 'current':
        if (currentYearBalance > 0) {
          deductionFromCurrentYear = Math.min(currentYearBalance, workingDays);
        }
        break;
    }
  }

  // Hitung sisa saldo setelah pengurangan
  const remainingAfterDeduction = {
    remainingTwoYearsAgo: Math.max(0, twoYearsAgoBalance - deductionFromTwoYearsAgo),
    remainingCarryOver: Math.max(0, previousYearBalance - deductionFromPrevYear),
    remainingCurrentYear: Math.max(0, currentYearBalance - deductionFromCurrentYear),
  };

  const totalRemaining = remainingAfterDeduction.remainingTwoYearsAgo +
                        remainingAfterDeduction.remainingCarryOver +
                        remainingAfterDeduction.remainingCurrentYear;

  // Check if balance is sufficient
  const isBalanceSufficient = totalBalance >= workingDays;

  return (
    <div className="space-y-4">
      {/* Show leave balance info when Annual Leave is selected */}
      {leaveType === "Cuti Tahunan" && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-800">Informasi Saldo Cuti Tahunan</h4>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-blue-600">Saldo Tahun {currentYear}:</span>
              <span className="ml-1 font-medium">{currentYearBalance} hari</span>
            </div>
            <div>
              <span className="text-blue-600">Saldo Tahun N-1 ({previousYear}):</span>
              <span className="ml-1 font-medium">{previousYearBalance} hari</span>
            </div>
            <div>
              <span className="text-blue-600">Saldo Tahun N-2 ({twoYearsAgo}):</span>
              <span className="ml-1 font-medium">{twoYearsAgoBalance} hari</span>
            </div>
            <div>
              <span className="text-blue-600">Total Saldo:</span>
              <span className="ml-1 font-medium">{totalBalance} hari</span>
            </div>
          </div>
        </div>
      )}

      {/* Warning message when balance is insufficient */}
      {leaveType === "Cuti Tahunan" && !isBalanceSufficient && workingDays > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">
              Saldo cuti tidak mencukupi! Sisa saldo {totalBalance} hari, permintaan {workingDays} hari
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-sm font-medium">Saldo Awal</div>
          <div className="text-xs text-gray-500"> ... {currentYearBalance} hari Tahun N-{currentYear}</div>
          {previousYearBalance > 0 && (
            <div className="text-xs text-gray-500">
              + {previousYearBalance} hari Tahun N-1 dari {previousYear}
            </div>
          )}
          {twoYearsAgoBalance > 0 && (
            <div className="text-xs text-gray-500">
              + {twoYearsAgoBalance} hari Tahun N-2 dari {twoYearsAgo}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-medium">Rencana Penggunaan</div>
          <div className="mt-1">
            <div className="font-medium">{workingDays} hari total</div>
            {leaveType === "Cuti Tahunan" && workingDays > 0 && (
              <>
                {deductionFromTwoYearsAgo > 0 && (
                  <div className="text-xs text-gray-500">
                    {deductionFromTwoYearsAgo} hari dari saldo {twoYearsAgo}
                  </div>
                )}
                {deductionFromPrevYear > 0 && (
                <div className="text-xs text-gray-500">
                  {deductionFromPrevYear} hari dari saldo {previousYear}
                </div>
                )}
                {deductionFromCurrentYear > 0 && (
                <div className="text-xs text-gray-500">
                  {deductionFromCurrentYear} hari dari saldo {currentYear}
                </div>
                )}
              </>
            )}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Saldo Setelah Cuti</div>
          <div className="mt-1">
            <div className="font-medium">{totalRemaining} hari total</div>
            {leaveType === "Cuti Tahunan" && workingDays > 0 && (
              <>
                {remainingAfterDeduction.remainingTwoYearsAgo > 0 && (
                  <div className="text-xs text-gray-500">
                    {remainingAfterDeduction.remainingTwoYearsAgo} hari dari {twoYearsAgo}
                  </div>
                )}
                {remainingAfterDeduction.remainingCarryOver > 0 && (
                <div className="text-xs text-gray-500">
                  {remainingAfterDeduction.remainingCarryOver} hari dari {previousYear}
                </div>
                )}
                {remainingAfterDeduction.remainingCurrentYear > 0 && (
                <div className="text-xs text-gray-500">
                  {remainingAfterDeduction.remainingCurrentYear} hari dari {currentYear}
                </div>
                )}
              </>
            )}
            {leaveType !== "Cuti Tahunan" && (
              <span className="text-xs text-gray-500 block">(Tidak ada pengurangan untuk {leaveType})</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
