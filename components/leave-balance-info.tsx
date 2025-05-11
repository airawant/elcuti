"use client"

import { useAuth } from "@/lib/auth-context"

interface LeaveBalanceInfoProps {
  initialBalance: number
  carryOverBalance: number
  remainingCarryOverBalance: number
  remainingCurrentYearBalance: number
  remainingBalance: number
  workingDays: number
  leaveType: string
  userId?: number
}

export function LeaveBalanceInfo({
  initialBalance,
  carryOverBalance,
  remainingCarryOverBalance,
  remainingCurrentYearBalance,
  remainingBalance,
  workingDays,
  leaveType,
  userId,
}: LeaveBalanceInfoProps) {
  const { calculateLeaveDeduction } = useAuth()

  // Calculate leave balance after deduction
  const calculateRemainingLeaveAfterDeduction = () => {
    // Only deduct from leave balance if it's Annual Leave
    if (leaveType === "Cuti Tahunan" && userId) {
      const deduction = calculateLeaveDeduction(userId, workingDays)
      return {
        remainingCarryOver: deduction.remainingCarryOver,
        remainingCurrentYear: deduction.remainingCurrentYear,
        totalRemaining: deduction.totalRemaining,
        sufficientBalance: deduction.sufficientBalance,
      }
    }
    // For other leave types, no deduction
    return {
      remainingCarryOver: remainingCarryOverBalance,
      remainingCurrentYear: remainingCurrentYearBalance,
      totalRemaining: remainingBalance,
      sufficientBalance: true,
    }
  }

  const deductionResult = userId
    ? calculateRemainingLeaveAfterDeduction()
    : {
        remainingCarryOver: remainingCarryOverBalance,
        remainingCurrentYear: remainingCurrentYearBalance,
        totalRemaining: remainingBalance,
        sufficientBalance: true,
      }

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1

  return (
    <div className="space-y-4">
      {/* Show leave balance info when Annual Leave is selected */}
      {leaveType === "Cuti Tahunan" && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-800">Informasi Saldo Cuti Tahunan</h4>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-blue-600">Saldo Tahun {currentYear}:</span>
              <span className="ml-1 font-medium">{initialBalance} hari</span>
            </div>
            <div>
              <span className="text-blue-600">Saldo Tahun N-1 ({previousYear}):</span>
              <span className="ml-1 font-medium">{carryOverBalance} hari</span>
            </div>
            <div>
              <span className="text-blue-600">Total Saldo:</span>
              <span className="ml-1 font-medium">{remainingBalance} hari</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-sm font-medium">Saldo Awal</div>
          <div className="mt-1 font-medium">{initialBalance} hari</div>
          {carryOverBalance > 0 && (
            <div className="text-xs text-gray-500">
              + {carryOverBalance} hari Tahun N-1 dari {previousYear}
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-medium">Sisa Cuti</div>
          <div className="mt-1">
            <div className="font-medium">{remainingBalance} hari total</div>
            {leaveType === "Cuti Tahunan" && (
              <>
                <div className="text-xs text-gray-500">
                  {remainingCarryOverBalance} hari dari {previousYear}
                </div>
                <div className="text-xs text-gray-500">
                  {remainingCurrentYearBalance} hari dari {currentYear}
                </div>
              </>
            )}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">Saldo Setelah Cuti</div>
          <div className="mt-1">
            <div className="font-medium">{deductionResult.totalRemaining} hari total</div>
            {leaveType === "Cuti Tahunan" && (
              <>
                <div className="text-xs text-gray-500">
                  {deductionResult.remainingCarryOver} hari dari {previousYear}
                </div>
                <div className="text-xs text-gray-500">
                  {deductionResult.remainingCurrentYear} hari dari {currentYear}
                </div>
                {!deductionResult.sufficientBalance && (
                  <div className="text-xs text-red-500 font-medium mt-1">Saldo cuti tidak mencukupi!</div>
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
  )
}
